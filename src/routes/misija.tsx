import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExperienceBadge, EXPERIENCE_LEVELS } from "@/components/ExperienceBadge";
import { supabase } from "@/integrations/supabase/client";
import { spartanopsAckTeamChange, spartanopsSelectTeam } from "@/lib/spartanops-game.functions";
import { spartanopsUpsertCheckin, spartanopsGetMyCheckin, spartanopsDeleteMyCheckin, spartanopsGetParticipantRoster, spartanopsGetServerTime, spartanopsGetRespawnLock } from "@/lib/spartanops-checkin.functions";
import { spartanopsAcknowledgeWarning } from "@/lib/spartanops-spartacus.functions";
import { SpartacusAlerts } from "@/components/SpartanOpsConsole";

import { OfflineBanner } from "@/components/OfflineBanner";
import { TacticalCompass } from "@/components/TacticalCompass";
import { Crosshair, Shield, ArrowUp } from "lucide-react";
import { useLang } from "@/lib/i18n";
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
  if (state?.event_name?.trim()) return state.event_name.trim();
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

function respawnLockKey(fieldId: string, sessionId: string): string {
  return `spartanops:respawn:${fieldId}:${sessionId}`;
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
  const en = lang === "en";
  const { field: rawField, point: targetPoint, preview, marshal: marshalMode, preset } = Route.useSearch();
  const field = useMemo(() => toDbField(rawField), [rawField]);
  const ackFn = useServerFn(spartanopsAckTeamChange);
  const selectTeamFn = useServerFn(spartanopsSelectTeam);
  const getParticipantRosterFn = useServerFn(spartanopsGetParticipantRoster);
  const getServerTimeFn = useServerFn(spartanopsGetServerTime);
  const getRespawnLockFn = useServerFn(spartanopsGetRespawnLock);

  const [sessionId, setSessionId] = useState("");
  const [state, setState] = useState<GameState | null>(null);
  const [dbMe, setDbMe] = useState<Checkin | null>(null);
  const [ghostMe, setGhostMe] = useState<Checkin | null>(null);
  const [roster, setRoster] = useState<Checkin[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [showTeamSelect, setShowTeamSelect] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [respawnUntil, setRespawnUntil] = useState(0);
  const me = preview ? ghostMe : dbMe;
  const setMe = (v: Checkin | null) => (preview ? setGhostMe(v) : setDbMe(v));

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
    let alive = true;
    syncServerClock()
      .catch(() => {});
    return () => { alive = false; };
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
    const remoteTimer = setInterval(syncRemote, 1500);
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

    const load = async () => {
      // Always try Supabase first — every lobby (legacy fixed IDs + new UUIDs)
      // now has a game_state row created by the lobby bootstrap trigger.
      const { data } = await supabase
        .from("spartanops_game_state")
        .select("*")
        .eq("field_id", field)
        .maybeSingle();
      if (alive && data) {
        setState(data as unknown as GameState);
        if ((data as any).match_started_at) syncServerClock().catch(() => {});
      }
    };
    load();

    // Safety net: if the DB fetch (or any subscription) hasn't populated state
    // within 1s, drop into the local onboarding flow so the player never sees
    // an infinite loading screen.
    const timeout = setTimeout(() => {
      if (!alive) return;
      setState((prev) => prev ?? synthesizeLocal());
    }, 2500);

    const ch = supabase
      .channel(`misija_state_${field}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spartanops_game_state", filter: `field_id=eq.${field}` },
        (p) => {
          if (p.new) {
            setState(p.new as unknown as GameState);
            if ((p.new as any).match_started_at) syncServerClock().catch(() => {});
          }
        },
      )
      .subscribe();
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
    const load = async () => {
      if (!sessionId) return;
      const res = await getParticipantRosterFn({ data: { fieldId: field, sessionId } });
      if (alive) setRoster((res?.ok ? res.rows : []) as unknown as Checkin[]);
    };
    load();
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
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyCheckinFn({ data: { fieldId: field, sessionId } });
        const row = res?.row as Checkin | null;
        if (cancelled) return;
        if (!row) { setDbMe(null); return; }
        // Prefer the latest row from the realtime roster (fresh assigned_team etc.),
        // fall back to the server-fn row (has PII); identify by id, not session_id.
        const fresh = roster.find((r) => r.id === row.id);
        setDbMe(fresh ? { ...row, ...fresh } : row);
      } catch {
        if (!cancelled) setDbMe(null);
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

  if (!sessionId || !state) {
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
    ? (en ? TEAM_LABEL_EN[me.assigned_team] : TEAM_LABEL[me.assigned_team])
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
              team. From now on, you hold positions and capture points for this faction.
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


  // Force endgame view when timer expires client-side, even if the DB status
  // hasn't flipped to "ended" yet — guarantees the After-Action Report renders.
  const startMsForEnd = state.match_started_at ? new Date(state.match_started_at).getTime() : null;
  const matchEndsAtMs = startMsForEnd ? startMsForEnd + state.match_duration_minutes * 60_000 : null;
  const timerExpired = !!(matchEndsAtMs && currentTime >= matchEndsAtMs);

  // 1a) PRE-MATCH WINDOW — marshal has scheduled a start in the future.
  // Only players who have already selected a team enter the HUD/countdown.
  const preMatchSecEarly = startMsForEnd && currentTime < startMsForEnd ? Math.ceil((startMsForEnd - currentTime) / 1000) : 0;
  if (preMatchSecEarly > 0) {
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }}>
        <OfflineBanner />
        {reassignedBanner}
        {warningOverlay}
        {pauseOverlay}
        <PreMatchCountdown seconds={preMatchSecEarly} polygon={state.current_polygon_name} eventName={state.event_name} gamemode={state.gamemode} pointTarget={state.point_target} settings={state.settings} en={en} state={state} />
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
          <AbortMissionButton field={field} en={en} />
        </div>
      );
    }
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }}>
        <OfflineBanner />
        {reassignedBanner}
        {warningOverlay}
        {pauseOverlay}
        <LiveMatch state={state} captures={captures} now={currentTime} roster={roster} />
        <AbortMissionButton field={field} en={en} />
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
        <EndgameReport state={state} roster={roster} captures={captures} en={en} now={currentTime} />
        <AbortMissionButton field={field} en={en} />
        {preview && <PreviewReturnButton />}
      </div>
    );
  }

  // 4) INACTIVE (closed/lobby) — team select + waiting. Pre-match countdown if scheduled.
  const startMs = state.match_started_at ? new Date(state.match_started_at).getTime() : null;
  const preMatchSec = startMs && currentTime < startMs ? Math.ceil((startMs - currentTime) / 1000) : 0;

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", paddingTop: 112 }}>
      <OfflineBanner />
      {reassignedBanner}
        {warningOverlay}
      {preMatchSec > 0 && <PreMatchCountdown seconds={preMatchSec} polygon={fieldTitleFromState(state, field)} eventName={missionTitleFromState(state, field)} gamemode={state.gamemode} pointTarget={state.point_target} settings={state.settings} en={en} state={state} /> }
      <div className="max-w-5xl mx-auto px-4 py-8">
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
        <AbortMissionButton field={field} en={en} />
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

function AbortMissionButton({ field, en }: { field: string; en: boolean }) {
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
    <div className="mt-4 mb-2 flex flex-col items-center px-4">
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

function TelemetryStatusStrip({ en }: { en: boolean }) {
  const [state, setState] = useState<"disconnected" | "granted" | "denied">("disconnected");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (typeof navigator !== "undefined" && "permissions" in navigator) {
          const r = await (navigator as any).permissions.query({ name: "geolocation" });
          if (!live) return;
          if (r?.state === "granted") setState("granted");
          else if (r?.state === "denied") setState("denied");
        }
      } catch { /* ignore */ }
      try {
        if (typeof window !== "undefined" && localStorage.getItem(GPS_OK_KEY) === "1") {
          if (live) setState((s) => (s === "denied" ? s : "granted"));
        }
      } catch { /* ignore */ }
    })();
    return () => { live = false; };
  }, []);

  const enable = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          localStorage.setItem(GPS_OK_KEY, "1");
          localStorage.setItem(GPS_FIX_KEY, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() }));
        } catch { /* ignore */ }
        setState("granted");
      },
      () => setState("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const granted = state === "granted";
  const color = granted ? "#3ddc84" : ACCENT;

  return (
    <div
      className="mx-auto mt-2 mb-6"
      style={{
        maxWidth: 460,
        border: `1px solid ${color}66`,
        background: `linear-gradient(180deg, ${color}0d, rgba(0,0,0,0.4))`,
        padding: "12px 14px",
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontFamily: "'Michroma', monospace",
              fontSize: 10.5,
              letterSpacing: "0.16em",
              color,
              textTransform: "uppercase",
              fontWeight: 700,
              margin: 0,
            }}
          >
            📡 {granted
              ? (en ? "TELEMETRY STATUS: SECURED (LAT/LON ACTIVE)" : "STATUS TELEMETRIJE: ZAVAROVANO (GPS AKTIVEN)")
              : (en ? "TELEMETRY STATUS: DISCONNECTED" : "STATUS TELEMETRIJE: PREKINJENO")}
          </p>
          <p style={{ fontFamily: "monospace", fontSize: 10, color: MUTED, marginTop: 4, lineHeight: 1.55 }}>
            {en
              ? "Required for SPARTACUS operational anti-cheat validation."
              : "Obvezno za SPARTACUS preverjanje varnosti na terenu."}
          </p>
        </div>
        {!granted && (
          <button
            type="button"
            onClick={enable}
            style={{
              background: `${ACCENT}18`,
              border: `1px solid ${ACCENT}`,
              color: ACCENT,
              padding: "8px 12px",
              fontFamily: "'Michroma', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            [ {en ? "ENABLE GPS" : "OMOGOČI GPS"} ]
          </button>
        )}
      </div>
    </div>
  );
}

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
          localStorage.setItem(GPS_FIX_KEY, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() }));
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
  const showTeamBadge = p.assigned_team && p.assigned_team !== "none";
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
      <span
        className="min-w-0 flex-1"
        style={{ color: INK, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {p.callsign}
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

function RespawnRulesBlock({ settings, en = false }: { settings?: GameSettings | null; en?: boolean }) {
  const r = settings?.respawn;
  const lines: string[] = [];
  if (!r || !r.enabled) {
    lines.push(en ? "Respawn rule: You return to the game instantly (instant respawn)." : "Respawn pravila: V igro se vrnete takoj (instant respawn).");
  } else {
    if (r.mode === "linear") {
      const min = Math.round((r.linearSec ?? 30) / 6) / 10;
      lines.push(en ? `Linear timer: after every elimination you respawn in ${min} minutes.` : `Linearni čas: vedno ko umrete se vrnete (respawnate) v igro čez: ${min} minut.`);
    } else {
      lines.push(en ? "Dynamic timer: the longer the mission runs, the longer respawns take." : "Dinamični čas: dlje kot traja igra, dlje traja da se vrnete v igro.");
    }
    if (r.visibility === "all") {
      lines.push(en ? "WARNING: enemy operators will see your respawn countdown." : "POZOR: vaši nasprotniki bodo videli ko čakate na respawn.");
    } else {
      lines.push(en ? "Enemy operators cannot see your respawn timers." : "Vaši nasprotniki ne bodo videli vaših respawn časov.");
    }
  }
  return (
    <div style={{ marginTop: 14, padding: "10px 14px", border: `1px dashed ${ACCENT}55`, background: "rgba(0,0,0,0.35)", maxWidth: 520 }}>
      {lines.map((l, i) => (
        <p key={i} className="text-[11px]" style={{ color: i === 0 ? INK : MUTED, lineHeight: 1.6, fontFamily: "monospace", margin: 0 }}>
          {l}
        </p>
      ))}
    </div>
  );
}

function PreMatchCountdown({ seconds, polygon, eventName, gamemode, pointTarget, settings, en = false, state }: { seconds: number; polygon: string | null; eventName?: string | null; gamemode?: "domination" | "search_destroy" | null; pointTarget?: number; settings?: GameSettings | null; en?: boolean; state?: GameState }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const modeLabel = gamemode === "search_destroy" ? "SEARCH & DESTROY" : "DOMINATION";
  const description = (settings as any)?.missionDescription as string | undefined;
  const configuredMission = (settings as any)?.missionName as string | undefined;
  const missionName = (eventName?.trim() || configuredMission?.trim() || polygon?.trim() || (en ? "ACTIVE MISSION" : "AKTIVNA MISIJA")).toUpperCase();
  const fieldName = polygon?.trim() && polygon.trim().toUpperCase() !== missionName ? polygon.trim().toUpperCase() : null;
  const duration = state?.match_duration_minutes ?? 0;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto p-4 text-center"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(224,176,78,0.14), rgba(11,13,9,0.99) 34%, #050604 100%)", color: INK, paddingTop: 112, paddingBottom: 40 }}
    >
      <p style={{ color: ACCENT, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", marginBottom: 8 }}>
        SpartanOps
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
        MISSION: {missionName}
      </h2>
      {fieldName && (
        <p className="font-mono uppercase mt-2" style={{ color: MUTED, fontSize: 10, letterSpacing: "0.22em" }}>
          {en ? "FIELD" : "POLIGON"}: {fieldName} · {modeLabel}
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
      {description && (
        <div
          className="max-w-2xl mt-4"
          style={{
            border: `1px solid ${ACCENT}55`,
            background: "rgba(0,0,0,0.42)",
            padding: "12px 14px",
            textAlign: "left",
            width: "min(640px, 100%)",
          }}
        >
          <p style={{ color: ACCENT, fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 6 }}>
            {en ? "// MISSION BRIEFING" : "// NAVODILA MISIJE"}
          </p>
          <p style={{ color: INK, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {description}
          </p>
        </div>
      )}
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
      {gamemode !== "search_destroy" && !description?.trim() && (
        <p className="max-w-2xl text-[12px]" style={{ color: MUTED, lineHeight: 1.7, fontStyle: "italic", marginTop: 0, marginBottom: 14 }}>
          {en
            ? `Your mission is to capture ${pointTarget ?? 50} points on the field and hold them for as long as possible — capture points by scanning the QR codes at the flagged locations.`
            : `Vaša misija je zavzeti ${pointTarget ?? 50} točk na poligonu in jih braniti čim dlje časa — točke zavzamete z skeniranjem QR kod ob označenih lokacijah.`}
        </p>
      )}
      {state && (
        <div style={{ width: "100%", maxWidth: 720, margin: "0 auto 12px", border: `1px solid ${ACCENT}55`, boxShadow: "0 20px 60px rgba(0,0,0,0.55)" }}>
          <TacticalMapContent state={state} en={en} nodeHoldersOverride={FREE_NODES} />
          <div style={{ position: "relative", height: 0 }}>
            <div style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(0,0,0,0.55)", padding: 6, border: `1px solid ${ACCENT}55` }}>
              <TacticalCompass size={56} />
            </div>
          </div>
        </div>
      )}
      <RespawnRulesBlock settings={settings} en={en} />
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
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, pointerEvents: "none" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(8,10,7,0.78)",
            border: `1px solid #ff5a5a`,
            boxShadow: `0 0 10px rgba(255,90,90,0.55), inset 0 0 8px rgba(0,0,0,0.6)`,
            display: "grid",
            placeItems: "center",
          }}
          title="North"
        >
          <ArrowUp size={20} color="#ff5a5a" strokeWidth={2.6} />
        </div>
      </div>
      {!positions["compass"] && (
        <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 10, pointerEvents: "none" }}>
          <TacticalCompass size={72} />
        </div>
      )}
    </div>
  );
}

function TacticalMap({ state, captures, en, hasPositions }: { state: GameState; captures: Capture[]; en: boolean; hasPositions: boolean }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1.6);
  const positions = state.node_positions ?? {};
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
          className="fixed inset-0 z-[80] flex flex-col"
          style={{ background: "rgba(4,6,3,0.98)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${ACCENT}44` }}>
            <div style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase" }}>
              // TACTICAL MAP
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, z - 0.3))}
                style={{ background: "transparent", color: INK, border: `1px solid ${ACCENT}55`, padding: "6px 10px", fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}
                aria-label="Zoom out"
              >−</button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, z + 0.3))}
                style={{ background: "transparent", color: INK, border: `1px solid ${ACCENT}55`, padding: "6px 10px", fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}
                aria-label="Zoom in"
              >+</button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: ACCENT, color: BG, border: "none", padding: "6px 12px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}
              >
                [ {en ? "CLOSE TACTICAL MAP" : "ZAPRI ZEMLJEVID"} ]
              </button>
            </div>
          </div>
          <div
            className="flex-1"
            style={{ overflow: "auto", touchAction: "pinch-zoom", WebkitOverflowScrolling: "touch" }}
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
        </div>
      )}
    </>
  );
}



function LiveMatch({ state, captures, now, roster }: { state: GameState; captures: Capture[]; now: number; roster: Checkin[] }) {
  const { lang } = useLang();
  const en = lang === "en";
  const teamLabelFor = (t: string) => {
    if (!en) return TEAM_LABEL[t] ?? t.toUpperCase();
    if (t === "modra") return "BLUE";
    if (t === "rdeca") return "RED";
    if (t === "rumena") return "YELLOW";
    return t.toUpperCase();
  };
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
    <div className="max-w-5xl mx-auto px-4 py-6" style={{ paddingTop: 112 }}>
      <PointCapturedOverlay captures={visibleCaptures} teamLabelFor={teamLabelFor} en={en} />
      {preMatchSec > 0 && <PreMatchCountdown seconds={preMatchSec} polygon={fieldTitleFromState(state, "")} eventName={missionTitleFromState(state, "")} gamemode={state.gamemode} pointTarget={state.point_target} settings={state.settings} en={en} state={state} />}

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

      <p className="text-center font-mono text-[11px] mt-2 mb-6" style={{ color: MUTED, lineHeight: 1.7 }}>
        {en
          ? "Scan the QR codes at flagged locations to score points for your team."
          : "Z skeniranjem QR kode na posameznih lokacijah z zastavico vaša ekipa pridobiva točke."}
      </p>

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
                    {teamLabelFor(t)} {en ? "TEAM" : "EKIPA"}
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

      <div className="text-center mb-6 font-mono text-[12px] uppercase tracking-widest" style={{ color: ACCENT }}>
        {en ? "TIME REMAINING:" : "Preostali čas:"}{" "}
        <span style={{ color: INK, fontSize: 20 }}>
          {mm}:{ss}
        </span>
      </div>

      {/* Map with positioned node markers — click to open zoomable modal */}
      <TacticalMap state={state} captures={visibleCaptures} en={en} hasPositions={hasPositions} />


      {/* Capture log */}
      <div style={{ background: PANEL, border: `1px solid rgba(236,227,196,0.12)` }}>
        <div
          style={{
            padding: "10px 14px",
            borderBottom: `1px solid rgba(236,227,196,0.1)`,
            fontFamily: "monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: ACCENT,
            textTransform: "uppercase",
          }}
        >
          ▌ {en ? "CAPTURE LOG" : "DNEVNIK ZAVZEMANJ"}
        </div>
        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {visibleCaptures.length === 0 && (
            <p style={{ color: MUTED, fontStyle: "italic", padding: 16, fontSize: 12, textAlign: "center" }}>
              {en ? "No captures recorded." : "Še ni zavzetij."}
            </p>
          )}
          {visibleCaptures.map((c) => {
            const t = new Date(c.captured_at);
            const time = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`;
            return (
              <div
                key={c.id}
                style={{
                  padding: "8px 14px",
                  borderTop: "1px solid rgba(236,227,196,0.05)",
                  fontSize: 12,
                  fontFamily: "monospace",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <span style={{ color: MUTED }}>{time}</span>
                <span style={{ color: TEAM_COLOR[c.team], fontWeight: 700, minWidth: 70 }}>{teamLabelFor(c.team)}</span>
                <span style={{ color: INK }}>
                  {en ? "Point" : "Točka"} {c.point_number} ({NODE_NAMES[c.point_number - 1]})
                </span>
                <span style={{ color: MUTED, marginLeft: "auto" }}>{c.player_callsign ?? "—"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player scoreboard (capture counts per player) */}
      {state.settings?.capturePointsScoring && (
        <PlayerScoreboard roster={roster} captures={visibleCaptures} respawn={state.settings?.respawn} en={en} />
      )}

      {/* Separator between scoreboard and the rest of the HUD */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${ACCENT}66, transparent)`, margin: "24px 0" }} />

      {/* Mission description / instructions — rendered under the scoreboard */}
      {((state.settings as any)?.missionDescription as string | undefined)?.trim() && (
        <div style={{ marginTop: 4, background: PANEL, border: `1px solid ${ACCENT}55`, padding: "12px 14px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 }}>
            ▌ {en ? "MISSION DESCRIPTION / INSTRUCTIONS" : "OPIS MISIJE / NAVODILA"}
          </div>
          <p style={{ fontFamily: "monospace", fontSize: 12, color: INK, lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0 }}>
            {(state.settings as any).missionDescription}
          </p>
        </div>
      )}

      {/* Respawn rules (Timer type) — always visible in-match */}
      <div className="mt-4 flex justify-center">
        <RespawnRulesBlock settings={state.settings} en={en} />
      </div>
    </div>
  );
}

function PlayerScoreboard({ roster, captures, respawn, en = false }: { roster: Checkin[]; captures: Capture[]; respawn?: RespawnSettings; en?: boolean }) {
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
  const teamLabelFor = (t: string) => {
    if (!en) return TEAM_LABEL[t] ?? t.toUpperCase();
    if (t === "modra") return "BLUE";
    if (t === "rdeca") return "RED";
    if (t === "rumena") return "YELLOW";
    return t.toUpperCase();
  };

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
              {en ? `${teamLabelFor(t)} TEAM SCOREBOARD` : `${teamLabelFor(t)} · SCOREBOARD`}
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(236,227,196,0.08)" }}>
              <div className="grid gap-2 px-3 py-1 text-[9px] font-mono uppercase tracking-widest" style={{ color: MUTED, gridTemplateColumns: `28px minmax(0,1fr) 56px${respawn?.publicDeaths ? " 40px" : ""}${respawn?.enabled ? " 70px" : ""}` }}>
                <span></span>
                <span>{en ? "Callsign" : "Callsign"}</span>
                <span style={{ textAlign: "right" }}>{en ? "PTS" : "TOČ"}</span>
                {respawn?.publicDeaths && <span style={{ textAlign: "right" }} title={en ? "Deaths" : "Smrti"}>☠</span>}
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
                return (
                  <div key={p.id} className="grid gap-2 items-center px-3 py-2 text-[12px] font-mono" style={{ gridTemplateColumns: `28px minmax(0,1fr) 56px${respawn?.publicDeaths ? " 40px" : ""}${respawn?.enabled ? " 70px" : ""}` }}>
                    <span style={{ color: ACCENT, display: "inline-flex", alignItems: "center" }}>
                      <ExperienceBadge level={p.experience_level} size={14} />
                    </span>
                    <span style={{ color: INK, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {p.callsign}
                      {real && <span style={{ color: MUTED, fontWeight: 400, fontSize: 10, marginLeft: 4 }}>({real})</span>}
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: BG,
  color: INK,
  border: "1px solid rgba(236,227,196,0.18)",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "monospace",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: 6,
          fontFamily: "monospace",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function EndgameSoundtrackTrigger() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spartanops:match-end"));
  }, []);
  return null;
}

function EndgameReport({ state, roster, captures, en, now }: { state: GameState; roster: Checkin[]; captures: Capture[]; en: boolean; now: number }) {
  useEffect(() => {
    return () => {
      try { window.dispatchEvent(new Event("spartanops:debrief-exit")); } catch { /* ignore */ }
    };
  }, []);
  const teamLabelFor = (t: string) => {
    if (!en) return TEAM_LABEL[t] ?? t.toUpperCase();
    if (t === "modra") return "BLUE";
    if (t === "rdeca") return "RED";
    if (t === "rumena") return "YELLOW";
    return t.toUpperCase();
  };
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
              ? `${teamLabelFor(winner)} ${en ? "TEAM HAS WON THE OPERATION!" : "EKIPA JE ZMAGALA OPERACIJO!"}`
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
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.callsign}
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



      {/* GLOBAL LEADERBOARD */}
      <div style={{ background: PANEL, border: `1px solid ${ACCENT}44` }}>
        <div
          style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${ACCENT}33`,
            fontFamily: "'Michroma', monospace",
            fontSize: 12,
            letterSpacing: "0.2em",
            color: ACCENT,
            textTransform: "uppercase",
          }}
        >
          ▌ {en ? "GLOBAL LEADERBOARD" : "SKUPNA LESTVICA"}
        </div>
        <div className="grid gap-2 px-3 py-2 text-[9px] font-mono uppercase tracking-widest" style={{ color: MUTED, gridTemplateColumns: "32px minmax(0,1fr) 70px 60px" }}>
          <span>#</span>
          <span>Callsign</span>
          <span style={{ textAlign: "center" }}>{en ? "TEAM" : "EKIPA"}</span>
          <span style={{ textAlign: "right" }}>{en ? "POINTS" : "TOČ"}</span>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {enriched.length === 0 && (
            <p className="text-center py-6 font-mono text-[11px]" style={{ color: MUTED }}>
              {en ? "— no operators —" : "— brez podatkov —"}
            </p>
          )}
          {enriched.map((p, idx) => {
            const teamCol = TEAM_COLOR[p.assigned_team] ?? "#666";
            const real = fmtName(p);
            return (
              <div
                key={p.id}
                className="grid gap-2 items-center px-3 py-2 text-[12px] font-mono"
                style={{
                  gridTemplateColumns: "32px minmax(0,1fr) 70px 60px",
                  borderTop: "1px solid rgba(236,227,196,0.06)",
                  background: idx < 3 ? `linear-gradient(90deg, ${teamCol}12, transparent)` : "transparent",
                }}
              >
                <span style={{ color: idx < 3 ? ACCENT : MUTED, fontWeight: 700 }}>#{idx + 1}</span>
                <span style={{ color: INK, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                  {p.callsign}
                  {real && <span style={{ color: MUTED, fontWeight: 400, fontSize: 10, marginLeft: 6 }}>({real})</span>}
                </span>
                <span
                  style={{
                    textAlign: "center",
                    color: teamCol,
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  {teamLabelFor(p.assigned_team)}
                </span>
                <span style={{ color: INK, fontWeight: 700, textAlign: "right" }}>{p.pts}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PointCapturedOverlay({ captures, teamLabelFor, en }: { captures: Capture[]; teamLabelFor: (t: string) => string; en: boolean }) {
  const [toasts, setToasts] = useState<Array<{ id: string; team: string; node: number; player: string | null }>>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    if (!primedRef.current) {
      captures.forEach((c) => seenRef.current.add(c.id));
      primedRef.current = true;
      return;
    }
    const fresh = captures.filter((c) => !seenRef.current.has(c.id));
    if (fresh.length === 0) return;
    fresh.forEach((c) => seenRef.current.add(c.id));
    const additions = fresh.slice(-3).map((c) => ({
      id: c.id,
      team: c.team,
      node: c.point_number,
      player: c.player_callsign,
    }));
    setToasts((prev) => [...prev, ...additions]);
    additions.forEach((a) => {
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== a.id)), 3200);
    });
  }, [captures]);

  if (toasts.length === 0) return null;
  return (
    <div style={{ position: "fixed", top: 96, left: 0, right: 0, zIndex: 65, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", padding: "0 16px" }}>
      {toasts.map((t) => {
        const col = TEAM_COLOR[t.team] ?? ACCENT;
        const label = teamLabelFor(t.team);
        const node = NODE_NAMES[t.node - 1] ?? `#${t.node}`;
        return (
          <div
            key={t.id}
            style={{
              background: "rgba(10,12,10,0.92)",
              border: `1.5px solid ${col}`,
              borderLeft: `4px solid ${col}`,
              boxShadow: `0 0 24px -4px ${col}88`,
              padding: "10px 16px",
              maxWidth: 420,
              width: "100%",
              fontFamily: "'Michroma', monospace",
              fontSize: 11,
              color: INK,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              animation: "spops-capture-toast 320ms ease-out",
            }}
          >
            <span style={{ color: col, fontWeight: 700 }}>🎯 {en ? "POINT CAPTURED" : "TOČKA ZAVZETA"}</span>
            <div style={{ marginTop: 4, fontSize: 10, letterSpacing: "0.12em", color: MUTED }}>
              <span style={{ color: col }}>{label}</span> · <strong style={{ color: INK }}>{node}</strong>
              {t.player ? <> · {t.player}</> : null}
            </div>
          </div>
        );
      })}
      <style>{`@keyframes spops-capture-toast{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
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
  const title = en ? "// OPERATION PAUSED" : "// OPERACIJA PREKINJENA";
  const desc = en
    ? "The Marshal has temporarily frozen the match. Active telemetry, timers, and QR scanning protocols are suspended until further notice. Remain at your current positions."
    : "Maršal je začasno zamrznil igro. Aktivna telemetrija, števci in protokoli za skeniranje QR kod so do nadaljnjega onemogočeni. Ostanite na svojih trenutnih položajih.";
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(4,6,3,0.94)",
        backdropFilter: "blur(10px)",
        display: "grid", placeItems: "center", padding: 20,
        animation: "spops-pause-pulse 2.4s ease-in-out infinite",
      }}
    >
      <div style={{
        background: "#14100a", border: `2px solid ${ACCENT}`,
        boxShadow: `0 0 60px ${ACCENT}55, inset 0 0 30px rgba(224,176,78,0.08)`,
        padding: "34px 26px", maxWidth: 520, width: "100%", textAlign: "center",
      }}>
        <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.3em", color: ACCENT, textTransform: "uppercase", marginBottom: 8 }}>
          ⏸ {en ? "MARSHAL COMMAND" : "MARŠALSKA KOMANDA"}
        </p>
        <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(20px, 4.5vw, 28px)", color: ACCENT, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, marginTop: 4, marginBottom: 18, textShadow: `0 0 24px ${ACCENT}66` }}>
          {title}
        </h2>
        <p style={{ color: INK, fontSize: 14, lineHeight: 1.75, letterSpacing: "0.02em" }}>
          {desc}
        </p>
      </div>
      <style>{`@keyframes spops-pause-pulse { 0%,100% { background: rgba(4,6,3,0.94); } 50% { background: rgba(30,20,4,0.94); } }`}</style>
    </div>
  );
}
