import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock, MapPin, X, Radio } from "lucide-react";
import { dtoToRecord, SYSTEM_FIELD, type LobbyRecord } from "./admin-pregled";
import { listPublishedLobbies, verifyLobbyPassword } from "@/lib/spartanops-lobbies.functions";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join Operation — SpartanOps" },
      { name: "description", content: "Universal SpartanOps join point. Select an active lobby and deploy." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    lobby: typeof s.lobby === "string" ? s.lobby : undefined,
    field_id: typeof s.field_id === "string" ? s.field_id : undefined,
  }),
  component: JoinPage,
});


const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";

const SESSION_KEY = "spartanops.active_session";


type ActiveSession = { lobbyId: string; authenticated: boolean; at: number };

function loadActiveSession(): ActiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ActiveSession;
    return s && s.authenticated && s.lobbyId ? s : null;
  } catch {
    return null;
  }
}

function saveActiveSession(s: ActiveSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function JoinPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const directLobbyId = search.lobby || search.field_id;
  const [lobbies, setLobbies] = useState<LobbyRecord[]>([]);
  const [selected, setSelected] = useState<LobbyRecord | null>(null);
  const [checking, setChecking] = useState(true);
  const listFn = useServerFn(listPublishedLobbies);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const dtos = await listFn();
        if (!alive) return;
        const records = dtos
          .map(dtoToRecord)
          .filter((l) => l.id !== SYSTEM_FIELD.id)
          .sort((a, b) => b.createdAt - a.createdAt);
        setLobbies(records);
        return records;
      } catch (e) {
        console.error("[join] failed to load lobbies", e);
        if (alive) setLobbies([]);
        return [];
      }
    };

    (async () => {
      const s = loadActiveSession();
      const list = (await refresh()) ?? [];
      if (!alive) return;
      // Direct-join via QR: /join?lobby=<id> bypasses lobby search + password
      if (directLobbyId && list.some((l) => l.id === directLobbyId)) {
        saveActiveSession({ lobbyId: directLobbyId, authenticated: true, at: Date.now() });
        navigate({ to: "/misija", search: { field: directLobbyId } as any, replace: true });
        return;
      }
      if (s && list.some((l) => l.id === s.lobbyId)) {
        navigate({ to: "/misija", search: { field: s.lobbyId } as any, replace: true });
        return;
      }
      setChecking(false);
    })();

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; window.removeEventListener("focus", onFocus); };
  }, [navigate, listFn, directLobbyId]);


  const activeCount = useMemo(() => lobbies.length, [lobbies]);

  if (checking) {
    return (
      <div style={{ background: BG, color: MUTED, minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase" }}>
          // ESTABLISHING UPLINK...
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", padding: "32px 16px 80px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <button
            onClick={() => navigate({ to: "/spartanops" })}
            style={{ background: "transparent", border: "none", color: MUTED, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={12} /> Home
          </button>
          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Radio size={11} /> UNIVERSAL JOIN
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.30em", color: ACCENT, marginBottom: 10, textTransform: "uppercase" }}>
            // NETWORK ROSTER
          </p>
          <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(20px, 4.4vw, 28px)", letterSpacing: "0.14em", color: INK, textTransform: "uppercase" }}>
            Select Active Mission
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
            Scan complete: there are currently {activeCount} deployed {activeCount === 1 ? "mission" : "missions"} on the tactical grid. Enter the mission password to proceed to check-in.
          </p>
        </div>

        {lobbies.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", border: `1px dashed rgba(236,227,196,0.15)`, color: MUTED }}>
            <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.20em", color: ACCENT, marginBottom: 8, textTransform: "uppercase" }}>
              // NO ACTIVE OPERATIONS
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              The network is quiet. Wait for the marshal to initialize a lobby.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {lobbies.map((l) => (
              <LobbyCard key={l.id} lobby={l} isSystem={l.id === SYSTEM_FIELD.id} onJoin={() => setSelected(l)} />
            ))}
          </div>
        )}

        <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
          <button
            onClick={() => navigate({ to: "/archive" })}
            style={{
              background: "transparent", color: ACCENT,
              border: `1px solid ${ACCENT}55`,
              padding: "12px 22px", fontFamily: "'Michroma', monospace",
              fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
            }}
          >
            View Operation Archives →
          </button>
        </div>
      </div>

      {selected && (
        <JoinPrompt
          lobby={selected}
          onClose={() => {
            setSelected(null);
            // Ensure a cancelled / failed password entry does not leave any
            // stale session behind — next visit must re-select and re-enter.
            try {
              localStorage.removeItem(SESSION_KEY);
            } catch { /* ignore */ }
            if (search.lobby || search.field_id) {
              navigate({ to: "/join", search: {} as any, replace: true });
            }
          }}
          onSuccess={() => {
            saveActiveSession({ lobbyId: selected.id, authenticated: true, at: Date.now() });
            navigate({ to: "/misija", search: { field: selected.id } as any });
          }}
        />
      )}

    </div>
  );
}

function LobbyCard({ lobby, isSystem, onJoin }: { lobby: LobbyRecord; isSystem: boolean; onJoin: () => void }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(224,176,78,0.05) 0%, rgba(0,0,0,0) 60%), " + PANEL,
      border: `1px solid ${ACCENT}40`, padding: "18px 20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.14em", color: ACCENT, textTransform: "uppercase" }}>
          {lobby.fieldName}
        </p>
        <span style={{
          fontFamily: "monospace", fontSize: 10, letterSpacing: "0.20em",
          color: "#9eff3d", textTransform: "uppercase",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#9eff3d", boxShadow: "0 0 8px #9eff3d", animation: "join-pulse 1.6s infinite" }} />
          Active {isSystem ? "· System" : ""}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: "rgba(236,227,196,0.85)", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <MapPin size={12} style={{ opacity: 0.7 }} /> {lobby.location}
      </p>
      <button
        onClick={onJoin}
        style={{
          width: "100%", background: ACCENT, color: "#0b0d09",
          border: "none", padding: "12px", fontFamily: "'Michroma', monospace",
          fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
        }}
      >
        [ DEPLOY TO {lobby.fieldName.split(" ")[0]} ]
      </button>
      <style>{`@keyframes join-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
}

function JoinPrompt({ lobby, onClose, onSuccess }: { lobby: LobbyRecord; onClose: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyFn = useServerFn(verifyLobbyPassword);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const { ok } = await verifyFn({ data: { id: lobby.id, password, kind: "player" } });
      if (ok) onSuccess();
      else setErr("Access denied — wrong lobby password.");
    } catch (e: any) {
      setErr(e?.message ?? "Authentication failed.");
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
          <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase" }}>// PASSWORD CHALLENGE</p>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ margin: "0 auto 16px", width: 48, height: 48, background: `${ACCENT}14`, border: `1px solid ${ACCENT}`, display: "grid", placeItems: "center", color: ACCENT }}>
          <Lock size={20} />
        </div>
        <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.18em", color: INK, textAlign: "center", marginBottom: 6, textTransform: "uppercase" }}>
          {lobby.fieldName}
        </h2>
        <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginBottom: 18 }}>
          Enter the marshal's field password to proceed to check-in.
        </p>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus placeholder="••••••••"
          style={{ width: "100%", background: BG, color: INK, border: "1px solid rgba(236,227,196,0.20)", padding: "12px 14px", fontSize: 14, marginBottom: 12, textAlign: "center", letterSpacing: "0.2em" }}
        />
        {err && <p style={{ color: "#d97a6c", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
        <button type="submit" style={{ width: "100%", padding: "12px", background: ACCENT, color: "#0b0d09", border: "none", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
          Authenticate & Proceed
        </button>
      </form>
    </div>
  );
}
