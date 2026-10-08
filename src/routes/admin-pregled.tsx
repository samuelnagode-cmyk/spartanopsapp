import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { getMasterPw, setMasterPw, clearMasterPw } from "@/lib/master-admin";
import { missionTitle } from "@/lib/mission-title";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, Lock, ChevronLeft, X, Crosshair, ShieldCheck,
  Eye, EyeOff, Upload, ArrowLeftRight, Phone,
} from "lucide-react";

import {
  SpartanOpsConsole,
  Pane,
  Field as FieldRow,
  NodePlacer,
  RespawnQrConfig,
  CaptureScoringConfig,
  SpartacusConfig,
  LiveMatchView,
  DEFAULT_RESPAWN,
  inputStyle as consoleInputStyle,
  selectStyle as consoleSelectStyle,
  unlockSpartacusAudio,
  type GameState,
} from "@/components/SpartanOpsConsole";
import { useLang, useT } from "@/lib/i18n";
import { MissionSettingsTabs, GAME_MODES, GameModeButtons, TeamConfigSection, type GameModeKey, type MissionSettingsValue, type MissionTabKey } from "@/components/MissionSettings";
import { CountrySearchInput } from "@/components/CountrySearchInput";
import { flagFor } from "@/lib/countries";
import { usePremium } from "@/lib/premium";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllLobbies,
  listPublishedLobbies,
  createLobby as createLobbyFn,
  updateLobbyServer,
  deleteLobbyPlayers,
  deleteLobbyServer,
  masterDeleteLobby,
  verifyLobbyPassword,
  verifyMasterPassword,
  getLobby,
  type LobbyDto,
} from "@/lib/spartanops-lobbies.functions";
import { spartanopsUpsertCheckin, spartanopsAdminGetRoster, spartanopsGetServerTime } from "@/lib/spartanops-checkin.functions";
import { spartanopsAdminVerify, spartanopsAdminReassignTeam } from "@/lib/spartanops-admin.functions";
import { isStaleState } from "@/lib/game-state-sync";


export const Route = createFileRoute("/admin-pregled")({
  validateSearch: (s: Record<string, unknown>): { edit?: "1" } => ({
    edit: s.edit === "1" || s.edit === 1 ? "1" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Admin — SpartanOps" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

const ACCENT = "#E0B04E";
const BG = "#11140f";
const PANEL = "#1a1f17";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const DANGER = "#c0392b";
const FREE_NODES: Record<string, string | null> = { "1": null, "2": null, "3": null, "4": null, "5": null };

export { getMasterPw };

type MainSection = "fields" | "statistics";
type FieldKey = "zeleni-raj";
type Field = {
  key: FieldKey;
  title: string;
  subtitle: string;
};

const INITIAL_FIELDS: Field[] = [
  {
    key: "zeleni-raj",
    title: "FIELD: ZELENI RAJ",
    subtitle: "Vače, Slovenia • Active zone",
  },
];


import type { GameSettings } from "@/components/SpartanOpsConsole";
import { MissionCardSkeletonGrid } from "@/components/TacticalLoader";
import { WeaponRulesEditor, hasWeaponRules, type WeaponRules } from "@/components/WeaponRulesEditor";

export type NodePositions = Record<string, { x: number; y: number } | null>;

export type LobbyState = "pending" | "active" | "paused" | "ended";

export type LobbyRecord = {
  id: string;
  fieldName: string;
  eventName?: string;
  location: string;
  country?: string;
  city?: string;
  password?: string;

  marshalPassword?: string;
  gamemode: "domination" | "search_destroy";
  mapUrl?: string;
  matchDurationMinutes: number;
  countdownSeconds: number;
  pointTarget?: number;
  nodePositions?: NodePositions;
  settings?: GameSettings;
  createdAt: number;
  published: boolean;
  /** Marshal-controlled runtime state for locally-deployed lobbies. */
  state?: LobbyState;
  /** Timestamp (ms) when the marshal pressed START GAME. */
  startedAt?: number | null;
};

const LOBBY_STORAGE_KEY = "spartanops.lobbies.v1";
const LOBBY_CACHE_META_KEY = "spartanops.lobbies.v1.cachedAt";
const LOBBY_CACHE_TTL_MS = 30 * 60_000; // 30 minutes
const ALL_TIME_STORAGE_KEY = "spartanops.all_time_fields.v1";

/** True when a lobby is finished/cancelled and must be excluded from the active grid. */
export function isLobbyRetired(l: { state?: LobbyState | string | null } | null | undefined): boolean {
  if (!l) return false;
  const s = String(l.state ?? "").toLowerCase();
  return s === "ended" || s === "finished" || s === "cancelled" || s === "canceled";
}

/** Map a raw snake_case `spartanops_lobbies` Realtime row to the client LobbyRecord shape. */
export function rowToRecord(r: any): LobbyRecord {
  return {
    id: r.id,
    fieldName: r.field_name ?? "",
    eventName: r.event_name ?? undefined,
    location: r.location ?? "",
    country: r.country ?? undefined,
    city: r.city ?? undefined,
    marshalPassword: undefined,
    gamemode: (r.gamemode as any) ?? "domination",
    mapUrl: r.map_url ?? undefined,
    matchDurationMinutes: r.match_duration_minutes ?? 30,
    countdownSeconds: r.countdown_seconds ?? 60,
    pointTarget: r.point_target ?? 50,
    nodePositions: (r.node_positions as any) ?? undefined,
    settings: (r.settings as any) ?? undefined,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    published: !!r.published,
    state: (r.state as any) ?? "pending",
    startedAt: r.started_at ? new Date(r.started_at).getTime() : null,
  };
}

function gameStatusToLobbyState(status: GameState["status"] | null | undefined): LobbyState | null {
  if (status === "active" || status === "paused" || status === "ended") return status;
  if (status === "lobby" || status === "closed") return "pending";
  return null;
}


export type AllTimeFieldRecord = {
  id: string;
  fieldName: string;
  city: string;
  country: string;
  createdAt: number;
  system?: boolean;
};

// DEPRECATED system field id — permanently purged from all public views.
export const SYSTEM_FIELD = {
  id: "__deprecated_zeleni_raj_tactical__",
  fieldName: "",
  city: "",
  country: "",
  createdAt: 0,
  system: true as const,
} satisfies AllTimeFieldRecord;

const PURGED_IDS = new Set(["zeleni-raj", SYSTEM_FIELD.id]);
const PURGED_NAMES = new Set(["zeleni raj tactical"]);

function isPurged(r: { id?: string; fieldName?: string; system?: boolean }) {
  if (!r) return false;
  if (r.id && PURGED_IDS.has(r.id)) return true;
  if (r.system === true) return true;
  if (r.fieldName && PURGED_NAMES.has(r.fieldName.trim().toLowerCase())) return true;
  return false;
}

/** Returns local registry with purged/system entries removed. */
export function loadFieldsRegistryWithSystem(): AllTimeFieldRecord[] {
  const local = loadAllTimeFields().filter((r) => !isPurged(r));
  return local.sort((a, b) => b.createdAt - a.createdAt);
}

export function loadLobbies(): LobbyRecord[] {
  if (typeof window === "undefined") return [];
  try {
    // TTL enforcement: purge cache older than 30 min so a long-idle tab doesn't
    // render stale (deleted / finished) missions on next open.
    const meta = Number(localStorage.getItem(LOBBY_CACHE_META_KEY) ?? 0);
    if (meta && Date.now() - meta > LOBBY_CACHE_TTL_MS) {
      try {
        localStorage.removeItem(LOBBY_STORAGE_KEY);
        localStorage.removeItem(LOBBY_CACHE_META_KEY);
      } catch {}
      return [];
    }
    const raw = localStorage.getItem(LOBBY_STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as LobbyRecord[]) : [];
    const cleaned = list
      .filter((l) => !isPurged(l as any))
      .filter((l) => !isLobbyRetired(l))
      .map((l) => (l.mapUrl && l.mapUrl.length > 4096 ? { ...l, mapUrl: undefined } : l));
    if (cleaned.length !== list.length || cleaned.some((l, i) => l.mapUrl !== list[i]?.mapUrl)) {
      safeSetItem(LOBBY_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch { return []; }
}

/** Wraps localStorage.setItem with quota-safe fallback. On QuotaExceededError
 *  we purge legacy spartanops caches (the lobbies mirror is not the source of
 *  truth — the DB is) and retry once. Never throws. */
function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    const isQuota = e && (e.name === "QuotaExceededError" || e.code === 22 || /quota/i.test(String(e?.message)));
    if (!isQuota) { console.warn("[spartanops] localStorage write failed", e); return false; }
    try {
      // Purge legacy spartanops keys except the auth session.
      const KEEP = new Set(["spartanops.active_session"]);
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("spartanops") && !KEEP.has(k)) toRemove.push(k);
      }
      toRemove.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
      localStorage.setItem(key, value);
      return true;
    } catch (e2) {
      console.warn("[spartanops] localStorage quota exceeded; skipping cache write", e2);
      return false;
    }
  }
}

export function saveLobbies(list: LobbyRecord[]) {
  // Cap at 25 most recent entries — the DB is the source of truth; this cache
  // exists only for offline fallback / cross-tab hints. Retired (ended/cancelled)
  // lobbies never enter the active-mission cache.
  const capped = list
    .filter((l) => !isLobbyRetired(l))
    .slice(0, 25)
    .map((l) => (l.mapUrl && l.mapUrl.length > 4096 ? { ...l, mapUrl: undefined } : l));
  const ok = safeSetItem(LOBBY_STORAGE_KEY, JSON.stringify(capped));
  if (ok) safeSetItem(LOBBY_CACHE_META_KEY, String(Date.now()));
}




export function updateLobby(id: string, patch: Partial<LobbyRecord>): LobbyRecord | null {
  const list = loadLobbies();
  const idx = list.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  const next = { ...list[idx], ...patch };
  list[idx] = next;
  saveLobbies(list);
  return next;
}

/** Convert a DB DTO into the client LobbyRecord shape used by existing UI. */
export function dtoToRecord(d: LobbyDto): LobbyRecord {
  return {
    id: d.id,
    fieldName: d.fieldName,
    eventName: d.eventName ?? undefined,
    location: d.location,
    country: d.country ?? undefined,
    city: d.city ?? undefined,
    marshalPassword: undefined,

    gamemode: d.gamemode,
    mapUrl: d.mapUrl ?? undefined,
    matchDurationMinutes: d.matchDurationMinutes,
    countdownSeconds: d.countdownSeconds,
    pointTarget: d.pointTarget,
    nodePositions: (d.nodePositions as any) ?? undefined,
    settings: (d.settings as any) ?? undefined,
    createdAt: new Date(d.createdAt).getTime(),
    published: d.published,
    state: d.state,
    startedAt: d.startedAt ? new Date(d.startedAt).getTime() : null,
  };
}


export function loadAllTimeFields(): AllTimeFieldRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALL_TIME_STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as AllTimeFieldRecord[]) : [];
    const cleaned = list.filter((r) => !isPurged(r));
    if (cleaned.length !== list.length) {
      safeSetItem(ALL_TIME_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch { return []; }
}
function saveAllTimeFields(list: AllTimeFieldRecord[]) {
  safeSetItem(ALL_TIME_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
}
function upsertAllTimeField(rec: AllTimeFieldRecord) {
  const list = loadAllTimeFields();
  const filtered = list.filter((r) => r.id !== rec.id);
  filtered.unshift(rec);
  saveAllTimeFields(filtered);
}

function PremiumStatusToggle({
  isPremium, t,
}: {
  isPremium: boolean;
  t: (k: string) => string;
}) {
  const label = isPremium ? t("premium.statusPremium") : t("premium.statusFree");
  const color = isPremium ? ACCENT : "rgba(180,190,205,0.75)";
  const glow = isPremium ? `0 0 10px ${ACCENT}88` : "none";
  return (
    <div style={{ maxWidth: 360, margin: "14px auto 0", textAlign: "center" }}>
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "4px 6px",
          fontFamily: "'Michroma', monospace", fontSize: 9.5, letterSpacing: "0.16em",
          color, textShadow: glow,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function AdminPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const t = useT();
  const { isPremium } = usePremium();
  const search = useSearch({ from: "/admin-pregled" }) as { edit?: string };
  const navigate = useNavigate();
  const [section, setSection] = useState<MainSection>("fields");
  const [fields] = useState<Field[]>(INITIAL_FIELDS);
  // Keep the server and first browser render identical; hydrate the local
  // cache immediately after mount, then reconcile with the database below.
  const [customLobbies, setCustomLobbies] = useState<LobbyRecord[]>([]);
  const [lobbiesLoaded, setLobbiesLoaded] = useState(false);
  const [activeField, setActiveField] = useState<FieldKey | null>(null);
  const [fieldAuth, setFieldAuth] = useState<Record<string, string>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createEventName, setCreateEventName] = useState("");
  const [marshalPromptLobby, setMarshalPromptLobby] = useState<LobbyRecord | null>(null);
  const [marshalActiveLobby, setMarshalActiveLobby] = useState<LobbyRecord | null>(null);
  const [ownerAccessToken, setOwnerAccessToken] = useState<string | undefined>(undefined);
  const [marshalPasswordVerified, setMarshalPasswordVerified] = useState<string>("");
  // Ephemeral plaintext password cache keyed by lobby id — passwords are bcrypt-hashed
  // in the DB and never returned, so we retain them only when the marshal enters them
  // this session (via create or verify) so the console can display the current values.
  const [lobbyPwCache, setLobbyPwCache] = useState<Record<string, { player?: string; marshal?: string }>>({});
  const listLobbiesFn = useServerFn(listAllLobbies);
  const listPublishedLobbiesFn = useServerFn(listPublishedLobbies);
  const masterDeleteLobbyFn = useServerFn(masterDeleteLobby);

  useEffect(() => {
    const cached = loadLobbies();
    if (cached.length > 0) {
      setCustomLobbies(cached);
      setLobbiesLoaded(true);
    }
  }, []);

  // Auto-open the edit modal when arriving via footer link (?edit=1)
  useEffect(() => {
    if (search.edit === "1" && !isEditMode) setEditModalOpen(true);
  }, [search.edit]);

  // Hydrate lobbies from the database (source of truth); mirror to localStorage
  // so cross-tab reads and legacy code paths still work.
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const mpw = getMasterPw();
      try {
        const rows = mpw
          ? await listLobbiesFn({ data: { masterPassword: mpw } })
          : await listPublishedLobbiesFn();
        if (!alive) return;
        // Strip retired (ended/cancelled) lobbies from the active grid.
        const records = rows.map(dtoToRecord).filter((l) => !isLobbyRetired(l));
        setCustomLobbies((prev) => {
          // Overwrite when the active set differs from the cache — this is the
          // "mathematically exact" background sync path.
          const prevIds = prev.map((l) => l.id).sort().join("|");
          const nextIds = records.map((l) => l.id).sort().join("|");
          if (prevIds !== nextIds) {
            saveLobbies(records);
            return records;
          }
          saveLobbies(records);
          return records;
        });
      } catch (e) {
        console.error("[admin] failed to load lobbies", e);
        if (alive) setCustomLobbies([]);
      } finally {
        if (alive) setLobbiesLoaded(true);
      }
    };
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    // Live-sync via Realtime on the lobbies table — merge directly into local
    // state instead of triggering a full SELECT on every ping.
    const channel = supabase
      .channel("admin-lobbies")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spartanops_lobbies" }, (payload) => {
        const row = rowToRecord(payload.new as any);
        if (isPurged(row as any) || isLobbyRetired(row)) return;
        setCustomLobbies((prev) => {
          if (prev.some((l) => l.id === row.id)) return prev;
          const next = [row, ...prev].sort((a, b) => b.createdAt - a.createdAt);
          saveLobbies(next);
          return next;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spartanops_lobbies" }, (payload) => {
        const row = rowToRecord(payload.new as any);
        setCustomLobbies((prev) => {
          // Retired states (ended/cancelled) drop from the active grid immediately.
          if (isLobbyRetired(row) || isPurged(row as any)) {
            const next = prev.filter((l) => l.id !== row.id);
            if (next.length !== prev.length) saveLobbies(next);
            return next;
          }
          const idx = prev.findIndex((l) => l.id === row.id);
          if (idx < 0) {
            const next = [row, ...prev].sort((a, b) => b.createdAt - a.createdAt);
            saveLobbies(next);
            return next;
          }
          // Preserve any locally cached fields the public view strips (e.g. marshalPassword).
          const merged = { ...prev[idx], ...row };
          const next = prev.slice();
          next[idx] = merged;
          saveLobbies(next);
          return next;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "spartanops_lobbies" }, (payload) => {
        const id = (payload.old as any)?.id;
        if (!id) return;
        setCustomLobbies((prev) => {
          const next = prev.filter((l) => l.id !== id);
          if (next.length !== prev.length) saveLobbies(next);
          return next;
        });
      })
      .subscribe();
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [creating, listLobbiesFn, listPublishedLobbiesFn]);


  const refreshLobbies = async () => {
    const mpw = getMasterPw();
    try {
      const rows = mpw
        ? await listLobbiesFn({ data: { masterPassword: mpw } })
        : await listPublishedLobbiesFn();
      const records = rows.map(dtoToRecord);
      setCustomLobbies(records);
      saveLobbies(records);
    } catch (e) {
      console.error("[admin] refresh failed", e);
    }
  };

  const scrollToList = () => {
    const el = document.getElementById("fields-list");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDecommissionLobby = async (id: string) => {
    const mpw = getMasterPw();
    if (!mpw) {
      alert("Master admin unlock required to permanently delete a mission. Use the footer Admin link to unlock edit mode.");
      return;
    }
    const msg = "CRITICAL: Permanently delete this mission and wipe all associated data (checkins, captures, game state)?";
    if (!confirm(msg)) return;
    // Optimistic local removal
    const prev = customLobbies;
    setCustomLobbies((list) => list.filter((l) => l.id !== id));
    try {
      await masterDeleteLobbyFn({ data: { id, masterPassword: mpw } });
      await refreshLobbies();
    } catch (e: any) {
      console.error("[admin] master delete failed", e);
      // A statement timeout can fire after the deletion already committed (or while
      // it finishes server-side). Re-check the live list before alarming the marshal.
      let stillThere = true;
      try {
        const fresh = await listLobbiesFn({ data: { masterPassword: mpw } } as any);
        stillThere = Array.isArray(fresh) && fresh.some((l: any) => l?.id === id);
      } catch {}
      if (!stillThere) {
        await refreshLobbies();
        return;
      }
      alert(`Failed to decommission lobby: ${e?.message ?? "unknown error"}`);
      setCustomLobbies(prev);
    }
  };

  const handleExitAdminView = () => {
    clearMasterPw();
    setIsEditMode(false);
    setEditModalOpen(false);
    // Clear ?edit=1 so the footer ADMIN link can re-trigger the unlock modal.
    void navigate({ to: "/admin-pregled", search: {} as any, replace: true });
    void refreshLobbies();
  };


  return (
    <div style={{ background: BG, color: INK, minHeight: "100dvh", padding: "96px 16px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 0, gap: 12 }}>
          {isEditMode ? (
            <button
              onClick={handleExitAdminView}
              title={en ? "Exit admin view" : "Izhod iz skrbniškega pogleda"}
              style={{
                background: "rgba(192,57,43,0.14)", color: "#ff8a7d",
                border: `1px solid ${DANGER}`, cursor: "pointer",
                boxShadow: `0 0 14px ${DANGER}44`,
                padding: "9px 12px",
                fontFamily: "'Michroma', monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 800,
              }}
              aria-label="Exit admin view"
            >
              ✕ {en ? "EXIT ADMIN" : "IZHOD ADMIN"}
            </button>
          ) : (
            <span />
          )}
          {isEditMode ? (
            <span />
          ) : (
            <Link to="/spartanops" style={{ color: MUTED, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ArrowLeft size={11} /> {en ? "Exit" : "Izhod"}
            </Link>
          )}
        </div>

        {/* Prominent title — sits comfortably below the fixed navbar */}
        <div style={{ textAlign: "center", marginTop: 56, marginBottom: 18 }}>
          <h1 style={{
            fontFamily: "'Michroma', monospace",
            fontSize: "clamp(16px, 4.4vw, 26px)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: ACCENT,
            lineHeight: 1.2,
            textShadow: `0 0 18px ${ACCENT}33`,
          }}>
            {en ? "MARSHAL COMMAND CENTER" : "MARŠAL KOMANDNI CENTER"}
          </h1>
          {isEditMode && (
            <p style={{
              fontFamily: "monospace", fontSize: 10.5, letterSpacing: "0.24em",
              color: DANGER, textTransform: "uppercase", marginTop: 10,
            }}>
              // ELEVATED PRIVILEGES ACTIVE — SECURED LOG MANAGEMENT HUB
            </p>
          )}
          <div style={{ width: 48, height: 1, background: ACCENT, margin: "12px auto 0", opacity: 0.7 }} />

          {/* Premium status indicator — static badge */}
          <PremiumStatusToggle
            isPremium={isPremium}
            t={t}
          />

        </div>




        {/* Tabs */}
        {!creating && !activeField && !marshalActiveLobby && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 6, marginBottom: 30 }}>
          {([
            { k: "fields", l: en ? "MISSIONS" : "MISIJE" },
            { k: "statistics", l: en ? "STATISTICS" : "STATISTIKA" },
          ] as { k: MainSection; l: string }[]).map((s) => {
            const active = section === s.k;
            return (
              <button
                key={s.k}
                onClick={() => { setSection(s.k); setActiveField(null); setCreating(false); }}
                style={{
                  background: active ? ACCENT : "transparent",
                  color: active ? BG : INK,
                  border: `1px solid ${active ? ACCENT : "rgba(224,176,78,0.35)"}`,
                  padding: "12px 10px",
                  fontFamily: "'Michroma', monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {s.l}
              </button>
            );
          })}
        </div>
        )}

        {section === "fields" && creating && (
          <CreateFieldForm
            initialEventName={createEventName}
            onCreated={async (rec, pws) => {
              setCreating(false);
              setCustomLobbies(loadLobbies());
              setLobbyPwCache((s) => ({ ...s, [rec.id]: { player: pws.password, marshal: pws.marshalPassword } }));
              setMarshalPasswordVerified(pws.marshalPassword);
              // Signed-in creator owns the mission: use the owner path so an empty
              // helper password still works.
              try {
                const { data: sess } = await supabase.auth.getSession();
                setOwnerAccessToken(sess.session?.access_token ?? undefined);
              } catch { setOwnerAccessToken(undefined); }
              setMarshalActiveLobby(rec);
            }}
          />
        )}

        {section === "fields" && !creating && !activeField && !marshalActiveLobby && (
          <FieldsWelcome
            onCreate={(ev?: string) => { setCreateEventName(ev ?? ""); setCreating(true); }}
            onOpenAccountMission={async (m) => {
              // Silent owner open: a signed-in account owner skips the password prompt.
              try {
                const { data: sess } = await supabase.auth.getSession();
                const token = sess.session?.access_token;
                if (token) {
                  const dto = await getLobby({ data: { id: m.id, authPassword: "", accessToken: token } });
                  if (dto) {
                    setOwnerAccessToken(token);
                    setMarshalPasswordVerified("");
                    setMarshalActiveLobby(dtoToRecord(dto));
                    return;
                  }
                }
              } catch (e) {
                console.warn("[marshal] silent owner open failed, falling back to password", e);
              }
              setOwnerAccessToken(undefined);
              setMarshalPromptLobby({
                id: m.id,
                fieldName: m.field_name,
                eventName: m.event_name ?? undefined,
                location: "",
                gamemode: "domination",
                matchDurationMinutes: 30,
                countdownSeconds: 60,
                createdAt: 0,
                published: false,
              });
            }}
          />
        )}

        {section === "fields" && !creating && activeField && (
          <FieldConsole
            field={fields.find((f) => f.key === activeField)!}
            authedPw={fieldAuth[activeField]}
            onBack={() => setActiveField(null)}
            onAuth={(pw) => setFieldAuth((s) => ({ ...s, [activeField]: pw }))}
          />
        )}

        {section === "fields" && marshalActiveLobby && (
          <MarshalLobbyConsole
            lobby={marshalActiveLobby}
            marshalPassword={marshalPasswordVerified}
            lobbyPasswordCached={lobbyPwCache[marshalActiveLobby.id]?.player ?? ""}
            marshalPasswordCached={lobbyPwCache[marshalActiveLobby.id]?.marshal ?? marshalPasswordVerified}
            ownerAccessToken={ownerAccessToken}
            onBack={() => { setMarshalActiveLobby(null); setMarshalPasswordVerified(""); setOwnerAccessToken(undefined); }}
          />
        )}

        {section === "statistics" && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: MUTED, fontStyle: "italic" }}>
            <p style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: ACCENT, marginBottom: 8 }}>
              // COMING SOON
            </p>
            <p>{en ? "Cross-field analytics are under construction." : "Analitika je še v pripravi."}</p>
          </div>
        )}
      </div>

      {editModalOpen && (
        <MasterPasswordModal
          onClose={() => setEditModalOpen(false)}
          onSuccess={(pw) => { setMasterPw(pw); setIsEditMode(true); setEditModalOpen(false); }}
        />
      )}

      {marshalPromptLobby && (
        <MarshalPasswordPrompt
          lobby={marshalPromptLobby}
          onClose={() => setMarshalPromptLobby(null)}
          onSuccess={async (pw) => {
            const prompt = marshalPromptLobby;
            // Always load a fresh, complete record by id so the console works even
            // for missions never cached on this device (account list → cross-device).
            let full: LobbyRecord = prompt;
            try {
              const dto = await getLobby({ data: { id: prompt.id, authPassword: pw } });
              if (dto) full = dtoToRecord(dto);
            } catch (e) {
              console.warn("[marshal] fresh lobby fetch failed, using cached record", e);
            }
            setMarshalPasswordVerified(pw);
            setLobbyPwCache((s) => ({ ...s, [prompt.id]: { ...s[prompt.id], marshal: pw } }));
            setMarshalActiveLobby(full);
            setMarshalPromptLobby(null);
          }}
        />
      )}

      <style>{`
        @keyframes cmdStatusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        .cmd-status-pulse > span:first-child {
          animation: cmdStatusPulse 1.6s ease-in-out infinite;
          box-shadow: 0 0 8px ${ACCENT};
        }
      `}</style>
    </div>
  );
}

function CreateFieldForm({ onCreated, initialEventName = "" }: { onCreated: (rec: LobbyRecord, pws: { password: string; marshalPassword: string }) => void; initialEventName?: string }) {
  const { lang } = useLang();
  const en = lang === "en";
  const [value, setValue] = useState<MissionSettingsValue>({
    missionName: "",
    eventName: initialEventName,
    missionDescription: "",
    afterGameInstructions: "",
    marshalName: "",
    marshalPhone: "",
    gamemode: "domination",
    duration: 20,
    countdown: 300,
    pointTarget: 50,
    settings: { respawn: { ...DEFAULT_RESPAWN }, capturePointsScoring: true },
    weaponRules: {},
    mapUrl: "",
    nodePositions: {},
  });
  const onChange = (patch: Partial<MissionSettingsValue>) => setValue((v) => ({ ...v, ...patch }));
  const [existingEvents, setExistingEvents] = useState<string[]>([]);

  // Load this account's event names and pre-fill the marshal from its most recent mission.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("spartanops_lobbies")
        .select("event_name, settings, created_at")
        .eq("account_id", user.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const rows = (data ?? []) as { event_name: string | null; settings: any }[];
      const seen = new Map<string, string>();
      for (const r of rows) {
        const k = foldEvent(r.event_name);
        if (k && !seen.has(k)) seen.set(k, (r.event_name ?? "").trim());
      }
      setExistingEvents([...seen.values()]);
      const last = rows[rows.length - 1]?.settings ?? null;
      if (last) {
        setValue((v) => ({
          ...v,
          marshalName: v.marshalName || String(last.marshalName ?? ""),
          marshalPhone: v.marshalPhone || String(last.marshalPhone ?? ""),
        }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const createFn = useServerFn(createLobbyFn);
  const [busy, setBusy] = useState(false);

  const missing: string[] = [];
  if (!value.missionName.trim()) missing.push("missionName");
  if (!value.marshalName.trim()) missing.push("marshalName");
  const missingLabels = missing.map((k) => k === "missionName" ? (en ? "mission name" : "ime misije") : (en ? "marshal name" : "ime maršala"));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || missing.length) return;
    const settingsWithMission = {
      ...value.settings,
      missionName: value.missionName.trim(),
      marshalName: value.marshalName.trim(),
      marshalPhone: value.marshalPhone.trim() || undefined,
      missionDescription: value.missionDescription.trim() || undefined,
      afterGameInstructions: value.afterGameInstructions.trim() || undefined,
      weaponRules: hasWeaponRules(value.weaponRules) ? value.weaponRules : undefined,
    } as any;
    const createToken = await getFreshOwnerAccessToken();
    if (!createToken) {
      setErr(en ? "Log in to create a mission" : "Za ustvarjanje misije se prijavi");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      // Field name, city, country and location are filled in by the server from the account.
      const dto = await createFn({
        data: {
          accessToken: createToken,
          eventName: value.eventName.trim() || undefined,
          gamemode: value.gamemode,
          mapUrl: value.mapUrl.trim() || undefined,
          matchDurationMinutes: value.duration,
          countdownSeconds: value.countdown,
          pointTarget: value.pointTarget,
          nodePositions: value.nodePositions,
          settings: settingsWithMission,
          masterPassword: getMasterPw(),
          published: true,
        },
      });

      const rec = dtoToRecord(dto);
      const list = loadLobbies();
      list.unshift(rec);
      saveLobbies(list);
      upsertAllTimeField({
        id: rec.id,
        fieldName: rec.fieldName,
        city: rec.city ?? "",
        country: rec.country ?? "",
        createdAt: rec.createdAt,
      });
      setOk(true);
      onCreated(rec, { password: "", marshalPassword: "" });
    } catch (e: any) {
      console.error("[admin] createLobby failed", { error: e, message: e?.message, cause: e?.cause, stack: e?.stack });
      setErr(e?.message ? `Error: ${e.message}` : "Failed to create lobby.");
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || missing.length > 0;
  return (
    <form onSubmit={submit} style={{ maxWidth: 780, margin: "0 auto", paddingBottom: 190 }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 18, letterSpacing: "0.2em", color: ACCENT, textTransform: "uppercase", fontWeight: 700 }}>
          {en ? "New mission" : "Nova misija"}
        </h2>
      </div>

      <MissionSettingsTabs en={en} value={value} onChange={onChange} mode="create" existingEvents={existingEvents} missingRequired={missing} />

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, background: `${BG}f2`, borderTop: `1px solid ${ACCENT}55`, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", backdropFilter: "blur(6px)" }}>
        {err && <p style={{ color: "#d97a6c", fontSize: 12, marginBottom: 8, textAlign: "center" }}>{err}</p>}
        {ok && <p style={{ color: ACCENT, fontSize: 12, marginBottom: 8, fontFamily: "monospace", letterSpacing: "0.14em", textAlign: "center" }}>// {en ? "MISSION CREATED" : "MISIJA USTVARJENA"}</p>}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {missing.length > 0 && (
            <p style={{ color: "#e8833a", fontSize: 11, fontFamily: "monospace", margin: 0, textAlign: "center" }}>
              {en ? "Missing: " : "Manjka: "}{missingLabels.join(", ")}
            </p>
          )}
          <button type="submit" disabled={disabled}
            style={{ background: ACCENT, color: BG, border: "none", padding: "14px 28px", fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, cursor: busy ? "wait" : disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, width: "min(320px, 100%)" }}>
            [ {busy ? (en ? "CREATING…" : "USTVARJAM…") : (en ? "Create mission" : "Ustvari misijo")} ]
          </button>
          <p style={{ color: `${ACCENT}99`, fontSize: 11, fontFamily: "monospace", letterSpacing: "0.04em", lineHeight: 1.55, textAlign: "center", maxWidth: 520, margin: 0 }}>
            {en
              ? "The mission appears in your list. Players can join once you set it active."
              : "Misija se prikaže na tvojem seznamu. Igralci lahko vstopijo, ko jo nastaviš kot aktivno."}
          </p>
        </div>
      </div>
    </form>
  );
}


type AccountLobby = {
  id: string;
  field_name: string;
  event_name: string | null;
  settings?: Record<string, any> | null;
  gamemode?: string | null;
  match_duration_minutes?: number | null;
  created_at?: string | null;
};

/** Case-, space- and diacritic-insensitive key for event names. */
function foldEvent(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function slMissionCount(n: number): string {
  const m100 = n % 100;
  if (m100 === 1) return `${n} misija`;
  if (m100 === 2) return `${n} misiji`;
  if (m100 === 3 || m100 === 4) return `${n} misije`;
  return `${n} misij`;
}

function gamemodeLabel(key: string | null | undefined): string {
  return GAME_MODES.find((g) => g.key === key)?.label ?? (key ? key : "Domination");
}

/** Event-name input with suggestions from this account's existing events.
 *  A value matching an existing event (ignoring case/spaces/accents) is stored in the existing spelling. */
function EventNameInput({ value, onChange, en }: { value: string; onChange: (v: string) => void; en: boolean }) {
  const [events, setEvents] = useState<string[]>([]);
  const listId = `evt-list-${useId().replace(/:/g, "")}`;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("spartanops_lobbies")
        .select("event_name, created_at")
        .eq("account_id", user.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const seen = new Map<string, string>();
      for (const r of (data ?? []) as { event_name: string | null }[]) {
        const k = foldEvent(r.event_name);
        if (k && !seen.has(k)) seen.set(k, (r.event_name ?? "").trim());
      }
      setEvents([...seen.values()]);
    })();
    return () => { cancelled = true; };
  }, []);
  const handle = (v: string) => {
    const k = foldEvent(v);
    const match = k ? events.find((e) => foldEvent(e) === k) : undefined;
    onChange(match && !v.endsWith(" ") ? match : v);
  };
  return (
    <>
      <input value={value} list={listId} onChange={(e) => handle(e.target.value)} style={consoleInputStyle} placeholder={en ? "e.g. Operation Sparta" : "npr. Operacija Sparta"} />
      <datalist id={listId}>
        {events.map((e) => <option key={e} value={e} />)}
      </datalist>
    </>
  );
}

const smallBarBtn: CSSProperties = {
  fontFamily: "monospace", fontSize: 11, letterSpacing: "0.04em", color: ACCENT,
  background: "transparent", border: `1px solid ${ACCENT}66`, padding: "5px 10px",
  whiteSpace: "nowrap", cursor: "pointer", textDecoration: "none", flexShrink: 0,
};
const smallLink: CSSProperties = {
  background: "transparent", border: "none", color: ACCENT, textDecoration: "underline", cursor: "pointer",
  fontFamily: "monospace", fontSize: 11, padding: 0, whiteSpace: "nowrap", flexShrink: 0,
};

type MissionGroup = { key: string; title: string; missions: AccountLobby[]; newest: number };

// Step 0.3: account-scoped mission list, grouped by event.
function AccountMissionsSection({ en, onOpenMission, onCreateInEvent }: { en: boolean; onOpenMission: (m: AccountLobby) => void; onCreateInEvent: (eventName: string) => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [missions, setMissions] = useState<AccountLobby[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [business, setBusiness] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const [activeLobbyId, setActiveLobbyId] = useState<string | null>(null);
  const [settingActive, setSettingActive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [locMissing, setLocMissing] = useState(false);

  useEffect(() => {
    if (!userId) { setMissions(null); setActiveLobbyId(null); return; }
    let cancelled = false;
    (async () => {
      const [{ data, error }, acc] = await Promise.all([
        supabase
          .from("spartanops_lobbies")
          .select("id, field_name, event_name, settings, gamemode, match_duration_minutes, created_at")
          .eq("account_id", userId)
          .order("created_at", { ascending: false }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("spartanops_accounts") as any)
          .select("active_lobby_id, city, country")
          .eq("id", userId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (error) { setErr(error.message); return; }
      setErr(null);
      setMissions((data ?? []) as AccountLobby[]);
      setActiveLobbyId((acc?.data?.active_lobby_id as string | null) ?? null);
      setLocMissing(!acc?.data?.city || !acc?.data?.country);
    })();
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const setActiveMission = async (lobbyId: string) => {
    if (!userId) return;
    setSettingActive(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    // End-and-reset the previously active mission (same as "END AND RESET"):
    // clears captures and scores, returns it to lobby, keeps its players.
    if (activeLobbyId && activeLobbyId !== lobbyId) {
      await updateLobbyServer({ data: { id: activeLobbyId, patch: { state: "pending" }, authPassword: "", accessToken: token } })
        .catch(() => undefined);
    }
    // Make sure the newly activated mission is open in the lobby so players can join.
    await updateLobbyServer({ data: { id: lobbyId, patch: { state: "pending" }, authPassword: "", accessToken: token } })
      .catch(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("spartanops_accounts") as any)
      .update({ active_lobby_id: lobbyId })
      .eq("id", userId);
    setSettingActive(false);
    if (error) { setErr(error.message); return; }
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!userId) { setBusiness(null); return; }
    let cancelled = false;
    supabase
      .from("spartanops_accounts")
      .select("business_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setBusiness(data?.business_name ?? null); });
    return () => { cancelled = true; };
  }, [userId]);

  const titleOf = (m: AccountLobby) => missionTitle(
    { fieldName: null, eventName: m.event_name, settings: m.settings ?? null },
    "",
  ) || (m.event_name ?? "").trim() || m.field_name;

  const groups: MissionGroup[] = useMemo(() => {
    if (!missions) return [];
    const ts = (m: AccountLobby) => (m.created_at ? Date.parse(m.created_at) : 0);
    const map = new Map<string, MissionGroup>();
    for (const m of missions) {
      const key = foldEvent(m.event_name);
      let g = map.get(key);
      if (!g) { g = { key, title: "", missions: [], newest: 0 }; map.set(key, g); }
      g.missions.push(m);
      g.newest = Math.max(g.newest, ts(m));
    }
    const out = [...map.values()];
    for (const g of out) {
      g.missions.sort((a, b) => ts(a) - ts(b));
      g.title = g.key ? (g.missions[0].event_name ?? "").trim() : (en ? "Standalone missions" : "Samostojne misije");
    }
    const hasActive = (g: MissionGroup) => g.missions.some((m) => m.id === activeLobbyId);
    out.sort((a, b) => {
      if (hasActive(a) !== hasActive(b)) return hasActive(a) ? -1 : 1;
      if (!a.key !== !b.key) return a.key ? -1 : 1; // "No event" last
      return b.newest - a.newest;
    });
    return out;
  }, [missions, activeLobbyId, en]);

  const total = missions?.length ?? 0;
  const showSearch = total > 8;
  const q = showSearch ? foldEvent(query) : "";

  // Initial collapse state (component-only).
  useEffect(() => {
    if (!missions || expanded) return;
    const init: Record<string, boolean> = {};
    for (const g of groups) init[g.key] = false;
    setExpanded(init);
  }, [missions, groups, expanded]);

  if (!ready) return null;

  if (!userId) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto 28px", padding: "10px 12px", border: `1px dashed ${ACCENT}55`, fontFamily: "monospace", fontSize: 12, color: MUTED, textAlign: "center" }}>
        {en ? "Log in to see your missions from any device — " : "Prijavi se in svoje misije vidi na vsaki napravi — "}
        <Link to="/marshal-account" style={{ color: ACCENT, textDecoration: "underline" }}>
          {en ? "Marshal account" : "Račun maršala"}
        </Link>
      </div>
    );
  }

  const matchesQ = (m: AccountLobby) => !q || foldEvent(titleOf(m)).includes(q) || foldEvent(m.event_name).includes(q);
  const activeMission = missions?.find((m) => m.id === activeLobbyId) ?? null;
  const pinned = activeMission && matchesQ(activeMission) ? activeMission : null;
  const visibleGroups = groups
    .map((g) => {
      const rest = g.missions.filter((m) => m.id !== activeLobbyId);
      if (!q) return { ...g, missions: rest };
      return { ...g, missions: rest.filter(matchesQ) };
    })
    .filter((g) => g.missions.length > 0);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <strong style={{ color: ACCENT, fontFamily: "monospace", fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{business || ""}</strong>
        <Link to="/marshal-account" style={{ ...smallBarBtn, flexShrink: 0 }}>{en ? "Field settings" : "Nastavitve poligona"}</Link>
      </div>
      <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.30em", color: ACCENT, margin: "0 0 10px", textTransform: "uppercase" }}>
        {en ? "// YOUR MISSIONS" : "// TVOJE MISIJE"}
      </p>
      {locMissing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontFamily: "monospace", fontSize: 11, opacity: 0.85 }}>
          <span style={{ flex: 1, minWidth: 0, lineHeight: 1.5 }}>{en ? "Add your field's city and country so players can find you." : "Dodaj mesto in državo poligona, da te igralci lahko najdejo."}</span>
          <Link to="/marshal-account" style={{ ...smallBarBtn, flexShrink: 0 }}>{en ? "Field settings" : "Nastavitve poligona"}</Link>
        </div>
      )}
      {showSearch && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={en ? "Search missions…" : "Išči misije…"}
          style={{ ...consoleInputStyle, width: "100%", marginBottom: 12, boxSizing: "border-box" }}
        />
      )}
      {err ? (
        <p style={{ color: "#d97a6c", fontSize: 12 }}>{err}</p>
      ) : missions === null ? (
        <p style={{ fontFamily: "monospace", fontSize: 12, color: MUTED }}>…</p>
      ) : missions.length === 0 ? (
        <p style={{ fontFamily: "monospace", fontSize: 12, color: MUTED }}>{en ? "No missions linked yet." : "Še ni povezanih misij."}</p>
      ) : (
        <>
        {pinned && (() => {
          const dur = pinned.match_duration_minutes ?? (pinned.settings as any)?.matchDurationMinutes;
          return (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: MUTED, margin: "0 0 6px", textTransform: "uppercase" }}>{en ? "Active now" : "Aktivna zdaj"}</p>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpenMission(pinned)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenMission(pinned); } }}
                style={{ border: `1px solid ${ACCENT}`, background: "rgba(0,0,0,0.35)", padding: "10px 12px", fontFamily: "monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titleOf(pinned)}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{gamemodeLabel(pinned.gamemode)}{dur ? ` · ${dur} min` : ""}</div>
                </div>
                <span style={{ fontSize: 9.5, letterSpacing: "0.15em", color: BG, background: ACCENT, padding: "4px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {en ? "ACTIVE MISSION" : "AKTIVNA MISIJA"}
                </span>
              </div>
            </div>
          );
        })()}
        {visibleGroups.map((g) => {
          const open = q ? true : (expanded?.[g.key] ?? false);
          const n = g.missions.length;
          return (
            <section key={g.key || "__none"} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${ACCENT}33`, paddingBottom: 4, marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...(s ?? {}), [g.key]: !open }))}
                  aria-expanded={open}
                  style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: INK, cursor: "pointer", padding: "8px 0", textAlign: "left", fontFamily: "monospace" }}
                >
                  <span style={{ color: ACCENT, width: 12, display: "inline-block" }}>{open ? "▾" : "▸"}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                  <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{en ? `${n} mission${n === 1 ? "" : "s"}` : slMissionCount(n)}</span>
                </button>
              </div>
              {open && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {g.missions.map((m) => {
                    const dur = m.match_duration_minutes ?? (m.settings as any)?.matchDurationMinutes;
                    return (
                      <li
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenMission(m)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenMission(m); } }}
                        style={{ border: `1px solid ${activeLobbyId === m.id ? ACCENT : `${ACCENT}33`}`, background: "rgba(0,0,0,0.25)", padding: "10px 12px", marginBottom: 6, fontFamily: "monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titleOf(m)}</div>
                          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                            {gamemodeLabel(m.gamemode)}{dur ? ` · ${dur} min` : ""}
                          </div>
                        </div>
                        {activeLobbyId === m.id ? (
                          <span style={{ fontSize: 9.5, letterSpacing: "0.15em", color: BG, background: ACCENT, padding: "4px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {en ? "ACTIVE MISSION" : "AKTIVNA MISIJA"}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={settingActive}
                            onClick={(e) => { e.stopPropagation(); setActiveMission(m.id); }}
                            onKeyDown={(e) => e.stopPropagation()}
                            style={{ minHeight: 36, padding: "0 10px", background: "transparent", border: `1px solid ${ACCENT}88`, color: ACCENT, cursor: "pointer", fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0, opacity: settingActive ? 0.5 : 1 }}
                          >
                            {en ? "Set active" : "Nastavi kot aktivno"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                  {g.key && (
                    <li>
                      <button
                        type="button"
                        onClick={() => onCreateInEvent(g.title)}
                        style={{ width: "100%", minHeight: 40, background: "transparent", border: `1px dashed ${ACCENT}44`, color: MUTED, cursor: "pointer", fontFamily: "monospace", fontSize: 12, textAlign: "left", padding: "0 12px" }}
                      >
                        {en ? "+ Add mission to this event" : "+ Dodaj misijo temu dogodku"}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
        </>
      )}
    </div>
  );
}

function FieldsWelcome({
  onCreate, onOpenAccountMission,
}: {
  onCreate: (eventName?: string) => void;
  onOpenAccountMission: (m: AccountLobby) => void;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session?.user);
    });
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed === null) return null;

  if (!authed) {
    return (
      <div style={{ textAlign: "center", maxWidth: 480, margin: "60px auto" }}>
        <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.30em", color: ACCENT, marginBottom: 14, textTransform: "uppercase" }}>
          {en ? "// MARSHAL LOGIN REQUIRED" : "// ZAHTEVANA PRIJAVA MARŠALA"}
        </p>
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
          {en
            ? "Log in or create a marshal account to create and manage your missions."
            : "Prijavi se ali ustvari račun maršala za ustvarjanje in upravljanje svojih misij."}
        </p>
        <Link
          to="/marshal-account"
          style={{
            display: "inline-block",
            background: ACCENT, color: BG, border: "none",
            padding: "14px 24px", fontFamily: "'Michroma', monospace",
            fontSize: 12, letterSpacing: "0.20em", textTransform: "uppercase",
            fontWeight: 700, textDecoration: "none",
          }}
        >
          {en ? "[ LOG IN / SIGN UP ]" : "[ PRIJAVA / REGISTRACIJA ]"}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480, margin: "0 auto 24px" }}>
        <button
          onClick={() => onCreate()}
          style={{
            background: ACCENT, color: BG, border: "none",
            padding: "16px 18px", fontFamily: "'Michroma', monospace",
            fontSize: 12, letterSpacing: "0.20em", textTransform: "uppercase",
            fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          {en ? "+ New mission" : "+ Nova misija"}
        </button>
      </div>

      <AccountMissionsSection en={en} onOpenMission={onOpenAccountMission} onCreateInEvent={(ev) => onCreate(ev)} />
    </>
  );
}

/** Always-visible join link for a created mission, with one-click copy. */
function FieldConsole({
  field, authedPw, onBack, onAuth,
}: {
  field: Field;
  authedPw: string | undefined;
  onBack: () => void;
  onAuth: (pw: string) => void;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <button
          onClick={onBack}
          style={{ background: "transparent", border: `1px solid ${ACCENT}40`, color: ACCENT, padding: "8px 14px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ChevronLeft size={12} /> {en ? "Back to main command center" : "Nazaj v glavni komandni center"}
        </button>
        <div style={{ marginTop: 14, marginBottom: 18, fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase" }}>
          {field.title}
        </div>
      </div>

      {!authedPw ? (
        <FieldPasswordGate label={field.title} fieldKey={field.key} onSuccess={onAuth} />
      ) : (
        <SpartanOpsConsole fieldId={field.key} password={authedPw} />
      )}
    </>
  );
}

function FieldPasswordGate({ label, fieldKey, onSuccess }: { label: string; fieldKey: string; onSuccess: (pw: string) => void }) {
  const { lang } = useLang();
  const en = lang === "en";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyFn = useServerFn(spartanopsAdminVerify);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    unlockSpartacusAudio();
    setBusy(true);
    try {
      const res = await verifyFn({ data: { tab: fieldKey, password } });
      if (res?.ok) {
        onSuccess(password);
      } else {
        setErr(en ? "Wrong password." : "Napačno geslo.");
      }
    } catch {
      setErr(en ? "Verification failed." : "Preverjanje ni uspelo.");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 16px" }}>
      <form onSubmit={submit} style={{ background: PANEL, border: `1px solid ${ACCENT}40`, padding: 32, maxWidth: 380, width: "100%", textAlign: "center" }}>
        <div style={{ margin: "0 auto 16px", width: 48, height: 48, borderRadius: "50%", background: `${ACCENT}1a`, border: `1px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT }}>
          <Lock size={20} />
        </div>
        <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.18em", marginBottom: 4, color: ACCENT }}>{label}</h2>
        <p style={{ fontSize: 11, color: MUTED, marginBottom: 20, letterSpacing: "0.12em", textTransform: "uppercase" }}>{en ? "Enter password" : "Vnesi geslo"}</p>
        <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus
          style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.2)", padding: "12px 14px", fontSize: 14, marginBottom: 6, textAlign: "center", letterSpacing: "0.2em" }} />
        <PasswordVisibilityToggle en={en} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
        {err && <p style={{ color: "#d97a6c", fontSize: 12, marginBottom: 10 }}>{err}</p>}
        <button type="submit" style={{ width: "100%", padding: "12px", background: ACCENT, color: BG, border: "none", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
          {en ? "Enter" : "Vstop"}
        </button>
      </form>
    </div>
  );
}

function MasterPasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (pw: string) => void }) {
  const { lang } = useLang();
  const en = lang === "en";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyFn = useServerFn(verifyMasterPassword);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    unlockSpartacusAudio();
    setBusy(true);
    setErr("");
    try {
      const res = await verifyFn({ data: { password } });
      if (res?.ok) onSuccess(password);
      else setErr("ACCESS DENIED — incorrect master credentials.");
    } catch {
      setErr("Verification failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
        display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          background: PANEL,
          border: `1px solid ${ACCENT}`,
          padding: 28,
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 0 0 1px rgba(224,176,78,0.10), 0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.28em", color: ACCENT, textTransform: "uppercase" }}>
            // COMMAND OVERRIDE
          </p>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ margin: "0 auto 16px", width: 52, height: 52, background: `${ACCENT}14`, border: `1px solid ${ACCENT}`, display: "grid", placeItems: "center", color: ACCENT }}>
          <Lock size={22} />
        </div>

        <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.20em", color: INK, textAlign: "center", marginBottom: 6, textTransform: "uppercase" }}>
          Master Password
        </h2>
        <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
          Enter master credentials to activate Command Edit Mode. Decommission actions cannot be undone.
        </p>

        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="••••••••"
          style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "12px 14px", fontSize: 14, marginBottom: 6, textAlign: "center", letterSpacing: "0.2em" }}
        />
        <PasswordVisibilityToggle en={en} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
        {err && <p style={{ color: "#d97a6c", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, background: "transparent", color: MUTED, border: `1px solid ${MUTED}`, padding: "12px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", cursor: "pointer" }}>
            Abort
          </button>
          <button type="submit"
            style={{ flex: 1, background: ACCENT, color: BG, border: "none", padding: "12px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
            Authorize
          </button>
        </div>
      </form>
    </div>
  );
}

function MarshalPasswordPrompt({ lobby, onClose, onSuccess }: { lobby: LobbyRecord; onClose: () => void; onSuccess: (pw: string) => void }) {
  const { lang } = useLang();
  const en = lang === "en";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyFn = useServerFn(verifyLobbyPassword);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    unlockSpartacusAudio();
    setBusy(true);
    setErr("");
    try {
      const { ok } = await verifyFn({ data: { id: lobby.id, password, kind: "marshal" } });
      if (ok) onSuccess(password);
      else setErr("ACCESS DENIED — incorrect Marshal password.");
    } catch (e: any) {
      setErr(e?.message ?? "Authorization failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", display: "grid", placeItems: "center", padding: 16 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        style={{ background: PANEL, border: `1px solid ${ACCENT}`, padding: 28, maxWidth: 420, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.28em", color: ACCENT, textTransform: "uppercase" }}>
            {lang === "en" ? "// COMMAND CENTER LOGIN" : "// PRIJAVA V POVELJNIŠKI CENTER"}
          </p>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ margin: "0 auto 16px", width: 52, height: 52, background: `${ACCENT}14`, border: `1px solid ${ACCENT}`, display: "grid", placeItems: "center", color: ACCENT }}>
          <ShieldCheck size={22} />
        </div>
        <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.18em", color: INK, textAlign: "center", marginBottom: 6, textTransform: "uppercase" }}>
          {(lang === "en" ? "LOGIN TO MISSION: " : "PRIJAVA V MISIJO: ") + missionTitle(lobby)}
        </h2>
        <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginBottom: 18 }}>
          {lang === "en"
            ? "Enter the Command Center password to open the Marshal dashboard for this mission."
            : "Vnesite geslo Poveljniškega centra za odpiranje nadzorne plošče maršala za to misijo."}
        </p>

        <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus placeholder="••••••••"
          style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "12px 14px", fontSize: 14, marginBottom: 6, textAlign: "center", letterSpacing: "0.2em" }} />
        <PasswordVisibilityToggle en={en} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
        {err && <p style={{ color: "#d97a6c", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
        <button type="submit" disabled={busy} style={{ width: "100%", padding: "12px", background: ACCENT, color: BG, border: "none", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
          Authorize Marshal
        </button>
      </form>
    </div>
  );
}

function PasswordVisibilityToggle({ en, visible, onToggle }: { en: boolean; visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      style={{ display: "block", background: "transparent", border: "none", color: ACCENT, padding: 0, marginBottom: 12, fontFamily: "monospace", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}
    >
      {visible ? (en ? "Hide password" : "Skrij geslo") : (en ? "See password" : "Pokaži geslo")}
    </button>
  );
}

async function getFreshOwnerAccessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

function MarshalLobbyConsole({ lobby: initialLobby, marshalPassword, lobbyPasswordCached = "", marshalPasswordCached = "", ownerAccessToken, onBack }: { lobby: LobbyRecord; marshalPassword: string; lobbyPasswordCached?: string; marshalPasswordCached?: string; ownerAccessToken?: string; onBack: () => void }) {
  const { lang } = useLang();
  const en = lang === "en";
  const [lobby, setLobby] = useState<LobbyRecord>(initialLobby);
  const [gameState, setGameState] = useState<GameState | null>(null);
  type RegisteredPlayer = {
    id: string;
    callsign: string;
    team: "lobby" | "modra" | "rdeca" | "rumena";
    firstName: string | null;
    lastInitial: string | null;
    experience: "slabo" | "dobro" | "zelo_dobro" | null;
    club: string | null;
    phoneNumber: string | null;
    operatorType: string | null;
  };
  const [registered, setRegistered] = useState<RegisteredPlayer[]>([]);
  const lobbyState: LobbyState = lobby.state ?? "pending";
  const state: LobbyState = gameStatusToLobbyState(gameState?.status) ?? lobbyState;


  // Always keep mission listed on /join. Publishing card was removed.
  useEffect(() => {
    if (!lobby.published) patch({ published: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const updateFn = useServerFn(updateLobbyServer);
  const deletePlayersFn = useServerFn(deleteLobbyPlayers);
  const deleteLobbyServerFn = useServerFn(deleteLobbyServer);
  const getServerTimeFn = useServerFn(spartanopsGetServerTime);
  const [serverOffset, setServerOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const syncServerClock = async () => {
    const before = Date.now();
    const res = await getServerTimeFn();
    const after = Date.now();
    const serverMs = typeof (res as any).serverNow === "number" ? (res as any).serverNow : Date.parse(res.serverTime);
    if (!Number.isFinite(serverMs)) return;
    const nextOffset = Math.round((before + after) / 2 - serverMs);
    setServerOffset(nextOffset);
    setNow(after - nextOffset);
  };

  useEffect(() => {
    syncServerClock().catch(() => {});
  }, [getServerTimeFn]);

  // Optimistic patch: update local state instantly, mirror to localStorage,
  // then persist to the DB (which broadcasts via Realtime to players).
  const patch = (p: Partial<LobbyRecord>) => {
    setLobby((prev) => ({ ...prev, ...p }));
    updateLobby(lobby.id, p);
    const dbPatch: Record<string, any> = {};
    if (p.fieldName !== undefined) dbPatch.fieldName = p.fieldName;
    if (p.eventName !== undefined) dbPatch.eventName = p.eventName;
    if (p.location !== undefined) dbPatch.location = p.location;
    if (p.country !== undefined) dbPatch.country = p.country;
    if (p.city !== undefined) dbPatch.city = p.city;
    if (p.gamemode !== undefined) dbPatch.gamemode = p.gamemode;
    if (p.mapUrl !== undefined) dbPatch.mapUrl = p.mapUrl;
    if (p.matchDurationMinutes !== undefined) dbPatch.matchDurationMinutes = p.matchDurationMinutes;
    if (p.countdownSeconds !== undefined) dbPatch.countdownSeconds = p.countdownSeconds;
    if (p.pointTarget !== undefined) dbPatch.pointTarget = p.pointTarget;
    if (p.nodePositions !== undefined) dbPatch.nodePositions = p.nodePositions;
    if (p.settings !== undefined) dbPatch.settings = p.settings as any;
    if (p.published !== undefined) dbPatch.published = p.published;
    if (p.state !== undefined) dbPatch.state = p.state;
    if (p.startedAt !== undefined) {
      dbPatch.startedAt = p.startedAt ? new Date(p.startedAt).toISOString() : null;
    }
    if (p.password) dbPatch.password = p.password;
    if (p.marshalPassword) dbPatch.marshalPassword = p.marshalPassword;
    (ownerAccessToken ? getFreshOwnerAccessToken() : Promise.resolve(undefined))
      .then((accessToken) => updateFn({ data: { id: lobby.id, patch: dbPatch, authPassword: marshalPassword || getMasterPw(), accessToken } }))
      .catch((e) => console.error("[marshal] update failed", e));
  };

  const startMission = async () => {
    await syncServerClock().catch(() => {});
    const pre = Math.max(0, (lobby.countdownSeconds ?? 300)) * 1000;
    const serverNow = Date.now() - serverOffset;
    setCaptures([]);
    setGameState((prev) => prev ? {
      ...prev,
      status: "active",
      match_started_at: new Date(serverNow + pre).toISOString(),
      team_scores: { modra: 0, rdeca: 0, rumena: 0 },
      node_holders: { ...FREE_NODES },
      winner_team: null,
    } : prev);
    patch({
      state: "active",
      startedAt: serverNow + pre,
      fieldName: lobby.fieldName,
      eventName: lobby.eventName,
      ...(gameState?.compressed_map_url ? {} : { mapUrl: lobby.mapUrl }),
      matchDurationMinutes: lobby.matchDurationMinutes,
      countdownSeconds: lobby.countdownSeconds,
      pointTarget: lobby.pointTarget,
      ...(Object.keys(gameState?.node_positions ?? {}).length ? {} : { nodePositions: lobby.nodePositions }),
      gamemode: lobby.gamemode,
      settings: lobby.settings,
    });
  };
  const pauseMission = () => {
    const pausedIso = new Date(Date.now() - serverOffset).toISOString();
    setLobby((prev) => ({ ...prev, state: "paused" }));
    updateLobby(lobby.id, { state: "paused" });
    setGameState((prev) => prev ? { ...prev, status: "paused", updated_at: pausedIso } : prev);
    (ownerAccessToken ? getFreshOwnerAccessToken() : Promise.resolve(undefined))
      .then((accessToken) => updateFn({ data: { id: lobby.id, patch: { state: "paused" }, authPassword: marshalPassword || getMasterPw(), accessToken } }))
      .catch((e) => console.error("[marshal] pause failed", e));
  };
  const resumeMission = () => {
    const serverNow = Date.now() - serverOffset;
    const pausedAt = gameState?.updated_at ? new Date(gameState.updated_at).getTime() : serverNow;
    const originalStart = gameState?.match_started_at
      ? new Date(gameState.match_started_at).getTime()
      : lobby.startedAt ?? serverNow;
    const nextStartedAt = originalStart + Math.max(0, serverNow - pausedAt);
    const nextStartedAtIso = new Date(nextStartedAt).toISOString();
    setLobby((prev) => ({ ...prev, state: "active", startedAt: nextStartedAt }));
    updateLobby(lobby.id, { state: "active", startedAt: nextStartedAt });
    setGameState((prev) => prev ? { ...prev, status: "active", match_started_at: nextStartedAtIso, updated_at: new Date(serverNow).toISOString() } : prev);
    (ownerAccessToken ? getFreshOwnerAccessToken() : Promise.resolve(undefined))
      .then((accessToken) => updateFn({ data: { id: lobby.id, patch: { state: "active", startedAt: nextStartedAtIso }, authPassword: marshalPassword || getMasterPw(), accessToken } }))
      .catch((e) => console.error("[marshal] resume failed", e));
  };
  const handleMatchPrimaryAction = () => {
    if (state === "active") { pauseMission(); return; }
    if (state === "paused") { resumeMission(); return; }
    // Bring the marshal back to the top so Match Controls (and the lobby URL)
    // are in view the moment the mission goes live.
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ }
    startMission().catch((e) => console.error("[marshal] start failed", e));
  };

  const endAndReset = () => {
    if (!confirm(en
      ? "End current mission/debriefing (score display) and reset stats? Registered players will remain in the lobby."
      : "Končaj trenutno misijo/debriefing (prikaz rezultatov) in ponastavi statistiko? Prijavljeni igralci ostanejo v lobbyju."
    )) return;
    setCaptures([]);
    setGameState((prev) => prev ? {
      ...prev,
      status: "lobby",
      match_started_at: null,
      team_scores: { modra: 0, rdeca: 0, rumena: 0 },
      node_holders: { ...FREE_NODES },
      winner_team: null,
    } : prev);
    patch({ state: "pending", startedAt: null });
  };
  const deleteAllPlayers = async () => {
    if (!confirm(en
      ? `Delete all registered players from "${lobby.fieldName}"? Other fields are not affected.`
      : `Izbriši vse prijavljene igralce iz "${lobby.fieldName}"? Drugi poligoni ostanejo nedotaknjeni.`
    )) return;
    try {
      const accessToken = ownerAccessToken ? await getFreshOwnerAccessToken() : undefined;
      await deletePlayersFn({ data: { id: lobby.id, marshalPassword, accessToken } });
      setRegistered([]);
    } catch (e) {
      console.error("[marshal] deleteAllPlayers failed", e);
      alert("Failed to remove players. Try again.");
    }
  };
  const decommission = async () => {
    if (!confirm(en
      ? "Decommission this field? It will disappear from the active list and the public join page."
      : "Odstrani misijo? Izginila bo iz aktivnega seznama in javne strani za pridružitev."
    )) return;
    try {
      const accessToken = ownerAccessToken ? await getFreshOwnerAccessToken() : undefined;
      await deleteLobbyServerFn({ data: { id: lobby.id, marshalPassword, accessToken } });
      saveLobbies(loadLobbies().filter((l) => l.id !== lobby.id));
      onBack();
    } catch (e) {
      console.error("[marshal] decommission failed", e);
      alert("Failed to decommission field. Try again.");
    }
  };

  // Live roster: fetch full PII via the marshal-authenticated server fn
  // (the public policy no longer exposes first_name/last_initial/club).
  // Realtime channel still triggers reload for near-instant updates.
  const getAdminRoster = useServerFn(spartanopsAdminGetRoster);
  useEffect(() => {
    let alive = true;
    const teamOf = (r: any): RegisteredPlayer["team"] =>
      r?.assigned_team === "modra" || r?.assigned_team === "rdeca" || r?.assigned_team === "rumena"
        ? r.assigned_team : "lobby";
    const load = async () => {
      if (!marshalPassword && !ownerAccessToken) return;
      try {
        const accessToken = ownerAccessToken ? await getFreshOwnerAccessToken() : undefined;
        const res = await getAdminRoster({ data: { fieldId: lobby.id, password: marshalPassword, accessToken } });
        if (!alive || !res?.ok) return;
        setRegistered((res.rows ?? []).map((r: any) => ({
          id: r.id,
          callsign: r.callsign,
          team: teamOf(r),
          firstName: r.first_name ?? null,
          lastInitial: r.last_initial ?? null,
          experience: r.experience_level ?? null,
          club: r.club ?? null,
          phoneNumber: r.phone_number ?? null,
          operatorType: r.operator_type ?? null,
        })));
      } catch (e) {
        console.error("[marshal] roster fetch failed", e);
      }
    };

    load();
    const channel = supabase
      .channel(`checkins:${lobby.id}`)
      .on("broadcast", { event: "roster_changed" }, () => load())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [lobby.id, marshalPassword, ownerAccessToken, getAdminRoster]);


  // Live game state (for the tactical map + countdown + node holders)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("spartanops_game_state")
        .select("*")
        .eq("field_id", lobby.id)
        .maybeSingle();
      if (alive && data) {
        const incoming = data as unknown as GameState;
        let applied = true;
        setGameState((prev) => {
          if (isStaleState(prev, incoming)) { applied = false; return prev; }
          // A running match must never lose its start time to a partial read.
          return {
            ...incoming,
            match_started_at: incoming.match_started_at || (["active", "paused"].includes(incoming.status) ? (prev?.match_started_at ?? null) : null),
          };
        });
        if (!applied) return;
        const next = incoming;
        const nextLobbyState = gameStatusToLobbyState(next.status);
        if (nextLobbyState) {
          setLobby((prev) => ({ ...prev, state: nextLobbyState, startedAt: next.match_started_at ? new Date(next.match_started_at).getTime() : prev.startedAt ?? null }));
          updateLobby(lobby.id, { state: nextLobbyState, startedAt: next.match_started_at ? new Date(next.match_started_at).getTime() : null });
        }
        if (next.match_started_at) syncServerClock().catch(() => {});
      }
    };
    load();
    let rtLive = false;
    const ch = supabase
      .channel(`marshal-gs-${lobby.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spartanops_game_state", filter: `field_id=eq.${lobby.id}` },
        (p) => {
          if (p.new) {
            const next = p.new as unknown as GameState;
            let applied = true;
            setGameState((prev) => {
              if (isStaleState(prev, next)) { applied = false; return prev; }
              return {
                ...next,
                match_started_at: next.match_started_at || (["active", "paused"].includes(next.status) ? (prev?.match_started_at ?? null) : null),
              };
            });
            if (!applied) return;
            const nextLobbyState = gameStatusToLobbyState(next.status);
            if (nextLobbyState) {
              setLobby((prev) => ({ ...prev, state: nextLobbyState, startedAt: next.match_started_at ? new Date(next.match_started_at).getTime() : prev.startedAt ?? null }));
              updateLobby(lobby.id, { state: nextLobbyState, startedAt: next.match_started_at ? new Date(next.match_started_at).getTime() : null });
            }
            if (next.match_started_at) syncServerClock().catch(() => {});
          }
        })
      .subscribe((status) => {
        rtLive = status === "SUBSCRIBED";
        if (rtLive) load();
      });

    // Websocket safety net (mirrors the player HUD): poll fast until realtime
    // confirms, then back off. Keeps the marshal console honest if the socket
    // silently drops mid-match.
    let pollTimer = 0;
    const schedule = () => {
      pollTimer = window.setTimeout(() => {
        if (!alive) return;
        if (document.visibilityState === "visible") load();
        if (alive) schedule();
      }, (rtLive ? 8000 : 2500) + Math.floor(Math.random() * 800));
    };
    schedule();
    const onWake = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      alive = false;
      window.clearTimeout(pollTimer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      supabase.removeChannel(ch);
    };
  }, [lobby.id]);


  // Live captures (for the event log)
  type CaptureRow = { id: string; point_number: number; team: string; player_callsign: string | null; captured_at: string };
  const [captures, setCaptures] = useState<CaptureRow[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("spartanops_captures")
        .select("id, point_number, team, player_callsign, captured_at")
        .eq("field_id", lobby.id)
        .order("captured_at", { ascending: false })
        .limit(50);

      if (alive) setCaptures((data ?? []) as any);
    };
    load();
    // Direct row merging via Realtime — avoids a full 50-row SELECT on every event.
    const ch = supabase
      .channel(`marshal-caps-${lobby.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spartanops_captures", filter: `field_id=eq.${lobby.id}` },
        (p) => {
          const r = p.new as any as CaptureRow;
          if (!r?.id) return;
          setCaptures((prev) => {
            if (prev.some((c) => c.id === r.id)) return prev;
            return [r, ...prev].slice(0, 50);
          });
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spartanops_captures", filter: `field_id=eq.${lobby.id}` },
        (p) => {
          const r = p.new as any as CaptureRow;
          if (!r?.id) return;
          setCaptures((prev) => {
            const idx = prev.findIndex((c) => c.id === r.id);
            if (idx < 0) return [r, ...prev].slice(0, 50);
            const next = prev.slice();
            next[idx] = { ...next[idx], ...r };
            return next;
          });
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "spartanops_captures", filter: `field_id=eq.${lobby.id}` },
        (p) => {
          const id = (p.old as any)?.id;
          if (!id) return;
          setCaptures((prev) => prev.filter((c) => c.id !== id));
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [lobby.id]);


  // Match timer tick (drives the "TIME REMAINING" countdown)
  useEffect(() => {
    if (state !== "active" && gameState?.status !== "active" && !gameState?.match_started_at) return;
    const tick = () => setNow(Date.now() - serverOffset);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [state, gameState?.status, gameState?.match_started_at, serverOffset]);

  useEffect(() => {
    if (gameState?.status !== "active" || !gameState.match_started_at) return;
    syncServerClock().catch(() => {});
    const t = setInterval(() => syncServerClock().catch(() => {}), 15000);
    return () => clearInterval(t);
  }, [gameState?.status, gameState?.match_started_at, getServerTimeFn]);




  const stateLabel: Record<LobbyState, string> = {
    pending: en ? "GAME INACTIVE"       : "IGRA NEAKTIVNA",
    active:  en ? "LIVE · IN PROGRESS"  : "AKTIVNO · V TEKU",
    paused:  en ? "PAUSED"              : "ZAUSTAVLJENO",
    ended:   en ? "ENDED"               : "KONČANO",
  };
  const stateColor: Record<LobbyState, string> = {
    pending: MUTED, active: "#3ddc84", paused: "#f5b041", ended: MUTED,
  };

  const joinUrl = `/misija?field=${encodeURIComponent(lobby.id)}&marshal=1`;
  const stashMarshalPw = () => {
    try {
      if (typeof window !== "undefined" && marshalPassword) {
        sessionStorage.setItem(`spartanops:marshal:pw:${lobby.id}`, marshalPassword);
      }
    } catch { /* ignore */ }
  };
  const target = lobby.pointTarget ?? 50;

  // Marshal auto-registration — cached callsign/faction bypass the modal
  // and drop straight into /misija after upserting the check-in.
  const MARSHAL_CACHE_KEY = "spartanops:marshal:profile";
  type MarshalProfile = {
    callsign: string;
    firstName: string;
    lastInitial: string;
    experience: "slabo" | "dobro" | "zelo_dobro";
    club: string;
    team: "modra" | "rdeca" | "rumena";
  };
  const [joinModal, setJoinModal] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinErr, setJoinErr] = useState("");
  const [jpCallsign, setJpCallsign] = useState("");
  const [jpFirst, setJpFirst] = useState("");
  const [jpLast, setJpLast] = useState("");
  const [jpClub, setJpClub] = useState("");
  const [jpExp, setJpExp] = useState<"slabo" | "dobro" | "zelo_dobro">("dobro");
  const [jpTeam, setJpTeam] = useState<"modra" | "rdeca" | "rumena">("modra");

  const readCache = (): MarshalProfile | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(MARSHAL_CACHE_KEY);
      return raw ? (JSON.parse(raw) as MarshalProfile) : null;
    } catch { return null; }
  };
  const getOrMakeSession = (): string => {
    if (typeof window === "undefined") return "";
    let s = localStorage.getItem("spartanops:session_id");
    if (!s) {
      s = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("spartanops:session_id", s);
    }
    return s;
  };

  const upsertCheckinFn = useServerFn(spartanopsUpsertCheckin);
  const runAutoCheckin = async (profile: MarshalProfile) => {
    const session_id = getOrMakeSession();
    await upsertCheckinFn({
      data: {
        sessionId: session_id,
        fieldId: lobby.id,
        callsign: profile.callsign,
        firstName: profile.firstName || null,
        lastInitial: profile.lastInitial ? profile.lastInitial.charAt(0).toUpperCase() : null,
        club: profile.club || null,
        experienceLevel: profile.experience,
        operatorType: "AEG",
        assignedTeam: profile.team,
        accessToken: await getFreshOwnerAccessToken(),
      },
    });
  };


  const openJoinModal = () => {
    const cached = readCache();
    setJpCallsign(cached?.callsign ?? "");
    setJpFirst(cached?.firstName ?? "");
    setJpLast(cached?.lastInitial ?? "");
    setJpClub(cached?.club ?? "");
    setJpExp(cached?.experience ?? "dobro");
    setJpTeam(cached?.team ?? "modra");
    setJoinErr("");
    setJoinModal(true);
  };

  const handleJoinGame = async () => {
    const cached = readCache();
    if (cached?.callsign && cached?.team) {
      try {
        setJoinBusy(true);
        await runAutoCheckin(cached);
        stashMarshalPw();
        window.location.href = joinUrl;
      } catch (e: any) {
        setJoinBusy(false);
        openJoinModal();
        setJoinErr(e?.message ?? "Check-in failed.");
      }
    } else {
      openJoinModal();
    }
  };

  const submitJoinModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jpCallsign.trim()) { setJoinErr(en ? "Callsign required." : "Callsign je obvezen."); return; }
    const profile: MarshalProfile = {
      callsign: jpCallsign.trim(),
      firstName: jpFirst.trim(),
      lastInitial: jpLast.trim(),
      club: jpClub.trim(),
      experience: jpExp,
      team: jpTeam,
    };
    setJoinBusy(true);
    setJoinErr("");
    try {
      await runAutoCheckin(profile);
      try { localStorage.setItem(MARSHAL_CACHE_KEY, JSON.stringify(profile)); } catch {}
      stashMarshalPw();
      window.location.href = joinUrl;
    } catch (e: any) {
      setJoinBusy(false);
      setJoinErr(e?.message ?? "Check-in failed.");
    }
  };


  const roster = {
    lobby: registered.filter((r) => r.team === "lobby"),
    modra: registered.filter((r) => r.team === "modra"),
    rdeca: registered.filter((r) => r.team === "rdeca"),
    rumena: registered.filter((r) => r.team === "rumena"),
  };

  const reassignFn = useServerFn(spartanopsAdminReassignTeam);
  const handleSwap = async (playerId: string, currentTeam: RegisteredPlayer["team"]) => {
    if (!marshalPassword && !ownerAccessToken) return;
    // Enforce 2-faction swap. Lobby players default to modra.
    const target: "modra" | "rdeca" =
      currentTeam === "modra" ? "rdeca" : currentTeam === "rdeca" ? "modra" : "modra";
    // Optimistic UI — realtime will reconcile.
    setRegistered((prev) => prev.map((p) => p.id === playerId ? { ...p, team: target } : p));
    try {
      const accessToken = ownerAccessToken ? await getFreshOwnerAccessToken() : undefined;
      await reassignFn({ data: { fieldId: lobby.id, password: marshalPassword, checkinId: playerId, team: target, accessToken } });
    } catch (e) {
      console.error("[marshal] swap failed", e);
    }
  };

  const [lobbyTab, setLobbyTab] = useState<"match" | "review" | MissionTabKey>("match");
  const lobbyTabs: { k: typeof lobbyTab; l: string }[] = [
    { k: "match", l: en ? "Match controls" : "Nadzor misije" },
    { k: "review", l: en ? "Game review" : "Pregled igre" },
    { k: "mission", l: en ? "Mission" : "Misija" },
    { k: "gamemode", l: en ? "Gamemode" : "Način igre" },
    { k: "rules", l: en ? "Rules" : "Pravila" },
    { k: "extras", l: en ? "Extras" : "Dodatki" },
    { k: "map", l: en ? "Map" : "Zemljevid" },
  ];

  // Shared settings component: value comes from the lobby, changes go through patch().
  const ls = (lobby.settings ?? {}) as any;
  const liveValue: MissionSettingsValue = {
    missionName: String(ls.missionName ?? ""),
    eventName: lobby.eventName ?? "",
    missionDescription: String(ls.missionDescription ?? ""),
    afterGameInstructions: String(ls.afterGameInstructions ?? ""),
    marshalName: String(ls.marshalName ?? ""),
    marshalPhone: String(ls.marshalPhone ?? ""),
    gamemode: ((lobby.gamemode as GameModeKey) ?? "domination"),
    duration: lobby.matchDurationMinutes,
    countdown: lobby.countdownSeconds,
    pointTarget: target,
    settings: (lobby.settings ?? { respawn: { ...DEFAULT_RESPAWN }, capturePointsScoring: true }) as any,
    weaponRules: ls.weaponRules ?? {},
    mapUrl: lobby.mapUrl ?? "",
    nodePositions: lobby.nodePositions ?? {},
  };
  const onLiveChange = (p: Partial<MissionSettingsValue>) => {
    const lp: Partial<LobbyRecord> = {};
    let nextSettings: any = p.settings !== undefined ? { ...(p.settings as any) } : null;
    const settingsKeys = ["missionName", "missionDescription", "afterGameInstructions", "marshalName", "marshalPhone", "weaponRules"] as const;
    for (const k of settingsKeys) {
      if (p[k] !== undefined) nextSettings = { ...(nextSettings ?? (lobby.settings ?? {})), [k]: p[k] };
    }
    if (nextSettings) lp.settings = nextSettings;
    if (p.eventName !== undefined) lp.eventName = p.eventName;
    if (p.gamemode !== undefined) lp.gamemode = p.gamemode as any;
    if (p.duration !== undefined) lp.matchDurationMinutes = p.duration;
    if (p.countdown !== undefined) lp.countdownSeconds = p.countdown;
    if (p.pointTarget !== undefined) lp.pointTarget = p.pointTarget;
    if (p.mapUrl !== undefined) lp.mapUrl = p.mapUrl;
    if (p.nodePositions !== undefined) lp.nodePositions = p.nodePositions;
    patch(lp);
  };
  const [existingEvents, setExistingEvents] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("spartanops_lobbies")
        .select("event_name, created_at")
        .eq("account_id", user.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const seen = new Map<string, string>();
      for (const r of (data ?? []) as { event_name: string | null }[]) {
        const k = foldEvent(r.event_name);
        if (k && !seen.has(k)) seen.set(k, (r.event_name ?? "").trim());
      }
      setExistingEvents([...seen.values()]);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <button onClick={onBack}
          style={{ background: "transparent", border: `1px solid ${ACCENT}40`, color: ACCENT, padding: "8px 14px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ChevronLeft size={12} /> {en ? "Back to main command center" : "Nazaj v glavni komandni center"}
        </button>
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase" }}>
            Mission: {missionTitle(lobby)}
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase",
            color: stateColor[state], border: `1px solid ${stateColor[state]}55`, padding: "4px 8px",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: stateColor[state], boxShadow: `0 0 8px ${stateColor[state]}` }} />
            {stateLabel[state]}
          </span>
        </div>
      </div>

      {/* ── TAB BAR: operations first, settings after. Two rows at 360px. ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 6, marginBottom: 18 }}>
        {lobbyTabs.map((t) => {
          const active = lobbyTab === t.k;
          const ops = t.k === "match" || t.k === "review";
          const dotColor = state === "active" ? "#3ddc84" : state === "paused" ? "#f5b041" : state === "pending" ? DANGER : MUTED;
          const pulse = state === "active" || state === "paused";
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setLobbyTab(t.k)}
              style={{
                gridColumn: ops ? "span 5" : "span 2",
                minWidth: 0,
                background: active ? ACCENT : "transparent",
                color: active ? BG : INK,
                border: `1px solid ${active ? ACCENT : "rgba(224,176,78,0.35)"}`,
                padding: ops ? "10px 6px" : "10px 2px",
                fontFamily: "'Michroma', monospace",
                fontSize: ops ? 10 : 9,
                letterSpacing: ops ? "0.12em" : "0.04em",
                lineHeight: 1.25,
                textTransform: "uppercase",
                cursor: "pointer",
                fontWeight: active ? 700 : 500,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                textAlign: "center", overflowWrap: "anywhere",
              }}
            >
              {t.k === "match" && (
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: dotColor, boxShadow: pulse ? `0 0 8px ${dotColor}` : "none", animation: pulse ? "cmdStatusPulse 1.6s ease-in-out infinite" : "none" }} />
              )}
              {t.l}
            </button>
          );
        })}
      </div>

      <div style={{ display: lobbyTab === "match" ? "block" : "none" }}>
      {/* MATCH CONTROLS */}
      <Pane title={en ? "MATCH CONTROLS" : "NADZOR MISIJE"}>
        {(() => {
          if (!gameState?.match_started_at) return null;
          const startMs = new Date(gameState.match_started_at).getTime();
          const remaining = Math.max(0, Math.ceil((startMs - now) / 1000));
          if (remaining <= 0) return null;
          const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
          const ss = String(remaining % 60).padStart(2, "0");
          return (
            <div style={{
              marginBottom: 12, padding: "14px 12px", textAlign: "center",
              border: `1px solid ${ACCENT}`, background: "rgba(224,176,78,0.08)",
            }}>
              <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 }}>
                // {en ? "MATCH STARTS IN" : "MISIJA SE ZAČNE ČEZ"}
              </p>
              <p style={{ fontFamily: "'Michroma', monospace", fontSize: 28, letterSpacing: "0.14em", color: ACCENT, fontWeight: 700 }}>
                {mm}:{ss}
              </p>
            </div>
          );
        })()}
        <button
          onClick={handleMatchPrimaryAction}
          style={{
            width: "100%",
            background: state === "active" ? "rgba(245,176,65,0.14)" : state === "paused" ? "rgba(61,220,132,0.14)" : "rgba(61,220,132,0.14)",
            color: state === "active" ? "#f5b041" : "#3ddc84",
            border: `1px solid ${state === "active" ? "#f5b041" : "#3ddc84"}`,
            padding: "9px 12px", marginBottom: 8, fontFamily: "'Michroma', monospace", fontSize: 10.5,
            letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 600,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          [ {state === "active" ? (en ? "PAUSE GAME" : "PAVZIRAJ IGRO") : state === "paused" ? (en ? "RESUME GAME" : "NADALJUJ IGRO") : (en ? "START MISSION" : "ZAŽENI MISIJO")} ]
        </button>
        <button

          onClick={endAndReset}
          style={{
            width: "100%",
            background: "rgba(192,57,43,0.10)", color: DANGER,
            border: `1px solid ${DANGER}`,
            padding: "9px 12px", marginBottom: 8, fontFamily: "'Michroma', monospace", fontSize: 10.5,
            letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          [ {en ? "END AND RESET" : "KONČAJ IN PONASTAVI"} ]
        </button>
        <button
          onClick={deleteAllPlayers}
          style={{
            width: "100%",
            background: "rgba(224,176,78,0.08)", color: ACCENT,
            border: `1px solid ${ACCENT}80`,
            padding: "9px 12px", fontFamily: "'Michroma', monospace", fontSize: 10.5,
            letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          [ {en ? "DELETE ALL REGISTERED PLAYERS" : "IZBRIŠI VSE PRIJAVLJENE IGRALCE"} ]
        </button>
        <p style={{ fontSize: 10.5, color: MUTED, textAlign: "center", marginTop: 10, fontStyle: "italic" }}>
          {en
            ? `Deletes only players in this lobby (${lobby.fieldName}). Other fields remain unchanged.`
            : `Izbriše samo igralce v tem lobbyju (${lobby.fieldName}). Drugi poligoni ostanejo nespremenjeni.`}
        </p>

        {/* State-driven marshal deployment */}
        <div style={{ marginTop: 12 }}>
          {state === "active" || state === "paused" ? (
            <button
              type="button"
              onClick={handleJoinGame}
              disabled={joinBusy}
              style={{
                width: "100%", display: "flex", flexDirection: "column", gap: 3,
                background: "#3ddc84", color: BG, cursor: joinBusy ? "wait" : "pointer",
                padding: "10px 14px", textAlign: "center", fontFamily: "'Michroma', monospace",
                fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", fontWeight: 600,
                border: "none", boxShadow: "0 0 18px rgba(61,220,132,0.22)",
              }}>
              <span>[ {joinBusy ? (en ? "DEPLOYING..." : "VSTOP...") : (en ? "JOIN GAME" : "PRIDRUŽI SE IGRI")} ]</span>
              <span style={{ fontSize: 9, letterSpacing: "0.14em", color: "rgba(11,13,9,0.72)", fontWeight: 500, textTransform: "none" }}>
                {en
                  ? "Deploy into the active grid — Marshal command retained."
                  : "Vstopi v aktivno mrežo — komanda maršala ostane aktivna."}
              </span>
            </button>
          ) : (
            <div style={{
              padding: "12px 14px", border: `1px dashed ${ACCENT}55`,
              background: "rgba(224,176,78,0.04)", color: MUTED,
              fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.7, textAlign: "center",
            }}>
              <p style={{ color: ACCENT, fontSize: 9.5, letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 5, fontWeight: 600 }}>
                // {en ? "DEPLOYMENT LOCKED" : "VSTOP ZAKLENJEN"}
              </p>
              {en
                ? "As a Marshal, you can only deploy into the game after it has been started. The Marshal Command Center remains accessible at any time."
                : "Kot maršal se lahko v igro vključiš šele po zagonu. Komandni center maršala je dostopen kadarkoli."}
            </div>
          )}
        </div>




        <p style={{ fontFamily: "monospace", fontSize: 11, color: MUTED, marginTop: 12 }}>
          {en ? "Registered:" : "Prijavljeni:"} <strong style={{ color: INK }}>{registered.length}</strong>
        </p>
      </Pane>

      {/* Decommission */}
      <div style={{ marginTop: 18 }}>
        <button onClick={decommission}
          style={{
            width: "100%", background: "transparent", color: DANGER, border: `1px solid ${DANGER}`,
            padding: "12px", fontFamily: "'Michroma', monospace", fontSize: 11,
            letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
          }}>
          [ {en ? "DECOMMISSION FIELD" : "RAZGRADI POLIGON"} ]
        </button>
      </div>
      </div>

      <div style={{ display: lobbyTab === "review" ? "block" : "none" }}>
      {/* ROSTER & TEAM BALANCING */}
      <Pane title={en ? "ROSTER & TEAM BALANCING" : "SEZNAM & URAVNOTEŽENJE EKIP"}>
        <LockedAutoBalanceButton en={en} />
        <RosterRow label="LOBBY"  color="rgba(236,227,196,0.35)" players={roster.lobby} teamKey="lobby" onSwap={handleSwap} />
        <RosterRow label="BLUE"   color="#3b82f6" players={roster.modra} teamKey="modra" onSwap={handleSwap} />
        <RosterRow label="RED"    color="#ef4444" players={roster.rdeca} teamKey="rdeca" onSwap={handleSwap} />
        <RosterRow label="YELLOW" color="#f5b041" players={roster.rumena} teamKey="rumena" onSwap={handleSwap} />
      </Pane>

      {/* LIVE LEADERBOARD */}
      <Pane title={en ? "LIVE LEADERBOARD" : "AKTIVNA LESTVICA"}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, fontFamily: "monospace", fontSize: 11, color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          <span>◉ {en ? "TARGET:" : "CILJ:"} <strong style={{ color: INK }}>{target}</strong> PTS</span>
          <span>⏱ {en ? "TIME:" : "ČAS:"} {(() => {
            if (!gameState || state !== "active" || !gameState.match_started_at) return "—";
            const startMs = new Date(gameState.match_started_at).getTime();
            const total = (gameState.match_duration_minutes ?? lobby.matchDurationMinutes) * 60;
            // Freeze at full duration during the pre-match countdown window.
            const remaining = now < startMs ? total : Math.max(0, total - Math.floor((now - startMs) / 1000));
            return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
          })()}</span>
        </div>
        {(() => {
          // Pre-start countdown: shown while the match is active or paused, as long
          // as the start timestamp is still in the future (the pre-match window).
          // Freezes at the remaining time during a pause instead of disappearing.
          if (!gameState || (state !== "active" && state !== "paused") || !gameState.match_started_at) return null;
          const startMs = new Date(gameState.match_started_at).getTime();
          const pausedAtMs = state === "paused" && gameState.updated_at
            ? new Date(gameState.updated_at).getTime()
            : null;
          const effectiveNow = pausedAtMs ?? now;
          if (effectiveNow >= startMs) return null;
          const preLeft = Math.max(0, Math.ceil((startMs - effectiveNow) / 1000));
          return (
            <div style={{ marginBottom: 14, padding: "10px 12px", border: `1px solid ${ACCENT}55`, background: `${ACCENT}12`, textAlign: "center", fontFamily: "monospace", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              <span style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>
                {state === "paused"
                  ? (en ? "⏸ GAME STARTS IN (PAUSED)" : "⏸ IGRA SE ZAČNE ČEZ (PREKINJENO)")
                  : (en ? "⏳ GAME STARTS IN" : "⏳ IGRA SE ZAČNE ČEZ")}
              </span>
              <span style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>
                {`${String(Math.floor(preLeft / 60)).padStart(2, "0")}:${String(preLeft % 60).padStart(2, "0")}`}
              </span>
            </div>
          );
        })()}
        <LeaderRow label="BLUE" color="#3b82f6" score={gameState?.team_scores?.modra ?? 0} target={target} />
        <LeaderRow label="RED"  color="#ef4444" score={gameState?.team_scores?.rdeca ?? 0} target={target} />
      </Pane>

      {/* LIVE TACTICAL MAP + EVENT LOG (visible whenever we have live game state) */}
      {gameState && (
        <LiveMatchView
          state={{
            ...gameState,
            compressed_map_url: gameState.compressed_map_url || lobby.mapUrl || null,
            node_positions: Object.keys(gameState.node_positions ?? {}).length ? gameState.node_positions : (lobby.nodePositions as GameState["node_positions"]),
            settings: { ...(lobby.settings ?? {}), ...(gameState.settings ?? {}) },
          }}
          captures={captures as any}
          now={now}
          en={en}
          mapUrl={lobby.mapUrl || undefined}
        />
      )}
      </div>



      {lobbyTab !== "match" && lobbyTab !== "review" && (
        <MissionSettingsTabs
          en={en}
          value={liveValue}
          onChange={onLiveChange}
          mode="live"
          existingEvents={existingEvents}
          tab={lobbyTab}
          hideTabBar
        />
      )}

      {lobby.startedAt && (
        <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 10, color: MUTED, letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center" }}>
          // {en ? "STARTED AT" : "ZAČETEK"}: <span style={{ color: INK }}>{new Date(lobby.startedAt).toLocaleTimeString()}</span>
        </p>
      )}




      {joinModal && (
        <div role="dialog" aria-modal="true" onClick={() => !joinBusy && setJoinModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", display: "grid", placeItems: "center", padding: 16 }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitJoinModal}
            style={{ background: PANEL, border: `1px solid ${ACCENT}`, padding: 24, maxWidth: 440, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.28em", color: ACCENT, textTransform: "uppercase" }}>
                // {en ? "OPERATOR CHECK-IN" : "PRIJAVA OPERATIVCA"}
              </p>
              <button type="button" onClick={() => !joinBusy && setJoinModal(false)} aria-label="Close"
                style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: MUTED, marginBottom: 16, lineHeight: 1.6 }}>
              {en
                ? "Register once — your callsign is cached locally and future deployments bypass this step."
                : "Prijavi se enkrat — callsign se shrani lokalno in nadaljnji vstopi ga preskočijo."}
            </p>

            <label style={{ display: "block", fontSize: 10, letterSpacing: "0.24em", color: MUTED, textTransform: "uppercase", marginBottom: 5 }}>
              {en ? "Callsign *" : "Callsign *"}
            </label>
            <input value={jpCallsign} onChange={(e) => setJpCallsign(e.target.value)} autoFocus placeholder="GHOST-01"
              style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "10px 12px", fontSize: 13, marginBottom: 12, fontFamily: "monospace" }} />

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: "0.24em", color: MUTED, textTransform: "uppercase", marginBottom: 5 }}>
                  {en ? "First name" : "Ime"}
                </label>
                <input value={jpFirst} onChange={(e) => setJpFirst(e.target.value)}
                  style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "10px 12px", fontSize: 13, fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: "0.24em", color: MUTED, textTransform: "uppercase", marginBottom: 5 }}>
                  {en ? "Last init." : "Priimek"}
                </label>
                <input value={jpLast} maxLength={1} onChange={(e) => setJpLast(e.target.value)} placeholder="N"
                  style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "10px 12px", fontSize: 13, textAlign: "center", fontFamily: "monospace" }} />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 10, letterSpacing: "0.24em", color: MUTED, textTransform: "uppercase", marginBottom: 5 }}>
              {en ? "Club / Unit" : "Klub / Enota"}
            </label>
            <input value={jpClub} onChange={(e) => setJpClub(e.target.value)}
              style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "10px 12px", fontSize: 13, marginBottom: 12, fontFamily: "monospace" }} />

            <label style={{ display: "block", fontSize: 10, letterSpacing: "0.24em", color: MUTED, textTransform: "uppercase", marginBottom: 5 }}>
              {en ? "Experience" : "Izkušnje"}
            </label>
            <select value={jpExp} onChange={(e) => setJpExp(e.target.value as any)}
              style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "10px 12px", fontSize: 13, marginBottom: 14, fontFamily: "monospace" }}>
              <option value="slabo">{en ? "Recon (novice)" : "Recon (novinec)"}</option>
              <option value="dobro">{en ? "Operator" : "Operativec"}</option>
              <option value="zelo_dobro">{en ? "Veteran" : "Veteran"}</option>
            </select>

            <label style={{ display: "block", fontSize: 10, letterSpacing: "0.24em", color: MUTED, textTransform: "uppercase", marginBottom: 5 }}>
              {en ? "Faction *" : "Frakcija *"}
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 16 }}>
              {(["modra", "rdeca", "rumena"] as const).map((t) => {
                const active = jpTeam === t;
                const c = t === "modra" ? "#3b82f6" : t === "rdeca" ? "#ef4444" : "#f5b041";
                const label = t === "modra" ? "BLUE" : t === "rdeca" ? "RED" : "YELLOW";
                return (
                  <button key={t} type="button" onClick={() => setJpTeam(t)}
                    style={{
                      background: active ? c : "transparent", color: active ? "#fff" : c,
                      border: `1px solid ${c}`, padding: "10px 6px", cursor: "pointer",
                      fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.2em", fontWeight: 700,
                    }}>{label}</button>
                );
              })}
            </div>

            {joinErr && <p style={{ color: "#d97a6c", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{joinErr}</p>}

            <button type="submit" disabled={joinBusy}
              style={{ width: "100%", padding: "12px", background: joinBusy ? "rgba(61,220,132,0.4)" : "#3ddc84", color: BG, border: "none", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, cursor: joinBusy ? "wait" : "pointer" }}>
              {joinBusy ? (en ? "Deploying..." : "Vstopam...") : (en ? "Deploy Operator" : "Vstopi kot operativec")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

type RosterPlayer = {
  id: string;
  callsign: string;
  firstName?: string | null;
  lastInitial?: string | null;
  experience?: "slabo" | "dobro" | "zelo_dobro" | null;
  club?: string | null;
  phoneNumber?: string | null;
  operatorType?: string | null;
};

const EXP_LABEL: Record<"slabo" | "dobro" | "zelo_dobro", string> = {
  slabo: "RECON",
  dobro: "OPERATOR",
  zelo_dobro: "VETERAN",
};

function LockedAutoBalanceButton({ en }: { en: boolean }) {
  const { isPremium, openPremiumModal } = usePremium();
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => { if (!isPremium) openPremiumModal(); }}
        style={{
          position: "relative",
          width: "100%",
          padding: "14px 14px",
          background: "linear-gradient(135deg, rgba(224,176,78,0.16), rgba(224,176,78,0.04))",
          border: `1px dashed ${ACCENT}`,
          color: ACCENT,
          fontFamily: "'Michroma', monospace",
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          cursor: "pointer",
          opacity: 0.92,
          boxShadow: `0 0 22px ${ACCENT}20`,
        }}
      >
        🔒 {en ? "Auto balance teams" : "Auto balance teams"}
        <span
          style={{
            position: "absolute",
            top: -9,
            right: 10,
            background: ACCENT,
            color: "#0b0d09",
            padding: "3px 7px",
            fontSize: 8,
            letterSpacing: "0.12em",
            fontFamily: "monospace",
            fontWeight: 900,
          }}
        >
          {en ? "NEW PREMIUM FEATURE" : "NOVA PREMIUM FUNKCIJA"}
        </span>
      </button>
      <p style={{
        marginTop: 8,
        color: MUTED,
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.55,
        letterSpacing: "0.04em",
      }}>
        {en
          ? "Balance the players among teams based on their skill level."
          : "Uravnoteži igralce med ekipami glede na njihovo stopnjo izkušenj."}
      </p>
    </div>
  );
}

function RosterRow({
  label, color, players, teamKey, onSwap,
}: {
  label: string;
  color: string;
  players: RosterPlayer[];
  teamKey?: "lobby" | "modra" | "rdeca" | "rumena";
  onSwap?: (playerId: string, currentTeam: "lobby" | "modra" | "rdeca" | "rumena") => void;
}) {
  const neutral = color === "rgba(236,227,196,0.35)";
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        background: neutral ? "rgba(255,255,255,0.04)" : color,
        color: neutral ? INK : "#fff",
        padding: "8px 12px", fontFamily: "monospace", fontSize: 11,
        letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700,
      }}>
        {label} · {players.length}
      </div>
      <div style={{
        background: "rgba(0,0,0,0.35)",
        border: `1px solid ${neutral ? "rgba(236,227,196,0.10)" : color + "55"}`,
        borderTop: "none",
        padding: players.length === 0 ? "16px 12px" : "6px 0",
        minHeight: 44,
        color: MUTED, fontFamily: "monospace", fontSize: 12,
      }}>
        {players.length === 0 ? (
          <div style={{ textAlign: "center" }}>—</div>
        ) : (
          players.map((p) => {
            const li = p.lastInitial?.trim() ? `${p.lastInitial.trim().charAt(0).toUpperCase()}.` : "";
            const real = [p.firstName?.trim(), li].filter(Boolean).join(" ");
            const rank = p.experience ? EXP_LABEL[p.experience] : null;
            const expanded = openId === p.id;
            const phone = p.phoneNumber?.trim();
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                borderBottom: "1px solid rgba(236,227,196,0.06)",
              }}>
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : p.id)}
                  style={{
                    background: "transparent", border: "none", padding: 0, cursor: phone ? "pointer" : "default",
                    display: "flex", flexDirection: "column", minWidth: 0, flex: 1, textAlign: "left", color: "inherit",
                  }}
                  title={phone ? "Show phone number" : ""}
                >
                  <span style={{ color: INK, fontWeight: 700, letterSpacing: "0.06em", fontSize: 12.5, textTransform: "uppercase", overflowWrap: "anywhere", lineHeight: 1.3 }}>
                    {p.callsign}{p.operatorType && <span style={{ color: ACCENT, fontSize: 9.5, marginLeft: 6 }}>· {p.operatorType}</span>}
                  </span>
                  {real && (
                    <span style={{ color: MUTED, fontSize: 10.5, marginTop: 2, letterSpacing: "0.02em" }}>
                      {real}
                    </span>
                  )}
                  {expanded && phone && (
                    <a
                      href={`tel:${phone}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: ACCENT, fontSize: 11, marginTop: 4, letterSpacing: "0.05em", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                    >
                      <Phone size={10} /> {phone}
                    </a>
                  )}
                </button>
                <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                  {rank && (
                    <span style={{
                      fontSize: 9, letterSpacing: "0.18em", padding: "2px 6px",
                      border: `1px solid ${ACCENT}55`, color: ACCENT,
                      textTransform: "uppercase", fontWeight: 700,
                    }}>{rank}</span>
                  )}
                  {p.club?.trim() ? (
                    <span style={{
                      fontSize: 9, letterSpacing: "0.18em", padding: "2px 6px",
                      border: `1px solid rgba(236,227,196,0.20)`, color: INK,
                      textTransform: "uppercase", fontWeight: 600,
                    }}>{p.club.trim()}</span>
                  ) : (
                    <span style={{ fontSize: 9, color: MUTED, padding: "2px 4px" }}>—</span>
                  )}
                  {onSwap && teamKey && (
                    <button
                      type="button"
                      onClick={() => onSwap(p.id, teamKey)}
                      title="Swap team"
                      style={{
                        background: "transparent",
                        border: `1px solid ${ACCENT}55`,
                        color: ACCENT,
                        padding: "4px 6px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ArrowLeftRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function LeaderRow({ label, color, score, target }: { label: string; color: string; score: number; target: number }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 4px", borderBottom: "1px solid rgba(236,227,196,0.08)",
    }}>
      <span style={{ fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.18em", color, textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontFamily: "monospace", fontSize: 13, color: INK }}>
        <strong style={{ color: ACCENT }}>{score}</strong> <span style={{ color: MUTED }}>/ {target}</span>
      </span>
    </div>
  );
}
