import { memo, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Award, ChevronUp, ChevronsUp, Compass, Pause, Play, RotateCcw, Square, Trash2, Upload, MapPin, Copy, Check, AlertTriangle, ShieldOff, ShieldCheck, ArrowLeftRight } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TacticalCompass } from "@/components/TacticalCompass";

import { supabase } from "@/integrations/supabase/client";
import { OfflineBanner } from "@/components/OfflineBanner";
import {
  spartanopsAdminPatchState,
  spartanopsAdminReassignTeam,
  spartanopsAdminRemovePlayer,
  spartanopsAdminReset,
  spartanopsAdminRemoveAllPlayers,
  spartanopsAdminUploadMap,
} from "@/lib/spartanops-admin.functions";
import { spartanopsAdminGetRoster, spartanopsGetServerTime } from "@/lib/spartanops-checkin.functions";
import { spartanopsSpartacusReview } from "@/lib/spartanops-spartacus.functions";
import { useLang } from "@/lib/i18n";
import { usePremium } from "@/lib/premium";

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const TEAM_COLOR: Record<string, string> = { modra: "#3b82f6", rdeca: "#ef4444", rumena: "#eab308", none: "#666" };
const TEAM_LABEL: Record<string, string> = { modra: "MODRA", rdeca: "RDEČA", rumena: "RUMENA", none: "ČAKALNICA" };
const TEAM_LABEL_EN: Record<string, string> = { modra: "BLUE", rdeca: "RED", rumena: "YELLOW", none: "LOBBY" };
const FREE_NODES: Record<string, string | null> = { "1": null, "2": null, "3": null, "4": null, "5": null };

export type GameSettings = {
  missionDescription?: string;
  teamCount?: number;
  teamNames?: Record<string, string>;
  respawn?: {
    enabled: boolean;
    mode: "linear" | "dynamic";
    linearSec: number;
    dynStartMin: number;
    dynEndMin: number;
    visibility: "all" | "team";
    publicDeaths: boolean;
  };
  capturePointsScoring?: boolean;
  /** Spartacus GPS anti-cheat. Anchors each QR code on first scan; flags any
   * subsequent scan more than 10m away as suspicious for marshal review. */
  spartacusEnabled?: boolean;
};
export type GameState = {
  field_id: string;
  status: "closed" | "lobby" | "active" | "paused" | "ended";
  team_selection_open: boolean;
  current_polygon_name: string | null;
  event_name: string | null;
  gamemode: "domination" | "search_destroy";
  compressed_map_url: string | null;
  countdown_seconds: number;
  match_duration_minutes: number;
  match_started_at: string | null;
  team_scores: Record<string, number>;
  node_holders: Record<string, string | null>;
  node_positions: Record<string, { x: number; y: number } | null>;
  point_target: number;
  winner_team: string | null;
  settings?: GameSettings | null;
  updated_at?: string;
};
type Checkin = {
  id: string; session_id?: string; callsign: string; club: string | null;
  experience_level: "slabo" | "dobro" | "zelo_dobro";
  assigned_team: "none" | "modra" | "rdeca" | "rumena";
  team_changed_flag: boolean;
  created_at?: string;
  first_name?: string | null;
  last_initial?: string | null;
};
type Capture = {
  id: string; point_number: number; team: string; player_callsign: string | null; captured_at: string;
};
const NODE_NAMES = ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"];
const TEAM_KEYS = ["modra", "rdeca", "rumena"] as const;

function nodeHoldersFromCaptures(captures: Capture[]): Record<string, string | null> {
  const holders: Record<string, string | null> = { ...FREE_NODES };
  [...captures]
    .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
    .forEach((capture) => {
      holders[String(capture.point_number)] = capture.team;
    });
  return holders;
}

function configuredTeams(settings?: GameSettings | null, roster: Checkin[] = [], scores: Record<string, number> = {}) {
  const count = Math.max(2, Math.min(3, Number(settings?.teamCount ?? 2)));
  const base = TEAM_KEYS.slice(0, count);
  if (count < 3 && (roster.some((r) => r.assigned_team === "rumena") || (scores.rumena ?? 0) > 0)) return TEAM_KEYS;
  return base;
}

function configuredTeamLabel(team: string, settings: GameSettings | null | undefined, en: boolean) {
  const custom = settings?.teamNames?.[team];
  if (typeof custom === "string" && custom.trim()) return custom.trim().toUpperCase();
  return (en ? TEAM_LABEL_EN[team] : TEAM_LABEL[team]) ?? team.toUpperCase();
}

function RankIcon({ level, size = 16 }: { level: Checkin["experience_level"]; size?: number }) {
  if (level === "slabo") return <ChevronUp size={size} strokeWidth={2.8} />;
  if (level === "dobro") return <ChevronsUp size={size} strokeWidth={2.6} />;
  return <Award size={size} strokeWidth={2.4} />;
}

export function SpartanOpsConsole({ fieldId, password }: { fieldId: string; password: string }) {
  const { lang } = useLang();
  const en = lang === "en";
  const TL = en ? TEAM_LABEL_EN : TEAM_LABEL;
  const patchState = useServerFn(spartanopsAdminPatchState);
  const reassign = useServerFn(spartanopsAdminReassignTeam);
  const removePlayer = useServerFn(spartanopsAdminRemovePlayer);
  const resetAll = useServerFn(spartanopsAdminReset);
  const removeAllPlayers = useServerFn(spartanopsAdminRemoveAllPlayers);
  const getRoster = useServerFn(spartanopsAdminGetRoster);
  const getServerTime = useServerFn(spartanopsGetServerTime);

  const [state, setState] = useState<GameState | null>(null);
  const [roster, setRoster] = useState<Checkin[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [polygonName, setPolygonName] = useState("");
  const [eventName, setEventName] = useState("");
  const [gamemode, setGamemode] = useState<"domination" | "search_destroy">("domination");
  const [mapUrl, setMapUrl] = useState("");
  const [duration, setDuration] = useState(20);
  const [countdown, setCountdown] = useState(60);
  const [pointTarget, setPointTarget] = useState(50);
  const [busy, setBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);

  const syncServerClock = async () => {
    const before = Date.now();
    const res = await getServerTime();
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
  }, [getServerTime]);

  useEffect(() => {
    if (state?.status !== "active" || !state.match_started_at) return;
    syncServerClock().catch(() => {});
    const timer = setInterval(() => syncServerClock().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [state?.status, state?.match_started_at, getServerTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now() - serverOffset);
    }, 1000);
    setCurrentTime(Date.now() - serverOffset);
    return () => clearInterval(timer);
  }, [serverOffset]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("spartanops_game_state").select("*").eq("field_id", fieldId).maybeSingle();
      if (!alive || !data) return;
      const g = data as unknown as GameState;
      setState(g);
      if (g.match_started_at) syncServerClock().catch(() => {});
      setPolygonName(g.current_polygon_name ?? "");
      setEventName(g.event_name ?? "");
      setGamemode((g.gamemode as any) === "search_destroy" ? "search_destroy" : "domination");
      setMapUrl(g.compressed_map_url ?? "");
      setDuration(g.match_duration_minutes);
      setCountdown(g.countdown_seconds);
      setPointTarget(g.point_target ?? 50);
    };
    load();
    const ch = supabase.channel(`admin_state_${fieldId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spartanops_game_state", filter: `field_id=eq.${fieldId}` },
        (p) => {
          if (p.new) {
            const next = p.new as unknown as GameState;
            setState(next);
            if (next.match_started_at) syncServerClock().catch(() => {});
          }
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [fieldId]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await getRoster({ data: { fieldId, password } });
      if (alive) setRoster((res?.ok ? res.rows : []) as unknown as Checkin[]);
    };
    load();
    const ch = supabase.channel(`admin_roster_${fieldId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spartanops_checkins", filter: `field_id=eq.${fieldId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [fieldId, password, getRoster]);

  // Captures (per field) — for live log
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("spartanops_captures").select("*").eq("field_id", fieldId).order("captured_at", { ascending: false }).limit(50);
      if (alive) setCaptures((data ?? []) as unknown as Capture[]);
    };
    load();
    const ch = supabase.channel(`admin_captures_${fieldId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spartanops_captures", filter: `field_id=eq.${fieldId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [fieldId]);

  const callPatch = async (patch: Partial<GameState>) => {
    setBusy(true);
    try { await patchState({ data: { fieldId, password, patch: patch as any } }); }
    finally { setBusy(false); }
  };

  const doReassign = async (id: string, team: "modra" | "rdeca" | "rumena" | "none") => {
    await reassign({ data: { fieldId, password, checkinId: id, team } });
    setRoster((items) => items.map((p) => (p.id === id ? { ...p, assigned_team: team, team_changed_flag: true } : p)));
  };
  const doRemove = async (id: string) => {
    if (!confirm(en ? "Remove player?" : "Odstrani igralca?")) return;
    await removePlayer({ data: { fieldId, password, checkinId: id } });
  };

  const startMatch = async () => {
    await syncServerClock().catch(() => {});
    await callPatch({
      status: "active",
      current_polygon_name: polygonName,
      event_name: eventName || null,
      gamemode,
      compressed_map_url: mapUrl,
      match_duration_minutes: duration,
      countdown_seconds: countdown,
      start_after_seconds: Math.max(0, countdown),
      team_scores: Object.fromEntries(configuredTeams(state?.settings, roster).map((t) => [t, 0])) as Record<string, number>,
      node_holders: { "1": null, "2": null, "3": null, "4": null, "5": null },
      point_target: pointTarget,
      winner_team: null,
    } as any);
  };
  const stopMatch = async () => {
    if (!confirm(en ? "Are you sure you want to STOP the mission? (This will end the match and declare a winner)" : "Ali ste prepričani, da želite ZAUSTAVITI misijo? (To bo zaključilo tekmo in razglasilo zmagovalca)")) return;
    const scores = state?.team_scores ?? {};
    const winner = (["modra", "rdeca", "rumena"] as const).reduce<"modra" | "rdeca" | "rumena" | null>((best, team) => {
      if (!best) return team;
      return (scores[team] ?? 0) > (scores[best] ?? 0) ? team : best;
    }, null);
    await callPatch({ status: "ended", winner_team: winner });
  };
  const togglePause = async () => {
    if (!state) return;
    if (state.status === "active") {
      await callPatch({ status: "paused" });
      return;
    }
    if (state.status === "paused") {
      const pausedAt = state.updated_at ? new Date(state.updated_at).getTime() : Date.now();
      const originalStart = state.match_started_at ? new Date(state.match_started_at).getTime() : Date.now();
      const pauseMs = Math.max(0, Date.now() - pausedAt);
      await callPatch({ status: "active", match_started_at: new Date(originalStart + pauseMs).toISOString() });
    }
  };
  const closeAll = async () => {
    if (!confirm(en ? "Reset all (deletes players and captures)?" : "Resetiraj vse (briše igralce in zavzetje)?")) return;
    await resetAll({ data: { fieldId, password } });
    setCaptures([]);
    setState((prev) => prev
      ? {
          ...prev,
          status: "closed",
          team_selection_open: false,
          match_started_at: null,
          team_scores: Object.fromEntries(configuredTeams(prev.settings, roster, prev.team_scores).map((team) => [team, 0])),
          node_holders: { ...FREE_NODES },
          winner_team: null,
        }
      : prev);
  };
  const purgePlayers = async () => {
    if (
      !confirm(
        en
          ? "This will delete all currently registered players (full reset); all players will need to re-register. Are you sure?"
          : "Ta akcija bo izbrisala vse do sedaj vpisane igralce (popolni reset), vsi igralci se bodo morali ponovno vpisati. Ali ste prepričani?"
      )
    )
      return;
    await removeAllPlayers({ data: { fieldId, password } });
  };

  if (!state) return <ConsoleLoading en={en} />;

  const isActive = state.status === "active";
  const isPaused = state.status === "paused";
  const isStartable = !isActive && !isPaused; // closed / ended / lobby

  const mainAction = async () => {
    if (isActive || isPaused) { await togglePause(); return; }
    await startMatch();
  };
  const mainLabel = isActive ? (en ? "PAUSE" : "PREMOR (PAUSE)") : isPaused ? (en ? "RESUME MISSION" : "NADALJUJ MISIJO") : (en ? "START MISSION" : "ZAČNI MISIJO");
  const mainColor = isActive ? ACCENT : "#9eff3d";
  const mainIcon = isActive ? <Pause size={14} /> : <Play size={14} />;

  return (
    <div>
      <OfflineBanner />
      <SpartacusAlerts fieldId={fieldId} password={password} en={en} />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div style={{ transform: "scale(1.2)", transformOrigin: "left center" }}><StatusBadge status={state.status} en={en} /></div>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: MUTED, letterSpacing: "0.16em" }}>
          {en ? "MISSION" : "MISIJA"}: <strong style={{ color: ACCENT, fontSize: 14 }}>{(state as any).event_name || (state as any).field_label || state.current_polygon_name || "—"}</strong>
        </div>
      </div>

      {/* 1. MATCH CONTROLS & STATUS */}
      <Pane title={en ? "MATCH CONTROLS" : "MATCH CONTROLS"}>
        <CtrlBtn onClick={mainAction} disabled={busy} icon={mainIcon} color={mainColor}>
          {mainLabel}
        </CtrlBtn>

        <PreMatchAdminCountdown state={state} now={currentTime} en={en} />

        <div style={{ marginTop: 14 }}>
          <CtrlBtn onClick={closeAll} disabled={busy} icon={<RotateCcw size={14} />} color="#ff7070">
            🛑 {en ? "END AND RESET" : "KONČAJ IN RESETIRAJ"}
          </CtrlBtn>
        </div>

        <div style={{ marginTop: 10 }}>
          <CtrlBtn onClick={purgePlayers} disabled={busy} icon={<RotateCcw size={14} />} color="#ff9a3d">
            👥 {en ? "DELETE ALL REGISTERED PLAYERS" : "IZBRIŠI VSE REGISTRIRANE IGRALCE"}
          </CtrlBtn>
          <div style={{ marginTop: 6, fontSize: 10.5, color: MUTED, lineHeight: 1.5, textAlign: "center", letterSpacing: "0.04em" }}>
            {en ? `Deletes only players in this lobby (${fieldId}). Other fields remain unchanged.` : `Izbriše samo igralce v tem lobbyju (${fieldId}). Ostali poligoni ostanejo nespremenjeni.`}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <a
            href={`/misija?field=${fieldId}&preview=1`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
              background: "transparent", color: ACCENT, border: `1px dashed ${ACCENT}88`,
              padding: "12px 12px", fontFamily: "'Michroma', monospace", fontSize: 10,
              letterSpacing: "0.16em", textTransform: "uppercase", textDecoration: "none",
            }}
          >
            <span>📱 {en ? "Preview & spectate game" : "Predogled & opazovanje igre"}</span>
            <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.06em", color: MUTED, textTransform: "none", lineHeight: 1.5, textAlign: "center" }}>
              {en
                ? "See what a player who scans the entry QR code will see (while selecting teams you remain invisible to other players); you'll watch the match like any other player."
                : "Oglejte si kaj bo videl igralec, ki poskenira vstopno QR kodo (ob izbiri ekip boste ostali nevidni ostalim igralcem), igro pa boste videli tako kot ostali igralci."}
            </span>
          </a>
        </div>

        <div style={{ marginTop: 14 }}>
          <QuickJoinQr fieldId={fieldId} en={en} />
        </div>

        <div style={{ marginTop: 10 }}>
          <a
            href={`/qr-generator?field_id=${fieldId}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
              background: "transparent", color: ACCENT, border: `1px dashed ${ACCENT}88`,
              padding: "12px 12px", fontFamily: "'Michroma', monospace", fontSize: 10,
              letterSpacing: "0.16em", textTransform: "uppercase", textDecoration: "none",
            }}
          >
            <span>▣ {en ? "Tactical QR Generator" : "Tactical QR Generator"}</span>
            <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.06em", color: MUTED, textTransform: "none", lineHeight: 1.5, textAlign: "center" }}>
              {en
                ? "Print-ready QR codes for sector points, respawns, and lobby entry."
                : "Print-ready QR kode za točke, respawn in vstop v lobby."}
            </span>
          </a>
        </div>



        <div style={{ marginTop: 14, fontSize: 10, color: MUTED, fontFamily: "monospace", lineHeight: 1.7 }}>
          <p>{en ? "Registered" : "Prijavljenih"}: <strong style={{ color: INK }}>{roster.length}</strong></p>
        </div>
      </Pane>

      {/* 2. ROSTER & TEAM BALANCING */}
      <div style={{ marginTop: 16 }}>
        <Pane title={en ? "ROSTER & TEAM BALANCING" : "ROSTER & TEAM BALANCING"}>
          <RosterBoard roster={roster} settings={state.settings} onReassign={doReassign} onRemove={doRemove} en={en} />
        </Pane>
      </div>

      {/* 3. LIVE LEADERBOARD (above live map) */}
      <div style={{ marginTop: 16 }}>
        <Pane title={en ? "LIVE LEADERBOARD" : "LIVE LEADERBOARD"}>
          <LeaderboardMeta state={state} now={currentTime} en={en} />
          {configuredTeams(state.settings, roster, state.team_scores)
            .map((t) => (
              <div key={t} className="flex items-center justify-between py-2" style={{ borderTop: "1px solid rgba(236,227,196,0.05)" }}>
                <span style={{ color: TEAM_COLOR[t], fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.16em" }}>{configuredTeamLabel(t, state.settings, en)}</span>
                <span style={{ color: INK, fontFamily: "monospace", fontSize: 22, fontWeight: 700 }}>
                  {state.team_scores[t] ?? 0}<span style={{ color: MUTED, fontSize: 12, fontWeight: 400 }}> / {state.point_target ?? 50}</span>
                </span>
              </div>
            ))}
        </Pane>
      </div>

      {/* 4. Live map view + timers — visible during pre-match countdown and while match is active/paused */}
      {(state.status === "active" || state.status === "paused" || !!state.match_started_at) && (
        <LiveMatchView state={state} captures={captures} now={currentTime} en={en} />
      )}

      {/* Separator */}
      <div style={{ margin: "40px 0 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, height: 1, background: `${ACCENT}55` }} />
        <span style={{ fontFamily: "'Michroma', monospace", fontSize: 15, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", fontWeight: 700 }}>
          ⚙ {en ? "GAME SETTINGS" : "NASTAVITVE IGRE"}
        </span>
        <div style={{ flex: 1, height: 1, background: `${ACCENT}55` }} />
      </div>

      {/* 5. GAME SETTINGS — at the bottom */}
      <div>
        <Pane title={en ? "FIELD, MAP & GAME SETTINGS" : "POLIGON, MAP & NASTAVITVE IGRE"}>
          <Field label={en ? "Field name" : "Ime poligona"}>
            <input value={polygonName} onChange={(e) => setPolygonName(e.target.value)} style={inputStyle} placeholder="Zeleni raj" />
          </Field>
          <Field label={en ? "Event name" : "Ime dogodka"}>
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} style={inputStyle} placeholder={en ? "e.g. Operation Ares" : "npr. Operacija Ares"} />
          </Field>
          <Field label={en ? "Game mode selection" : "Izbira igralnega načina (Gamemode)"}>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setGamemode("domination")}
                style={{
                  background: gamemode === "domination" ? `${ACCENT}22` : "transparent",
                  color: gamemode === "domination" ? ACCENT : INK,
                  border: `1px solid ${gamemode === "domination" ? ACCENT : "rgba(236,227,196,0.18)"}`,
                  padding: "10px 8px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em",
                  textTransform: "uppercase", cursor: "pointer", textAlign: "left",
                }}>
                ● Domination<br /><span style={{ fontSize: 9, color: MUTED }}>{en ? "Point capture" : "Zavzemanje točk"}</span>
              </button>
              <button type="button" disabled title={en ? "Coming soon" : "Prihaja kmalu"}
                style={{
                  background: "rgba(255,255,255,0.03)", color: MUTED,
                  border: `1px dashed rgba(236,227,196,0.18)`,
                  padding: "10px 8px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em",
                  textTransform: "uppercase", cursor: "not-allowed", textAlign: "left", opacity: 0.6,
                }}>
                🔒 Search & Destroy<br /><span style={{ fontSize: 9 }}>{en ? "Coming soon" : "Prihaja kmalu"}</span>
              </button>
            </div>
          </Field>
          <MapUploader fieldId={fieldId} password={password} currentUrl={state.compressed_map_url} onUploaded={(u) => setMapUrl(u)} en={en} />
          <Field label={en ? "or map URL" : "ali URL zemljevida"}>
            <input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} style={inputStyle} placeholder="https://..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={en ? "Duration (min)" : "Trajanje (min)"}>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={selectStyle}>
                {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </Field>
            <Field label={en ? "Pre-start" : "Pred-štart"}>
              <select value={countdown} onChange={(e) => setCountdown(Number(e.target.value))} style={selectStyle}>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m * 60}>{m} min</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 4, fontFamily: "monospace" }}>
              {en ? "Target points (win when reached)" : "Ciljne točke (zmaga ob doseženem številu)"}
            </div>
            <p style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", lineHeight: 1.55, marginBottom: 8, fontStyle: "italic" }}>
              {en
                ? "Planning note: the system is balanced so a standard game lasts exactly 40 minutes if a team constantly holds the majority (3 of 5 flags). If a team holds more flags (4 or 5), the target is reached faster. If they hold fewer, the game lasts longer. Adjust the final point count based on desired event duration."
                : "Pojasnilo za lažje načrtovanje: Sistem je uravnotežen tako, da standardna igra traja natanko 40 minut, če ekipa konstantno drži večino (3 od 5 zastavic). Če ekipa drži več zastavic (4 ali 5), bo cilj dosežen hitreje. Če drži manj, bo igra trajala dlje. Prilagodite končno število točk glede na želeno trajanje dogodka."}
            </p>
            <select value={pointTarget} onChange={(e) => setPointTarget(Number(e.target.value))} style={selectStyle}>
              {Array.from({ length: 30 }, (_, i) => (i + 1) * 10).map((p) => (
                <option key={p} value={p}>{p} {en ? "pts" : "točk"}</option>
              ))}
            </select>
          </div>
          <NodePlacer
            mapUrl={state.compressed_map_url || mapUrl}
            positions={state.node_positions ?? {}}
            onChange={(positions) => callPatch({ node_positions: positions })}
            en={en}
          />
          <RespawnQrConfig settings={state.settings ?? {}} onPatch={(s) => callPatch({ settings: s } as any)} en={en} />
          <CaptureScoringConfig settings={state.settings ?? {}} onPatch={(s) => callPatch({ settings: s } as any)} en={en} />
          <SpartacusConfig settings={state.settings ?? {}} onPatch={(s) => callPatch({ settings: s } as any)} en={en} />
        </Pane>
      </div>
    </div>
  );
}


export function LiveMatchView({ state, captures, now, en }: { state: GameState; captures: Capture[]; now: number; en: boolean }) {
  const startMs = state.match_started_at ? new Date(state.match_started_at).getTime() : null;
  const matchIsRunning = (state.status === "active" || state.status === "paused") && !!startMs;
  const visibleCaptures = matchIsRunning
    ? captures.filter((c) => !startMs || new Date(c.captured_at).getTime() >= startMs)
    : [];
  const visibleNodeHolders = nodeHoldersFromCaptures(visibleCaptures);
  const remaining = (() => {
    if (!startMs) return state.match_duration_minutes * 60;
    if (now < startMs) return state.match_duration_minutes * 60;
    const elapsed = Math.floor((now - startMs) / 1000);
    return Math.max(0, state.match_duration_minutes * 60 - elapsed);
  })();
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const positions = state.node_positions ?? {};

  return (
    <div style={{ marginTop: 20 }}>
      <Pane title={en ? "LIVE MAP & EVENT LOG" : "LIVE MAP & DNEVNIK DOGODKOV"}>
        <div className="text-center mb-3 font-mono text-[11px] uppercase tracking-widest" style={{ color: ACCENT }}>
          {en ? "Time remaining" : "Preostali čas"}: <span style={{ color: INK, fontSize: 16 }}>{mm}:{ss}</span>
        </div>
        <div style={{ position: "relative", background: "#0c0e09", border: `1px solid ${ACCENT}55`, marginBottom: 14 }}>
          {state.compressed_map_url ? (
            <div style={{ position: "relative" }}>
              <img src={state.compressed_map_url} alt="Map" style={{ width: "100%", display: "block" }} loading="lazy" decoding="async" />
              {[1, 2, 3, 4, 5].map((n) => {
                const p = positions[String(n)];
                if (!p) return null;
                const holder = matchIsRunning ? visibleNodeHolders[String(n)] : null;
                const c = holder ? TEAM_COLOR[holder] : "#888";
                return (
                  <div key={n} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${c}dd`, border: `3px solid #000`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Michroma',monospace", fontSize: 12, fontWeight: 700 }}>{n}</div>
                    <div style={{ marginTop: 2, fontSize: 8, fontFamily: "monospace", letterSpacing: "0.14em", color: "#fff", background: "rgba(0,0,0,0.7)", padding: "1px 4px" }}>{NODE_NAMES[n - 1]}</div>
                  </div>
                );
              })}
              {positions["compass"] && (
                <div style={{ position: "absolute", left: `${positions["compass"]!.x}%`, top: `${positions["compass"]!.y}%`, transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
                  <TacticalCompass size={72} />
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: MUTED, fontSize: 11, textAlign: "center", padding: 40, textTransform: "uppercase", letterSpacing: "0.16em", fontFamily: "monospace" }}>— {en ? "map not uploaded yet" : "zemljevid še ni naložen"} —</p>
          )}
        </div>

        <div style={{ background: "#0c0e09", border: `1px solid rgba(236,227,196,0.12)` }}>
          <div style={{ padding: "8px 12px", borderBottom: `1px solid rgba(236,227,196,0.1)`, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: ACCENT, textTransform: "uppercase" }}>
            ▌ {en ? "CAPTURE LOG" : "DNEVNIK ZAVZEMANJ"}
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {visibleCaptures.length === 0 && <p style={{ color: MUTED, fontStyle: "italic", padding: 14, fontSize: 12, textAlign: "center" }}>{en ? "No captures yet." : "Še ni zavzetij."}</p>}
            {visibleCaptures.map((c) => {
              const t = new Date(c.captured_at);
              const time = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`;
              const tl = en ? TEAM_LABEL_EN : TEAM_LABEL;
              return (
                <div key={c.id} style={{ padding: "7px 12px", borderTop: "1px solid rgba(236,227,196,0.05)", fontSize: 12, fontFamily: "monospace", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: MUTED }}>{time}</span>
                  <span style={{ color: TEAM_COLOR[c.team], fontWeight: 700, minWidth: 64 }}>{tl[c.team] ?? c.team.toUpperCase()}</span>
                  <span style={{ color: INK }}>{en ? "Point" : "Točka"} {c.point_number} ({NODE_NAMES[c.point_number - 1]})</span>
                  <span style={{ color: MUTED, marginLeft: "auto" }}>{c.player_callsign ?? "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Pane>
    </div>
  );
}

const RosterBoard = memo(function RosterBoard({ roster, settings, onReassign, onRemove, en }: { roster: Checkin[]; settings?: GameSettings | null; onReassign: (id: string, t: "modra" | "rdeca" | "rumena" | "none") => void; onRemove: (id: string) => void; en: boolean }) {
  const activeTeams = configuredTeams(settings, roster);
  const cols: ("none" | "modra" | "rdeca" | "rumena")[] = ["none", ...activeTeams];
  const [switching, setSwitching] = useState<Checkin | null>(null);
  return (
    <div className="space-y-3">
      <div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={en ? "Premium feature — coming soon" : "Premium funkcija — prihaja kmalu"}
          style={{
            position: "relative",
            width: "100%",
            padding: "12px 12px",
            background: "linear-gradient(135deg, rgba(224,176,78,0.14), rgba(224,176,78,0.03))",
            border: `1px dashed ${ACCENT}`,
            color: ACCENT,
            fontFamily: "'Michroma', monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: "not-allowed",
            opacity: 0.85,
            boxShadow: `0 0 22px ${ACCENT}22`,
          }}
        >
          🔒 Auto balance teams
          <span
            style={{
              position: "absolute",
              top: -8,
              right: -6,
              background: ACCENT,
              color: "#0b0d09",
              padding: "2px 6px",
              fontSize: 8.5,
              letterSpacing: "0.14em",
              fontWeight: 700,
              boxShadow: `0 0 10px ${ACCENT}66`,
            }}
          >
            {en ? "NEW PREMIUM FEATURE" : "NOVA PREMIUM FUNKCIJA"}
          </span>
        </button>
        <p style={{ marginTop: 8, fontSize: 10.5, color: MUTED, fontFamily: "monospace", lineHeight: 1.55, textAlign: "center", letterSpacing: "0.04em" }}>
          {en
            ? "Balance the players among teams based on their skill level."
            : "Uravnotežite igralce med ekipami glede na njihovo raven veščin."}
        </p>
      </div>
      {cols.map((c) => {
        const players = roster.filter((r) => r.assigned_team === c);
        return (
          <div key={c} style={{ background: "#0c0e09", border: `1px solid ${TEAM_COLOR[c]}55` }}>
            <div style={{ background: c === "none" ? "rgba(255,255,255,0.05)" : TEAM_COLOR[c], color: c === "none" ? MUTED : "#fff", padding: "6px 10px", fontSize: 10, fontFamily: "'Michroma', monospace", letterSpacing: "0.18em" }}>
              {c === "none" ? (en ? TEAM_LABEL_EN : TEAM_LABEL)[c] : configuredTeamLabel(c, settings, en)} · {players.length}
            </div>
            <div className="p-2 space-y-1">
              {players.length === 0 && <p style={{ color: MUTED, fontSize: 10.5, textAlign: "center", padding: 8, fontFamily: "monospace", letterSpacing: "0.14em" }}>{en ? "[ NO OPERATIVES CHECKED IN ]" : "[ NI PRIJAVLJENIH OPERATIVCEV ]"}</p>}
              {players.map((p) => (
                <div key={p.id} className="flex items-center gap-2" style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", fontSize: 12 }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2" style={{ color: INK, fontWeight: 600 }}>
                      <span className="inline-flex shrink-0" style={{ color: ACCENT }}><RankIcon level={p.experience_level} /></span>
                      <span className="min-w-0 truncate">{p.callsign}</span>
                      {p.club && <span style={{ color: MUTED, fontWeight: 400 }}>· {p.club}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
                      <span style={{ color: ACCENT }}>{p.experience_level === "slabo" ? "RECRUIT" : p.experience_level === "dobro" ? "VETERAN" : "MASTER"}</span>
                      {p.club && ` · ${p.club}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const opposing = activeTeams.find((t) => t !== p.assigned_team) ?? activeTeams[0];
                      if (opposing) onReassign(p.id, opposing);
                    }}
                    title={en ? "Switch to opposing team" : "Premesti v nasprotno ekipo"}
                    aria-label={en ? "Switch team" : "Premesti ekipo"}
                    style={{ background: BG, color: ACCENT, border: `1px solid ${TEAM_COLOR[p.assigned_team]}66`, padding: "5px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <ArrowLeftRight size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwitching(p)}
                    style={{ background: "transparent", color: MUTED, border: `1px solid ${MUTED}44`, fontSize: 9, padding: "5px 6px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer" }}
                    title={en ? "More options" : "Več možnosti"}
                  >
                    …
                  </button>
                  <button onClick={() => onRemove(p.id)} style={{ background: "transparent", border: "none", color: "#ff7070", cursor: "pointer", padding: 4 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {switching && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div style={{ width: "min(420px, 100%)", background: PANEL, border: `1px solid ${ACCENT}`, padding: 18, boxShadow: `0 0 45px ${ACCENT}22` }}>
            <p style={{ color: ACCENT, fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
              {en ? "SWITCH FACTION" : "PREMESTI FRAKCIJO"}
            </p>
            <p style={{ color: INK, fontSize: 13, marginBottom: 14 }}>{switching.callsign}</p>
            <div className="grid gap-2">
              <button onClick={() => { onReassign(switching.id, "none"); setSwitching(null); }} style={{ padding: 10, background: "rgba(255,255,255,0.05)", color: MUTED, border: `1px solid ${MUTED}` }}>— {en ? "LOBBY" : "ČAKALNICA"}</button>
              {activeTeams.map((t) => (
                <button key={t} onClick={() => { onReassign(switching.id, t); setSwitching(null); }} style={{ padding: 10, background: `${TEAM_COLOR[t]}22`, color: TEAM_COLOR[t], border: `1px solid ${TEAM_COLOR[t]}`, fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.12em" }}>
                  {configuredTeamLabel(t, settings, en)}
                </button>
              ))}
            </div>
            <button onClick={() => setSwitching(null)} style={{ marginTop: 12, width: "100%", padding: 9, background: "transparent", color: MUTED, border: `1px solid ${MUTED}55` }}>{en ? "Cancel" : "Prekliči"}</button>
          </div>
        </div>
      )}
    </div>
  );
});

function PreMatchAdminCountdown({ state, now, en }: { state: GameState; now: number; en: boolean }) {
  if (!state.match_started_at) return null;
  const startMs = new Date(state.match_started_at).getTime();
  if (now >= startMs) return null;
  const secs = Math.ceil((startMs - now) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 16px",
        background: "rgba(224,176,78,0.08)",
        border: `1px dashed ${ACCENT}`,
        textAlign: "center",
        animation: "admin-countdown-flash 1s ease-in-out infinite",
      }}
    >
      <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 }}>
        ⏱ {en ? "UNTIL MISSION START" : "DO ZAČETKA MISIJE"}
      </p>
      <div style={{ fontFamily: "'Michroma', monospace", fontSize: 32, color: ACCENT, fontWeight: 700, letterSpacing: "0.08em", textShadow: `0 0 18px ${ACCENT}66` }}>
        {mm}:{ss}
      </div>
      <style>{`@keyframes admin-countdown-flash { 0%,100% { box-shadow: 0 0 0 0 ${ACCENT}00; } 50% { box-shadow: 0 0 18px 0 ${ACCENT}55; } }`}</style>
    </div>
  );
}

export function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: PANEL, border: `1px solid ${ACCENT}22`, padding: 14 }}>
      <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.2em", color: ACCENT, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${ACCENT}22` }}>{title}</h2>
      {children}
    </section>
  );
}

function LeaderboardMeta({ state, now, en }: { state: GameState; now: number; en: boolean }) {
  let remaining = "—";
  if ((state.status === "active" || state.status === "paused") && state.match_started_at) {
    const startMs = new Date(state.match_started_at).getTime();
    const durationSec = (state.match_duration_minutes ?? 0) * 60;
    // Freeze at full duration during the pre-match countdown window.
    const secs = now < startMs
      ? durationSec
      : Math.max(0, Math.floor((startMs + durationSec * 1000 - now) / 1000));
    remaining = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  }
  return (
    <div className="flex items-center justify-between py-2 mb-1" style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", color: MUTED, textTransform: "uppercase" }}>
      <span>🎯 {en ? "TARGET" : "CILJ"}: <strong style={{ color: ACCENT }}>{state.point_target ?? 50}</strong> {en ? "PTS" : "TOČK"}</span>
      <span>⏱ {en ? "TIME" : "ČAS"}: <strong style={{ color: ACCENT }}>{remaining}</strong></span>
    </div>
  );
}


function StatusBadge({ status, en }: { status: GameState["status"]; en: boolean }) {
  const color = status === "active" ? "#9eff3d" : status === "paused" ? ACCENT : status === "ended" ? "#ff7070" : MUTED;
  const label = status === "active" ? (en ? "GAME ACTIVE" : "IGRA AKTIVNA") : status === "paused" ? (en ? "GAME PAUSED" : "IGRA V PAVZI") : status === "ended" ? (en ? "GAME ENDED" : "IGRA KONČANA") : (en ? "GAME INACTIVE" : "IGRA NEAKTIVNA");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color, textTransform: "uppercase" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}


function CtrlBtn({ onClick, disabled, icon, color, children }: { onClick: () => void; disabled?: boolean; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      background: disabled ? "rgba(255,255,255,0.05)" : `${color}1a`, color: disabled ? MUTED : color,
      border: `1px solid ${disabled ? "rgba(236,227,196,0.1)" : color}`,
      padding: "12px 14px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.16em",
      cursor: disabled ? "not-allowed" : "pointer", textTransform: "uppercase",
    }}>
      {icon} {children}
    </button>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.18)",
  padding: "10px 12px", fontSize: 13, fontFamily: "monospace",
};
export const selectStyle: React.CSSProperties = {
  width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.18)",
  padding: "10px 12px", fontSize: 13, fontFamily: "monospace",
  appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
  backgroundImage: `linear-gradient(45deg, transparent 50%, ${ACCENT} 50%), linear-gradient(135deg, ${ACCENT} 50%, transparent 50%)`,
  backgroundPosition: "calc(100% - 18px) center, calc(100% - 12px) center",
  backgroundSize: "6px 6px, 6px 6px",
  backgroundRepeat: "no-repeat",
  paddingRight: 30,
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 4, fontFamily: "monospace" }}>{label}</div>
      {children}
    </label>
  );
}

function MapUploader({ fieldId, password, currentUrl, onUploaded, en }: { fieldId: string; password: string; currentUrl: string | null; onUploaded: (url: string) => void; en: boolean }) {
  const uploadFn = useServerFn(spartanopsAdminUploadMap);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setErr(""); setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await uploadFn({ data: { fieldId, password, filename: file.name, contentType: file.type || "image/webp", base64 } });
      onUploaded(res.url);
    } catch (e: any) { setErr(e?.message ?? (en ? "Upload error" : "Napaka pri uploadu")); }
    setBusy(false);
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 4, fontFamily: "monospace" }}>{en ? "Upload map (WebP/PNG/JPEG, ≤8 MB)" : "Naloži zemljevid (WebP/PNG/JPEG, ≤8 MB)"}</div>
      <input ref={inputRef} type="file" accept="image/webp,image/png,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: `${ACCENT}1a`, color: ACCENT, border: `1px dashed ${ACCENT}88`, padding: "10px 12px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", cursor: busy ? "wait" : "pointer" }}>
        <Upload size={12} /> {busy ? (en ? "Uploading..." : "Nalagam...") : currentUrl ? (en ? "Replace map" : "Zamenjaj zemljevid") : (en ? "Choose file" : "Izberi datoteko")}
      </button>
      {err && <p style={{ color: "#ff8a8a", fontSize: 11, marginTop: 6, fontFamily: "monospace" }}>{err}</p>}
    </div>
  );
}

export function NodePlacer({ mapUrl, positions, onChange, en }: { mapUrl: string | null; positions: Record<string, { x: number; y: number } | null>; onChange: (p: Record<string, { x: number; y: number } | null>) => void; en: boolean }) {
  const [selected, setSelected] = useState<string>("1");
  const wrapRef = useRef<HTMLDivElement>(null);
  const NODES: { key: string; label: string; color: string; type: "capture" | "spawn" | "compass" }[] = [
    { key: "1", label: "1·ALPHA", color: ACCENT, type: "capture" },
    { key: "2", label: "2·BETA", color: ACCENT, type: "capture" },
    { key: "3", label: "3·GAMMA", color: ACCENT, type: "capture" },
    { key: "4", label: "4·DELTA", color: ACCENT, type: "capture" },
    { key: "5", label: "5·EPSILON", color: ACCENT, type: "capture" },
    { key: "spawn_rdeca", label: en ? "SPAWN RED" : "SPAWN RDEČA", color: "#c0392b", type: "spawn" },
    { key: "spawn_modra", label: en ? "SPAWN BLUE" : "SPAWN MODRA", color: "#2e86de", type: "spawn" },
    { key: "spawn_rumena", label: en ? "SPAWN YELLOW" : "SPAWN RUMENA", color: "#f1c40f", type: "spawn" },
    { key: "compass", label: en ? "COMPASS" : "KOMPAS", color: "#7fd4ff", type: "compass" },
  ];

  const onClickMap = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    onChange({ ...positions, [selected]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } });
  };
  const clearOne = (k: string) => onChange({ ...positions, [k]: null });

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 6, fontFamily: "monospace" }}>
        {en ? "Click the map to place the selected point" : "Klikni na zemljevid, da postaviš izbrano točko"}
      </div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {NODES.map((n) => {
          const placed = !!positions[n.key];
          const active = selected === n.key;
          const icon = n.type === "spawn" ? "▲" : n.type === "compass" ? <Compass size={10} /> : <MapPin size={10} />;
          return (
            <button key={n.key} type="button" onClick={() => setSelected(n.key)}
              style={{ display: "flex", alignItems: "center", gap: 4, background: active ? n.color : `${n.color}22`, color: active ? BG : n.color, border: `1px solid ${n.color}`, padding: "5px 8px", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.14em", cursor: "pointer" }}>
              {icon} {n.label} {placed && "✓"}
            </button>
          );
        })}
      </div>
      <div ref={wrapRef} onClick={mapUrl ? onClickMap : undefined}
        style={{ position: "relative", background: "#0c0e09", border: `1px solid rgba(236,227,196,0.12)`, cursor: mapUrl ? "crosshair" : "default", userSelect: "none" }}>
        {mapUrl ? <img src={mapUrl} alt="map" style={{ width: "100%", display: "block", pointerEvents: "none" }} loading="lazy" decoding="async" /> :
          <p style={{ color: MUTED, fontSize: 11, textAlign: "center", padding: 40, textTransform: "uppercase", letterSpacing: "0.16em", fontFamily: "monospace" }}>— {en ? "upload a map first" : "najprej naloži zemljevid"} —</p>}
        {mapUrl && NODES.map((n) => {
          const p = positions[n.key];
          if (!p) return null;
          const active = selected === n.key;
          const isSpawn = n.type === "spawn";
          const isCompass = n.type === "compass";
          if (isCompass) {
            return (
              <button key={n.key} type="button" onClick={(ev) => { ev.stopPropagation(); clearOne(n.key); }}
                title={en ? "Remove compass" : "Odstrani kompas"}
                style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                <TacticalCompass size={64} />
              </button>
            );
          }
          return (
            <button key={n.key} type="button" onClick={(ev) => { ev.stopPropagation(); clearOne(n.key); }}
              title={`${en ? "Remove" : "Odstrani"} ${n.label}`}
              style={{
                position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
                transform: isSpawn ? "translate(-50%,-50%) rotate(0deg)" : "translate(-50%,-50%)",
                width: isSpawn ? 21 : 30, height: isSpawn ? 21 : 30,
                borderRadius: isSpawn ? 0 : "50%",
                clipPath: isSpawn ? "polygon(50% 0%, 100% 100%, 0% 100%)" : undefined,
                background: active ? n.color : `${n.color}cc`,
                color: BG, border: isSpawn ? "none" : "2px solid #000",
                fontFamily: "'Michroma',monospace", fontSize: isSpawn ? 8 : 11, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 0 8px rgba(0,0,0,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                paddingTop: isSpawn ? 5 : 0,
              }}>
              {isSpawn ? "▲" : n.key}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 10, color: MUTED, marginTop: 6, fontFamily: "monospace", lineHeight: 1.5 }}>
        ▸ {en ? "Click image = place selected point. Click existing marker = remove. Triangles (▲) are team spawn points. Only one COMPASS may be on the map." : "Klik na sliko = postavi izbrano točko. Klik na obstoječ marker = odstrani. Trikotniki (▲) so spawn točke ekip. Samo en KOMPAS je lahko na zemljevidu."}
      </p>
    </div>
  );
}

export const DEFAULT_RESPAWN: NonNullable<GameSettings["respawn"]> = {
  enabled: false, mode: "linear", linearSec: 30, dynStartMin: 0.5, dynEndMin: 2,
  visibility: "all", publicDeaths: false,
};

export function ConfigToggle({ value, onChange, options }: { value: string; onChange: (v: any) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          style={{
            background: value === o.v ? `${ACCENT}22` : "transparent",
            color: value === o.v ? ACCENT : INK,
            border: `1px solid ${value === o.v ? ACCENT : "rgba(236,227,196,0.18)"}`,
            padding: "9px 8px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em",
            textTransform: "uppercase", cursor: "pointer", textAlign: "center",
          }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function RespawnQrConfig({ settings, onPatch, en }: { settings: GameSettings; onPatch: (s: GameSettings) => void; en: boolean }) {
  const respawn = { ...DEFAULT_RESPAWN, ...(settings.respawn ?? {}) };
  const update = (patch: Partial<NonNullable<GameSettings["respawn"]>>) => {
    onPatch({ ...settings, respawn: { ...respawn, ...patch } });
  };
  const YN = [{ v: "da", l: en ? "YES" : "DA" }, { v: "ne", l: en ? "NO" : "NE" }];
  return (
    <div style={{ marginTop: 22, padding: 14, border: `1px solid ${ACCENT}44`, background: "rgba(0,0,0,0.25)" }}>
      <div style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase", marginBottom: 4 }}>
        {en ? "RESPAWN QR CODES" : "RESPAWN QR KODE"}
      </div>
      <p style={{ fontSize: 10.5, color: MUTED, fontFamily: "monospace", lineHeight: 1.6, marginBottom: 12 }}>
        {en ? "QR codes at spawn points that a player scans to see their respawn timer." : "Na spawn točkah bodo QR kode, ki jih igralec poskenira, da se mu izpiše respawn čas."}
      </p>
      <Field label={en ? "Enable Respawn QR codes" : "Omogoči Respawn QR kode"}>
        <ConfigToggle value={respawn.enabled ? "da" : "ne"} onChange={(v) => update({ enabled: v === "da" })} options={YN} />
      </Field>
      {respawn.enabled && (
        <>
          <Field label={en ? "Countdown mode" : "Način odštevanja časa"}>
            <ConfigToggle value={respawn.mode} onChange={(v) => update({ mode: v })} options={[
              { v: "linear", l: en ? "Linear time" : "Linearni čas" },
              { v: "dynamic", l: en ? "Dynamic time" : "Dinamični čas" },
            ]} />
          </Field>
          {respawn.mode === "linear" ? (
            <Field label={en ? "Respawn duration (seconds)" : "Trajanje respawna (sekunde)"}>
              <input type="number" min={1} max={600} value={respawn.linearSec} onChange={(e) => update({ linearSec: Number(e.target.value) })} style={inputStyle} />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={en ? "Game start (min)" : "Začetek igre (min)"}>
                <input type="number" min={0} step={0.25} value={respawn.dynStartMin} onChange={(e) => update({ dynStartMin: Number(e.target.value) })} style={inputStyle} />
              </Field>
              <Field label={en ? "Game end (min)" : "Konec igre (min)"}>
                <input type="number" min={0} step={0.25} value={respawn.dynEndMin} onChange={(e) => update({ dynEndMin: Number(e.target.value) })} style={inputStyle} />
              </Field>
            </div>
          )}
          <Field label={en ? "Timer visibility" : "Vidnost časovnikov"}>
            <ConfigToggle value={respawn.visibility} onChange={(v) => update({ visibility: v })} options={[
              { v: "all", l: en ? "All players" : "Vsi igralci" },
              { v: "team", l: en ? "Team only" : "Samo ekipa" },
            ]} />
          </Field>
          <Field label={en ? "Public death display on scoreboard" : "Javni prikaz smrti v scoreboardu"}>
            <ConfigToggle value={respawn.publicDeaths ? "da" : "ne"} onChange={(v) => update({ publicDeaths: v === "da" })} options={YN} />
          </Field>
        </>
      )}
    </div>
  );
}

export function CaptureScoringConfig({ settings, onPatch, en }: { settings: GameSettings; onPatch: (s: GameSettings) => void; en: boolean }) {
  const enabled = !!settings.capturePointsScoring;
  return (
    <div style={{ marginTop: 16, padding: 14, border: `1px solid ${ACCENT}44`, background: "rgba(0,0,0,0.25)" }}>
      <div style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase", marginBottom: 4 }}>
        {en ? "PLAYER SCORING" : "TOČKOVANJE IGRALCEV"}
      </div>
      <p style={{ fontSize: 10.5, color: MUTED, fontFamily: "monospace", lineHeight: 1.6, marginBottom: 12 }}>
        {en
          ? "The live scoreboard tracks how many points and objectives each player captures for their team in real-time. Once the match ends, the top three players of the winning team are crowned on the final leaderboard."
          : "Živi scoreboard v realnem času beleži, koliko točk in objektov posamezni igralec zavzame za svojo ekipo. Ko se misija zaključi, so na končnem scoreboardu okronani trije najboljši igralci zmagovalne ekipe."}
      </p>
      <Field label={en ? "Enable player point display" : "Omogoči prikaz točk igralcev"}>
        <ConfigToggle value={enabled ? "da" : "ne"} onChange={(v) => onPatch({ ...settings, capturePointsScoring: v === "da" })} options={[{ v: "da", l: en ? "YES" : "DA" }, { v: "ne", l: en ? "NO" : "NE" }]} />
      </Field>
    </div>
  );
}

/**
 * SPARTACUS · GPS-based anti-cheat card. Stored as `settings.spartacusEnabled`.
 * Rendered with an amber warning-style border so it stands out as a premium
 * security feature.
 */
export function SpartacusConfig({ settings, onPatch, en }: { settings: GameSettings; onPatch: (s: GameSettings) => void; en: boolean }) {
  const enabled = !!settings.spartacusEnabled;
  const BORDER = enabled ? "#ffb020" : "#ffb02066";
  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        position: "relative",
        border: `1.5px solid ${BORDER}`,
        background: "linear-gradient(135deg, rgba(255,176,32,0.08), rgba(0,0,0,0.35))",
        boxShadow: enabled ? "0 0 24px -6px rgba(255,176,32,0.45)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span
          aria-hidden
          style={{
            width: 10, height: 10, borderRadius: 999,
            background: enabled ? "#ffb020" : "#555",
            boxShadow: enabled ? "0 0 10px #ffb020" : "none",
            animation: enabled ? "spartacus-pulse 1.6s ease-in-out infinite" : "none",
          }}
        />
        <div style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.24em", color: "#ffb020", textTransform: "uppercase", fontWeight: 700 }}>
          SPARTACUS
        </div>
        <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.2em", color: MUTED, marginLeft: "auto", textTransform: "uppercase" }}>
          V1.0
        </span>
      </div>
      <div style={{ fontFamily: "'Michroma', monospace", fontSize: 10.5, letterSpacing: "0.18em", color: INK, textTransform: "uppercase", marginBottom: 10 }}>
        {en ? "GPS-ENFORCED OPERATIONAL INTEGRITY" : "GPS-ZAVAROVANA INTEGRITETA OPERACIJE"}
      </div>
      <p style={{ fontSize: 11, color: INK, opacity: 0.75, fontFamily: "monospace", lineHeight: 1.7, marginBottom: 14 }}>
        {en
          ? "Anti-spoofing protocol engaged. The very first scan of a physical QR code anchors its tactical coordinates. Subsequent scans must fall within a 10-meter operational radius. If a player attempts to scan a photo of the QR from a safe zone or unauthorized location, the system instantly flags the breach on the Marshal's dashboard. The Marshal maintains full command over the incident and can choose to override and approve the capture, dismiss the warning, or penalize the offending player."
          : "Protokol proti goljufanju je aktiviran. Prvi sken fizične QR kode usidra njene taktične koordinate v sistem. Vsi naslednji skeni morajo biti znotraj 10-metrskega delovnega radija. Če igralec poskuša skenirati fotografijo QR kode iz varne cone ali druge nepooblaščene lokacije, sistem nemudoma sproži alarm na maršalovi nadzorni plošči. Maršal ohranja popolno kontrolo nad incidentom in se lahko odloči, da opozorilo prezre in odobri zavzetje, ali pa igralca kaznuje."}
      </p>
      <button
        type="button"
        onClick={() => onPatch({ ...settings, spartacusEnabled: !enabled })}
        style={{
          width: "100%",
          background: enabled ? "rgba(255,176,32,0.18)" : "transparent",
          color: enabled ? "#ffb020" : INK,
          border: `1px solid ${enabled ? "#ffb020" : "#ffb02055"}`,
          padding: "12px 14px",
          fontFamily: "'Michroma', monospace",
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        [ {enabled ? (en ? "SPARTACUS PROTECTION ACTIVE" : "SPARTACUS ZAŠČITA AKTIVNA") : (en ? "ENABLE SPARTACUS PROTECTION" : "OMOGOČI SPARTACUS ZAŠČITO")} ]
      </button>
      <style>{`@keyframes spartacus-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.55;transform:scale(1.25)}}`}</style>
    </div>
  );
}

function ConsoleLoading({ en }: { en: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 2200);
    return () => clearTimeout(t);
  }, []);
  if (!slow) {
    return <div style={{ padding: 40, textAlign: "center", color: MUTED }}>{en ? "Loading..." : "Nalagam..."}</div>;
  }
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: MUTED }}>
      <p style={{ fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.18em", color: ACCENT, marginBottom: 10, textTransform: "uppercase" }}>
        // NO LIVE STATE
      </p>
      <p style={{ fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
        {en
          ? "This field has no active mission state yet. It may not be initialized on the network."
          : "Ta poligon še nima aktivnega stanja. Morda ni inicializiran na omrežju."}
      </p>
      <button
        onClick={() => window.history.back()}
        style={{ background: "transparent", border: `1px solid ${ACCENT}`, color: ACCENT, padding: "10px 18px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer" }}
      >
        {en ? "Back to main command center" : "Nazaj v glavni komandni center"}
      </button>
    </div>
  );
}



function QuickJoinQr({ fieldId, en }: { fieldId: string; en: boolean }) {
  const url = `https://spartanopsapp.com/join?lobby=${fieldId}`;
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setToast(en ? "LINK COPIED TO CLIPBOARD // READY TO SHARE" : "POVEZAVA KOPIRANA // PRIPRAVLJENA ZA DELITEV");
      setTimeout(() => setCopied(false), 1800);
      setTimeout(() => setToast(null), 2400);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ background: PANEL, border: `1px solid ${ACCENT}55`, padding: 14, position: "relative" }}>
      <p
        className="font-mono uppercase"
        style={{ fontSize: 10, letterSpacing: "0.22em", color: ACCENT, textAlign: "center", marginBottom: 10 }}
      >
        [ {en ? "QUICK JOIN QR CODE // SCAN TO JOIN LOBBY DIRECTLY" : "QR ZA HITRI VSTOP // SKENIRAJ ZA NEPOSREDEN VSTOP"} ]
      </p>
      <div style={{ background: "#fff", padding: 12, display: "grid", placeItems: "center", margin: "0 auto", width: 180 }}>
        <QRCodeSVG value={url} size={156} level="M" />
      </div>
      <div
        style={{
          background: "#0a0c07",
          border: `1px solid ${ACCENT}33`,
          padding: "8px 10px",
          marginTop: 12,
          fontFamily: "monospace",
          fontSize: 11,
          color: INK,
          wordBreak: "break-all",
          lineHeight: 1.5,
          textAlign: "center",
        }}
      >
        {url.replace(/^https:\/\//, "")}
      </div>
      <p
        className="text-xs"
        style={{ color: MUTED, fontSize: 10, lineHeight: 1.55, textAlign: "center", marginTop: 8 }}
      >
        {en
          ? "Scan the QR code or send your teammates this URL, so they can join the game directly."
          : "Skenirajte QR kodo ali pošljite soigralcem to povezavo, da se lahko neposredno pridružijo igri."}
      </p>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center justify-center gap-2"
        style={{
          marginTop: 10,
          width: "100%",
          background: copied ? "#3ddc8422" : "transparent",
          color: copied ? "#3ddc84" : ACCENT,
          border: `1px solid ${copied ? "#3ddc8477" : ACCENT + "66"}`,
          padding: "9px 10px",
          fontFamily: "'Michroma', monospace",
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {copied ? <><Check size={12} /> {en ? "Copied" : "Kopirano"}</> : <><Copy size={12} /> {en ? "Copy Link" : "Kopiraj povezavo"}</>}
      </button>
      {toast && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: "50%",
            bottom: -14,
            transform: "translate(-50%, 100%)",
            background: "#0a0c07",
            color: "#3ddc84",
            border: "1px solid #3ddc8477",
            padding: "8px 12px",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            zIndex: 20,
            boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── SPARTACUS ANTI-CHEAT REALTIME ALERT ──────────────────────────────────
type SuspiciousRow = {
  id: string;
  point_number: number;
  team: string;
  player_callsign: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m: number | null;
  captured_at: string;
  spartacus_status: string;
};

function playSpartacusBeep() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      const t = now + i * 0.28;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.start(t);
      o.stop(t + 0.24);
    }
    setTimeout(() => ctx.close?.(), 1200);
  } catch { /* ignore */ }
}

export function SpartacusAlerts({ fieldId, password, en }: { fieldId: string; password: string; en: boolean }) {
  const [rows, setRows] = useState<SuspiciousRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const reviewFn = useServerFn(spartanopsSpartacusReview);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!password) return;
      const { data } = await supabase.rpc("spartanops_get_suspicious_captures" as any, {
        p_field_id: fieldId,
        p_marshal_password: password,
      });
      if (!alive) return;
      const list = ((data ?? []) as unknown as SuspiciousRow[]);
      setRows(list);
      list.forEach((r) => seen.current.add(r.id));
    };
    load();
    const ch = supabase
      .channel(`spartacus_alerts_${fieldId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spartanops_captures", filter: `field_id=eq.${fieldId}` }, (p) => {
        const n = p.new as any;
        if (!n?.suspicious || n?.spartacus_status !== "pending") return;
        if (seen.current.has(n.id)) return;
        seen.current.add(n.id);
        playSpartacusBeep();
        load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spartanops_captures", filter: `field_id=eq.${fieldId}` }, (p) => {
        const n = p.new as any;
        if (n?.spartacus_status && n.spartacus_status !== "pending") {
          setRows((prev) => prev.filter((r) => r.id !== n.id));
        } else {
          load();
        }
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [fieldId, password]);

  const decide = async (id: string, decision: "approve" | "reject" | "ban") => {
    if (busy) return;
    if (decision === "ban" && !confirm(en ? "Ban this player from the mission?" : "Izženi tega igralca iz misije?")) return;
    setBusy(id);
    try {
      await reviewFn({ data: { captureId: id, decision, fieldId, password } });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "Review failed");
    } finally { setBusy(null); }
  };

  if (rows.length === 0) return null;
  const NEON = "#ffb020";
  const RED = "#ff3b3b";

  return (
    <div style={{ marginBottom: 16 }}>
      {rows.map((r) => {
        const node = NODE_NAMES[r.point_number - 1] ?? `#${r.point_number}`;
        const teamLbl = (en ? TEAM_LABEL_EN[r.team] : TEAM_LABEL[r.team]) ?? r.team.toUpperCase();
        const loc = r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}` : "—";
        return (
          <div
            key={r.id}
            style={{
              border: `2px solid ${RED}`,
              background: "linear-gradient(135deg, rgba(255,59,59,0.14), rgba(255,176,32,0.10))",
              boxShadow: `0 0 24px -4px ${RED}88`,
              padding: 14,
              marginBottom: 10,
              animation: "spartacus-alert-pulse 1.4s ease-in-out infinite",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <AlertTriangle size={18} style={{ color: NEON }} />
              <span style={{ fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.22em", color: NEON, textTransform: "uppercase", fontWeight: 700 }}>
                ⚠ {en ? "SPARTACUS ALERT: SUSPICIOUS ACTIVITY DETECTED" : "SPARTACUS OPOZORILO: ZAZNANA SUMLJIVA AKTIVNOST"}
              </span>
              <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 9, letterSpacing: "0.18em", color: NEON, textTransform: "uppercase", padding: "2px 8px", border: `1px solid ${NEON}` }}>
                SPARTACUS
              </span>
            </div>
            <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 12, color: INK, lineHeight: 1.7 }}>
              <div>
                <span style={{ color: MUTED }}>{en ? "PLAYER" : "IGRALEC"}:</span>{" "}
                <strong>{r.player_callsign ?? "—"}</strong>{" "}
                <span style={{ color: TEAM_COLOR[r.team] ?? INK }}>({teamLbl})</span>
              </div>
              <div><span style={{ color: MUTED }}>{en ? "OBJECTIVE" : "CILJ"}:</span> <strong>{node}</strong></div>
              <div><span style={{ color: MUTED }}>{en ? "GPS" : "GPS"}:</span> {loc}</div>
              {r.distance_m != null && (
                <div><span style={{ color: MUTED }}>{en ? "DISTANCE" : "RAZDALJA"}:</span> <strong style={{ color: RED }}>{r.distance_m.toFixed(1)} m</strong></div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => decide(r.id, "approve")}
                style={{ background: "transparent", color: "#3ddc84", border: "1px solid #3ddc84", padding: "8px 10px", fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <ShieldCheck size={12} /> {en ? "APPROVE" : "ODOBRI"}
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => decide(r.id, "reject")}
                style={{ background: "transparent", color: NEON, border: `1px solid ${NEON}`, padding: "8px 10px", fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}
              >
                {en ? "DISMISS" : "ZAVRNI"}
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => decide(r.id, "ban")}
                style={{ background: RED, color: "#fff", border: `1px solid ${RED}`, padding: "8px 10px", fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <ShieldOff size={12} /> {en ? "BAN PLAYER" : "IZŽENI"}
              </button>
            </div>
          </div>
        );
      })}
      <style>{`@keyframes spartacus-alert-pulse{0%,100%{box-shadow:0 0 24px -4px rgba(255,59,59,0.55)}50%{box-shadow:0 0 40px -2px rgba(255,59,59,0.95)}}`}</style>
    </div>
  );
}

