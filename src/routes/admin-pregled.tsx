import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  type GameState,
} from "@/components/SpartanOpsConsole";
import { useLang, useT } from "@/lib/i18n";
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
  type LobbyDto,
} from "@/lib/spartanops-lobbies.functions";
import { spartanopsUpsertCheckin, spartanopsAdminGetRoster, spartanopsGetServerTime } from "@/lib/spartanops-checkin.functions";
import { spartanopsAdminVerify, spartanopsAdminReassignTeam } from "@/lib/spartanops-admin.functions";


export const Route = createFileRoute("/admin-pregled")({
  validateSearch: (s: Record<string, unknown>) => ({
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

const MASTER_PW_STORAGE_KEY = "spartanops:master_pw";
export function getMasterPw(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(MASTER_PW_STORAGE_KEY) ?? "";
}
function setMasterPw(pw: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(MASTER_PW_STORAGE_KEY, pw);
}

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
  isPremium, keyInput, setKeyInput, keyError, setKeyError, activatePremium, t,
}: {
  isPremium: boolean;
  keyInput: string;
  setKeyInput: (v: string) => void;
  keyError: boolean;
  setKeyError: (v: boolean) => void;
  activatePremium: (k: string) => Promise<boolean>;
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (isPremium) setOpen(false); }, [isPremium]);
  const label = isPremium ? t("premium.statusPremium") : t("premium.statusFree");
  const color = isPremium ? ACCENT : "rgba(180,190,205,0.75)";
  const glow = isPremium ? `0 0 10px ${ACCENT}88` : "none";
  return (
    <div style={{ maxWidth: 360, margin: "14px auto 0", textAlign: "center" }}>
      <button
        type="button"
        onClick={() => { if (!isPremium) setOpen((v) => !v); }}
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "transparent", border: "none", padding: "4px 6px",
          fontFamily: "'Michroma', monospace", fontSize: 9.5, letterSpacing: "0.16em",
          color, textShadow: glow, cursor: isPremium ? "default" : "pointer",
        }}
      >
        <span>{label}</span>
        {!isPremium && (
          <span aria-hidden style={{ fontSize: 9, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
        )}
      </button>
      {!isPremium && open && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const ok = await activatePremium(keyInput);
              if (ok) { setKeyInput(""); setKeyError(false); } else { setKeyError(true); }
            } finally {
              setBusy(false);
            }
          }}

          style={{ display: "flex", gap: 6, alignItems: "stretch", marginTop: 8 }}
        >
          <input
            type="password"
            autoFocus
            value={keyInput}
            onChange={(e) => { setKeyInput(e.target.value); setKeyError(false); }}
            placeholder={t("premium.enterKeyPlaceholder")}
            style={{
              flex: 1, background: "rgba(0,0,0,0.4)", color: INK,
              border: `1px solid ${keyError ? DANGER : `${ACCENT}55`}`,
              padding: "7px 9px", fontFamily: "'Michroma', monospace",
              fontSize: 10, letterSpacing: "0.10em",
            }}
          />
          <button
            type="submit"
            disabled={!keyInput}
            style={{
              background: ACCENT, color: BG, border: `1px solid ${ACCENT}`,
              padding: "7px 11px", fontFamily: "'Michroma', monospace",
              fontSize: 10, letterSpacing: "0.14em", cursor: "pointer", fontWeight: 700,
            }}
          >→</button>
        </form>
      )}
    </div>
  );
}

function AdminPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const t = useT();
  const { isPremium, activatePremium } = usePremium();
  const [premiumKeyInput, setPremiumKeyInput] = useState("");
  const [premiumKeyError, setPremiumKeyError] = useState(false);
  const search = useSearch({ from: "/admin-pregled" }) as { edit?: string };
  const [section, setSection] = useState<MainSection>("fields");
  const [fields, setFields] = useState<Field[]>(INITIAL_FIELDS);
  // Hydrate from localStorage cache so mission cards outline instantly on mount
  // and the DB refresh below silently reconciles.
  const [customLobbies, setCustomLobbies] = useState<LobbyRecord[]>(() => loadLobbies());
  const [lobbiesLoaded, setLobbiesLoaded] = useState(() => loadLobbies().length > 0);
  const [activeField, setActiveField] = useState<FieldKey | null>(null);
  const [fieldAuth, setFieldAuth] = useState<Record<string, string>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [marshalPromptLobby, setMarshalPromptLobby] = useState<LobbyRecord | null>(null);
  const [marshalActiveLobby, setMarshalActiveLobby] = useState<LobbyRecord | null>(null);
  const [marshalPasswordVerified, setMarshalPasswordVerified] = useState<string>("");
  // Ephemeral plaintext password cache keyed by lobby id — passwords are bcrypt-hashed
  // in the DB and never returned, so we retain them only when the marshal enters them
  // this session (via create or verify) so the console can display the current values.
  const [lobbyPwCache, setLobbyPwCache] = useState<Record<string, { player?: string; marshal?: string }>>({});
  const listLobbiesFn = useServerFn(listAllLobbies);
  const listPublishedLobbiesFn = useServerFn(listPublishedLobbies);
  const masterDeleteLobbyFn = useServerFn(masterDeleteLobby);

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

  const handleDecommission = (key: FieldKey) => {
    const msg = "CRITICAL: Are you sure you want to completely decommission and wipe this field?";
    if (!confirm(msg)) return;
    setFields((f) => f.filter((x) => x.key !== key));
    if (activeField === key) setActiveField(null);
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
      alert(`Failed to decommission lobby: ${e?.message ?? "unknown error"}`);
      setCustomLobbies(prev);
    }
  };

  const handleExitAdminView = () => {
    if (typeof window !== "undefined") {
      try { sessionStorage.removeItem(MASTER_PW_STORAGE_KEY); } catch {}
    }
    setIsEditMode(false);
    setEditModalOpen(false);
    void refreshLobbies();
  };


  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", padding: "32px 16px 80px" }}>
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

          {/* Premium status indicator — click to reveal operation key input */}
          <PremiumStatusToggle
            isPremium={isPremium}
            keyInput={premiumKeyInput}
            setKeyInput={setPremiumKeyInput}
            keyError={premiumKeyError}
            setKeyError={setPremiumKeyError}
            activatePremium={activatePremium}
            t={t}
          />

        </div>




        {/* Tabs */}
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

        {section === "fields" && creating && (
          <CreateFieldForm
            onCancel={() => setCreating(false)}
            onCreated={(rec, pws) => {
              setCreating(false);
              setCustomLobbies(loadLobbies());
              setLobbyPwCache((s) => ({ ...s, [rec.id]: { player: pws.password, marshal: pws.marshalPassword } }));
              setMarshalPasswordVerified(pws.marshalPassword);
              setMarshalActiveLobby(rec);
            }}
          />
        )}

        {section === "fields" && !creating && !activeField && !marshalActiveLobby && (
          <FieldsWelcome
            fields={fields}
            customLobbies={customLobbies}
            lobbiesLoaded={lobbiesLoaded}
            isEditMode={isEditMode}
            onCreate={() => setCreating(true)}
            onUseExisting={scrollToList}
            onOpenField={(k) => setActiveField(k)}
            onDecommission={handleDecommission}
            onOpenLobby={(id) => {
              const l = customLobbies.find((x) => x.id === id);
              if (l) setMarshalPromptLobby(l);
            }}
            onDecommissionLobby={handleDecommissionLobby}
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
            onBack={() => { setMarshalActiveLobby(null); setMarshalPasswordVerified(""); }}
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
          onSuccess={(pw) => {
            setMarshalPasswordVerified(pw);
            setLobbyPwCache((s) => ({ ...s, [marshalPromptLobby.id]: { ...s[marshalPromptLobby.id], marshal: pw } }));
            setMarshalActiveLobby(marshalPromptLobby);
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

function CreateFieldForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (rec: LobbyRecord, pws: { password: string; marshalPassword: string }) => void }) {
  const { lang } = useLang();
  const en = lang === "en";
  const { isPremium, openPremiumModal } = usePremium();

  // Core lobby identity
  const [fieldName, setFieldName] = useState("");
  const [missionName, setMissionName] = useState("");
  const [missionDescription, setMissionDescription] = useState("");
  const [afterGameInstructions, setAfterGameInstructions] = useState("");
  const [password, setPassword] = useState("");
  const [marshalPassword, setMarshalPassword] = useState("");
  const [showMarshalPassword, setShowMarshalPassword] = useState(true);
  const [eventName, setEventName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [marshalName, setMarshalName] = useState("");
  const [marshalPhone, setMarshalPhone] = useState("");


  // Field / map / game settings (mirrors SpartanOpsConsole atoms)
  const [gamemode, setGamemode] = useState<"domination" | "search_destroy">("domination");
  const [mapUrl, setMapUrl] = useState("");
  const [duration, setDuration] = useState(20);
  const [countdown, setCountdown] = useState(300); // seconds
  const [pointTarget, setPointTarget] = useState(50);

  // Node positions on the map (Alpha–Epsilon, spawns, compass)
  const [nodePositions, setNodePositions] = useState<NodePositions>({});

  // Advanced tactical settings (respawn + capture scoring) — same shape as GameSettings
  const [settings, setSettings] = useState<GameSettings>({
    respawn: { ...DEFAULT_RESPAWN },
    capturePointsScoring: true,
  });

  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [created, setCreated] = useState<{ rec: LobbyRecord; password: string; marshalPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onMapFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErr(en ? "Please upload an image file." : "Naloži slikovno datoteko.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setMapUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const createFn = useServerFn(createLobbyFn);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!missionName.trim() || !fieldName.trim() || !password.trim() || !country.trim() || !city.trim() || !marshalPassword.trim() || !marshalName.trim()) {
      setErr(en
        ? "Mission name, field name, city, country, marshal name, mission password, and marshal password are required."
        : "Ime misije, ime poligona, mesto, država, ime maršala, geslo misije in geslo maršala so obvezni.");
      return;
    }
    if (marshalPassword.trim() === password.trim()) {
      setErr(en
        ? "Marshal password must differ from the player lobby password."
        : "Geslo maršala mora biti različno od igralskega gesla.");
      return;
    }
    const location = `${city.trim()}, ${country.trim()}`;
    const effectiveFieldName = fieldName.trim();
    // Persist mission name / description inside the settings JSON so no DB migration is needed.
    const settingsWithMission = {
      ...settings,
      missionName: missionName.trim(),
      marshalName: marshalName.trim(),
      marshalPhone: marshalPhone.trim() || undefined,
      missionDescription: missionDescription.trim() || undefined,
      afterGameInstructions: afterGameInstructions.trim() || undefined,
    } as any;
    setBusy(true);
    setErr("");
    try {
      const dto = await createFn({
        data: {
          fieldName: effectiveFieldName,
          eventName: eventName.trim() || undefined,
          location,
          country: country.trim(),
          city: city.trim(),
          gamemode,
          mapUrl: mapUrl.trim() || undefined,
          matchDurationMinutes: duration,
          countdownSeconds: countdown,
          pointTarget,
          nodePositions,
          settings: settingsWithMission,
          password: password.trim(),
          marshalPassword: marshalPassword.trim(),
          masterPassword: getMasterPw(),
          published: true,
        },
      });

      const rec = dtoToRecord(dto);
      // Cache marshal password locally so the marshal keeps it around this session.
      rec.marshalPassword = marshalPassword.trim();
      rec.password = password.trim();
      // Mirror to localStorage for legacy code paths.
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
      setCreated({ rec, password: password.trim(), marshalPassword: marshalPassword.trim() });
    } catch (e: any) {
      console.error("[admin] createLobby failed", { error: e, message: e?.message, cause: e?.cause, stack: e?.stack });
      setErr(e?.message ? `Error: ${e.message}` : "Failed to create lobby.");
    } finally {
      setBusy(false);
    }
  };

  const lobbyUrl = created && typeof window !== "undefined"
    ? `${window.location.origin}/misija?field=${created.rec.id}`
    : "";

  return (
    <form onSubmit={submit} style={{ maxWidth: 780, margin: "0 auto" }}>
      {/* Screen header */}
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 18, letterSpacing: "0.24em", color: ACCENT, marginBottom: 10, textTransform: "uppercase", fontWeight: 700 }}>
          // {en ? "GAME SETTINGS" : "NASTAVITVE IGRE"}
        </p>
        <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 16, letterSpacing: "0.14em", color: INK, textTransform: "uppercase" }}>
          {en ? "DEPLOY NEW MISSION" : "POSTAVI NOVO MISIJO"}
        </h2>
      </div>

      {/* ── CARD 1: MISSION AND FIELD ───────────────────────── */}
      <Pane title={en ? "MISSION AND FIELD" : "MISIJA IN POLIGON"}>
        <FieldRow label={en ? "Field name *" : "Ime poligona *"}>
          <input required value={fieldName} onChange={(e) => setFieldName(e.target.value)} style={consoleInputStyle} placeholder="Poligon Ljubljana" />
        </FieldRow>
        <FieldRow label={en ? "Mission name" : "Ime misije"}>
          <input value={missionName} onChange={(e) => setMissionName(e.target.value)} style={consoleInputStyle} placeholder={en ? "Operation Fallen Angel" : "Operacija Fallen Angel"} />
        </FieldRow>
        <FieldRow label={en ? "Mission description / instructions (Optional)" : "Opis misije / navodila (Neobvezno)"}>
          <textarea
            value={missionDescription}
            onChange={(e) => setMissionDescription(e.target.value)}
            style={{ ...consoleInputStyle, minHeight: 72, resize: "vertical" }}
            placeholder={en ? "The players will see this description/instructions before and during the game." : "Igralci bodo videli ta opis/navodila pred in med igro."}
          />
        </FieldRow>
        <FieldRow label={en ? "After game instructions" : "Navodila po igri"}>
          <textarea
            value={afterGameInstructions}
            onChange={(e) => setAfterGameInstructions(e.target.value)}
            style={{ ...consoleInputStyle, minHeight: 72, resize: "vertical" }}
            placeholder={en ? "Instruction on what the players should do after the game." : "Navodilo, kaj naj igralci naredijo po koncu igre."}
          />
        </FieldRow>
        <FieldRow label={en ? "Event name (optional)" : "Ime dogodka (neobvezno)"}>
          <input value={eventName} onChange={(e) => setEventName(e.target.value)} style={consoleInputStyle} placeholder={en ? "e.g. Operation Ares" : "npr. Operacija Ares"} />
        </FieldRow>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label={en ? "City" : "Mesto"}>
            <input value={city} onChange={(e) => setCity(e.target.value)} style={consoleInputStyle} placeholder="Ljubljana" />
          </FieldRow>
          <FieldRow label={en ? "Country" : "Država"}>
            <input value={country} onChange={(e) => setCountry(e.target.value)} style={consoleInputStyle} placeholder="Slovenia" />
          </FieldRow>
        </div>
        <FieldRow label={en ? "Marshal name (mandatory)" : "Ime maršala (obvezno)"}>
          <input required value={marshalName} onChange={(e) => setMarshalName(e.target.value)} style={consoleInputStyle} placeholder={en ? "e.g. Luka" : "npr. Luka"} />
        </FieldRow>
        <FieldRow label={en ? "Marshal phone number (optional)" : "Telefonska številka maršala (neobvezno)"}>
          <input value={marshalPhone} onChange={(e) => setMarshalPhone(e.target.value)} style={consoleInputStyle} placeholder="+386 40 123 456" inputMode="tel" />
        </FieldRow>
      </Pane>

      <div style={{ height: 16 }} />

      {/* ── CARD 2: PASSWORDS ───────────────────────────────── */}
      <Pane title={en ? "PASSWORDS" : "GESLA"}>
        <FieldRow label={en ? "Mission password (for players)" : "Geslo misije (za igralce)"}>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...consoleInputStyle, paddingRight: 40 }}
              placeholder={en ? "e.g. spartan-alpha-2025" : "npr. spartan-alpha-2025"}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? (en ? "Hide password" : "Skrij geslo") : (en ? "Show password" : "Prikaži geslo")}
              style={{
                position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)",
                background: "transparent", border: "none", color: MUTED, cursor: "pointer",
                padding: 4, display: "grid", placeItems: "center",
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FieldRow>
        <FieldRow label={en ? "Marshal password (for organizers to access this mission control center)" : "Geslo maršala (za organizatorje – dostop do komandnega centra misije)"}>
          <div style={{ position: "relative" }}>
            <input
              type={showMarshalPassword ? "text" : "password"}
              value={marshalPassword}
              onChange={(e) => setMarshalPassword(e.target.value)}
              style={{ ...consoleInputStyle, paddingRight: 40 }}
              placeholder={en ? "e.g. marshal-override-2025" : "npr. marshal-override-2025"}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowMarshalPassword((v) => !v)}
              aria-label={showMarshalPassword ? (en ? "Hide password" : "Skrij geslo") : (en ? "Show password" : "Prikaži geslo")}
              style={{
                position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)",
                background: "transparent", border: "none", color: MUTED, cursor: "pointer",
                padding: 4, display: "grid", placeItems: "center",
              }}
            >
              {showMarshalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", marginTop: 6, lineHeight: 1.5 }}>
            {en
              ? "Must differ from the mission password."
              : "Mora biti različno od igralskega gesla."}
          </p>
        </FieldRow>
      </Pane>

      <div style={{ height: 16 }} />

      {/* ── STANDALONE SECTION TITLE ────────────────────────── */}
      <div style={{ margin: "8px 0 14px", textAlign: "center" }}>
        <h3 style={{ fontFamily: "'Michroma', monospace", fontSize: 18, letterSpacing: "0.22em", color: ACCENT, textTransform: "uppercase", fontWeight: 700 }}>
          {en ? "GAMEMODE AND PARAMETERS" : "IGRALNI NAČIN IN PARAMETRI"}
        </h3>
        <div style={{ height: 1, background: `${ACCENT}30`, marginTop: 10 }} />
      </div>

      {/* ── CARD 3: GAME MODE SELECTION ─────────────────────── */}
      <Pane title={en ? "GAME MODE SELECTION" : "IZBIRA IGRALNEGA NAČINA"}>
        <FieldRow label={en ? "Game mode selection" : "Izbira igralnega načina (Gamemode)"}>
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
            <button type="button" onClick={() => { if (!isPremium) openPremiumModal(); }}
              style={{
                background: "rgba(255,255,255,0.03)", color: MUTED,
                border: `1px dashed rgba(236,227,196,0.18)`,
                padding: "10px 8px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em",
                textTransform: "uppercase", cursor: "pointer", textAlign: "left", opacity: 0.75,
              }}>
              🔒 Search &amp; Destroy<br /><span style={{ fontSize: 9 }}>{en ? "Coming soon" : "Prihaja kmalu"}</span>
            </button>
          </div>
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label={en ? "Duration (min)" : "Trajanje (min)"}>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={consoleSelectStyle}>
              {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label={en ? "Pre-start" : "Pred-štart"}>
            <select value={countdown} onChange={(e) => setCountdown(Number(e.target.value))} style={consoleSelectStyle}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m * 60}>{m} min</option>
              ))}
            </select>
          </FieldRow>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 4, fontFamily: "monospace" }}>
            {en ? "Target points (win when reached)" : "Ciljne točke (zmaga ob doseženem številu)"}
          </div>
          <p style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", lineHeight: 1.55, marginBottom: 8, fontStyle: "italic" }}>
            {en
              ? "Planning note: the system is balanced so a standard game lasts exactly 40 minutes if a team constantly holds the majority (3 of 5 flags)."
              : "Pojasnilo: sistem je uravnotežen tako, da standardna igra traja natanko 40 minut, če ekipa konstantno drži večino (3 od 5 zastavic)."}
          </p>
          <select value={pointTarget} onChange={(e) => setPointTarget(Number(e.target.value))} style={consoleSelectStyle}>
            {Array.from({ length: 30 }, (_, i) => (i + 1) * 10).map((p) => (
              <option key={p} value={p}>{p} {en ? "pts" : "točk"}</option>
            ))}
          </select>
        </div>
      </Pane>

      <div style={{ height: 16 }} />

      {/* ── RESPAWN QR CODES (self-titled card) ─────────────── */}
      <RespawnQrConfig settings={settings} onPatch={setSettings} en={en} />

      <div style={{ height: 16 }} />

      {/* ── CAPTURE POINTS SCORING (self-titled card) ───────── */}
      <CaptureScoringConfig settings={settings} onPatch={setSettings} en={en} />

      <div style={{ height: 16 }} />

      {/* ── SPARTACUS ANTI-CHEAT (self-titled card) ─────────── */}
      <SpartacusConfig settings={settings} onPatch={setSettings} en={en} />

      <div style={{ height: 16 }} />

      {/* ── TEAMS (self-titled card) ────────────────────────── */}
      <TeamConfigSection settings={settings} onPatch={setSettings} en={en} />

      <div style={{ height: 16 }} />

      {/* ── TACTICAL MAP ────────────────────────────────────── */}
      <Pane title={en ? "TACTICAL MAP" : "TAKTIČNI ZEMLJEVID"}>
        <p style={{ fontSize: 11, color: MUTED, fontFamily: "monospace", lineHeight: 1.55, marginBottom: 12 }}>
          {en ? "Upload the image of your field or playing area." : "Naloži sliko svojega poligona ali igralne površine."}
        </p>
        <FieldRow label={en ? "Upload image from device (or link)" : "Naloži sliko z naprave (ali povezavo)"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onMapFile(f);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "transparent", color: ACCENT,
                border: `1px dashed ${ACCENT}`, padding: "12px 14px",
                fontFamily: "'Michroma', monospace", fontSize: 11,
                letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Upload size={14} /> [ {en ? "UPLOAD IMAGE FROM DEVICE" : "NALOŽI SLIKO Z NAPRAVE"} ]
            </button>
            <input
              value={mapUrl.startsWith("data:") ? "" : mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              style={consoleInputStyle}
              placeholder="https://.../map.webp"
            />
            {mapUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, border: `1px solid ${ACCENT}33`, background: "rgba(224,176,78,0.04)" }}>
                <img
                  src={mapUrl}
                  alt="Map preview"
                  style={{ width: 72, height: 54, objectFit: "cover", border: `1px solid ${ACCENT}55` }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase", marginBottom: 2 }}>
                    // {en ? "MAP READY" : "ZEMLJEVID PRIPRAVLJEN"}
                  </p>
                  <p style={{ fontSize: 11, color: MUTED, wordBreak: "break-all", lineHeight: 1.4 }}>
                    {mapUrl.startsWith("data:") ? (en ? "Uploaded from device" : "Naloženo z naprave") : mapUrl}
                  </p>
                </div>
                <button type="button" onClick={() => setMapUrl("")}
                  aria-label="Clear map"
                  style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer" }}>
                  <X size={14} />
                </button>
              </div>
            )}
            <p style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", lineHeight: 1.5, fontStyle: "italic" }}>
              {en
                ? "Recommended: Upload compressed .webp images for the fastest loading speeds during live gameplay on the field."
                : "Priporočeno: naloži stisnjene .webp slike za najhitrejše nalaganje med igro na terenu."}
            </p>
          </div>
        </FieldRow>
      </Pane>

      <div style={{ height: 16 }} />

      {/* ── CREATE YOUR MAP ─────────────────────────────────── */}
      <Pane title={en ? "CREATE YOUR MAP" : "SESTAVI ZEMLJEVID"}>
        <NodePlacer
          mapUrl={mapUrl || null}
          positions={nodePositions}
          onChange={(p) => setNodePositions(p)}
          en={en}
        />
      </Pane>

      <p style={{ fontSize: 11, color: MUTED, fontFamily: "monospace", lineHeight: 1.6, margin: "18px 0 16px", padding: "12px 14px", border: `1px dashed ${ACCENT}33`, background: "rgba(224,176,78,0.03)" }}>
        <strong style={{ color: ACCENT }}>{en ? "NOTE:" : "OPOMBA:"}</strong>{" "}
        {en
          ? "Initializing the lobby adds the mission to the missions list. The player must then join the mission with the mission password you have created, register and choose their teams. Before the game starts you can balance the teams."
          : "Inicializacija lobbyja doda misijo na seznam misij. Igralec se mora nato pridružiti misiji z geslom, ki ste ga ustvarili, se registrirati in izbrati svojo ekipo. Pred začetkom igre lahko ekipe uravnotežite."}
      </p>


      {err && <p style={{ color: "#d97a6c", fontSize: 12, marginBottom: 10 }}>{err}</p>}
      {ok && <p style={{ color: ACCENT, fontSize: 12, marginBottom: 10, fontFamily: "monospace", letterSpacing: "0.14em" }}>// {en ? "LOBBY INITIALIZED" : "LOBBY INICIALIZIRAN"}</p>}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={busy}
          style={{ background: ACCENT, color: BG, border: "none", padding: "14px 28px", fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, minWidth: 280 }}>
          [ {busy ? (en ? "STARTING…" : "VZPOSTAVLJAM…") : (en ? "START LOBBY" : "VZPOSTAVI MISIJO")} ]
        </button>
        <p style={{ color: `${ACCENT}99`, fontSize: 11, fontFamily: "monospace", letterSpacing: "0.06em", lineHeight: 1.55, textAlign: "center", maxWidth: 520, margin: 0 }}>
          {en
            ? "Click to show this lobby on the list of missions."
            : "Klikni, da se ta misija prikaže na seznamu aktivnih misij — igralci se lahko po tem pridružijo misiji z geslom, ki ste ga ustvarili."}
        </p>
      </div>

      <div style={{ marginTop: 22, padding: "14px 16px", border: `1px solid ${ACCENT}55`, background: "rgba(224,176,78,0.04)" }}>
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase", marginBottom: 10 }}>
          {en ? "LOBBY URL" : "POVEZAVA DO MISIJE"}
        </p>
        {lobbyUrl ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input readOnly value={lobbyUrl} onFocus={(e) => e.currentTarget.select()} style={{ ...consoleInputStyle, flex: "1 1 240px" }} />
            <button
              type="button"
              onClick={async () => {
                try { await navigator.clipboard.writeText(lobbyUrl); } catch { /* ignore */ }
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              style={{ background: "transparent", border: `1px solid ${ACCENT}`, color: ACCENT, padding: "10px 14px", fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}
            >
              {copied ? (en ? "COPIED" : "KOPIRANO") : (en ? "COPY LINK" : "KOPIRAJ")}
            </button>
          </div>
        ) : (
          <p style={{ fontFamily: "monospace", fontSize: 12, color: MUTED, letterSpacing: "0.06em" }}>____</p>
        )}
        <p style={{ fontFamily: "monospace", fontSize: 11, color: MUTED, lineHeight: 1.6, marginTop: 10 }}>
          {en
            ? "After creating a lobby, you can copy the provided link and send it to your players, so they can join the mission directly."
            : "Po tem ko vzpostavite misijo, lahko kopirate generirani link, s katerim se lahko vaši igralci povežejo direktno v misijo."}
        </p>
        {created && (
          <button
            type="button"
            onClick={() => onCreated(created.rec, { password: created.password, marshalPassword: created.marshalPassword })}
            style={{ marginTop: 14, background: ACCENT, color: BG, border: "none", padding: "12px 22px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}
          >
            [ {en ? "ENTER COMMAND CENTER" : "V KOMANDNI CENTER"} ]
          </button>
        )}
      </div>
    </form>
  );
}




function FieldsWelcome({
  fields, customLobbies, lobbiesLoaded, isEditMode, onCreate, onUseExisting, onOpenField, onDecommission, onOpenLobby, onDecommissionLobby,
}: {
  fields: Field[];
  customLobbies: LobbyRecord[];
  lobbiesLoaded: boolean;
  isEditMode: boolean;
  onCreate: () => void;
  onUseExisting: () => void;
  onOpenField: (k: FieldKey) => void;
  onDecommission: (k: FieldKey) => void;
  onOpenLobby: (id: string) => void;
  onDecommissionLobby: (id: string) => void;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  return (
    <>
      {/* Deployment onboarding */}
      <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 28px" }}>
        <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.30em", color: ACCENT, marginBottom: 10, textTransform: "uppercase" }}>
          {en ? "// CREATE YOUR OPERATIONAL PLAN" : "// USTVARITE SVOJ OPERATIVNI NAČRT"}
        </p>
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
          {en ? "Create a new mission from scratch or resume an existing one." : "Ustvarite novo misijo iz nič ali nadaljujte z obstoječo."}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480, margin: "0 auto 40px" }}>
        <button
          onClick={onCreate}
          style={{
            background: ACCENT, color: BG, border: "none",
            padding: "16px 18px", fontFamily: "'Michroma', monospace",
            fontSize: 12, letterSpacing: "0.20em", textTransform: "uppercase",
            fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          {en ? "[ + CREATE NEW MISSION ]" : "[ + USTVARI NOVO MISIJO ]"}
        </button>
        <button
          onClick={onUseExisting}
          style={{
            background: "transparent", color: ACCENT,
            border: `1px solid ${ACCENT}`, padding: "15px 18px",
            fontFamily: "'Michroma', monospace",
            fontSize: 12, letterSpacing: "0.20em", textTransform: "uppercase",
            fontWeight: 600, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <span>[</span>
          <ShieldCheck size={14} strokeWidth={1.8} />
          <span>{en ? "USE EXISTING MISSION ]" : "UPORABI OBSTOJEČO MISIJO ]"}</span>
        </button>
      </div>


      {/* Existing missions list */}
      <div id="fields-list" style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.30em", color: MUTED, marginBottom: 14, textTransform: "uppercase" }}>
          {en ? "// ACTIVE MISSIONS" : "// AKTIVNE MISIJE"}
        </p>

        {!lobbiesLoaded ? (
          <MissionCardSkeletonGrid count={3} />
        ) : customLobbies.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", border: `1px dashed rgba(236,227,196,0.15)`, color: MUTED, fontSize: 13, fontStyle: "italic" }}>
            No active fields on the network. Deploy a new one to get started.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {customLobbies.map((l) => {
              const city = l.city || (l.location?.split(",")[0]?.trim() ?? "");
              const country = l.country || (l.location?.split(",")[1]?.trim() ?? "");
              const status = l.published ? "ACTIVE" : "STANDBY";
              const locationText = [city, country].filter(Boolean).join(", ") || l.location || "—";
              const statusColor = l.published ? "#3ddc84" : ACCENT;
              return (
                <div key={l.id}
                  style={{
                    position: "relative",
                    background: "linear-gradient(180deg, rgba(224,176,78,0.04) 0%, rgba(0,0,0,0) 60%), " + PANEL,
                    border: `1px solid ${ACCENT}40`,
                    padding: "20px 20px 18px",
                    color: INK,
                  }}>
                  {isEditMode && (
                    <button
                      onClick={() => onDecommissionLobby(l.id)}
                      aria-label="Decommission lobby"
                      title="Decommission lobby"
                      style={{
                        position: "absolute", top: 8, right: 8,
                        width: 30, height: 30, display: "grid", placeItems: "center",
                        background: "transparent", color: DANGER,
                        border: `1px solid ${DANGER}80`, cursor: "pointer",
                      }}>
                      <X size={14} strokeWidth={2.2} />
                    </button>
                  )}
                  <button
                    onClick={() => onOpenLobby(l.id)}
                    style={{ background: "transparent", border: "none", color: INK, cursor: "pointer", textAlign: "left", padding: 0, width: "100%" }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="shrink-0 grid place-items-center"
                        style={{ width: 44, height: 44, background: `${ACCENT}14`, border: `1px solid ${ACCENT}`, color: ACCENT }}>
                        <Crosshair size={20} strokeWidth={1.6} />
                      </div>
                      <span style={{
                        fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em",
                        color: statusColor, textTransform: "uppercase",
                        border: `1px solid ${statusColor}55`, padding: "3px 8px",
                      }}>
                        {status}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.14em", color: ACCENT, marginBottom: 8, textTransform: "uppercase", lineHeight: 1.55 }}>
                      MISSION: {l.eventName || l.fieldName}
                    </p>
                    {l.fieldName && (
                      <p style={{ fontFamily: "monospace", fontSize: 10.5, color: MUTED, letterSpacing: "0.14em", marginTop: 6, textTransform: "uppercase" }}>
                        Field {l.fieldName}
                      </p>
                    )}
                    <p style={{ fontSize: 12.5, color: "rgba(236,227,196,0.85)", lineHeight: 1.6, marginTop: 8 }}>
                      Location: {locationText}
                    </p>
                  </button>
                  
                </div>

              );
            })}
          </div>
        )}
      </div>


    </>
  );
}

/** Always-visible join link for a created mission, with one-click copy. */
function LobbyLinkRow({ lobbyId, en }: { lobbyId: string; en: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/misija?field=${lobbyId}` : "";
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${ACCENT}33` }}>
      <p style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.24em", color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>
        {en ? "LOBBY URL" : "POVEZAVA DO MISIJE"}
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: 1, minWidth: 0, background: "rgba(0,0,0,0.35)", border: `1px solid ${ACCENT}33`, color: INK, fontFamily: "monospace", fontSize: 10.5, padding: "7px 8px" }}
        />
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          style={{ background: "transparent", border: `1px solid ${ACCENT}`, color: ACCENT, padding: "7px 10px", fontFamily: "'Michroma', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {copied ? (en ? "COPIED" : "KOPIRANO") : (en ? "COPY" : "KOPIRAJ")}
        </button>
      </div>
    </div>
  );
}


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
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyFn = useServerFn(spartanopsAdminVerify);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
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
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus
          style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.2)", padding: "12px 14px", fontSize: 14, marginBottom: 12, textAlign: "center", letterSpacing: "0.2em" }} />
        {err && <p style={{ color: "#d97a6c", fontSize: 12, marginBottom: 10 }}>{err}</p>}
        <button type="submit" style={{ width: "100%", padding: "12px", background: ACCENT, color: BG, border: "none", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
          {en ? "Enter" : "Vstop"}
        </button>
      </form>
    </div>
  );
}

function MasterPasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (pw: string) => void }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyFn = useServerFn(verifyMasterPassword);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
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
        position: "fixed", inset: 0, zIndex: 200,
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
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="••••••••"
          style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "12px 14px", fontSize: 14, marginBottom: 12, textAlign: "center", letterSpacing: "0.2em" }}
        />
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
  const [password, setPassword] = useState("");

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyFn = useServerFn(verifyLobbyPassword);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
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
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", display: "grid", placeItems: "center", padding: 16 }}>
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
          {(lang === "en" ? "LOGIN TO MISSION: " : "PRIJAVA V MISIJO: ") + (lobby.eventName || lobby.fieldName)}
        </h2>
        <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginBottom: 18 }}>
          {lang === "en"
            ? "Enter the Command Center password to open the Marshal dashboard for this mission."
            : "Vnesite geslo Poveljniškega centra za odpiranje nadzorne plošče maršala za to misijo."}
        </p>

        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus placeholder="••••••••"
          style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "12px 14px", fontSize: 14, marginBottom: 12, textAlign: "center", letterSpacing: "0.2em" }} />
        {err && <p style={{ color: "#d97a6c", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
        <button type="submit" style={{ width: "100%", padding: "12px", background: ACCENT, color: BG, border: "none", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
          Authorize Marshal
        </button>
      </form>
    </div>
  );
}

function MarshalLobbyConsole({ lobby: initialLobby, marshalPassword, lobbyPasswordCached = "", marshalPasswordCached = "", onBack }: { lobby: LobbyRecord; marshalPassword: string; lobbyPasswordCached?: string; marshalPasswordCached?: string; onBack: () => void }) {
  const { lang } = useLang();
  const en = lang === "en";
  const { isPremium, openPremiumModal } = usePremium();
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
  };
  const [registered, setRegistered] = useState<RegisteredPlayer[]>([]);
  const lobbyState: LobbyState = lobby.state ?? "pending";
  const state: LobbyState = gameStatusToLobbyState(gameState?.status) ?? lobbyState;
  const [showLobbyPw, setShowLobbyPw] = useState(false);
  const [showMarshalPw, setShowMarshalPw] = useState(false);
  // Ephemeral plaintext passwords. Bcrypt hashes never leave the DB, so we
  // seed from the cached values captured this session (create or verify flow).
  // An empty value means "unknown" — we show a masked placeholder and only
  // persist a change when the marshal types a new value.
  const [lobbyPwInput, setLobbyPwInput] = useState<string>(lobbyPasswordCached);
  const [marshalPwInput, setMarshalPwInput] = useState<string>(marshalPasswordCached);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onMapFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") patch({ mapUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };


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
    updateFn({ data: { id: lobby.id, patch: dbPatch, authPassword: marshalPassword || getMasterPw() } }).catch((e) => console.error("[marshal] update failed", e));
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
    updateFn({ data: { id: lobby.id, patch: { state: "paused" }, authPassword: marshalPassword || getMasterPw() } })
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
    updateFn({ data: { id: lobby.id, patch: { state: "active", startedAt: nextStartedAtIso }, authPassword: marshalPassword || getMasterPw() } })
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
      await deletePlayersFn({ data: { id: lobby.id, marshalPassword } });
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
      await deleteLobbyServerFn({ data: { id: lobby.id, marshalPassword } });
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
      if (!marshalPassword) return;
      try {
        const res = await getAdminRoster({ data: { fieldId: lobby.id, password: marshalPassword } });
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
        })));
      } catch (e) {
        console.error("[marshal] roster fetch failed", e);
      }
    };

    load();
    const channel = supabase
      .channel(`marshal-roster-${lobby.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spartanops_checkins", filter: `field_id=eq.${lobby.id}` },
        () => load(),
      )
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [lobby.id, marshalPassword, getAdminRoster]);


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
        const next = data as unknown as GameState;
        setGameState(next);
        const nextLobbyState = gameStatusToLobbyState(next.status);
        if (nextLobbyState) {
          setLobby((prev) => ({ ...prev, state: nextLobbyState, startedAt: next.match_started_at ? new Date(next.match_started_at).getTime() : prev.startedAt ?? null }));
          updateLobby(lobby.id, { state: nextLobbyState, startedAt: next.match_started_at ? new Date(next.match_started_at).getTime() : null });
        }
        if (next.match_started_at) syncServerClock().catch(() => {});
      }
    };
    load();
    const ch = supabase
      .channel(`marshal-gs-${lobby.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spartanops_game_state", filter: `field_id=eq.${lobby.id}` },
        (p) => {
          if (p.new) {
            const next = p.new as unknown as GameState;
            setGameState(next);
            const nextLobbyState = gameStatusToLobbyState(next.status);
            if (nextLobbyState) {
              setLobby((prev) => ({ ...prev, state: nextLobbyState, startedAt: next.match_started_at ? new Date(next.match_started_at).getTime() : prev.startedAt ?? null }));
              updateLobby(lobby.id, { state: nextLobbyState, startedAt: next.match_started_at ? new Date(next.match_started_at).getTime() : null });
            }
            if (next.match_started_at) syncServerClock().catch(() => {});
          }
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
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
        assignedTeam: profile.team,
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
    if (!marshalPassword) return;
    // Enforce 2-faction swap. Lobby players default to modra.
    const target: "modra" | "rdeca" =
      currentTeam === "modra" ? "rdeca" : currentTeam === "rdeca" ? "modra" : "modra";
    // Optimistic UI — realtime will reconcile.
    setRegistered((prev) => prev.map((p) => p.id === playerId ? { ...p, team: target } : p));
    try {
      await reassignFn({ data: { fieldId: lobby.id, password: marshalPassword, checkinId: playerId, team: target } });
    } catch (e) {
      console.error("[marshal] swap failed", e);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <button onClick={onBack}
          style={{ background: "transparent", border: `1px solid ${ACCENT}40`, color: ACCENT, padding: "8px 14px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ChevronLeft size={12} /> {en ? "Back to main command center" : "Nazaj v glavni komandni center"}
        </button>
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase" }}>
            Mission: {lobby.eventName || lobby.fieldName}
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

        {/* Join link is only exposed inside the password-protected marshal console. */}
        <LobbyLinkRow lobbyId={lobby.id} en={en} />



        <p style={{ fontFamily: "monospace", fontSize: 11, color: MUTED, marginTop: 12 }}>
          {en ? "Registered:" : "Prijavljeni:"} <strong style={{ color: INK }}>{registered.length}</strong>
        </p>
      </Pane>

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
        <LeaderRow label="BLUE" color="#3b82f6" score={gameState?.team_scores?.modra ?? 0} target={target} />
        <LeaderRow label="RED"  color="#ef4444" score={gameState?.team_scores?.rdeca ?? 0} target={target} />
      </Pane>

      {/* LIVE TACTICAL MAP + EVENT LOG (visible whenever we have live game state) */}
      {gameState && (
        <LiveMatchView state={gameState} captures={captures as any} now={now} en={en} mapUrl={lobby.mapUrl || undefined} />
      )}



      {/* SETTINGS SECTION DIVIDER */}
      <div style={{ margin: "26px 0 14px", textAlign: "center", fontFamily: "'Michroma', monospace", fontSize: 20, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", fontWeight: 700 }}>
        ⚙ {en ? "GAME SETTINGS" : "NASTAVITVE IGRE"}
      </div>
      <div style={{ height: 1, background: `${ACCENT}30`, marginBottom: 18 }} />

      {/* ── CARD 1: MISSION AND FIELD ───────────────────────── */}
      <Pane title={en ? "MISSION AND FIELD" : "MISIJA IN POLIGON"}>
        <FieldRow label={en ? "Field name (locked)" : "Ime poligona (zaklenjeno)"}>
          <input value={lobby.fieldName} readOnly disabled style={{ ...consoleInputStyle, opacity: 0.65, cursor: "not-allowed" }} />
        </FieldRow>
        <FieldRow label={en ? "Event name (optional)" : "Ime dogodka (neobvezno)"}>
          <input value={lobby.eventName ?? ""} onChange={(e) => patch({ eventName: e.target.value })} style={consoleInputStyle} placeholder={en ? "e.g. Operation Ares" : "npr. Operacija Ares"} />
        </FieldRow>
        <FieldRow label={en ? "Mission description / instructions (optional)" : "Opis misije / navodila (neobvezno)"}>
          <textarea
            value={(lobby.settings as any)?.missionDescription ?? ""}
            onChange={(e) => patch({ settings: { ...(lobby.settings ?? {}), missionDescription: e.target.value } as any })}
            rows={3}
            style={{ ...consoleInputStyle, resize: "vertical", minHeight: 80, fontFamily: "inherit" }}
            placeholder={en ? "The players will see this description/instructions before and during the game." : "Igralci bodo videli ta opis/navodila pred in med igro."}
          />
          <p style={{ fontSize: 10, color: MUTED, marginTop: 4, fontFamily: "monospace", letterSpacing: "0.06em" }}>
            // {en ? "Editable any time — updates propagate live to player HUDs." : "Uredljivo kadarkoli — spremembe se v živo prenesejo na igralski HUD."}
          </p>
        </FieldRow>
        <FieldRow label={en ? "After game instructions" : "Navodila po igri"}>
          <textarea
            value={(lobby.settings as any)?.afterGameInstructions ?? ""}
            onChange={(e) => patch({ settings: { ...(lobby.settings ?? {}), afterGameInstructions: e.target.value } as any })}
            rows={3}
            style={{ ...consoleInputStyle, resize: "vertical", minHeight: 80, fontFamily: "inherit" }}
            placeholder={en ? "Instruction on what the players should do after the game." : "Navodilo, kaj naj igralci naredijo po koncu igre."}
          />
        </FieldRow>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label={en ? "City (locked)" : "Mesto (zaklenjeno)"}>
            <input value={lobby.city ?? ""} readOnly disabled style={{ ...consoleInputStyle, opacity: 0.65, cursor: "not-allowed" }} />
          </FieldRow>
          <FieldRow label={en ? "Country (locked)" : "Država (zaklenjeno)"}>
            <input value={lobby.country ?? ""} readOnly disabled style={{ ...consoleInputStyle, opacity: 0.65, cursor: "not-allowed" }} />
          </FieldRow>
        </div>
      </Pane>

      <div style={{ height: 16 }} />

      {/* ── CARD 2: PASSWORDS ───────────────────────────────── */}
      <Pane title={en ? "PASSWORDS" : "GESLA"}>
        <FieldRow label={en ? "Mission password (for players)" : "Geslo misije (za igralce)"}>
          <div style={{ position: "relative" }}>
            <input
              type={showLobbyPw ? "text" : "password"}
              value={lobbyPwInput}
              placeholder={lobbyPwInput ? "" : "••••••••"}
              onChange={(e) => {
                const v = e.target.value;
                setLobbyPwInput(v);
                if (v.trim()) patch({ password: v });
              }}
              style={{ ...consoleInputStyle, paddingRight: 40 }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowLobbyPw((v) => !v)}
              aria-label={showLobbyPw ? (en ? "Hide password" : "Skrij geslo") : (en ? "Show password" : "Prikaži geslo")}
              style={{
                position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)",
                background: "transparent", border: "none", color: MUTED, cursor: "pointer",
                padding: 4, display: "grid", placeItems: "center",
              }}
            >
              {showLobbyPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {!lobbyPwInput && (
            <p style={{ fontSize: 10, color: MUTED, marginTop: 4, fontFamily: "monospace", letterSpacing: "0.08em" }}>
              // {en ? "Password stored securely — type a new value to change it." : "Geslo je varno shranjeno — vpiši novo vrednost za spremembo."}
            </p>
          )}
        </FieldRow>
        <FieldRow label={en ? "Marshal password (for organizers to access this mission control center)" : "Geslo maršala (za organizatorje – dostop do komandnega centra misije)"}>
          <div style={{ position: "relative" }}>
            <input
              type={showMarshalPw ? "text" : "password"}
              value={marshalPwInput}
              placeholder={marshalPwInput ? "" : "••••••••"}
              onChange={(e) => {
                const v = e.target.value;
                setMarshalPwInput(v);
                if (v.trim()) patch({ marshalPassword: v });
              }}
              style={{ ...consoleInputStyle, paddingRight: 40 }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowMarshalPw((v) => !v)}
              aria-label={showMarshalPw ? (en ? "Hide password" : "Skrij geslo") : (en ? "Show password" : "Prikaži geslo")}
              style={{
                position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)",
                background: "transparent", border: "none", color: MUTED, cursor: "pointer",
                padding: 4, display: "grid", placeItems: "center",
              }}
            >
              {showMarshalPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {!marshalPwInput && (
            <p style={{ fontSize: 10, color: MUTED, marginTop: 4, fontFamily: "monospace", letterSpacing: "0.08em" }}>
              // {en ? "Password stored securely — type a new value to change it." : "Geslo je varno shranjeno — vpiši novo vrednost za spremembo."}
            </p>
          )}
        </FieldRow>
      </Pane>

      <div style={{ height: 16 }} />

      {/* ── STANDALONE SECTION TITLE ────────────────────────── */}
      <div style={{ margin: "8px 0 14px", textAlign: "center" }}>
        <h3 style={{ fontFamily: "'Michroma', monospace", fontSize: 18, letterSpacing: "0.22em", color: ACCENT, textTransform: "uppercase", fontWeight: 700 }}>
          {en ? "GAMEMODE AND PARAMETERS" : "IGRALNI NAČIN IN PARAMETRI"}
        </h3>
        <div style={{ height: 1, background: `${ACCENT}30`, marginTop: 10 }} />
      </div>

      {/* ── CARD 3: GAME MODE SELECTION ─────────────────────── */}
      <Pane title={en ? "GAME MODE SELECTION" : "IZBIRA IGRALNEGA NAČINA"}>
        <FieldRow label={en ? "Game mode selection" : "Izbira igralnega načina (Gamemode)"}>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => patch({ gamemode: "domination" })}
              style={{
                background: lobby.gamemode === "domination" ? `${ACCENT}22` : "transparent",
                color: lobby.gamemode === "domination" ? ACCENT : INK,
                border: `1px solid ${lobby.gamemode === "domination" ? ACCENT : "rgba(236,227,196,0.18)"}`,
                padding: "10px 8px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em",
                textTransform: "uppercase", cursor: "pointer", textAlign: "left",
              }}>
              ● Domination<br /><span style={{ fontSize: 9, color: MUTED }}>{en ? "Point capture" : "Zavzemanje točk"}</span>
            </button>
            <button type="button" onClick={() => { if (!isPremium) openPremiumModal(); }}
              style={{
                background: "rgba(255,255,255,0.03)", color: MUTED,
                border: `1px dashed rgba(236,227,196,0.18)`,
                padding: "10px 8px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em",
                textTransform: "uppercase", cursor: "pointer", textAlign: "left", opacity: 0.75,
              }}>
              🔒 Search &amp; Destroy<br /><span style={{ fontSize: 9 }}>{en ? "Coming soon" : "Prihaja kmalu"}</span>
            </button>
          </div>
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label={en ? "Duration (min)" : "Trajanje (min)"}>
            <select value={lobby.matchDurationMinutes} onChange={(e) => patch({ matchDurationMinutes: Number(e.target.value) })} style={consoleSelectStyle}>
              {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label={en ? "Pre-start" : "Pred-štart"}>
            <select value={lobby.countdownSeconds} onChange={(e) => patch({ countdownSeconds: Number(e.target.value) })} style={consoleSelectStyle}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m * 60}>{m} min</option>
              ))}
            </select>
          </FieldRow>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 4, fontFamily: "monospace" }}>
            {en ? "Target points (win when reached)" : "Ciljne točke (zmaga ob doseženem številu)"}
          </div>
          <p style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", lineHeight: 1.55, marginBottom: 8, fontStyle: "italic" }}>
            {en
              ? "Planning note: the system is balanced so a standard game lasts exactly 40 minutes if a team constantly holds the majority (3 of 5 flags)."
              : "Pojasnilo: sistem je uravnotežen tako, da standardna igra traja natanko 40 minut, če ekipa konstantno drži večino (3 od 5 zastavic)."}
          </p>
          <select value={target} onChange={(e) => patch({ pointTarget: Number(e.target.value) })} style={consoleSelectStyle}>
            {Array.from({ length: 30 }, (_, i) => (i + 1) * 10).map((p) => (
              <option key={p} value={p}>{p} {en ? "pts" : "točk"}</option>
            ))}
          </select>
        </div>
      </Pane>

      <div style={{ height: 16 }} />

      {/* ── RESPAWN QR CODES ────────────────────────────────── */}
      <RespawnQrConfig
        settings={lobby.settings ?? { respawn: { ...DEFAULT_RESPAWN }, capturePointsScoring: true }}
        onPatch={(s) => patch({ settings: s })}
        en={en}
      />

      <div style={{ height: 16 }} />

      {/* ── CAPTURE POINTS SCORING ──────────────────────────── */}
      <CaptureScoringConfig
        settings={lobby.settings ?? { respawn: { ...DEFAULT_RESPAWN }, capturePointsScoring: true }}
        onPatch={(s) => patch({ settings: s })}
        en={en}
      />

      <div style={{ height: 16 }} />

      {/* ── SPARTACUS ANTI-CHEAT ────────────────────────────── */}
      <SpartacusConfig
        settings={lobby.settings ?? { respawn: { ...DEFAULT_RESPAWN }, capturePointsScoring: true }}
        onPatch={(s) => patch({ settings: s })}
        en={en}
      />

      <div style={{ height: 16 }} />

      {/* ── TEAMS ───────────────────────────────────────────── */}
      <TeamConfigSection
        settings={lobby.settings ?? {}}
        onPatch={(s) => patch({ settings: s })}
        en={en}
      />

      <div style={{ height: 16 }} />

      {/* ── TACTICAL MAP ────────────────────────────────────── */}
      <Pane title={en ? "TACTICAL MAP" : "TAKTIČNI ZEMLJEVID"}>
        <p style={{ fontSize: 11, color: MUTED, fontFamily: "monospace", lineHeight: 1.55, marginBottom: 12 }}>
          {en ? "Upload the image of your field or playing area." : "Naloži sliko svojega poligona ali igralne površine."}
        </p>
        <FieldRow label={en ? "Tactical map source (file upload or URL)" : "Vir taktičnega zemljevida (datoteka ali URL)"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onMapFile(f);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "transparent", color: ACCENT,
                border: `1px dashed ${ACCENT}`, padding: "12px 14px",
                fontFamily: "'Michroma', monospace", fontSize: 11,
                letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Upload size={14} /> [ {en ? "UPLOAD IMAGE FROM DEVICE" : "NALOŽI SLIKO Z NAPRAVE"} ]
            </button>
            <input
              value={(lobby.mapUrl ?? "").startsWith("data:") ? "" : (lobby.mapUrl ?? "")}
              onChange={(e) => patch({ mapUrl: e.target.value })}
              style={consoleInputStyle}
              placeholder="https://.../map.webp"
            />
            {lobby.mapUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, border: `1px solid ${ACCENT}33`, background: "rgba(224,176,78,0.04)" }}>
                <img
                  src={lobby.mapUrl}
                  alt="Map preview"
                  style={{ width: 72, height: 54, objectFit: "cover", border: `1px solid ${ACCENT}55` }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase", marginBottom: 2 }}>
                    // {en ? "MAP READY" : "ZEMLJEVID PRIPRAVLJEN"}
                  </p>
                  <p style={{ fontSize: 11, color: MUTED, wordBreak: "break-all", lineHeight: 1.4 }}>
                    {lobby.mapUrl.startsWith("data:") ? (en ? "Uploaded from device" : "Naloženo z naprave") : lobby.mapUrl}
                  </p>
                </div>
                <button type="button" onClick={() => patch({ mapUrl: "" })}
                  aria-label="Clear map"
                  style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer" }}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </FieldRow>
      </Pane>

      <div style={{ height: 16 }} />

      {/* ── CREATE YOUR MAP ─────────────────────────────────── */}
      <Pane title={en ? "CREATE YOUR MAP" : "SESTAVI ZEMLJEVID"}>
        <NodePlacer
          mapUrl={lobby.mapUrl || null}
          positions={lobby.nodePositions ?? {}}
          onChange={(p) => patch({ nodePositions: p })}
          en={en}
        />
      </Pane>

      {lobby.startedAt && (
        <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 10, color: MUTED, letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center" }}>
          // {en ? "STARTED AT" : "ZAČETEK"}: <span style={{ color: INK }}>{new Date(lobby.startedAt).toLocaleTimeString()}</span>
        </p>
      )}




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

      <div style={{ marginTop: 18, textAlign: "center" }}>
        <Link to="/join"
          style={{
            color: MUTED, textDecoration: "none", fontFamily: "monospace",
            fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase",
            borderBottom: `1px solid ${MUTED}`, paddingBottom: 2,
          }}>
          {en ? "Open Join Page" : "Odpri stran za pridružitev"}
        </Link>
      </div>

      {joinModal && (
        <div role="dialog" aria-modal="true" onClick={() => !joinBusy && setJoinModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", display: "grid", placeItems: "center", padding: 16 }}>
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
                  <span style={{ color: INK, fontWeight: 700, letterSpacing: "0.06em", fontSize: 12.5, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.callsign}
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


function TeamConfigSection({ settings, onPatch, en }: { settings: any; onPatch: (s: any) => void; en: boolean }) {
  const teamNames = (settings?.teamNames ?? {}) as Record<string, string>;
  const teamCount = Number(settings?.teamCount ?? 2);
  const { isPremium, openPremiumModal } = usePremium();
  const update = (patch: any) => onPatch({ ...settings, ...patch });
  const setName = (key: string, value: string) =>
    onPatch({ ...settings, teamNames: { ...teamNames, [key]: value } });
  return (
    <div style={{ marginTop: 22, padding: 14, border: `1px solid ${ACCENT}44`, background: "rgba(0,0,0,0.25)" }}>
      <div style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase", marginBottom: 4 }}>
        {en ? "TEAMS" : "EKIPE"}
      </div>
      <p style={{ fontSize: 10.5, color: MUTED, fontFamily: "monospace", lineHeight: 1.6, marginBottom: 12 }}>
        {en
          ? "Number of teams and their faction names. Faction names replace the default BLUE/RED labels in the roster and scoreboards."
          : "Število ekip in imena frakcij. Imena zamenjajo privzete oznake MODRA/RDEČA v roster-ju in scoreboardih."}
      </p>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 4, fontFamily: "monospace" }}>
          {en ? "Number of teams" : "Število ekip"}
        </div>
        <select
          value={teamCount > 2 && !isPremium ? 2 : teamCount}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (next > 2 && !isPremium) {
              openPremiumModal();
              return;
            }
            update({ teamCount: next });
          }}
          style={{
            width: "100%", background: "rgba(0,0,0,0.35)", color: INK,
            border: `1px solid ${ACCENT}55`, padding: "10px 12px",
            fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.12em",
          }}
        >
          <option value={2}>2</option>
          <option value={3}>3 — 🔒 {en ? "Premium feature" : "Premium funkcija"}</option>
          <option value={4}>4 — 🔒 {en ? "Premium feature" : "Premium funkcija"}</option>
          <option value={5}>5 — 🔒 {en ? "Premium feature" : "Premium funkcija"}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 4, fontFamily: "monospace" }}>
            {en ? "Blue faction name" : "Ime modre ekipe"}
          </div>
          <input
            value={teamNames.modra ?? ""}
            onChange={(e) => setName("modra", e.target.value)}
            maxLength={24}
            placeholder={en ? "e.g. Lions" : "npr. Levi"}
            style={{ width: "100%", background: "rgba(0,0,0,0.35)", color: INK, border: `1px solid #3b82f655`, padding: "10px 12px", fontFamily: "monospace", fontSize: 13 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ef4444", marginBottom: 4, fontFamily: "monospace" }}>
            {en ? "Red faction name" : "Ime rdeče ekipe"}
          </div>
          <input
            value={teamNames.rdeca ?? ""}
            onChange={(e) => setName("rdeca", e.target.value)}
            maxLength={24}
            placeholder={en ? "e.g. Spartans" : "npr. Spartanci"}
            style={{ width: "100%", background: "rgba(0,0,0,0.35)", color: INK, border: `1px solid #ef444455`, padding: "10px 12px", fontFamily: "monospace", fontSize: 13 }}
          />
        </div>
      </div>
    </div>
  );
}
