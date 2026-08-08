import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { useServerFn } from "@tanstack/react-start";
import { ExperienceBadge, EXPERIENCE_LEVELS } from "@/components/ExperienceBadge";
import { supabase } from "@/integrations/supabase/client";
import { isStaleState } from "@/lib/game-state-sync";

import { spartanopsAckTeamChange, spartanopsSelectTeam } from "@/lib/spartanops-game.functions";
import { spartanopsUpsertCheckin, spartanopsGetMyCheckin, spartanopsDeleteMyCheckin, spartanopsGetParticipantRoster, spartanopsGetServerTime, spartanopsGetRespawnLock } from "@/lib/spartanops-checkin.functions";
import { spartanopsAcknowledgeWarning } from "@/lib/spartanops-spartacus.functions";
import { SpartacusAlerts } from "@/components/SpartanOpsConsole";
import { MissionRulesAccordion, MissionDescriptionCard, CollapsibleCard } from "@/components/MissionRulesAccordion";

import { OfflineBanner } from "@/components/OfflineBanner";
import { TacticalCompass } from "@/components/TacticalCompass";
import { Crosshair, Shield, Phone } from "lucide-react";
import { useLang, useT } from "@/lib/i18n";
import { HudNotificationStack, useHudNotices, fillTemplate } from "@/components/HudNotificationStack";
import { HudHistoryLog } from "@/components/HudHistoryLog";
import { appendDeathEvents, readDeathEvents, clearDeathEvents, type DeathEvent } from "@/lib/hud-history";
import { QRScanner, type ScanPayload } from "@/components/QRScanner";
import { useAmbientAudio } from "@/components/AmbientAudio";

import landingView from "@/assets/landing-view.webp.asset.json";

export const Route = createFileRoute("/misija")({
  head: () => ({
    meta: [{ title: "SpartanOps · Misija" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  validateSearch: (s: Record<string, unknown>) => {
    return {
      field: typeof s.field === "string" ? s.field : (typeof s.field_id === "string" ? s.field_id : "zeleni-raj"),
      point: typeof s.point === "string" || typeof s.point === "number" ? String(s.point) : undefined,
      preview: s.preview === "1" || s.preview === 1 || s.preview === true || s.preview === "true" ? true : false,
      marshal: s.marshal === "1" || s.marshal === 1 || s.marshal === true || s.marshal === "true" ? true : false,
      preset: typeof s.preset === "string" ? s.preset : undefined,
    };
  },

  component: MisijaPage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const TEAM_COLOR: Record<string, string> = {
  modra: "#3b82f6",
  rdeca: "#ef4444",
  rumena: "#eab308",
  none: "#666",
};
const TEAM_LABEL: Record<string, string> = {
  modra: "MODRA",
  rdeca: "RDEČA",
  rumena: "RUMENA",
};
const TEAM_LABEL_EN: Record<string, string> = {
  modra: "BLUE",
  rdeca: "RED",
  rumena: "YELLOW",
};
function teamName(team: string, settings: any, en: boolean): string {
  const custom = settings?.teamNames?.[team];
  if (typeof custom === "string" && custom.trim()) return custom.trim().toUpperCase();
  return (en ? TEAM_LABEL_EN[team] : TEAM_LABEL[team]) ?? team.toUpperCase();
}
const NODE_NAMES = ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"];
const NEUTRAL_NODE = "#ece3c4";
const FREE_NODES: Record<string, string | null> = { "1": null, "2": null, "3": null, "4": null, "5": null };
// Baseline: holding exactly 3 flags → reach `pointTarget` in 40 min (2400s).
// per-flag-per-second = pointTarget / 3 / 2400
function scoreRatePerNode(pointTarget: number | undefined) {
  const t = Math.max(1, pointTarget ?? 200);
  return t / 3 / 2400;
}

function computeDynamicScores(
  captures: Capture[],
  currentHolders: Record<string, string | null>,
  startMs: number | null,
  nowMs: number,
  matchEndMs: number | null,
  pointTarget: number | undefined,
): Record<string, number> {
  const scores: Record<string, number> = { modra: 0, rdeca: 0, rumena: 0 };
  if (!startMs) return scores;
  const tEnd = Math.min(nowMs, matchEndMs ?? nowMs);
  if (tEnd <= startMs) return scores;
  const rate = scoreRatePerNode(pointTarget);

  for (let node = 1; node <= 5; node++) {
    const nodeCaps = captures
      .filter((c) => c.point_number === node && new Date(c.captured_at).getTime() <= tEnd)
      .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime());
    let owner: string | null = null;
    let lastT = startMs;
    for (const cap of nodeCaps) {
      const t = Math.max(new Date(cap.captured_at).getTime(), startMs);
      if (owner && scores[owner] !== undefined) {
        scores[owner] += ((t - lastT) / 1000) * rate;
      }
      owner = cap.team;
      lastT = t;
    }
    const tailOwner = owner ?? currentHolders[String(node)] ?? null;
    if (tailOwner && scores[tailOwner] !== undefined && lastT < tEnd) {
      scores[tailOwner] += ((tEnd - lastT) / 1000) * rate;
    }
  }
  return scores;
}
const RANK_OPTIONS = EXPERIENCE_LEVELS.map((l) => ({
  v: l.value,
  label: l.labelSl,
  labelEn: l.labelEn,
  title: l.labelEn,
}));

const SESSION_KEY = "spartanops:session_id";
const GPS_FIX_KEY = "spartanops:gps_fix";

type RespawnSettings = {
  enabled: boolean;
  mode: "linear" | "dynamic";
  linearSec: number;
  dynStartMin: number;
  dynEndMin: number;
  visibility: "all" | "team";
  publicDeaths: boolean;
};
type GameSettings = {
  missionDescription?: string;
  missionName?: string;
  marshalName?: string;
  marshalPhone?: string;
  afterGameInstructions?: string;
  teamCount?: number;
  teamNames?: Record<string, string>;
  respawn?: RespawnSettings;
  capturePointsScoring?: boolean;
};
type GameState = {
  field_id?: string;
  field_label?: string | null;
  status: "closed" | "lobby" | "active" | "paused" | "ended";
  team_selection_open: boolean;
  current_polygon_name: string | null;
  event_name?: string | null;
  gamemode?: "domination" | "search_destroy" | null;
  compressed_map_url: string | null;
  countdown_seconds: number;
  match_started_at: string | null;
  match_duration_minutes: number;
  team_scores: Record<string, number>;
  node_holders: Record<string, string | null>;
  node_positions: Record<string, { x: number; y: number } | null>;
  point_target: number;
  winner_team: string | null;
  settings?: GameSettings | null;
  updated_at?: string;
};
type Checkin = {
  id: string;
  session_id?: string;
  callsign: string;
  club: string | null;
  experience_level: "slabo" | "dobro" | "zelo_dobro";
  assigned_team: "none" | "modra" | "rdeca" | "rumena";
  team_changed_flag: boolean;
  first_name?: string | null;
  last_initial?: string | null;
  warning_message?: string | null;
  death_count?: number | null;
  respawn_unlock_at?: string | null;
  operator_type?: string | null;

};
type Capture = {
  id: string;
  point_number: number;
  team: string;
  player_callsign: string | null;
  captured_at: string;
};

function nodeHoldersFromCaptures(captures: Capture[]): Record<string, string | null> {
  const holders: Record<string, string | null> = { ...FREE_NODES };
  [...captures]
    .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
    .forEach((capture) => {
      holders[String(capture.point_number)] = capture.team;
    });
  return holders;
}

function missionTitleFromState(state: GameState | null, fallback: string): string {
  const configured = state?.settings?.missionName;
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  if (state?.field_label?.trim()) return state.field_label.trim();
  if (state?.current_polygon_name?.trim()) return state.current_polygon_name.trim();
  return fallback;
}

function activeTeams(settings?: GameSettings | null): Array<"modra" | "rdeca" | "rumena"> {
  const count = Math.max(2, Math.min(3, Number(settings?.teamCount ?? 2)));
  return (["modra", "rdeca", "rumena"] as const).slice(0, count);
}

function fieldTitleFromState(state: GameState | null, fallback: string): string {
  if (state?.field_label?.trim()) return state.field_label.trim();
  if (state?.current_polygon_name?.trim()) return state.current_polygon_name.trim();
  return fallback;
}

function stateCacheKey(fieldId: string): string {
  return `spartanops:state-cache:${fieldId}`;
}
function rosterCacheKey(fieldId: string): string {
  return `spartanops:roster-cache:${fieldId}`;
}
function meCacheKey(fieldId: string, sessionId: string): string {
  return `spartanops:me-cache:${fieldId}:${sessionId}`;
}
function respawnLockKey(fieldId: string, sessionId: string): string {
  return `spartanops:respawn:${fieldId}:${sessionId}`;
}

/**
 * Cached game state older than this is only trusted for cosmetic fields
 * (map, description). Its `status` may describe a finished/previous match,
 * so the screen waits for the live row before choosing which phase to render.
 */
const STATE_CACHE_TTL_MS = 45_000;

function readCachedState(fieldId: string): { state: GameState; fresh: boolean } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(stateCacheKey(fieldId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "state" in parsed) {
      const at = Number((parsed as any).at ?? 0);
      return { state: (parsed as any).state as GameState, fresh: Date.now() - at < STATE_CACHE_TTL_MS };
    }
    // Legacy (unversioned) payload — treat as stale.
    return { state: parsed as GameState, fresh: false };
  } catch {
    return null;
  }
}

function writeCachedState(fieldId: string, state: GameState) {
  try {
    localStorage.setItem(stateCacheKey(fieldId), JSON.stringify({ at: Date.now(), state }));
  } catch { /* ignore */ }
}


function RankIcon({ level, size = 18 }: { level: Checkin["experience_level"]; size?: number }) {
  return <ExperienceBadge level={level} size={size} />;
}

function getOrMakeSession(): string {
  if (typeof window === "undefined") return "";
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

function toDbField(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (v === "zeleniraj" || v === "zeleni-raj") return "zeleni-raj";
  if (v === "field1" || v === "field-1") return "field-1";
  if (v === "field2" || v === "field-2") return "field-2";
  if (v === "field3" || v === "field-3") return "field-3";
  return v;
}

function makePreviewRoster(field: string, sessionId: string): Checkin[] {
  return [
    { id: `ghost-${sessionId}`, session_id: sessionId, callsign: "Kozjak_Marko", club: "Zeleni Raj", experience_level: "zelo_dobro", assigned_team: "modra", team_changed_flag: false, first_name: "Marko", last_initial: "K", death_count: 1, respawn_unlock_at: null },
    { id: `${field}-vipera`, callsign: "Vipera_07", club: "Spartan", experience_level: "dobro", assigned_team: "modra", team_changed_flag: false, first_name: "Ana", last_initial: "V", death_count: 3, respawn_unlock_at: new Date(Date.now() + 47_000).toISOString() },
    { id: `${field}-falcon`, callsign: "Ghost_Falcon", club: "Raven", experience_level: "zelo_dobro", assigned_team: "rdeca", team_changed_flag: false, first_name: "Tim", last_initial: "F", death_count: 2, respawn_unlock_at: null },
    { id: `${field}-nightshade`, callsign: "Nightshade", club: null, experience_level: "slabo", assigned_team: "rdeca", team_changed_flag: false, first_name: "Nika", last_initial: "N", death_count: 5, respawn_unlock_at: new Date(Date.now() + 22_000).toISOString() },
  ];
}

function makePreviewState(field: string, preset?: string): GameState {
  const now = Date.now();
  const active = preset === "hud" || preset === "paused";
  const prestart = preset === "prestart";
  return {
    field_id: field,
    field_label: "Zeleni Raj",
    status: preset === "paused" ? "paused" : active || prestart ? "active" : "lobby",
    team_selection_open: true,
    current_polygon_name: "Zeleni Raj",
    event_name: "Operation Fallen Angel",
    gamemode: "domination",
    compressed_map_url: landingView.url,
    countdown_seconds: 60,
    match_started_at: prestart ? new Date(now + 60_000).toISOString() : active ? new Date(now - 7 * 60_000).toISOString() : null,
    match_duration_minutes: 40,
    team_scores: { modra: 7, rdeca: 4, rumena: 0 },
    node_holders: { "1": "modra", "2": "rdeca", "3": null, "4": "modra", "5": null },
    node_positions: { "1": { x: 21, y: 28 }, "2": { x: 70, y: 25 }, "3": { x: 50, y: 50 }, "4": { x: 30, y: 72 }, "5": { x: 76, y: 74 } },
    point_target: 200,
    winner_team: null,
    settings: {
      missionName: "Operation Fallen Angel",
      missionDescription: "Secure and hold ALPHA and DELTA for a minimum of 6 minutes. Bravo team defends BETA at all costs.",
      teamCount: 2,
      teamNames: { modra: "ALPHA", rdeca: "BRAVO" },
      respawn: { enabled: true, mode: "linear", linearSec: 60, dynStartMin: 1, dynEndMin: 3, visibility: "all", publicDeaths: true },
      capturePointsScoring: true,
    },
  };
}

function makePreviewCaptures(): Capture[] {
  const base = Date.now() - 6 * 60_000;
  return [
    { id: "preview-c1", point_number: 1, team: "modra", player_callsign: "Kozjak_Marko", captured_at: new Date(base).toISOString() },
    { id: "preview-c2", point_number: 2, team: "rdeca", player_callsign: "Ghost_Falcon", captured_at: new Date(base + 75_000).toISOString() },
    { id: "preview-c3", point_number: 4, team: "modra", player_callsign: "Vipera_07", captured_at: new Date(base + 140_000).toISOString() },
  ];
}

function MisijaPage() {
  const { lang } = useLang();
  const t = useT();
  const en = lang === "en";
  const { field: rawField, point: targetPoint, preview, marshal: marshalMode, preset } = Route.useSearch();

  // Anti-cheat security alert: /scan sets this flag when a QR is opened
  // outside the in-app scanner. Surface a tactical warning on arrival.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("spartanops:security_alert")) {
        sessionStorage.removeItem("spartanops:security_alert");
        alert(t("scanner.securityAlert"));
      }
    } catch { /* ignore */ }
  }, [t]);

  const field = useMemo(() => toDbField(rawField), [rawField]);
  const ackFn = useServerFn(spartanopsAckTeamChange);
  const selectTeamFn = useServerFn(spartanopsSelectTeam);
  const getParticipantRosterFn = useServerFn(spartanopsGetParticipantRoster);
  const getServerTimeFn = useServerFn(spartanopsGetServerTime);
  const getRespawnLockFn = useServerFn(spartanopsGetRespawnLock);

  const [sessionId, setSessionId] = useState("");
  const [state, setState] = useState<GameState | null>(null);
  // True once a live game_state row has been read for this field. Until then a
  // stale cached snapshot must not decide which phase renders.
  const [stateFresh, setStateFresh] = useState(false);
  const [dbMe, setDbMe] = useState<Checkin | null>(null);
  // Null = still resolving. Prevents a flash of the deployment-registration
  // form for a player who is already checked in.
  const [meResolved, setMeResolved] = useState(false);
  const [ghostMe, setGhostMe] = useState<Checkin | null>(null);
  const [roster, setRoster] = useState<Checkin[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [showTeamSelect, setShowTeamSelect] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [respawnUntil, setRespawnUntil] = useState(0);
  const me = preview ? ghostMe : dbMe;
  const setMe = (v: Checkin | null) => (preview ? setGhostMe(v) : setDbMe(v));

  // Instant paint of the player's own check-in so returning from /capture or a
  // notification lands straight on the HUD instead of the registration form.
  useEffect(() => {
    if (preview || !sessionId) return;
    try {
      const raw = localStorage.getItem(meCacheKey(field, sessionId));
      if (raw) setDbMe((prev) => prev ?? (JSON.parse(raw) as Checkin));
    } catch { /* ignore */ }
  }, [field, sessionId, preview]);

  useEffect(() => {
    if (preview || !sessionId || !dbMe) return;
    try { localStorage.setItem(meCacheKey(field, sessionId), JSON.stringify(dbMe)); } catch { /* ignore */ }
  }, [dbMe, field, sessionId, preview]);


  const syncServerClock = async () => {
    const before = Date.now();
    const res = await getServerTimeFn();
    const after = Date.now();
    const serverMs = typeof (res as any).serverNow === "number" ? (res as any).serverNow : Date.parse(res.serverTime);
    if (!Number.isFinite(serverMs)) return;
    const nextOffset = Math.round((before + after) / 2 - serverMs);
    setServerOffset(nextOffset);
    setCurrentTime(after - nextOffset);
  };

  useEffect(() => {
    syncServerClock().catch(() => {});
  }, [getServerTimeFn]);

  useEffect(() => {
    if (state?.status !== "active" || !state.match_started_at) return;
    syncServerClock().catch(() => {});
    const timer = setInterval(() => syncServerClock().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [state?.status, state?.match_started_at, getServerTimeFn]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now() - serverOffset);
    }, 1000);
    setCurrentTime(Date.now() - serverOffset);
    return () => clearInterval(timer);
  }, [serverOffset]);

  useEffect(() => {
    setSessionId(preview ? `ghost-${Math.random().toString(36).slice(2)}` : getOrMakeSession());
  }, [preview]);

  useEffect(() => {
    if (!preview || !sessionId || !preset) return;
    const previewRoster = makePreviewRoster(field, sessionId);
    const primary = previewRoster[0];
    setState(makePreviewState(field, preset));
    setCaptures(makePreviewCaptures());
    setRoster(previewRoster);
    if (preset === "registration") {
      setGhostMe(null);
      setShowTeamSelect(false);
      return;
    }
    setGhostMe({ ...primary, assigned_team: preset === "team" ? "none" : "modra" });
    setShowTeamSelect(preset === "team");
  }, [preview, preset, field, sessionId]);

  useEffect(() => {
    if (!sessionId || preview) return;
    const key = respawnLockKey(field, sessionId);
    const readLocal = () => {
      try {
        const nowMs = Date.now() - serverOffset;
        const unlockAt = Number(localStorage.getItem(key) ?? 0);
        if (unlockAt > nowMs) setRespawnUntil(unlockAt);
        else {
          localStorage.removeItem(key);
          setRespawnUntil(0);
        }
      } catch { setRespawnUntil(0); }
    };
    const syncRemote = async () => {
      try {
        const lock = await getRespawnLockFn({ data: { fieldId: field, sessionId } });
        const unlockMs = lock?.unlockAt ? Date.parse(lock.unlockAt) : NaN;
        if (Number.isFinite(unlockMs) && unlockMs > Date.now() - serverOffset) {
          localStorage.setItem(key, String(unlockMs));
          setRespawnUntil(unlockMs);
        } else {
          readLocal();
        }
      } catch {
        readLocal();
      }
    };
    readLocal();
    syncRemote();
    const localTimer = setInterval(readLocal, 1000);
    // Only hammer the server while a respawn lock is actually running; idle
    // players fall back to a light 15s heartbeat. Keeps load flat at 30 players.
    const remoteTimer = setInterval(() => {
      let active = false;
      try { active = Number(localStorage.getItem(key) ?? 0) > Date.now() - serverOffset; } catch { /* ignore */ }
      if (active || Date.now() % 15000 < 1600) syncRemote();
    }, 1500);
    window.addEventListener("focus", syncRemote);
    window.addEventListener("pageshow", syncRemote);
    return () => {
      clearInterval(localTimer);
      clearInterval(remoteTimer);
      window.removeEventListener("focus", syncRemote);
      window.removeEventListener("pageshow", syncRemote);
    };
  }, [field, sessionId, preview, getRespawnLockFn, serverOffset]);

  // Load + subscribe game state (per field). For non-DB local lobbies (custom
  // fields initialized by a marshal via the admin console), the server-backed
  // Supabase table has no row — we synthesize a lobby state from localStorage
  // so the player is never stuck on "Povezovanje...".
  useEffect(() => {
    if (preview && preset) return;
    let alive = true;

    const synthesizeLocal = (): GameState | null => {
      if (typeof window === "undefined") return null;
      try {
        const raw = localStorage.getItem("spartanops.lobbies.v1");
        const list = raw ? (JSON.parse(raw) as Array<any>) : [];
        const l = list.find((x) => x?.id === field);
        return {
          field_id: field,
          field_label: l?.fieldName ?? field,
          status: "lobby",
          team_selection_open: true,
          current_polygon_name: null,
          event_name: l?.eventName ?? l?.fieldName ?? "SpartanOps",
          gamemode: (l?.gamemode as any) ?? "domination",
          compressed_map_url: l?.mapUrl ?? null,
          countdown_seconds: l?.countdownSeconds ?? 60,
          match_started_at: null,
          match_duration_minutes: l?.matchDurationMinutes ?? 40,
          team_scores: { modra: 0, rdeca: 0, rumena: 0 },
          node_holders: {},
          node_positions: (l?.nodePositions as any) ?? {},
          point_target: l?.pointTarget ?? 200,
          winner_team: null,
          settings: (l?.settings as any) ?? null,
        };
      } catch {
        return null;
      }
    };

    // Instant paint: hydrate from the last known snapshot for this field so
    // mission description / settings are on screen before the network answers.
    const cached = readCachedState(field);
    if (cached) {
      setState((prev) => prev ?? cached.state);
      if (cached.fresh) setStateFresh(true);
    }

    const load = async (attempt = 0): Promise<boolean> => {
      // Always try Supabase first — every lobby (legacy fixed IDs + new UUIDs)
      // now has a game_state row created by the lobby bootstrap trigger.
      const { data } = await supabase
        .from("spartanops_game_state")
        .select("*")
        .eq("field_id", field)
        .maybeSingle();
      if (alive && data) {
        const liveState = data as unknown as GameState;
        setState((previous) => {
          if (isStaleState(previous, liveState)) return previous;
          const merged: GameState = {
            ...liveState,
            compressed_map_url: liveState.compressed_map_url || previous?.compressed_map_url || null,
            node_positions: Object.keys(liveState.node_positions ?? {}).length ? liveState.node_positions : (previous?.node_positions ?? {}),
            settings: { ...(previous?.settings ?? {}), ...(liveState.settings ?? {}) },
          };
          writeCachedState(field, merged);
          return merged;
        });

        // Fresh lobby (marshal reset / not started yet) must never show the
        // previous match's death events.
        if (liveState.status === "lobby" && !liveState.match_started_at && readDeathEvents(field).length > 0) {
          clearDeathEvents(field);
          try { window.dispatchEvent(new Event("spartanops:deathlog")); } catch { /* ignore */ }
        }
        setStateFresh(true);
        if ((data as any).match_started_at) syncServerClock().catch(() => {});

        return true;

      }
      if (alive && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
        return load(attempt + 1);
      }
      return false;
    };

    // Safety net: if the DB fetch (or any subscription) hasn't populated state
    // within 1s, drop into the local onboarding flow so the player never sees
    // an infinite loading screen.
    const timeout = setTimeout(() => {
      if (!alive) return;
      setState((prev) => prev ?? synthesizeLocal());
      setStateFresh(true);
    }, 2500);

    const ch = supabase
      .channel(`misija_state_${field}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spartanops_game_state", filter: `field_id=eq.${field}` },
        (p) => {
          if (p.new) {
            const incoming = p.new as unknown as GameState;
            const incomingPositions = incoming.node_positions ?? {};
            const hasIncomingPositions = Object.keys(incomingPositions).length > 0;
            setState((prev) => {
              // Marshal reset: the match returns to the lobby with no start
              // time. Wipe the locally persisted death log so the next match
              // never inherits the previous one's events.
              if (prev && incoming.status === "lobby" && !incoming.match_started_at && (prev.match_started_at || prev.status !== "lobby")) {
                clearDeathEvents(field);
                try { window.dispatchEvent(new Event("spartanops:deathlog")); } catch { /* ignore */ }
              }
              const merged: GameState = {
                ...incoming,
                compressed_map_url: incoming.compressed_map_url || prev?.compressed_map_url || null,
                node_positions: hasIncomingPositions ? incomingPositions : (prev?.node_positions ?? {}),
                settings: { ...(prev?.settings ?? {}), ...(incoming.settings ?? {}) },
                match_started_at: incoming.match_started_at || (["active", "paused"].includes(incoming.status) ? (prev?.match_started_at ?? null) : null),
              };
              writeCachedState(field, merged);
              return merged;
            });
            setStateFresh(true);
            if ((p.new as any).match_started_at) syncServerClock().catch(() => {});
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") load().catch(() => {});
      });

    load().catch(() => {});
    return () => {
      alive = false;
      clearTimeout(timeout);
      supabase.removeChannel(ch);
    };
  }, [field, preview, preset]);

  // Load + subscribe roster (per field)
  useEffect(() => {
    if (preview && preset) return;
    let alive = true;
    // Instant paint: show the cached roster while the fresh one loads.
    try {
      const cached = localStorage.getItem(rosterCacheKey(field));
      if (cached) setRoster((prev) => (prev.length ? prev : (JSON.parse(cached) as Checkin[])));
    } catch { /* ignore */ }

    const load = async () => {
      if (!sessionId) return;
      const res = await getParticipantRosterFn({ data: { fieldId: field, sessionId } });
      if (!alive) return;
      const rows = (res?.ok ? res.rows : []) as unknown as Checkin[];
      if (rows.length > 0) {
        setRoster(rows);
        try { localStorage.setItem(rosterCacheKey(field), JSON.stringify(rows)); } catch { /* ignore */ }
      } else {
        setRoster([]);
        try { localStorage.removeItem(rosterCacheKey(field)); } catch { /* ignore */ }
      }
    };
    load();
    // Short retry burst — the roster row may not be readable the instant the
    // player finishes deployment, and we never want an empty first paint.
    const retries = [700, 1800, 4000].map((ms) => window.setTimeout(() => { if (alive) load(); }, ms));
    const ch = supabase
      .channel(`misija_roster_${field}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spartanops_checkins", filter: `field_id=eq.${field}` },
        (payload: any) => {
          const next = payload.new as Checkin | undefined;
          const old = payload.old as Partial<Checkin> | undefined;
          if (payload.eventType === "DELETE" && old?.id) {
            setRoster((items) => items.filter((r) => r.id !== old.id));
          } else if (next?.id) {
            setRoster((items) => {
              const exists = items.some((r) => r.id === next.id);
              return exists ? items.map((r) => (r.id === next.id ? { ...r, ...next } : r)) : [...items, next];
            });
            if (next.session_id === sessionId) {
              setDbMe((prev) => (prev ? { ...prev, ...next } : next));
            }
          }
          window.setTimeout(load, 150);
        },
      )
      .subscribe();
    return () => {
      alive = false;
      retries.forEach((id) => window.clearTimeout(id));
      supabase.removeChannel(ch);
    };
  }, [field, sessionId, getParticipantRosterFn, preview, preset]);

  // Derive my checkin (only for real DB player; ghost is local). Fetch PII
  // (first_name / last_initial / club) separately via a server function since
  // the public roster policy no longer exposes those columns.
  const getMyCheckinFn = useServerFn(spartanopsGetMyCheckin);
  const ackWarningFn = useServerFn(spartanopsAcknowledgeWarning);

  useEffect(() => {
    if (preview && preset) return;
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyCheckinFn({ data: { fieldId: field, sessionId } });
        const row = res?.row as Checkin | null;
        if (cancelled) return;
        if (!row) {
          setDbMe(null);
          try { localStorage.removeItem(meCacheKey(field, sessionId)); } catch { /* ignore */ }
          setMeResolved(true);
          return;
        }
        // Prefer the latest row from the realtime roster (fresh assigned_team etc.),
        // fall back to the server-fn row (has PII); identify by id, not session_id.
        const fresh = roster.find((r) => r.id === row.id);
        setDbMe(fresh ? { ...row, ...fresh } : row);
        setMeResolved(true);
      } catch {
        // Network hiccup: keep any cached check-in rather than bouncing the
        // player back to the registration form.
        if (!cancelled) setMeResolved(true);
      }
    })();
    return () => { cancelled = true; };
  }, [roster, sessionId, preview, field, getMyCheckinFn]);


  useEffect(() => {
    if (preview || !dbMe?.id) return;
    const fresh = roster.find((r) => r.id === dbMe.id);
    if (fresh) setDbMe((prev) => (prev ? { ...prev, ...fresh } : prev));
  }, [roster, preview, dbMe?.id]);


  // Load + subscribe captures (per field)
  useEffect(() => {
    if (preview) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("spartanops_captures")
        .select("id, point_number, team, player_callsign, captured_at")
        .eq("field_id", field)
        .eq("suspicious", false)
        .order("captured_at", { ascending: false })
        .limit(50);
      if (alive) setCaptures((data ?? []) as unknown as Capture[]);
    };
    load();
    const ch = supabase
      .channel(`misija_captures_${field}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spartanops_captures", filter: `field_id=eq.${field}` },
        load,
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [field, preview, preset]);

  // Bridge lobby / match transitions to the ambient audio provider so the
  // lobby track plays on entry and fades out when the match actually begins.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!state) return;
    const isTeamSetup = !me || me.assigned_team === "none";
    const isLobby = state.status === "lobby" || state.status === "closed" || isTeamSetup;
    window.dispatchEvent(new CustomEvent("spartanops:lobby", { detail: { active: isLobby } }));
    if (state.status === "active" && !isTeamSetup) {
      window.dispatchEvent(new Event("spartanops:match-start"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("spartanops:lobby", { detail: { active: false } }));
    };
  }, [state?.status, me?.assigned_team]);

  // Guard against accidental swipe-to-refresh / hard reload while a match is
  // live. The browser shows its standard confirmation dialog; the custom
  // message is legacy but we still set returnValue for older engines.
  useEffect(() => {
    if (typeof window === "undefined" || preview) return;
    const matchLive = state?.status === "active" || state?.status === "paused";
    const inGame = matchLive && !!me && me.assigned_team !== "none";
    if (!inGame) return;
    const handler = (e: BeforeUnloadEvent) => {
      const msg = "Are you sure you want to leave the active deployment? Your tactical telemetry might be temporarily interrupted.";
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state?.status, me?.assigned_team, preview]);


  // --- INTERCEPT QR SCAN EVENT (AUTOMATIC CAPTURE LOGIC) ---
  useEffect(() => {
    if (preview) return; // ghost preview: never write to DB
    if (!targetPoint || !me || !state) return;

    const startAt = state.match_started_at ? Date.parse(state.match_started_at) : NaN;
    const preStartLocked = !Number.isFinite(startAt) || currentTime < startAt;
    if (state.status === "paused") {
      alert(en
        ? "The Marshal has paused the match — QR scanning is suspended until the match resumes."
        : "Maršal je prekinil tekmo — skeniranje QR kod je onemogočeno, dokler se tekma ne nadaljuje.");
      window.history.replaceState({}, document.title, window.location.pathname + `?field=${rawField}`);
      return;
    }
    if (state.status !== "active" || preStartLocked) {
      alert("Zavzemanje točk ni mogoče, ker igra trenutno ni aktivna!");
      window.history.replaceState({}, document.title, window.location.pathname + `?field=${rawField}`);
      return;
    }

    if (!me.assigned_team || me.assigned_team === "none") {
      alert("Pred zavzemanjem točke si morate najprej izbrati ekipo v Operativni sobi!");
      window.history.replaceState({}, document.title, window.location.pathname + `?field=${rawField}`);
      return;
    }

    window.location.replace(`/capture?field=${encodeURIComponent(field)}&point=${encodeURIComponent(targetPoint)}`);
  }, [targetPoint, me, state, field, rawField, preview, currentTime, en]);

  const ackTeamChange = async () => {
    await ackFn({ data: { fieldId: field, sessionId } });
  };

  // Hold the phase decision until we have (a) a session, (b) a trustworthy
  // game state, and (c) a resolved check-in. Otherwise the screen would flash
  // registration -> team select -> HUD (or an old debriefing) on every return.
  const gateLoading = !sessionId || !state || (!preview && (!stateFresh || (!meResolved && !me)));
  if (gateLoading) {
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }} className="flex items-center justify-center">
        <OfflineBanner />
        <p className="font-mono text-sm" style={{ color: MUTED }}>
          Povezovanje...
        </p>
      </div>
    );
  }

  // 1) CHECK-IN FORM — always accessible, no auth, no status check
  if (!me)
    return (
      <>
        <OfflineBanner />
        <CheckinForm sessionId={sessionId} fieldId={field} preview={preview} onGhost={(g) => setGhostMe(g)} fieldLabel={`${missionTitleFromState(state, field)} · ${fieldTitleFromState(state, field)}`} />
        {preview && <PreviewReturnButton />}
      </>
    );


  // Fullscreen forced-team-change interrupt (must be acknowledged)
  const teamColorNow = me.assigned_team !== "none" ? TEAM_COLOR[me.assigned_team] : "#ff5050";
  const teamLabelNow = me.assigned_team !== "none"
    ? teamName(me.assigned_team, state.settings, en)
    : "";
  const colorWordEn = me.assigned_team === "modra" ? "BLUE" : me.assigned_team === "rdeca" ? "RED" : me.assigned_team === "rumena" ? "YELLOW" : "";
  const reassignedBanner = me.team_changed_flag ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", animation: "spops-alert-flash 1.6s ease-in-out infinite" }}
    >
      <div style={{ background: "#141008", border: `2px solid ${teamColorNow}`, boxShadow: `0 0 32px ${teamColorNow}80`, padding: "28px 24px", maxWidth: 460, width: "100%", textAlign: "center" }}>
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 15, color: ACCENT, letterSpacing: "0.14em", marginBottom: 14, textTransform: "uppercase", fontWeight: 700 }}>
          {en ? "⚠️ WARNING: NEW COMMAND RECEIVED" : "⚠️ POZOR: PRIŠLA JE NOVA KOMANDA"}
        </p>
        <p className="text-[13px]" style={{ color: INK, lineHeight: 1.7, marginBottom: 22 }}>
          {en ? (
            <>
              Marshal has decided to balance the teams and placed you into{" "}
              <strong style={{ color: teamColorNow }}>{teamLabelNow} {colorWordEn && `(${colorWordEn})`}</strong>{" "}
              team. From now on, you hold position and capture points for this team.
            </>
          ) : (
            <>
              Maršal vam je z namenom uravnoteženja ekip spremenil ekipo. Od sedaj naprej zasedate položaje in osvajate točke za{" "}
              <strong style={{ color: teamColorNow }}>{teamLabelNow}</strong>{" "}
              ekipo.
            </>
          )}
        </p>
        <button
          onClick={ackTeamChange}
          style={{ width: "100%", background: ACCENT, color: BG, padding: "13px 18px", fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer", border: "none" }}
        >
          {en ? "UNDERSTAND AND AGREE" : "RAZUMEM IN SE STRINJAM"}
        </button>
      </div>
      <style>{`@keyframes spops-alert-flash { 0%,100% { background: rgba(0,0,0,0.82); } 50% { background: rgba(80,0,0,0.85); } }`}</style>
    </div>
  ) : null;

  const pauseOverlay = state.status === "paused" ? <PausedOverlay en={en} /> : null;


  const warningOverlay = me.warning_message ? (
    <WarningModal
      message={me.warning_message}
      en={en}
      onAcknowledge={async () => {
        setMe({ ...me, warning_message: null });
        try {
          await ackWarningFn({ data: { fieldId: field, sessionId } });
        } catch { /* ignore — will re-appear on next poll if still set */ }
      }}
    />
  ) : null;


  // Freeze every client-side clock while the marshal has the match paused.
  const pausedAtMsTop = state.status === "paused" && state.updated_at
    ? new Date(state.updated_at).getTime()
    : null;
  const clockNow = pausedAtMsTop ?? currentTime;

  // Force endgame view when timer expires client-side, even if the DB status
  // hasn't flipped to "ended" yet — guarantees the After-Action Report renders.
  const startMsForEnd = state.match_started_at ? new Date(state.match_started_at).getTime() : null;
  const matchEndsAtMs = startMsForEnd ? startMsForEnd + state.match_duration_minutes * 60_000 : null;
  const timerExpired = !!(matchEndsAtMs && clockNow >= matchEndsAtMs);

  // 1a) PRE-MATCH WINDOW — marshal has scheduled a start in the future.
  // Only players who have already selected a team enter the HUD/countdown.
  const preMatchSecEarly = startMsForEnd && clockNow < startMsForEnd ? Math.ceil((startMsForEnd - clockNow) / 1000) : 0;
  if (preMatchSecEarly > 0) {
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }}>
        <OfflineBanner />
        {reassignedBanner}
        {warningOverlay}
        {pauseOverlay}
        <PreMatchCountdown seconds={preMatchSecEarly} polygon={state.current_polygon_name} eventName={missionTitleFromState(state, "")} gamemode={state.gamemode} pointTarget={state.point_target} settings={state.settings} en={en} state={state} roster={roster} />
        
        {preview && <PreviewReturnButton />}
      </div>
    );
  }

  // 2) ACTIVE MATCH — only if the player already has a team. Otherwise fall through to team select.
  if ((state.status === "active" || state.status === "paused") && me.assigned_team !== "none" && !timerExpired) {
    if (!preview && respawnUntil > currentTime) {
      return (
        <div style={{ background: BG, color: INK, minHeight: "100vh" }}>
          <OfflineBanner />
          {reassignedBanner}
        {warningOverlay}
          <RespawnLockScreen until={respawnUntil} field={field} sessionId={sessionId} serverOffset={serverOffset} en={en} />
          <AbortMissionButton field={field} en={en} settings={state.settings} />
        </div>
      );
    }
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }}>
        <OfflineBanner />
        {reassignedBanner}
        {warningOverlay}
        {pauseOverlay}
        <LiveMatch state={state} captures={captures} now={currentTime} roster={roster} myTeam={me.assigned_team} meId={me.id} meCallsign={me.callsign ?? ""} />
        <AbortMissionButton field={field} en={en} settings={state.settings} />
        {preview && <PreviewReturnButton />}
      </div>
    );
  }


  // 3) ENDED — grandiose After-Action Report
  if (state.status === "ended" || timerExpired) {
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }}>
        <OfflineBanner />
        {reassignedBanner}
        {warningOverlay}
        <EndgameSoundtrackTrigger />
        <EndgameReport state={state} roster={roster} captures={captures} en={en} now={currentTime} myTeam={me.assigned_team} />
        <AbortMissionButton field={field} en={en} settings={state.settings} />
        {preview && <PreviewReturnButton />}
      </div>
    );
  }

  // 4) INACTIVE (closed/lobby) — team select + waiting. Pre-match countdown if scheduled.
  const startMs = state.match_started_at ? new Date(state.match_started_at).getTime() : null;
  const preMatchSec = startMs && clockNow < startMs ? Math.ceil((startMs - clockNow) / 1000) : 0;

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", paddingTop: 84 }}>
      <OfflineBanner />
      {reassignedBanner}
        {warningOverlay}
      {preMatchSec > 0 && <PreMatchCountdown seconds={preMatchSec} polygon={fieldTitleFromState(state, field)} eventName={missionTitleFromState(state, field)} gamemode={state.gamemode} pointTarget={state.point_target} settings={state.settings} en={en} state={state} roster={roster} /> }
      <div className="max-w-5xl mx-auto px-4 pt-1 pb-8">

        <PlayerHudHeader en={en} />
        <h1
          className="text-center font-display tracking-widest mb-2"
          style={{ fontFamily: "'Michroma', monospace", fontSize: 22, color: INK }}
        >
          {en ? "TEAM SELECTION" : "IZBIRA EKIPE"}
        </h1>
        <MissionFieldSubline
          missionName={missionTitleFromState(state, field)}
          fieldName={fieldTitleFromState(state, field)}
          en={en}
        />


        {me.assigned_team === "none" ? (
          <div className="text-center mb-8">
            <ChooseFactionButton onClick={() => setShowTeamSelect(true)} en={en} />
          </div>
        ) : (
          <div className="text-center mb-6 font-mono uppercase text-[11px] tracking-widest" style={{ color: MUTED }}>
            {en ? "Your faction:" : "Vaša ekipa:"} <strong style={{ color: TEAM_COLOR[me.assigned_team] }}>{teamName(me.assigned_team, state.settings, en)}</strong>
          </div>
        )}

        <p
          className="text-center font-mono text-[11px] uppercase tracking-widest mb-6"
          style={{ color: MUTED, letterSpacing: "0.2em", lineHeight: 1.8 }}
        >
          {en ? "AWAITING MARSHAL COMMAND..." : "ČAKANJE NA MARŠALOVO KOMANDO..."}
        </p>


        <TeamGrid roster={roster} meId={me.id} settings={state.settings} />

        {me.assigned_team !== "none" && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => {
                if (confirm(en ? "Are you sure you want to change teams?" : "Ste prepričani, da želite zamenjati ekipo?")) {
                  setShowTeamSelect(true);
                }
              }}
              style={{
                background: "transparent",
                border: `1px solid ${ACCENT}88`,
                color: ACCENT,
                padding: "8px 18px",
                fontFamily: "'Michroma', monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              ⇄ {en ? "SWITCH TEAMS" : "ZAMENJAJ EKIPO"}
            </button>
          </div>
        )}


        {showTeamSelect && (
          <TeamSelectModal
            settings={state.settings}
            onPick={async (team) => {
              if (team === "rumena" && !confirm("Ali ste prepričani, da bodo v igri 3 ekipe?")) return;
              const previous = me;
              setMe({ ...me, assigned_team: team, team_changed_flag: false });
              setShowTeamSelect(false);
              if (preview) return; // ghost preview: no DB writes, no roster mutation
              setRoster((items) =>
                items.map((p) => (p.id === me.id ? { ...p, assigned_team: team, team_changed_flag: false } : p)),
              );
              try {
                await selectTeamFn({ data: { fieldId: field, sessionId, team } });
              } catch (error) {
                setMe(previous);
                setRoster((items) => items.map((p) => (p.id === me.id ? previous : p)));
                alert(error instanceof Error ? error.message : "Ekipe ni bilo mogoče posodobiti.");
              }
            }}
            onClose={() => setShowTeamSelect(false)}
          />
        )}
      </div>
      {marshalMode ? (
        <MarshalHudOverlay fieldId={field} en={en} />
      ) : (
        <AbortMissionButton field={field} en={en} settings={state.settings} />
      )}
      {preview && <PreviewReturnButton />}
    </div>
  );
}


function PreviewReturnButton() {
  return (
    <Link
      to="/admin-pregled"
      style={{
        position: "fixed", bottom: 16, right: 16, zIndex: 60,
        background: "rgba(11,13,9,0.85)", backdropFilter: "blur(8px)",
        color: "#E0B04E", border: "1px solid #E0B04E88",
        padding: "10px 14px", fontFamily: "'Michroma', monospace",
        fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
        textDecoration: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      ⚙️ Nazaj v maršal komandni center
    </Link>
  );
}

function MarshalContactBlock({ settings, en }: { settings?: GameSettings | null; en: boolean }) {
  const name = (settings?.marshalName ?? "").trim();
  const phone = (settings?.marshalPhone ?? "").trim();
  if (!name || !phone) return null;
  return (
    <div style={{ width: "min(640px, 100%)", margin: "10px auto 0" }}>

      <CollapsibleCard
        icon={<Phone size={16} />}
        title={en ? "MARSHAL - CONTACT" : "MARŠAL - KONTAKT"}
      >
        <p style={{ color: INK, fontFamily: "monospace", fontSize: 12, lineHeight: 1.7, margin: 0 }}>
          {en ? (
            <>This game is marshaled by <strong style={{ color: ACCENT }}>{name}</strong>, you can reach him at: <a href={`tel:${phone.replace(/\s+/g, "")}`} style={{ color: ACCENT, textDecoration: "underline" }}>{phone}</a></>
          ) : (
            <>To igro vodi marshal <strong style={{ color: ACCENT }}>{name}</strong>, dosegljiv je na telefonski številki: <a href={`tel:${phone.replace(/\s+/g, "")}`} style={{ color: ACCENT, textDecoration: "underline" }}>{phone}</a></>
          )}
        </p>
      </CollapsibleCard>
    </div>
  );
}

function AbortMissionButton({ field, en, settings }: { field: string; en: boolean; settings?: GameSettings | null }) {
  const deleteMyCheckinFn = useServerFn(spartanopsDeleteMyCheckin);
  const onClick = async () => {
    if (!confirm(en ? "Abort mission and disconnect from this lobby?" : "Prekiniti misijo in se odklopiti iz tega lobbyja?")) return;
    let sid: string | null = null;
    try {
      if (typeof window !== "undefined") {
        sid = localStorage.getItem(SESSION_KEY);
      }
    } catch { /* ignore */ }
    if (sid) {
      try { await deleteMyCheckinFn({ data: { fieldId: field, sessionId: sid } }); } catch { /* ignore */ }
    }
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem("spartanops.active_session");
        Object.keys(localStorage)
          .filter((k) => k.startsWith("spartanops:") || k.startsWith(`spartanops.marshal.${field}`))
          .forEach((k) => localStorage.removeItem(k));
      }
    } catch { /* ignore */ }
    try { window.dispatchEvent(new Event("spartanops:debrief-exit")); } catch { /* ignore */ }
    if (typeof window !== "undefined") window.location.href = `/join`;
  };
  return (
    <div className="mt-0 mb-2 flex flex-col items-center px-4">
      <MarshalContactBlock settings={settings} en={en} />
      <div style={{ height: 72 }} aria-hidden="true" />
      <button

        onClick={onClick}
        className="transition-colors"
        style={{
          background: "transparent",
          border: "1px solid rgba(153,27,27,0.45)",
          color: "#fca5a5",
          padding: "6px 12px",
          fontFamily: "'Michroma', monospace",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(69,10,10,0.3)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        [ {en ? "ABORT MISSION / DISCONNECT" : "PREKINI MISIJO / ODKLOP"} ]
      </button>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(148,148,148,0.55)", letterSpacing: "0.04em", marginTop: 4 }}>
        {en ? "Leave this lobby and delete your data for this field." : "Zapustite lobby in izbrišite svoje podatke za ta poligon."}
      </div>
    </div>
  );
}

function MarshalHudOverlay({ fieldId, en }: { fieldId: string; en: boolean }) {
  const deleteMyCheckinFn = useServerFn(spartanopsDeleteMyCheckin);
  const [marshalPw, setMarshalPw] = useState<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pw = sessionStorage.getItem(`spartanops:marshal:pw:${fieldId}`) ?? "";
      setMarshalPw(pw);
    } catch { /* ignore */ }
  }, [fieldId]);

  const onReturn = async () => {
    const msg = en
      ? "Return to Marshal Command Center? You will be removed from the game as a player, your score will be deleted and you will have to reassign."
      : "Nazaj v komandni center maršala? Kot igralec boš odstranjen iz igre, tvoj rezultat bo izbrisan in se boš moral znova prijaviti.";
    if (!confirm(msg)) return;
    let sid: string | null = null;
    try { sid = localStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
    if (sid) {
      try { await deleteMyCheckinFn({ data: { fieldId, sessionId: sid } }); } catch { /* ignore */ }
    }
    if (typeof window !== "undefined") window.location.href = "/admin-pregled";
  };

  return (
    <>
      {marshalPw ? (
        <SpartacusAlerts fieldId={fieldId} password={marshalPw} en={en} />
      ) : null}
      <div style={{ padding: "16px 12px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={onReturn}
          style={{
            width: "100%", maxWidth: 520,
            background: "#E0B04E", color: "#0b0d09", border: "none",
            padding: "16px 18px", fontFamily: "'Michroma', monospace",
            fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 0 18px rgba(224,176,78,0.35)",
          }}
        >
          [ {en ? "RETURN TO MARSHAL COMMAND CENTER" : "NAZAJ V KOMANDNI CENTER MARŠALA"} ]
        </button>
        <p style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(236,227,196,0.65)", lineHeight: 1.5, textAlign: "center", maxWidth: 520 }}>
          {en
            ? "If you leave you will be removed from the game as a player, your score will be deleted and you will have to reassign."
            : "Če odideš, boš kot igralec odstranjen iz igre, tvoj rezultat bo izbrisan in se boš moral znova prijaviti."}
        </p>
      </div>
    </>
  );
}

function RespawnLockScreen({ until, field, sessionId, serverOffset, en }: { until: number; field: string; sessionId: string; serverOffset: number; en: boolean }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((until - (Date.now() - serverOffset)) / 1000)));

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, Math.ceil((until - (Date.now() - serverOffset)) / 1000));
      setLeft(next);
      if (next <= 0) {
        try { localStorage.removeItem(respawnLockKey(field, sessionId)); } catch { /* ignore */ }
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until, field, sessionId, serverOffset]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-5 text-center"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(224,176,78,0.16), rgba(11,13,9,0.98) 42%, #050604 100%)", color: INK }}
    >
      <p style={{ color: ACCENT, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", marginBottom: 10 }}>
        SpartanOps
      </p>
      <h2 style={{ fontFamily: "'Michroma', monospace", color: ACCENT, fontSize: "clamp(24px, 8vw, 54px)", letterSpacing: "0.12em", lineHeight: 1.1, textShadow: `0 0 28px ${ACCENT}66` }}>
        {en ? "RESPAWN LOCK" : "RESPAWN ZAKLEP"}
      </h2>
      <p className="mt-4 max-w-lg font-mono text-[12px] uppercase tracking-[0.18em]" style={{ color: MUTED, lineHeight: 1.8 }}>
        {left > 0
          ? (en ? "Remain on this mission screen until your cooldown expires." : "Ostanite na tem zaslonu misije, dokler se cooldown ne izteče.")
          : (en ? "Cooldown complete — rejoining mission HUD." : "Cooldown zaključen — vračanje v HUD misije.")}
      </p>
      <div className="my-7 font-bold" style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(72px, 22vw, 150px)", color: ACCENT, lineHeight: 0.95, textShadow: `0 0 34px ${ACCENT}55` }}>
        {mm}:{ss}
      </div>
      <div style={{ width: "min(520px, 100%)", border: `1px solid ${ACCENT}55`, background: "rgba(0,0,0,0.35)", padding: "12px 14px" }}>
        <p className="font-mono text-[11px]" style={{ color: INK, lineHeight: 1.7, margin: 0 }}>
          {en
            ? "Leaving and opening the HUD again will not bypass this timer. SpartanOps keeps the lock on this mission until re-entry is authorized."
            : "Zapustitev strani in ponovni vstop v HUD ne obideta tega časovnika. SpartanOps zaklep drži na tej misiji do dovoljenega vstopa."}
        </p>
      </div>
    </div>
  );
}


function PlayerHudHeader({ en }: { en: boolean }) {
  return (
    <p className="text-center font-semibold" style={{ fontSize: 11, letterSpacing: "0.3em", color: "rgba(224,176,78,0.8)", marginBottom: 4, fontFamily: "'Michroma', monospace" }}>
      {en ? "PLAYER HUD" : "PLAYER HUD"}
    </p>
  );
}

function MissionFieldSubline({ missionName, fieldName, en }: { missionName: string; fieldName: string; en: boolean }) {
  const missionPart = missionName || fieldName || (en ? "Active Operation" : "Aktivna operacija");
  const line = `${en ? "Mission" : "Misija"}: ${missionPart}`;
  return (
    <p
      className="text-center font-mono text-[11px] tracking-widest mb-6"
      style={{ color: "rgba(224,176,78,0.75)", letterSpacing: "0.12em", lineHeight: 1.6 }}
    >
      {line}
    </p>
  );
}

const GPS_OK_KEY = "spartanops:gps_authorized";

function ChooseFactionButton({ onClick, en }: { onClick: () => void; en: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className="font-mono font-bold tracking-widest py-3 px-8"
        style={{
          background: ACCENT,
          color: BG,
          fontSize: 13,
          letterSpacing: "0.2em",
          border: "none",
          cursor: "pointer",
        }}
      >
        {en ? "CHOOSE FACTION" : "IZBERI EKIPO"}
      </button>
    </div>
  );
}

function SpartacusConsentBlock({ en, onClearedChange }: { en: boolean; onClearedChange: (ok: boolean) => void }) {
  // Always start in "idle" so both mobile & desktop show the same amber
  // "AGREE + ACTIVATE GPS" call-to-action. Only an explicit user tap flips
  // the state — no silent auto-grant from localStorage or the Permissions API.
  const [status, setStatus] = useState<"idle" | "granted" | "denied">("idle");

  const activate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("denied");
      onClearedChange(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          localStorage.setItem(GPS_OK_KEY, "1");
          localStorage.setItem(GPS_FIX_KEY, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: Date.now() }));
        } catch { /* ignore */ }
        setStatus("granted");
        onClearedChange(true);
      },
      () => {
        setStatus("denied");
        onClearedChange(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const granted = status === "granted";
  return (
    <div style={{ border: `1px solid ${granted ? "#3ddc84" : ACCENT}66`, background: granted ? "rgba(61,220,132,0.08)" : "rgba(224,176,78,0.08)", padding: 14 }}>
      <p style={{ fontFamily: "'Michroma', monospace", fontSize: 10.5, color: granted ? "#3ddc84" : ACCENT, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, marginBottom: 6 }}>
        {granted
          ? (en ? "📡 TELEMETRY STATUS: SECURED (LAT/LON ACTIVE)" : "📡 STATUS TELEMETRIJE: ZAVAROVANO (GPS AKTIVEN)")
          : (en ? "SPARTACUS ANTI-CHEAT SYSTEM" : "SPARTACUS ANTI-CHEAT SISTEM")}
      </p>
      <p style={{ fontFamily: "monospace", color: MUTED, fontSize: 11, lineHeight: 1.6, marginBottom: 12 }}>
        {en
          ? "I agree to activate browser location telemetry for mission integrity, objective validation, and marshal override review."
          : "Strinjam se z aktivacijo lokacijske telemetrije za integriteto misije, validacijo ciljev in pregled maršala."}
      </p>
      <button
        type="button"
        onClick={activate}
        disabled={granted}
        style={{
          width: "100%",
          background: granted ? "rgba(61,220,132,0.16)" : `${ACCENT}18`,
          border: `1px solid ${granted ? "#3ddc84" : ACCENT}`,
          color: granted ? "#3ddc84" : ACCENT,
          padding: "10px 12px",
          fontFamily: "'Michroma', monospace",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          cursor: granted ? "default" : "pointer",
        }}
      >
        {granted ? (en ? "✓ AGREED / SATELLITE LINK SECURED" : "✓ POTRJENO / SATELITSKA POVEZAVA VARNA") : (en ? "AGREE + ACTIVATE GPS" : "STRINJAM SE + AKTIVIRAJ GPS")}
      </button>
      {status === "denied" && (
        <p style={{ color: "#ff8a8a", fontFamily: "monospace", fontSize: 10.5, lineHeight: 1.5, marginTop: 8 }}>
          {en ? "Location permission is blocked. Enable it in your browser settings to register." : "Dovoljenje za lokacijo je blokirano. Omogočite ga v nastavitvah brskalnika za prijavo."}
        </p>
      )}
    </div>
  );
}


function AudioSettingsBlock({ en }: { en: boolean }) {
  const { musicEnabled, sfxEnabled, setMusicEnabled, setSfxEnabled, unlock } = useAmbientAudio();
  const Row = ({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) => (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 4px",
        cursor: "pointer",
      }}
    >
      <span
        onClick={onChange}
        role="switch"
        aria-checked={on}
        style={{
          flexShrink: 0,
          width: 36,
          height: 20,
          borderRadius: 999,
          background: on ? "rgba(61,220,132,0.35)" : "rgba(236,227,196,0.14)",
          border: `1px solid ${on ? "#3ddc84" : "rgba(236,227,196,0.28)"}`,
          position: "relative",
          transition: "background 160ms",
          marginTop: 2,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: on ? 16 : 1,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: on ? "#3ddc84" : "rgba(236,227,196,0.6)",
            boxShadow: on ? "0 0 8px #3ddc84" : "none",
            transition: "left 160ms",
          }}
        />
      </span>
      <span style={{ fontFamily: "monospace", color: INK, fontSize: 11.5, lineHeight: 1.55 }}>{label}</span>
    </label>
  );
  return (
    <div style={{ border: `1px solid ${ACCENT}55`, background: "rgba(0,0,0,0.28)", padding: 14 }}>
      <p style={{ fontFamily: "'Michroma', monospace", fontSize: 10.5, color: ACCENT, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>
        {en ? "🎧 AUDIO SETTINGS" : "🎧 NASTAVITVE ZVOKA"}
      </p>
      <Row
        on={musicEnabled}
        onChange={() => { unlock(); setMusicEnabled(!musicEnabled); }}
        label={en
          ? "Background Music: Optional. Immersive atmosphere for lobby and debriefing."
          : "Glasba v ozadju: Izbirno. Ambience za lobby in debriefing."}
      />
      <Row
        on={sfxEnabled}
        onChange={() => { unlock(); setSfxEnabled(!sfxEnabled); }}
        label={en
          ? "Sound Effects (SFX): Recommended. Tactical in-game alerts (respawns, sectors, countdowns)."
          : "Zvočni efekti (SFX): Priporočeno. Taktični zvoki med igro (respawn, sektorji, odštevanje)."}
      />
      <p style={{ fontFamily: "monospace", color: MUTED, fontSize: 10.5, lineHeight: 1.55, marginTop: 8, fontStyle: "italic" }}>
        {en
          ? "*(Note: Sounds play only while your screen is active. You can mute them at any time during the game using the bottom-left icon.)*"
          : "*(Opomba: Zvoki se predvajajo le ob prižganem zaslonu. Med igro jih lahko kadarkoli izklopite s krogcem spodaj levo.)*"}
      </p>
    </div>
  );
}



function CheckinForm({ sessionId, fieldId, preview, onGhost, fieldLabel }: { sessionId: string; fieldId: string; preview?: boolean; onGhost?: (m: Checkin) => void; fieldLabel?: string | null }) {
  const { lang } = useLang();
  const en = lang === "en";
  const upsertCheckinFn = useServerFn(spartanopsUpsertCheckin);
  const deleteMyCheckinFn = useServerFn(spartanopsDeleteMyCheckin);
  const [callsign, setCallsign] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [club, setClub] = useState("");
  const [phone, setPhone] = useState("");
  const [exp, setExp] = useState<"slabo" | "dobro" | "zelo_dobro">("dobro");
  const [operatorType, setOperatorType] = useState<"AEG" | "SNIPER" | "DMR" | "PUMP">("AEG");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [spartacusCleared, setSpartacusCleared] = useState(false);

  const activeField = (fieldLabel ?? fieldId ?? "").toString().toUpperCase();
  const t = {
    title: en ? "MISSION DEPLOYMENT REGISTRATION" : "PRIJAVA NA MISIJO",
    subtitle: activeField ? `// MISSION: ${activeField}` : (en ? "// CHECK-IN · ANONYMOUS MODE" : "// CHECK-IN · ANONIMNO"),
    callsign: en ? "Callsign / Tactical Moniker *" : "Callsign / Taktični vzdevek *",
    firstName: en ? "First name" : "Ime",
    lastInitial: en ? "Last initial" : "Priimek (črka)",
    phone: en ? "Phone number (visible only to the marshal)" : "Telefonska številka (vidna samo maršalu)",
    club: en ? "Team / Club (Optional*)" : "Ekipa / Klub (opcijsko*)",
    experience: en ? "Experience level" : "Nivo izkušenj",
    operatorType: en ? "Operator type" : "Tip operaterja",
    submit: en ? "OK" : "OK",
    submitting: en ? "Sending..." : "Pošiljam...",
    needCallsign: en ? "Enter a callsign (tactical moniker)." : "Vnesite callsign (taktični vzdevek).",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cs = callsign.trim();
    if (!cs) {
      setErr(t.needCallsign);
      return;
    }
    if (!spartacusCleared) {
      setErr(en ? "Activate and accept the Spartacus anti-cheat protocol before registering." : "Pred prijavo aktivirajte in potrdite Spartacus anti-cheat protokol.");
      return;
    }
    setSubmitting(true);
    setErr("");
    const li = lastInitial.trim().charAt(0).toUpperCase();

    if (preview && onGhost) {
      onGhost({
        id: `ghost-${sessionId}`,
        session_id: sessionId,
        callsign: cs,
        club: club.trim() || null,
        experience_level: exp,
        operator_type: operatorType,
        assigned_team: "none",
        team_changed_flag: false,
        first_name: firstName.trim() || null,
        last_initial: li || null,
      });
      setSubmitting(false);
      return;
    }

    // Upsert on session_id via a service-role server function so the client
    // never needs a broad UPDATE policy on spartanops_checkins.
    try {
      await upsertCheckinFn({
        data: {
          sessionId,
          fieldId,
          callsign: cs,
          club: club.trim() || null,
          phoneNumber: phone.trim() || null,
          experienceLevel: exp,
          operatorType,
          firstName: firstName.trim() || null,
          lastInitial: li || null,
        },
      });
      // Force a full reload so iOS Safari (where the realtime channel can lag
      // right after the POST) reliably hydrates the check-in and drops the
      // player straight into the team-selection view.
      if (typeof window !== "undefined") {
        window.location.reload();
        return;
      }
      setSubmitting(false);
    } catch (e: any) {
      setSubmitting(false);
      setErr(e?.message ?? "Napaka pri prijavi.");
    }
  };

  const inputStyle = {
    width: "100%",
    background: "rgba(0,0,0,0.36)",
    border: "1px solid rgba(236,227,196,0.18)",
    padding: "10px 12px",
    color: INK,
    fontFamily: "monospace",
    fontSize: 13,
  };

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", padding: "60px 16px" }}>
      <div className="max-w-md mx-auto">
        <h1
          className="text-center mb-2"
          style={{ fontFamily: "'Michroma', monospace", fontSize: 18, letterSpacing: "0.16em", color: ACCENT }}
        >
          {t.title}
        </h1>
        <p className="text-center font-mono text-[11px] uppercase tracking-widest mb-8" style={{ color: MUTED }}>
          {t.subtitle}
        </p>

        <form
          onSubmit={submit}
          style={{ background: PANEL, border: `1px solid ${ACCENT}40`, padding: 24 }}
          className="space-y-4"
        >
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>
              {t.callsign}
            </label>
            <input
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              required
              maxLength={32}
              style={inputStyle}
              placeholder="Sršen"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>
                {t.firstName}
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={40}
                style={inputStyle}
                placeholder={en ? "John" : "Janez"}
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>
                {t.lastInitial}
              </label>
              <input
                value={lastInitial}
                onChange={(e) => setLastInitial(e.target.value.slice(0, 1).toUpperCase())}
                maxLength={1}
                style={inputStyle}
                placeholder="N"
              />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>
              {t.phone}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              style={inputStyle}
              placeholder="+386 40 123 456"
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: MUTED }}>
              {t.club}
            </label>
            <input
              value={club}
              onChange={(e) => setClub(e.target.value)}
              maxLength={60}
              style={inputStyle}
              placeholder="Spartan Airsoft"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>
              {t.operatorType}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["AEG", "SNIPER", "DMR", "PUMP"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOperatorType(type)}
                  style={{
                    background: operatorType === type ? `${ACCENT}20` : "transparent",
                    border: `1px solid ${operatorType === type ? ACCENT : "rgba(236,227,196,0.18)"}`,
                    color: operatorType === type ? ACCENT : MUTED,
                    padding: "10px 4px",
                    fontFamily: "monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>
              {t.experience}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {RANK_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.v}
                  onClick={() => setExp(opt.v)}
                  style={{
                    background: exp === opt.v ? `${ACCENT}20` : "transparent",
                    border: `1px solid ${exp === opt.v ? ACCENT : "rgba(236,227,196,0.18)"}`,
                    padding: "10px 6px",
                    textAlign: "center",
                    cursor: "pointer",
                    color: INK,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center"
                    style={{ color: exp === opt.v ? ACCENT : "rgba(224,176,78,0.28)" }}
                  >
                    <RankIcon level={opt.v} size={opt.v === "slabo" ? 16 : 18} />
                  </span>
                  <div
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: exp === opt.v ? INK : MUTED,
                      fontFamily: "monospace",
                    }}
                  >
                    {en ? opt.labelEn : opt.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <SpartacusConsentBlock en={en} onClearedChange={setSpartacusCleared} />

          <AudioSettingsBlock en={en} />

          {err && <p style={{ color: "#ff8a8a", fontSize: 12 }}>{err}</p>}

          <button
            type="submit"
            disabled={submitting || !spartacusCleared}
            style={{
              width: "100%",
              background: spartacusCleared ? ACCENT : "rgba(224,176,78,0.18)",
              color: spartacusCleared ? BG : "rgba(236,227,196,0.55)",
              padding: "14px",
              border: "none",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontSize: 13,
              cursor: submitting || !spartacusCleared ? "not-allowed" : "pointer",
              fontFamily: "monospace",
            }}
          >
            {submitting ? t.submitting : t.submit}
          </button>

          <div className="pt-4 flex flex-col items-center">
            <button
              type="button"
              onClick={async () => {
                let sid: string | null = null;
                try {
                  if (typeof window !== "undefined") sid = localStorage.getItem(SESSION_KEY);
                } catch { /* ignore */ }
                if (sid) {
                  try { await deleteMyCheckinFn({ data: { fieldId, sessionId: sid } }); } catch { /* ignore */ }
                }
                try {
                  if (typeof window !== "undefined") {
                    localStorage.removeItem(SESSION_KEY);
                    localStorage.removeItem("spartanops.active_session");
                    Object.keys(localStorage)
                      .filter((k) => k.startsWith("spartanops:") || k.startsWith(`spartanops.marshal.${fieldId}`))
                      .forEach((k) => localStorage.removeItem(k));
                  }
                } catch { /* ignore */ }
                if (typeof window !== "undefined") window.location.href = "/join";
              }}
              style={{
                background: "transparent",
                border: "1px solid rgba(153,27,27,0.45)",
                color: "#fca5a5",
                padding: "8px 16px",
                fontFamily: "'Michroma', monospace",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              [ {en ? "ABORT" : "PREKINI"} ]
            </button>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(148,148,148,0.55)", letterSpacing: "0.04em", marginTop: 6 }}>
              {en ? "Deserters will be shot." : "Dezerterji bodo ustreljeni."}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}

function TeamGrid({ roster, meId, settings }: { roster: Checkin[]; meId: string; settings?: any }) {
  const { lang } = useLang();
  const en = lang === "en";
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const blueCount = roster.filter((r) => r.assigned_team === "modra").length;
  const redCount = roster.filter((r) => r.assigned_team === "rdeca").length;
  const teams = activeTeams(settings);
  const yellowCount = roster.filter((r) => r.assigned_team === "rumena").length;
  const FALLBACK: Record<string, string> = { modra: "ALPHA", rdeca: "BRAVO", rumena: "CHARLIE" };
  const primary = (k: "modra" | "rdeca" | "rumena") => {
    const custom = settings?.teamNames?.[k];
    if (typeof custom === "string" && custom.trim()) return custom.trim().toUpperCase();
    return FALLBACK[k];
  };
  const colorTag = (k: "modra" | "rdeca" | "rumena") => (en ? TEAM_LABEL_EN[k] : TEAM_LABEL[k]);
  type TeamKey = "modra" | "rdeca" | "rumena";
  const allCols: { key: TeamKey; label: string; sub: string }[] = [
    { key: "modra", label: primary("modra"), sub: `· ${colorTag("modra")} FACTION ·` },
    { key: "rdeca", label: primary("rdeca"), sub: `· ${colorTag("rdeca")} FACTION ·` },
    { key: "rumena", label: primary("rumena"), sub: `· ${colorTag("rumena")} FACTION ·` },
  ];
  const cols = allCols.filter((c) => teams.includes(c.key) || roster.some((r) => r.assigned_team === c.key));
  return (
    <div>
      <div
        className="mb-4 rounded-md px-4 py-4 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(19,22,15,0.96), rgba(8,10,7,0.96))",
          border: `1px solid ${ACCENT}33`,
        }}
      >
        <p className="font-mono uppercase tracking-[0.28em] text-[10px] mb-2" style={{ color: MUTED }}>
          ACTIVE PLAYER RATIO
        </p>
        <div
          className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap"
          style={{ fontFamily: "'Michroma', monospace" }}
        >
          <span style={{ color: TEAM_COLOR.modra, fontSize: "clamp(28px, 8vw, 48px)", fontWeight: 800 }}>
            {blueCount}
          </span>
          <span style={{ color: MUTED, fontSize: "clamp(16px, 5vw, 28px)", letterSpacing: "0.14em" }}>VS</span>
          <span style={{ color: TEAM_COLOR.rdeca, fontSize: "clamp(28px, 8vw, 48px)", fontWeight: 800 }}>
            {redCount}
          </span>
          {yellowCount > 0 && (
            <>
              <span style={{ color: MUTED, fontSize: "clamp(16px, 5vw, 28px)", letterSpacing: "0.14em" }}>VS</span>
              <span style={{ color: TEAM_COLOR.rumena, fontSize: "clamp(28px, 8vw, 48px)", fontWeight: 800 }}>
                {yellowCount}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cols.map((c) => {
          const players = roster.filter((r) => r.assigned_team === c.key);
          const isOpen = expanded[c.key] ?? false;
          const visiblePlayers = isOpen ? players : players.slice(0, 5);
          return (
            <div
              key={c.key}
              className="rounded-md overflow-hidden"
              style={{
                background: `linear-gradient(180deg, ${TEAM_COLOR[c.key]}18, rgba(19,22,15,0.96) 34%)`,
                border: `1px solid ${TEAM_COLOR[c.key]}66`,
                boxShadow: `0 14px 34px -26px ${TEAM_COLOR[c.key]}`,
              }}
            >
              <div
                className="flex items-center justify-between gap-3 px-3 py-3"
                style={{ borderBottom: `1px solid ${TEAM_COLOR[c.key]}33` }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: "'Michroma', monospace",
                      color: TEAM_COLOR[c.key],
                      fontSize: 12,
                      letterSpacing: "0.16em",
                    }}
                  >
                    {c.label} ({players.length})
                  </p>
                  <p className="font-mono uppercase tracking-[0.18em] text-[9px] mt-1" style={{ color: MUTED }}>
                    {c.sub}
                  </p>
                </div>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: TEAM_COLOR[c.key],
                    boxShadow: `0 0 14px ${TEAM_COLOR[c.key]}`,
                  }}
                />
              </div>
              <div className="p-3 space-y-2 min-h-[92px]">
                {players.length === 0 && (
                  <p
                    className="text-center font-mono text-[10px] uppercase tracking-widest py-6"
                    style={{ color: MUTED }}
                  >
                    {en ? "— EMPTY —" : "— prazno —"}
                  </p>
                )}
                {visiblePlayers.map((p) => (
                  <PlayerRow key={p.id} p={p} isMe={p.id === meId} en={en} />
                ))}
                {players.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [c.key]: !isOpen }))}
                    className="w-full font-mono uppercase tracking-[0.18em] text-[10px] py-2 rounded-sm"
                    style={{
                      background: `${TEAM_COLOR[c.key]}14`,
                      border: `1px solid ${TEAM_COLOR[c.key]}44`,
                      color: TEAM_COLOR[c.key],
                    }}
                  >
                    {isOpen ? (en ? "Hide" : "Skrij") : `${en ? "Show all" : "Prikaži vse"} (${players.length})`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div
          className="md:col-span-3 rounded-md"
          style={{ background: PANEL, border: `1px solid rgba(236,227,196,0.12)` }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontFamily: "'Michroma', monospace",
              fontSize: 11,
              letterSpacing: "0.2em",
              color: MUTED,
              textAlign: "center",
            }}
          >
            {en ? "WAITING ROOM" : "ČAKALNICA"} · {roster.filter((r) => r.assigned_team === "none").length}
          </div>
          <div
            style={{
              padding: "10px 12px",
              borderTop: `1px dashed rgba(224,176,78,0.25)`,
              background: "rgba(224,176,78,0.05)",
              color: MUTED,
              fontFamily: "monospace",
              fontSize: 10.5,
              lineHeight: 1.55,
              textAlign: "center",
            }}
          >
            {en
              ? "Please join teams according to player numbers and experience level, otherwise the marshal will reposition some players to make the game more balanced."
              : "Prosimo, pridružite se ekipam glede na število igralcev in raven izkušenj, sicer bo maršal razporedil nekaj igralcev, da bo igra bolj uravnotežena."}
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {roster
              .filter((r) => r.assigned_team === "none")
              .map((p) => (
                <PlayerRow key={p.id} p={p} isMe={p.id === meId} compact en={en} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PlayerRow = memo(function PlayerRow({ p, isMe, compact, en }: { p: Checkin; isMe: boolean; compact?: boolean; en: boolean }) {
  const realName = [p.first_name?.trim(), p.last_initial?.trim() ? `${p.last_initial.trim().charAt(0).toUpperCase()}.` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className="rounded-sm"
      style={{
        background: isMe ? `${ACCENT}1f` : "rgba(0,0,0,0.28)",
        border: `1px solid ${isMe ? ACCENT : "rgba(236,227,196,0.08)"}`,
        padding: compact ? "6px 9px" : "8px 10px",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span className="inline-flex shrink-0 items-center justify-center" style={{ color: ACCENT }}>
        <RankIcon level={p.experience_level} size={compact ? 14 : 16} />
      </span>
      <span className="min-w-0 flex-1" style={{ color: INK, fontWeight: 700, overflowWrap: "anywhere", lineHeight: 1.3 }}>
        {p.callsign}{p.operator_type && <span style={{ color: ACCENT, fontSize: 10, marginLeft: 6 }}>· {p.operator_type}</span>}
        {realName && (
          <span style={{ color: MUTED, fontWeight: 400, fontSize: compact ? 10 : 11, marginLeft: 6 }}>
            {realName}
          </span>
        )}
        {isMe && <span style={{ color: ACCENT, fontWeight: 400 }}> · {en ? "YOU" : "JAZ"}</span>}
      </span>
      {/* Team color is already conveyed by the column background — no per-row chip needed. */}
    </div>
  );
});

function TeamSelectModal({
  onPick,
  onClose,
  settings,
}: {
  onPick: (t: "modra" | "rdeca" | "rumena") => void;
  onClose: () => void;
  settings?: any;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  const FALLBACK_EN: Record<string, string> = { modra: "BLUE TEAM", rdeca: "RED TEAM", rumena: "YELLOW TEAM" };
  const FALLBACK_SL: Record<string, string> = { modra: "MODRA EKIPA", rdeca: "RDEČA EKIPA", rumena: "RUMENA EKIPA" };
  const label = (t: "modra" | "rdeca" | "rumena") => {
    const custom = settings?.teamNames?.[t];
    if (typeof custom === "string" && custom.trim()) return custom.trim().toUpperCase();
    return (en ? FALLBACK_EN : FALLBACK_SL)[t];
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: PANEL, border: `1px solid ${ACCENT}`, padding: 28, maxWidth: 460, width: "100%" }}
      >
        <h3
          className="text-center mb-5"
          style={{ fontFamily: "'Michroma', monospace", fontSize: 14, letterSpacing: "0.2em", color: ACCENT }}
        >
          {en ? "CHOOSE FACTION" : "IZBERI EKIPO"}
        </h3>
        <div className="flex flex-col gap-2">
          {activeTeams(settings).map((t) => (
            <button
              key={t}
              onClick={() => onPick(t)}
              style={{
                background: TEAM_COLOR[t],
                color: "#fff",
                padding: "18px 14px",
                border: "none",
                cursor: "pointer",
                fontFamily: "'Michroma', monospace",
                fontSize: 14,
                letterSpacing: "0.10em",
                fontWeight: 800,
                textAlign: "center",
                width: "100%",
              }}
            >
              {label(t)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}




function PreMatchCountdown({ seconds, polygon, eventName, gamemode, pointTarget, settings, en = false, state, roster }: { seconds: number; polygon: string | null; eventName?: string | null; gamemode?: "domination" | "search_destroy" | null; pointTarget?: number; settings?: GameSettings | null; en?: boolean; state?: GameState; roster?: Checkin[] }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const modeLabel = gamemode === "search_destroy" ? "SEARCH & DESTROY" : "DOMINATION";
  const description = (settings as any)?.missionDescription as string | undefined;
  const configuredMission = (settings as any)?.missionName as string | undefined;
  const missionName = (eventName?.trim() || configuredMission?.trim() || polygon?.trim() || (en ? "ACTIVE MISSION" : "AKTIVNA MISIJA")).toUpperCase();
  const fieldName = (polygon?.trim() || state?.field_label?.trim() || "").toUpperCase();
  const duration = state?.match_duration_minutes ?? 0;
  // Fire the tactical countdown SFX exactly once when the visible timer
  // hits T-15s so the audio aligns with the final phase.
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    if (seconds === 15) {
      firedRef.current = true;
      try { window.dispatchEvent(new Event("spartanops:countdown")); } catch { /* ignore */ }
    }
  }, [seconds]);
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto p-4 text-center"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(224,176,78,0.14), rgba(11,13,9,0.99) 34%, #050604 100%)", color: INK, paddingTop: 112, paddingBottom: 40 }}
    >
      <p style={{ color: ACCENT, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", marginBottom: 8 }}>
        SPARTANOPS {modeLabel} MODE
      </p>
      <h2
        style={{
          fontFamily: "'Michroma', monospace",
          fontSize: "clamp(25px, 7vw, 58px)",
          letterSpacing: "0.10em",
          color: ACCENT,
          lineHeight: 1.08,
          maxWidth: 940,
          textShadow: `0 0 18px ${ACCENT}77, 0 0 52px rgba(224,176,78,0.30)`,
          textTransform: "uppercase",
        }}
      >
        <span style={{ display: "block", fontSize: "clamp(11px, 2.4vw, 18px)", letterSpacing: "0.34em", color: `${ACCENT}bb`, textShadow: "none", marginBottom: 6 }}>MISSION:</span>
        {missionName}
      </h2>
      {fieldName && (
        <p
          className="uppercase mt-3"
          style={{ color: INK, fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.14em", opacity: 0.85 }}
        >
          {fieldName}
        </p>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.2em] mt-5" style={{ color: MUTED }}>
        {en ? "Mission begins in:" : "Misija se bo začela čez:"}
      </p>
      <div
        className="my-3 font-bold"
        style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(72px, 20vw, 142px)", color: ACCENT, lineHeight: 0.95, textShadow: `0 0 34px ${ACCENT}55` }}
      >
        {mm}:{ss}
      </div>
      {/* 1) Team vs team with player counts (directly under the timer) */}
      <div
        className="flex items-center justify-center flex-wrap mt-1 mb-4"
        style={{ width: "min(640px, 100%)", columnGap: 14, rowGap: 2, textAlign: "center" }}
      >
        {(["modra", "rdeca"] as const).map((k, i) => (
          <Fragment key={k}>
            {i === 1 && (
              <span style={{ color: MUTED, fontFamily: "monospace", fontSize: 12, letterSpacing: "0.2em", flex: "0 0 auto" }}>VS</span>
            )}
            <span
              style={{
                fontFamily: "'Michroma', monospace",
                fontSize: 14,
                color: TEAM_COLOR[k],
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                flex: "0 0 auto",
                maxWidth: "100%",
              }}
            >
              {teamName(k, settings, en)}
              <span style={{ color: INK, marginLeft: 6 }}>({(roster ?? []).filter((r) => r.assigned_team === k).length})</span>
            </span>
          </Fragment>
        ))}
      </div>


      {/* 2) Mission description / instructions (from Marshal Command Center) */}
      {description?.trim() && (
        <div
          className="max-w-2xl mt-1 mb-4"
          style={{
            border: `1px solid ${ACCENT}55`,
            background: "rgba(0,0,0,0.42)",
            padding: "12px 14px",
            textAlign: "left",
            width: "min(640px, 100%)",
          }}
        >
          <p style={{ color: ACCENT, fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 6 }}>
            {en ? "// MISSION DESCRIPTION / INSTRUCTIONS" : "// OPIS MISIJE / NAVODILA"}
          </p>
          <p style={{ color: INK, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {description}
          </p>
        </div>
      )}




      {/* 3) Standing objective text */}
      <p className="max-w-2xl text-[12px]" style={{ color: MUTED, lineHeight: 1.7, fontStyle: "italic", marginTop: 14, marginBottom: 0, width: "min(640px, 100%)" }}>
        {en
          ? "Your objective is to secure as many sectors as possible via scanning the QR codes in the marked areas."
          : "Vaš cilj je zavarovati čim več sektorjev s skeniranjem QR kod na označenih lokacijah."}
      </p>

      {/* 4) Objective + time */}
      <div className="grid grid-cols-2 gap-3 my-5" style={{ width: "min(560px, 100%)" }}>
        <div style={{ border: `1px solid ${ACCENT}55`, background: "rgba(0,0,0,0.32)", padding: "12px 10px" }}>
          <p style={{ color: MUTED, fontFamily: "monospace", fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase" }}>{en ? "Objective" : "Cilj"}</p>
          <p style={{ color: ACCENT, fontFamily: "'Michroma', monospace", fontSize: 18, marginTop: 5 }}>{pointTarget ?? 50} PTS</p>
        </div>
        <div style={{ border: `1px solid ${ACCENT}55`, background: "rgba(0,0,0,0.32)", padding: "12px 10px" }}>
          <p style={{ color: MUTED, fontFamily: "monospace", fontSize: 9, letterSpacing: "0.20em", textTransform: "uppercase" }}>{en ? "Time to do it" : "Čas izvedbe"}</p>
          <p style={{ color: ACCENT, fontFamily: "'Michroma', monospace", fontSize: 18, marginTop: 5 }}>{duration || "—"} MIN</p>
        </div>
      </div>

      {/* 5) Spawn point note */}
      <div
        className="max-w-2xl mb-5"
        style={{
          border: `1px solid ${ACCENT}66`,
          borderLeft: `5px solid ${TEAM_COLOR.modra}`,
          background: "rgba(59,130,246,0.10)",
          padding: "10px 14px",
          textAlign: "left",
          width: "min(640px, 100%)",
        }}
      >
        <p style={{ color: INK, fontSize: 12.5, lineHeight: 1.65, fontFamily: "monospace", margin: 0 }}>
          {en
            ? "You can now move to your spawn points, get ready and wait for the start of the game."
            : "Zdaj se lahko premaknete na spawn točke, se pripravite in počakate na začetek igre."}
        </p>
      </div>

      {state && (
        <div style={{ width: "100%", maxWidth: 720, margin: "0 auto 12px" }}>
          <TacticalMap state={state} captures={[]} en={en} hasPositions={true} missionName={missionName} timeLabel={`${mm}:${ss}`} />
        </div>
      )}
      {/* 6) Team rosters under the map */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5" style={{ width: "min(720px, 100%)" }}>
        {(["modra", "rdeca"] as const).map((k) => {
          const members = (roster ?? []).filter((r) => r.assigned_team === k);
          return (
            <div key={k} style={{ border: `1px solid ${TEAM_COLOR[k]}66`, background: "rgba(0,0,0,0.38)", padding: "10px 12px", textAlign: "left" }}>
              <p style={{ color: TEAM_COLOR[k], fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
                {teamName(k, settings, en)} ({members.length})
              </p>
              {members.length === 0 ? (
                <p style={{ color: MUTED, fontFamily: "monospace", fontSize: 11 }}>
                  {en ? "// NO OPERATORS ASSIGNED" : "// NI DODELJENIH OPERATIVCEV"}
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                  {members.map((m) => (
                    <li key={m.id} style={{ color: INK, fontFamily: "monospace", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      <span style={{ color: TEAM_COLOR[k], marginRight: 6 }}>▪</span>{m.callsign}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      
      <MissionRulesAccordion respawn={settings?.respawn} weaponRules={(settings as any)?.weaponRules} en={en} />
      <MarshalContactBlock settings={settings} en={en} />

    </div>
  );
}

/* ---------- TACTICAL MAP (shared inline + zoom modal) ---------- */
type LabelSide = "right" | "left" | "top" | "bottom";
function computeLabelPlacements(
  positions: Record<string, { x: number; y: number } | null | undefined>,
): Record<number, LabelSide> {
  const nodes = [1, 2, 3, 4, 5]
    .map((n) => ({ n, p: positions[String(n)] }))
    .filter((x): x is { n: number; p: { x: number; y: number } } => !!x.p);
  const out: Record<number, LabelSide> = {};
  const SIDES: LabelSide[] = ["right", "left", "top", "bottom"];
  for (const { n, p } of nodes) {
    // Find any other node whose label would collide with a right-side default.
    const used = new Set<LabelSide>();
    for (const other of nodes) {
      if (other.n === n) continue;
      const dx = other.p.x - p.x; // percent
      const dy = other.p.y - p.y;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 6) {
        // Reserve the direction that other node sits in — we don't want to overlap it.
        if (dx > 3) used.add("right");
        else if (dx < -3) used.add("left");
        if (dy > 3) used.add("bottom");
        else if (dy < -3) used.add("top");
        // If two nodes are essentially stacked, also block the already-assigned side
        if (out[other.n]) used.add(out[other.n]);
      }
    }
    out[n] = SIDES.find((s) => !used.has(s)) ?? "right";
  }
  return out;
}

function NodeLabel({ text, side }: { text: string; side: LabelSide }) {
  const base: React.CSSProperties = {
    position: "absolute",
    fontSize: 10,
    fontFamily: "'Michroma', monospace",
    letterSpacing: "0.14em",
    color: INK,
    background: "rgba(0,0,0,0.72)",
    backdropFilter: "blur(4px)",
    padding: "2px 6px",
    borderRadius: 3,
    whiteSpace: "nowrap",
  };
  const placement: React.CSSProperties =
    side === "right"
      ? { left: 18, top: 0, transform: "translateY(-50%)" }
      : side === "left"
        ? { left: -14, top: 0, transform: "translate(-100%,-50%)" }
        : side === "top"
          ? { left: 0, top: -16, transform: "translate(-50%,-100%)" }
          : { left: 0, top: 16, transform: "translate(-50%,0)" };
  return <div style={{ ...base, ...placement }}>{text}</div>;
}

function TacticalMapContent({ state, en, nodeHoldersOverride }: { state: GameState; en: boolean; nodeHoldersOverride?: Record<string, string | null> }) {
  const positions = state.node_positions ?? {};
  const labelSides = useMemo(() => computeLabelPlacements(positions), [positions]);
  const [localMapUrl, setLocalMapUrl] = useState<string | null>(null);
  useEffect(() => {
    if (state.compressed_map_url || !state.field_id) {
      setLocalMapUrl(null);
      return;
    }
    try {
      const raw = localStorage.getItem("spartanops.lobbies.v1");
      const list = raw ? (JSON.parse(raw) as Array<any>) : [];
      const match = list.find((x) => x?.id === state.field_id);
      setLocalMapUrl(typeof match?.mapUrl === "string" && match.mapUrl ? match.mapUrl : null);
    } catch {
      setLocalMapUrl(null);
    }
  }, [state.compressed_map_url, state.field_id]);
  const startMs = state.match_started_at ? new Date(state.match_started_at).getTime() : null;
  const mapIsLive = (state.status === "active" || state.status === "paused") && !!startMs;
  const nodeHolders = nodeHoldersOverride ?? state.node_holders ?? FREE_NODES;
  const mapUrl = state.compressed_map_url || localMapUrl;
  if (!mapUrl) {
    return (
      <div style={{ paddingTop: "60%", background: "#1c1f17", position: "relative" }}>
        <p
          className="absolute inset-0 flex items-center justify-center font-mono text-[11px] uppercase tracking-widest"
          style={{ color: MUTED }}
        >
          {en ? "— map not loaded yet —" : "— zemljevid še ni naložen —"}
        </p>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <img src={mapUrl} alt="Map" className="w-full block" loading="eager" fetchPriority="high" decoding="async" />
      {[1, 2, 3, 4, 5].map((n) => {
        const p = positions[String(n)];
        if (!p) return null;
        const holder = mapIsLive ? nodeHolders[String(n)] : null;
        const captured = holder === "rdeca" || holder === "modra" || holder === "rumena";
        const c = captured ? TEAM_COLOR[holder!] : NEUTRAL_NODE;
        const pulseClass = captured ? "animate-pulse" : "";
        return (
          <div
            key={n}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 0,
              height: 0,
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%,-50%)", lineHeight: 0 }}>
              <Crosshair
                className={pulseClass}
                size={28}
                color={c}
                strokeWidth={2.4}
                style={{ filter: captured ? `drop-shadow(0 0 10px ${c})` : "drop-shadow(0 0 3px rgba(0,0,0,0.9))" }}
              />
            </div>
            <NodeLabel text={NODE_NAMES[n - 1]} side={labelSides[n] ?? "right"} />
          </div>
        );
      })}
      {(["spawn_rdeca", "spawn_modra", "spawn_rumena"] as const).map((key) => {
        const p = positions[key];
        if (!p) return null;
        const teamKey = key.replace("spawn_", "") as "rdeca" | "modra" | "rumena";
        const col = TEAM_COLOR[teamKey];
        const labelEn = teamKey === "modra" ? "BLUE HQ" : teamKey === "rdeca" ? "RED HQ" : "YELLOW HQ";
        const labelSl = `SPAWN ${TEAM_LABEL[teamKey]}`;
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 0,
              height: 0,
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: "translate(-50%,-50%)",
                width: 34,
                height: 34,
                display: "grid",
                placeItems: "center",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.72)",
                border: `2px solid ${col}`,
                boxShadow: `0 0 14px ${col}aa, 0 0 4px rgba(0,0,0,0.9)`,
              }}
            >
              <Shield size={18} color={col} strokeWidth={2.4} fill={`${col}33`} />
            </div>
            <div
              style={{
                position: "absolute",
                left: 24,
                top: 0,
                transform: "translateY(-50%)",
                fontSize: 9,
                fontFamily: "'Michroma', monospace",
                letterSpacing: "0.18em",
                color: col,
                background: "rgba(0,0,0,0.78)",
                border: `1px solid ${col}88`,
                padding: "2px 6px",
                borderRadius: 3,
                whiteSpace: "nowrap",
                textShadow: `0 0 6px ${col}`,
              }}
            >
              {en ? labelEn : labelSl}
            </div>
          </div>
        );
      })}
      {positions["compass"] && (
        <div style={{ position: "absolute", left: `${positions["compass"]!.x}%`, top: `${positions["compass"]!.y}%`, transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 5 }}>
          <TacticalCompass size={80} />
        </div>
      )}
      {!positions["compass"] && (
        <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 10, pointerEvents: "none" }}>
          <TacticalCompass size={72} />
        </div>
      )}
    </div>
  );
}

function TacticalMap({ state, captures, en, hasPositions, missionName, timeLabel }: { state: GameState; captures: Capture[]; en: boolean; hasPositions: boolean; missionName?: string; timeLabel?: string }) {
  const [open, setOpen] = useState(false);
  // Opens showing the FULL map (no crop) — the operator zooms in from there.
  const [zoom, setZoom] = useState(1);
  // One-finger (or mouse) drag panning inside the zoomed map.
  const panRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const onPanStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = panRef.current;
    if (!el || e.isPrimary === false) return;
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
  };
  const onPanMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = panRef.current;
    const d = dragRef.current;
    if (!el || !d || d.id !== e.pointerId) return;
    el.scrollLeft = d.left - (e.clientX - d.x);
    el.scrollTop = d.top - (e.clientY - d.y);
  };
  const onPanEnd = () => {
    dragRef.current = null;
  };
  useEffect(() => { if (open) setZoom(1); }, [open]);
  const startMs = state.match_started_at ? new Date(state.match_started_at).getTime() : null;
  const mapIsLive = (state.status === "active" || state.status === "paused") && !!startMs;
  const visibleCaptures = useMemo(
    () => startMs ? captures.filter((c) => new Date(c.captured_at).getTime() >= startMs) : [],
    [captures, startMs],
  );
  const visibleNodeHolders = useMemo(() => nodeHoldersFromCaptures(visibleCaptures), [visibleCaptures]);
  return (
    <>
      <div
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") setOpen(true); }}
        aria-label={en ? "Open tactical map" : "Odpri taktični zemljevid"}
        style={{ position: "relative", background: PANEL, border: `1px solid ${ACCENT}55`, cursor: "zoom-in" }}
        className="mb-6"
      >
        <TacticalMapContent state={state} en={en} nodeHoldersOverride={visibleNodeHolders} />
        {/* Hint overlay */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 11,
            padding: "4px 8px",
            background: "rgba(0,0,0,0.6)",
            border: `1px solid ${ACCENT}66`,
            color: ACCENT,
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          {en ? "TAP TO ZOOM" : "TAPNI ZA POVEČAVO"}
        </div>
        {!hasPositions && (
          <div className="grid grid-cols-5 gap-2 p-3">
            {[1, 2, 3, 4, 5].map((n) => {
              const holder = mapIsLive ? visibleNodeHolders[String(n)] : null;
              const captured = holder === "rdeca" || holder === "modra" || holder === "rumena";
              const c = captured ? TEAM_COLOR[holder!] : NEUTRAL_NODE;
              const glow =
                holder === "rdeca"
                  ? "animate-pulse drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]"
                  : holder === "modra"
                    ? "animate-pulse drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                    : holder === "rumena"
                      ? "animate-pulse drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]"
                      : "";
              return (
                <div
                  key={n}
                  className={glow}
                  style={{
                    background: captured ? `${c}22` : `${NEUTRAL_NODE}18`,
                    border: `2px solid ${c}`,
                    padding: "10px 4px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontFamily: "'Michroma', monospace", fontSize: 14, color: c, fontWeight: 700 }}>
                    {NODE_NAMES[n - 1]}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex flex-col"
          style={{ background: "rgba(4,6,3,0.98)" }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ borderBottom: `1px solid ${ACCENT}44`, paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
          >
            <div
              style={{
                fontFamily: "'Michroma', monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                color: ACCENT,
                textTransform: "uppercase",
                textShadow: `0 0 10px ${ACCENT}99, 0 0 22px ${ACCENT}55`,
                lineHeight: 1.5,
                minWidth: 0,
              }}
            >
              <div>{(missionName || (en ? "ACTIVE MISSION" : "AKTIVNA MISIJA")).toUpperCase()}</div>
              <div>{en ? "TIME REMAINING" : "PREOSTALI ČAS"}: {timeLabel ?? "--:--"}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={en ? "Close tactical map" : "Zapri zemljevid"}
              style={{
                flexShrink: 0,
                width: 38,
                height: 38,
                background: "transparent",
                color: ACCENT,
                border: `1px solid ${ACCENT}77`,
                fontFamily: "'Michroma', monospace",
                fontSize: 15,
                lineHeight: 1,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
          <div
            ref={panRef}
            className="flex-1"
            style={{
              overflow: "auto",
              // One finger pans, two fingers pinch-zoom the browser view.
              touchAction: "pan-x pan-y pinch-zoom",
              WebkitOverflowScrolling: "touch",
              cursor: "grab",
            }}
            onPointerDown={onPanStart}
            onPointerMove={onPanMove}
            onPointerUp={onPanEnd}
            onPointerCancel={onPanEnd}
          >
            <div
              style={{
                width: `${zoom * 100}%`,
                minWidth: `${zoom * 100}%`,
                margin: "0 auto",
                padding: 12,
              }}
            >
              <TacticalMapContent state={state} en={en} nodeHoldersOverride={visibleNodeHolders} />
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${ACCENT}33` }}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.3).toFixed(2)))}
              style={{ background: "transparent", color: INK, border: `1px solid ${ACCENT}55`, padding: "6px 16px", fontFamily: "monospace", fontSize: 14, cursor: "pointer" }}
              aria-label="Zoom out"
            >−</button>
            <span style={{ color: ACCENT, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.14em" }}>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, +(z + 0.3).toFixed(2)))}
              style={{ background: "transparent", color: INK, border: `1px solid ${ACCENT}55`, padding: "6px 16px", fontFamily: "monospace", fontSize: 14, cursor: "pointer" }}
              aria-label="Zoom in"
            >+</button>
          </div>
        </div>
      )}
    </>
  );
}



function ScanCodeButton({ fieldId, paused, en }: { fieldId: string; paused: boolean; en: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleDecode = useCallback((payload: ScanPayload) => {
    setOpen(false);
    // Universal respawn QR — route straight into the respawn sequence.
    if (payload.kind === "respawn") {
      navigate({ to: "/spawn", search: { field: payload.fieldId } as any, replace: true });
      return;
    }
    // Anti-cheat ticket: /capture will only accept scans originating from
    // this in-app scanner. The ticket carries the fresh scan payload so the
    // URL query string cannot be tampered with mid-flight.
    try {
      sessionStorage.setItem(
        "spartanops:scan_ticket",
        JSON.stringify({ fieldId: payload.fieldId, point: payload.point, at: Date.now() }),
      );
    } catch { /* ignore */ }
    // Preserve the printed URL contract for /capture's existing search parsing.
    navigate({ to: "/capture", search: { field: payload.fieldId, point: payload.point } as any, replace: true });
  }, [navigate]);


  return (
    <>
      <div className="mb-6 flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={paused}
          className={paused ? "" : "animate-pulse"}
          style={{
            width: "100%",
            maxWidth: 520,
            background: `linear-gradient(180deg, ${ACCENT}22, ${ACCENT}05)`,
            color: paused ? "rgba(224,176,78,0.35)" : ACCENT,
            border: `2px solid ${paused ? "rgba(224,176,78,0.28)" : ACCENT}`,
            padding: "16px 12px",
            fontFamily: "'Michroma', monospace",
            fontSize: 13,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            fontWeight: 700,
            cursor: paused ? "not-allowed" : "pointer",
            boxShadow: paused ? "none" : `0 0 24px -6px ${ACCENT}, inset 0 0 12px -6px ${ACCENT}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Crosshair size={16} /> {t("scanner.hudButton")}
        </button>
      </div>
      <QRScanner open={open} onClose={() => setOpen(false)} onDecode={handleDecode} />
    </>
  );
}

function LiveMatch({ state, captures, now, roster, myTeam, meId, meCallsign }: { state: GameState; captures: Capture[]; now: number; roster: Checkin[]; myTeam: string; meId?: string; meCallsign?: string }) {

  const deathLog = useDeathLog(state.field_id ?? "");
  const { lang } = useLang();
  const en = lang === "en";
  const teamLabelFor = (t: string) => teamName(t, state.settings, en);
  const startMs = state.match_started_at ? new Date(state.match_started_at).getTime() : null;
  // Freeze scoring + countdown while the marshal has paused the match.
  const pausedAtMs = state.status === "paused" && state.updated_at
    ? new Date(state.updated_at).getTime()
    : null;
  const effectiveNow = pausedAtMs ?? now;
  const preMatchSec = startMs && effectiveNow < startMs ? Math.ceil((startMs - effectiveNow) / 1000) : 0;

  const remaining = useMemo(() => {
    if (!startMs) return state.match_duration_minutes * 60;
    if (effectiveNow < startMs) return state.match_duration_minutes * 60;
    const elapsed = Math.floor((effectiveNow - startMs) / 1000);
    return Math.max(0, state.match_duration_minutes * 60 - elapsed);
  }, [startMs, state.match_duration_minutes, effectiveNow]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const hasPositions = [1, 2, 3, 4, 5].some((n) => (state.node_positions ?? {})[String(n)]);

  const matchEndMs = startMs ? startMs + state.match_duration_minutes * 60 * 1000 : null;
  const target = state.point_target ?? 200;
  const visibleCaptures = useMemo(
    () => startMs ? captures.filter((c) => new Date(c.captured_at).getTime() >= startMs) : [],
    [captures, startMs],
  );
  const visibleNodeHolders = useMemo(() => nodeHoldersFromCaptures(visibleCaptures), [visibleCaptures]);
  const dynamicScores = useMemo(
    () => computeDynamicScores(visibleCaptures, visibleNodeHolders, startMs, effectiveNow, matchEndMs, target),
    [visibleCaptures, visibleNodeHolders, startMs, effectiveNow, matchEndMs, target],
  );
  const scoreFor = (t: string) => Math.floor(dynamicScores[t] ?? 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" style={{ paddingTop: 84 }}>
      <HudNoticeFeed captures={visibleCaptures} roster={roster} myTeam={myTeam} meId={meId} meCallsign={meCallsign} teamLabelFor={teamLabelFor} respawnEnabled={!!state.settings?.respawn?.enabled} fieldId={state.field_id ?? ""} />
      {preMatchSec > 0 && <PreMatchCountdown seconds={preMatchSec} polygon={fieldTitleFromState(state, "")} eventName={missionTitleFromState(state, "")} gamemode={state.gamemode} pointTarget={state.point_target} settings={state.settings} en={en} state={state} roster={roster} />}

      <PlayerHudHeader en={en} />
      <h1
        className="text-center"
        style={{ fontFamily: "'Michroma', monospace", fontSize: 20, color: ACCENT, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 2 }}
      >
        {missionTitleFromState(state, en ? "Active Mission" : "Aktivna misija")}
      </h1>
      {fieldTitleFromState(state, "") && (
        <p className="text-center font-mono mt-1 mb-4" style={{ color: MUTED, fontSize: 11, letterSpacing: "0.14em" }}>
          {en ? "Field" : "Poligon"}: {fieldTitleFromState(state, "")}
        </p>
      )}

      {/* Score header — team label above, big centered "score / target" in team color */}
      {(() => {
        const showYellow = scoreFor("rumena") > 0;
        const teams: ReadonlyArray<"modra" | "rdeca" | "rumena"> = showYellow
          ? ["modra", "rdeca", "rumena"]
          : ["modra", "rdeca"];
        return (
          <div className={`grid gap-3 mb-5 ${showYellow ? "grid-cols-3" : "grid-cols-2"}`}>
            {teams.map((t) => {
              const val = scoreFor(t);
              const pct = Math.min(100, Math.max(0, (val / target) * 100));
              const col = TEAM_COLOR[t];
              return (
                <div key={t} style={{ background: PANEL, borderTop: `3px solid ${col}`, padding: "12px 10px 14px", textAlign: "center" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", color: MUTED, textTransform: "uppercase" }}>
                    {teamLabelFor(t)} SCOREBOARD
                  </div>
                  <div
                    style={{
                      fontFamily: "'Michroma', monospace",
                      fontSize: "clamp(24px, 7vw, 34px)",
                      color: col,
                      fontWeight: 700,
                      textAlign: "center",
                      marginTop: 4,
                      textShadow: `0 0 12px ${col}55`,
                    }}
                  >
                    {val} / {target}
                  </div>
                  {/* Progress bar */}
                  <div style={{ position: "relative", marginTop: 10, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`,
                      background: `linear-gradient(90deg, ${col}66 0%, ${col} 90%, #fff 100%)`,
                      boxShadow: `0 0 10px ${col}, 0 0 4px #fff`,
                      transition: "width 500ms ease-out",
                      borderRadius: 999,
                    }} />
                    {[25, 50, 75].map((p) => (
                      <div key={p} style={{ position: "absolute", top: 1, bottom: 1, left: `${p}%`, width: 1, background: "rgba(255,255,255,0.28)" }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <p
        className="text-center font-mono mb-5"
        style={{ color: MUTED, fontSize: "clamp(12px, 3.4vw, 15px)", lineHeight: 1.45, letterSpacing: "0.02em", maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}
      >
        {en
          ? "Scan the QR codes at flagged locations to score points for your team."
          : "Z skeniranjem QR kod na lokacijah z zastavico vaša ekipa pridobiva točke."}
      </p>

      <div className="text-center mb-6 font-mono text-[12px] uppercase tracking-widest" style={{ color: ACCENT }}>
        {en ? "TIME REMAINING:" : "Preostali čas:"}{" "}
        <span style={{ color: INK, fontSize: 20 }}>
          {mm}:{ss}
        </span>
      </div>

      {/* Map with positioned node markers — click to open zoomable modal */}
      <TacticalMap state={state} captures={visibleCaptures} en={en} hasPositions={hasPositions} missionName={missionTitleFromState(state, en ? "Active Mission" : "Aktivna misija")} timeLabel={`${mm}:${ss}`} />

      {/* In-app Scan Code button — the ONLY sanctioned capture path */}
      <ScanCodeButton fieldId={state.field_id ?? ""} paused={state.status === "paused"} en={en} />





      {/* Two-tier tactical history log */}
      <HudHistoryLog
        captures={visibleCaptures}
        deaths={deathLog}
        respawnEnabled={!!state.settings?.respawn?.enabled}
        teamLabelFor={teamLabelFor}
        teamColor={(t) => TEAM_COLOR[t] ?? ACCENT}
        nodeNames={NODE_NAMES}
        maxHeight={300}
      />

      {/* Player scoreboard (capture counts per player) */}
      {state.settings?.capturePointsScoring && (
        <PlayerScoreboard roster={roster} captures={visibleCaptures} respawn={state.settings?.respawn} settings={state.settings} en={en} />
      )}

      {/* Separator between scoreboard and the rest of the HUD */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${ACCENT}66, transparent)`, margin: "24px 0" }} />

      {/* Mission description / instructions — collapsible, emphasized card */}
      <MissionDescriptionCard description={(state.settings as any)?.missionDescription} en={en} />

      <div style={{ marginTop: 12 }}>
        <MissionRulesAccordion respawn={state.settings?.respawn} weaponRules={(state.settings as any)?.weaponRules} en={en} />
      </div>
    </div>
  );
}

function PlayerScoreboard({ roster, captures, respawn, settings, en = false }: { roster: Checkin[]; captures: Capture[]; respawn?: RespawnSettings; settings?: GameSettings | null; en?: boolean }) {
  const captureCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of captures) {
      const key = c.player_callsign ?? "—";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [captures]);

  const teams = (["modra", "rdeca", "rumena"] as const).filter(
    (t) => roster.some((r) => r.assigned_team === t)
  );
  const teamLabelFor = (t: string) => teamName(t, settings, en);

  return (
    <div className="mt-6 flex flex-col w-full gap-4">
      {teams.map((t) => {
        const players = roster
          .filter((r) => r.assigned_team === t)
          .map((r) => ({ ...r, pts: captureCounts[r.callsign] ?? 0 }))
          .sort((a, b) => b.pts - a.pts);
        return (
          <div key={t} className="w-full" style={{ background: PANEL, border: `1px solid ${TEAM_COLOR[t]}66` }}>
            <div style={{ padding: "8px 12px", background: `${TEAM_COLOR[t]}22`, color: TEAM_COLOR[t], fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              {teamLabelFor(t)} SCOREBOARD
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(236,227,196,0.08)" }}>
              <div className="grid gap-1.5 px-3 py-1 text-[9px] font-mono uppercase tracking-widest" style={{ color: MUTED, gridTemplateColumns: `24px minmax(0,1fr) 42px${respawn?.publicDeaths ? " 46px" : ""}${respawn?.enabled ? " 62px" : ""}` }}>
                <span></span>
                <span>{en ? "Callsign" : "Callsign"}</span>
                <span style={{ textAlign: "right", letterSpacing: "0.04em" }}>{en ? "Points" : "Točke"}</span>
                {respawn?.publicDeaths && <span style={{ textAlign: "right", letterSpacing: "0.04em" }}>{en ? "Deaths" : "Smrti"}</span>}
                {respawn?.enabled && <span style={{ textAlign: "right" }}>RSP</span>}
              </div>
              {players.length === 0 && (
                <p className="text-center py-3 font-mono text-[11px]" style={{ color: MUTED }}>{en ? "— empty —" : "— prazno —"}</p>
              )}
              {players.map((p) => {
                const real = [p.first_name?.trim(), p.last_initial?.trim() ? `${p.last_initial.trim().charAt(0).toUpperCase()}.` : null].filter(Boolean).join(" ");
                const unlockMs = p.respawn_unlock_at ? Date.parse(p.respawn_unlock_at) : NaN;
                const showTimer = respawn?.enabled && respawn?.visibility === "all" && Number.isFinite(unlockMs) && unlockMs > Date.now();
                const leftSec = showTimer ? Math.max(0, Math.ceil((unlockMs - Date.now()) / 1000)) : 0;
                const tmm = String(Math.floor(leftSec / 60)).padStart(2, "0");
                const tss = String(leftSec % 60).padStart(2, "0");
                const infoLen = p.callsign.length + (p.operator_type?.length ?? 0) + real.length;
                const baseSize = infoLen > 40 ? 9 : infoLen > 32 ? 10 : infoLen > 24 ? 11 : 12;
                return (
                  <div key={p.id} className="grid gap-1.5 items-center px-3 py-2 text-[12px] font-mono" style={{ gridTemplateColumns: `24px minmax(0,1fr) 42px${respawn?.publicDeaths ? " 46px" : ""}${respawn?.enabled ? " 62px" : ""}` }}>
                    <span style={{ color: ACCENT, display: "inline-flex", alignItems: "center" }}>
                      <ExperienceBadge level={p.experience_level} size={14} />
                    </span>
                    <span style={{ color: INK, fontWeight: 700, minWidth: 0, lineHeight: 1.3, fontSize: baseSize, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.callsign}{p.operator_type && <span style={{ color: ACCENT, fontSize: baseSize - 2, marginLeft: 5 }}>· {p.operator_type}</span>}
                      {real && <span style={{ color: MUTED, fontWeight: 400, fontSize: baseSize - 2, marginLeft: 4 }}>({real})</span>}
                    </span>

                    <span style={{ color: TEAM_COLOR[t], fontWeight: 700, textAlign: "right" }}>{p.pts}</span>
                    {respawn?.publicDeaths && (
                      <span style={{ color: "#ff7070", textAlign: "right", fontSize: 11, letterSpacing: "0.06em" }}>☠ {p.death_count ?? 0}</span>
                    )}
                    {respawn?.enabled && (
                      showTimer ? (
                        <span style={{ color: "#ff9a3d", textAlign: "right", fontSize: 10, letterSpacing: "0.08em", fontWeight: 700 }}>☠ {tmm}:{tss}</span>
                      ) : (
                        <span style={{ color: "#9eff3d", textAlign: "right", fontSize: 9, letterSpacing: "0.14em" }}>ALIVE</span>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EndgameSoundtrackTrigger() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spartanops:match-end"));
  }, []);
  return null;
}

function EndgameReport({ state, roster, captures, en, now, myTeam }: { state: GameState; roster: Checkin[]; captures: Capture[]; en: boolean; now: number; myTeam?: string }) {
  useEffect(() => {
    return () => {
      try { window.dispatchEvent(new Event("spartanops:debrief-exit")); } catch { /* ignore */ }
    };
  }, []);
  const t = useT();
  const deathLog = useDeathLog(state.field_id ?? "");
  const respawnEnabled = !!state.settings?.respawn?.enabled;
  const showDeaths = respawnEnabled && !!state.settings?.respawn?.publicDeaths;
  const teamLabelFor = (tm: string) => teamName(tm, state.settings, en);
  const counts: Record<string, number> = {};
  for (const c of captures) counts[c.player_callsign ?? "—"] = (counts[c.player_callsign ?? "—"] ?? 0) + 1;

  const enriched = roster
    .map((r) => ({ ...r, pts: counts[r.callsign] ?? 0 }))
    .sort((a, b) => b.pts - a.pts);

  // Determine winner from dynamic team scores (falls back to DB state).
  const startMs = state.match_started_at ? new Date(state.match_started_at).getTime() : null;
  const matchEndMs = startMs ? startMs + state.match_duration_minutes * 60 * 1000 : null;
  const dynamicScores = computeDynamicScores(captures, state.node_holders, startMs, now, matchEndMs, state.point_target);
  const activeTeams = (["modra", "rdeca", "rumena"] as const).filter(
    (t) => roster.some((r) => r.assigned_team === t) || (dynamicScores[t] ?? 0) > 0,
  );
  const teamScoresFinal = Object.fromEntries(activeTeams.map((t) => [t, Math.floor(dynamicScores[t] ?? 0)])) as Record<string, number>;
  let winner: string | null = state.winner_team ?? null;
  const scoreValues = Object.values(teamScoresFinal);
  const maxScore = scoreValues.length ? Math.max(...scoreValues) : 0;
  const leaders = activeTeams.filter((t) => teamScoresFinal[t] === maxScore);
  const isTie = leaders.length > 1;
  if (!winner && !isTie && leaders.length === 1) winner = leaders[0];
  if (isTie) winner = null;

  // Podium: winning-team-only when a winner exists, else top 3 overall (tie).
  const podiumSource = winner ? enriched.filter((p) => p.assigned_team === winner) : enriched;
  const top3 = podiumSource.slice(0, 3);
  // Podium order: [2nd (left), 1st (center), 3rd (right)]
  const podium = [top3[1], top3[0], top3[2]];
  const podiumMeta = [
    { rank: 2, label: en ? "2ND" : "2.", height: 108, ringOuter: "#E0E0E0", ringInner: "#8A8D8F", badgeText: "#F5F5F5" },
    { rank: 1, label: "MVP", height: 152, ringOuter: "#D4AF37", ringInner: "#AA7C11", badgeText: "#FFE79A" },
    { rank: 3, label: "3RD", height: 84, ringOuter: "#A87C53", ringInner: "#6E4724", badgeText: "#E8C9A6" },
  ];


  const fmtName = (p: (typeof enriched)[number] | undefined) => {
    if (!p) return "";
    const real = [
      p.first_name?.trim(),
      p.last_initial?.trim() ? `${p.last_initial.trim().charAt(0).toUpperCase()}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return real;
  };

  const winnerColor = winner ? TEAM_COLOR[winner] ?? ACCENT : "#eab308";
  const afterGameInstructions = state.settings?.afterGameInstructions?.trim();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10" style={{ paddingTop: 112 }}>
      <PlayerHudHeader en={en} />
      <div className="text-center mb-6">
        <h1
          className="mt-1"
          style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(18px, 4.2vw, 26px)", color: INK, letterSpacing: "0.24em", fontWeight: 700 }}
        >
          DEBRIEFING
        </h1>
      </div>


      {/* VICTORY BANNER */}
      <div
        className="text-center mb-8 mx-auto"
        style={{
          maxWidth: 720,
          padding: "18px 20px",
          background: isTie ? "rgba(234,179,8,0.08)" : `${winnerColor}14`,
          border: `2px solid ${isTie ? "#eab308" : winnerColor}`,
          boxShadow: isTie ? "0 0 30px rgba(234,179,8,0.35)" : `0 0 42px ${winnerColor}55`,
          animation: isTie ? "spo-tie-flash 1.2s ease-in-out infinite" : undefined,
        }}
      >
        <p
          style={{
            fontFamily: "'Michroma', monospace",
            fontSize: "clamp(16px, 4.2vw, 26px)",
            letterSpacing: "0.14em",
            color: isTie ? "#eab308" : winnerColor,
            textShadow: `0 0 18px ${isTie ? "#eab30888" : winnerColor + "aa"}`,
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          {isTie
            ? (en ? "IT'S A TIE! NO DOMINANT FACTION ESTABLISHED." : "NEODLOČENO! NOBENA EKIPA NI PREVLADALA.")
            : winner
              ? (myTeam && myTeam !== "none" && myTeam === winner
                  ? (en
                      ? `YOUR TEAM ${teamLabelFor(winner)} HAS WON THE MISSION`
                      : `VAŠA EKIPA ${teamLabelFor(winner)} JE ZMAGALA MISIJO`)
                  : (myTeam && myTeam !== "none"
                      ? (en
                          ? `THE ENEMY TEAM ${teamLabelFor(winner)} HAS WON THE MISSION`
                          : `NASPROTNA EKIPA ${teamLabelFor(winner)} JE ZMAGALA MISIJO`)
                      : `${en ? "TEAM" : "EKIPA"} ${teamLabelFor(winner)} ${en ? "HAS WON THE MISSION" : "JE ZMAGALA MISIJO"}`))
              : (en ? "OPERATION COMPLETED" : "OPERACIJA KONČANA")}
        </p>
      </div>
      <style>{`@keyframes spo-tie-flash { 0%,100% { box-shadow: 0 0 20px rgba(234,179,8,0.35); } 50% { box-shadow: 0 0 46px rgba(234,179,8,0.75); } }`}</style>

      {/* PODIUM */}
      <p className="text-center font-mono text-[10px] uppercase tracking-[0.28em] mb-4" style={{ color: MUTED }}>
        ▌ {winner
          ? (en ? `TOP OPERATORS · ${teamLabelFor(winner)} TEAM` : `NAJBOLJŠI · ${teamLabelFor(winner)} EKIPA`)
          : (en ? "TOP OPERATORS · OVERALL" : "NAJBOLJŠI · SKUPNO")}
      </p>
      <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end mb-10">
        {podium.map((p, i) => {
          const meta = podiumMeta[i];
          const teamCol = p ? (TEAM_COLOR[p.assigned_team] ?? ACCENT) : "#444";
          const badgeSize = meta.rank === 1 ? 78 : 60;
          return (
            <div key={i} className="flex flex-col items-center min-w-0">
              <div
                className="w-full flex flex-col items-center justify-start"
                style={{
                  height: meta.height,
                  background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 40%, #0a0a0a 100%)",
                  border: "1px solid #2f2f2f",
                  borderTop: "1px solid #4a4a4a",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -12px 24px rgba(0,0,0,0.6), 0 6px 18px rgba(0,0,0,0.5)",
                  paddingTop: 14,
                  position: "relative",
                }}
              >
                {/* metallic badge */}
                <div
                  style={{
                    width: badgeSize,
                    height: badgeSize,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 35% 30%, ${meta.ringOuter} 0%, ${meta.ringInner} 55%, #1a1a1a 100%)`,
                    padding: 3,
                    boxShadow: `0 0 14px ${meta.ringOuter}55, inset 0 0 6px rgba(0,0,0,0.4)`,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background: "radial-gradient(circle at 40% 35%, #2a2a2a 0%, #0e0e0e 80%)",
                      border: `1px solid ${meta.ringInner}`,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Michroma', monospace",
                        fontSize: meta.rank === 1 ? 14 : 11,
                        color: meta.badgeText,
                        letterSpacing: "0.12em",
                        fontWeight: 700,
                        textShadow: `0 1px 2px rgba(0,0,0,0.9)`,
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
                {p && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      bottom: 6,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: teamCol,
                      boxShadow: `0 0 10px ${teamCol}`,
                    }}
                  />
                )}
              </div>
              <div className="text-center mt-3 w-full">
                {p ? (
                  <>
                    <div
                      style={{
                        fontFamily: "'Michroma', monospace",
                        fontSize: "clamp(11px, 3.2vw, 13px)",
                        color: INK,
                        letterSpacing: "0.12em",
                        overflowWrap: "anywhere",
                        lineHeight: 1.3,
                      }}
                    >
                      {p.callsign}{p.operator_type && <span style={{ color: ACCENT, fontSize: 9, marginLeft: 4 }}>· {p.operator_type}</span>}
                    </div>
                    {fmtName(p) && (
                      <div className="font-mono text-[10px] mt-0.5" style={{ color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {fmtName(p)}
                      </div>
                    )}
                    <div
                      className="mt-1"
                      style={{ fontFamily: "'Michroma', monospace", fontSize: 15, color: meta.ringOuter, fontWeight: 700 }}
                    >
                      {p.pts}
                    </div>
                  </>
                ) : (
                  <div className="font-mono text-[10px]" style={{ color: MUTED }}>—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>



      <div className="grid gap-4 md:grid-cols-2">
        {activeTeams.map((team) => {
          const teamCol = TEAM_COLOR[team] ?? ACCENT;
          const members = enriched.filter((p) => p.assigned_team === team);
          const teamDeaths = members.reduce((sum, p) => sum + (p.death_count ?? 0), 0);
          const cols = showDeaths ? "minmax(0,1fr) 44px 48px" : "minmax(0,1fr) 44px";
          return (
            <div key={team} style={{ background: PANEL, border: `1px solid ${teamCol}66` }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${teamCol}44`, fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.16em", color: teamCol, textTransform: "uppercase" }}>
                ▌ {teamLabelFor(team)} {en ? "SCOREBOARD" : "LESTVICA"}
              </div>
              <div className="grid gap-1.5 px-3 py-2 text-[9px] font-mono uppercase tracking-widest" style={{ color: MUTED, gridTemplateColumns: cols }}>
                <span>Callsign</span>
                <span style={{ textAlign: "right", letterSpacing: "0.04em" }}>{en ? "Points" : "Točke"}</span>
                {showDeaths && <span style={{ textAlign: "right", letterSpacing: "0.04em" }}>{en ? "Deaths" : "Smrti"}</span>}
              </div>
              {members.length === 0 ? (
                <p className="text-center py-6 font-mono text-[11px]" style={{ color: MUTED }}>—</p>
              ) : members.map((p) => {
                const real = fmtName(p);
                const infoLen = p.callsign.length + (p.operator_type?.length ?? 0) + real.length;
                const baseSize = infoLen > 40 ? 9 : infoLen > 32 ? 10 : infoLen > 24 ? 11 : 12;
                return (
                  <div key={p.id} className="grid gap-1.5 items-center px-3 py-2 text-[12px] font-mono" style={{ gridTemplateColumns: cols, borderTop: "1px solid rgba(236,227,196,0.06)" }}>
                    <span style={{ color: INK, fontWeight: 700, minWidth: 0, lineHeight: 1.3, fontSize: baseSize, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.callsign}{p.operator_type && <span style={{ color: ACCENT, fontSize: baseSize - 2, marginLeft: 5 }}>· {p.operator_type}</span>}{real && <span style={{ color: MUTED, fontWeight: 400, fontSize: baseSize - 2, marginLeft: 6 }}>({real})</span>}
                    </span>

                    <span style={{ color: INK, fontWeight: 700, textAlign: "right" }}>{p.pts}</span>
                    {showDeaths && <span style={{ color: "#ff7070", textAlign: "right", fontWeight: 700 }}>☠ {p.death_count ?? 0}</span>}
                  </div>
                );
              })}
              {showDeaths && (
                <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] flex items-center justify-between" style={{ borderTop: `1px solid ${teamCol}44`, color: MUTED }}>
                  <span>{t("hudLog.totalDeaths")}</span>
                  <span style={{ color: "#ff7070", fontWeight: 700 }}>☠ {teamDeaths}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {afterGameInstructions && (
        <>
          <div style={{ maxWidth: 720, margin: "28px auto 0", height: 1, background: `linear-gradient(90deg, transparent, ${ACCENT}66, transparent)` }} />
          <div style={{ maxWidth: 720, margin: "18px auto 0", background: PANEL, border: `1px solid ${ACCENT}55`, padding: "14px 16px" }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: ACCENT, textTransform: "uppercase", marginBottom: 8 }}>
              ▌ {en ? "AFTER GAME INSTRUCTIONS" : "NAVODILA PO IGRI"}
            </div>
            <p style={{ color: INK, fontFamily: "monospace", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{afterGameInstructions}</p>
          </div>
        </>
      )}

      {/* Full mission history log */}
      <div style={{ maxWidth: 720, margin: "24px auto 0" }}>
        <HudHistoryLog
          captures={captures}
          deaths={deathLog}
          respawnEnabled={respawnEnabled}
          teamLabelFor={teamLabelFor}
          teamColor={(x) => TEAM_COLOR[x] ?? ACCENT}
          nodeNames={NODE_NAMES}
          maxHeight={360}
        />
      </div>
    </div>
  );
}

export function useDeathLog(fieldId: string): DeathEvent[] {
  const [events, setEvents] = useState<DeathEvent[]>(() => readDeathEvents(fieldId));
  useEffect(() => {
    setEvents(readDeathEvents(fieldId));
    const onUpdate = () => setEvents(readDeathEvents(fieldId));
    window.addEventListener("spartanops:deathlog", onUpdate);
    return () => window.removeEventListener("spartanops:deathlog", onUpdate);
  }, [fieldId]);
  return events;
}

function HudNoticeFeed({
  captures,
  roster,
  myTeam,
  meId,
  meCallsign,
  teamLabelFor,
  respawnEnabled,
  fieldId,
}: {
  captures: Capture[];
  roster: Checkin[];
  myTeam: string;
  meId?: string;
  meCallsign?: string;
  teamLabelFor: (t: string) => string;
  respawnEnabled: boolean;
  fieldId: string;
}) {
  const t = useT();
  const { notices, push, dismiss } = useHudNotices();
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const deathRef = useRef<Map<string, string>>(new Map());
  const deathPrimedRef = useRef(false);

  // Sector captures -> tactical notice + team/enemy SFX.
  useEffect(() => {
    if (!primedRef.current) {
      captures.forEach((c) => seenRef.current.add(c.id));
      primedRef.current = true;
      return;
    }
    const fresh = captures.filter((c) => !seenRef.current.has(c.id));
    if (fresh.length === 0) return;
    fresh.forEach((c) => seenRef.current.add(c.id));
    fresh.slice(-3).forEach((c) => {
      const color = TEAM_COLOR[c.team] ?? ACCENT;
      const mine = !!meCallsign && String(c.player_callsign ?? "").trim().toLowerCase() === meCallsign.trim().toLowerCase();
      if (!mine) push({
        id: `cap-${c.id}`,
        kind: "capture",
        title: t("hudNotif.captureTitle"),
        color,
        at: new Date(c.captured_at).getTime() || Date.now(),
        text: fillTemplate(t("hudNotif.capture"), {
          player: c.player_callsign ? String(c.player_callsign).toUpperCase() : "—",
          sector: NODE_NAMES[c.point_number - 1] ?? `#${c.point_number}`,
          team: teamLabelFor(c.team),
        }),
      });
      const evt = c.team === myTeam ? "spartanops:sfx-team-capture" : "spartanops:sfx-enemy-capture";
      try { window.dispatchEvent(new Event(evt)); } catch { /* ignore */ }
    });
  }, [captures, myTeam, meCallsign, push, t, teamLabelFor]);

  // Player deaths (respawn lock started) -> notice + respawn SFX.
  useEffect(() => {
    if (!respawnEnabled) return;
    const next = new Map<string, string>();
    const fresh: Checkin[] = [];
    roster.forEach((p) => {
      const v = p.respawn_unlock_at ?? "";
      next.set(p.id, v);
      const prev = deathRef.current.get(p.id) ?? "";
      const isNew = v && v !== prev && Date.parse(v) > Date.now();
      if (deathPrimedRef.current && isNew) fresh.push(p);
    });
    deathRef.current = next;
    if (!deathPrimedRef.current) {
      deathPrimedRef.current = true;
      return;
    }
    if (fresh.length > 0) {
      appendDeathEvents(
        fieldId,
        fresh.map((p) => ({
          id: `${p.id}-${p.respawn_unlock_at}`,
          callsign: String(p.callsign ?? "—"),
          team: p.assigned_team,
          at: Date.now(),
        })),
      );
      try { window.dispatchEvent(new Event("spartanops:deathlog")); } catch { /* ignore */ }
    }
    fresh.slice(-3).forEach((p) => {
      const color = TEAM_COLOR[p.assigned_team] ?? ACCENT;
      if (p.id !== meId) push({
        id: `rsp-${p.id}-${p.respawn_unlock_at}`,
        kind: "respawn",
        title: t("hudNotif.respawnTitle"),
        color,
        at: Date.now(),
        text: fillTemplate(t("hudNotif.respawn"), {
          player: String(p.callsign ?? "—").toUpperCase(),
          team: teamLabelFor(p.assigned_team),
        }),
      });
      try { window.dispatchEvent(new Event("spartanops:sfx-respawn")); } catch { /* ignore */ }
    });
  }, [roster, respawnEnabled, meId, push, t, teamLabelFor, fieldId]);

  return <HudNotificationStack notices={notices} onDismiss={dismiss} />;
}


function WarningModal({ message, en, onAcknowledge }: { message: string; en: boolean; onAcknowledge: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "#141008", border: `2px solid ${ACCENT}`, boxShadow: `0 0 40px ${ACCENT}88`, padding: "28px 24px", maxWidth: 480, width: "100%", textAlign: "center" }}>
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 15, color: ACCENT, letterSpacing: "0.16em", marginBottom: 16, textTransform: "uppercase", fontWeight: 700 }}>
          {en ? "⚠ MARSHAL WARNING" : "⚠ OPOZORILO MARŠALA"}
        </p>
        <p className="text-[13px]" style={{ color: INK, lineHeight: 1.7, marginBottom: 22, whiteSpace: "pre-wrap" }}>
          {message}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onAcknowledge(); } finally { setBusy(false); } }}
          style={{ width: "100%", background: ACCENT, color: BG, padding: "13px 18px", fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, cursor: busy ? "wait" : "pointer", border: "none", opacity: busy ? 0.75 : 1 }}
        >
          {en ? "// ACKNOWLEDGE & ALIGN" : "// POTRDI IN NADALJUJ"}
        </button>
      </div>
    </div>
  );
}





function PausedOverlay({ en }: { en: boolean }) {
  const title = en ? "MATCH PAUSED" : "TEKMA JE PAVZIRANA";
  const desc = en
    ? "The Marshal has temporarily paused the game. Hold your position and wait for further instructions."
    : "Maršal je začasno zaustavil igro. Ostani na svojem položaju in počakaj na nadaljnja navodila.";
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(4,6,3,0.95)",
        backdropFilter: "blur(10px)",
        display: "grid", placeItems: "center", padding: 20,
      }}
    >
      <div style={{
        background: "#14100a",
        border: "2px solid #f5b041",
        animation: "spops-hazard 2.2s ease-in-out infinite",
        padding: "34px 26px", maxWidth: 520, width: "100%", textAlign: "center",
      }}>
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 12, animation: "spops-hold 2.2s ease-in-out infinite" }} aria-hidden>
          ✋
        </div>
        <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.3em", color: "#f5b041", textTransform: "uppercase", marginBottom: 8 }}>
          ⏸ {en ? "MARSHAL COMMAND" : "MARŠALSKA KOMANDA"}
        </p>
        <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(20px, 4.5vw, 28px)", color: "#f5b041", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, marginTop: 4, marginBottom: 18, textShadow: "0 0 24px rgba(245,176,65,0.45)" }}>
          {title}
        </h2>
        <p style={{ color: INK, fontSize: 14, lineHeight: 1.75, letterSpacing: "0.02em" }}>
          {desc}
        </p>
      </div>
      <style>{`
        @keyframes spops-hazard {
          0%,100% { box-shadow: 0 0 20px rgba(245,176,65,0.25), inset 0 0 20px rgba(245,176,65,0.05); border-color: rgba(245,176,65,0.55); }
          50% { box-shadow: 0 0 70px rgba(245,176,65,0.65), inset 0 0 34px rgba(245,176,65,0.12); border-color: #f5b041; }
        }
        @keyframes spops-hold { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
      `}</style>
    </div>
  );
}
