import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

const ACTIVE_SESSION_KEY = "spartanops.active_session";
const DISMISS_KEY = "spartanops:mip_dismissed_at";

const ACCENT = "#E0B04E";
const PANEL = "#13160f";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.65)";

type ActiveSession = { lobbyId: string; authenticated: boolean };

function loadLobbyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ActiveSession;
    return s && s.authenticated && s.lobbyId ? s.lobbyId : null;
  } catch { return null; }
}

/** Backdrop used by the modal and by the /dev-preview entry. */
export function MissionInProgressBackdrop({
  onDismiss, children, fixed = true,
}: { onDismiss: () => void; children: React.ReactNode; fixed?: boolean }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
      style={{
        position: fixed ? "fixed" : "relative", inset: fixed ? 0 : undefined, zIndex: fixed ? 1100 : undefined,
        background: "rgba(0,0,0,0.85)",
        display: "grid", placeItems: "center", padding: 16,
      }}
    >
      {children}
    </div>
  );
}

/** Presentational card for the "mission running" prompt. */
export function MissionInProgressCard({
  en, onReturn, onDismiss, autoFocus = true,
}: { en: boolean; onReturn: () => void; onDismiss: () => void; autoFocus?: boolean }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const id = useRef(`mip-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    if (autoFocus) btnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoFocus, onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-desc`}
      style={{
        background: PANEL,
        border: `1px solid ${ACCENT}`,
        borderLeft: `3px solid ${ACCENT}`,
        maxWidth: 420, width: "100%", boxSizing: "border-box",
        padding: 24, color: INK,
      }}
    >
      <style>{`@keyframes mipPulse{0%,100%{opacity:1}50%{opacity:.3}}.mip-dot{animation:mipPulse 1.4s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.mip-dot{animation:none}}`}</style>
      <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, marginBottom: 10, fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.22em", color: ACCENT, fontWeight: 700 }}>
        <span className="mip-dot" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
        {en ? "MISSION RUNNING" : "MISIJA TEČE"}
      </p>
      <h2 id={`${id}-title`} style={{ fontFamily: "'Michroma', monospace", fontSize: 16, color: INK, fontWeight: 700, margin: 0, marginBottom: 10, lineHeight: 1.35, overflowWrap: "break-word" }}>
        {en ? "Your game is still on" : "Tvoja igra še teče"}
      </h2>
      <p id={`${id}-desc`} style={{ fontSize: 14, lineHeight: 1.6, color: MUTED, margin: 0, marginBottom: 20 }}>
        {en
          ? "You are checked in to a running mission. Jump back in."
          : "Prijavljen si v misijo, ki še teče. Vrni se v igro."}
      </p>
      <button
        ref={btnRef}
        type="button"
        onClick={onReturn}
        style={{
          width: "100%", minHeight: 52, background: ACCENT, color: "#0b0d09", border: "none",
          fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.14em",
          fontWeight: 700, cursor: "pointer", padding: "0 12px",
        }}
      >
        {en ? "BACK TO MISSION" : "NAZAJ V MISIJO"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          width: "100%", minHeight: 44, marginTop: 6, background: "transparent", border: "none",
          color: MUTED, fontSize: 14, cursor: "pointer",
        }}
      >
        {en ? "Not now" : "Ne zdaj"}
      </button>
    </div>
  );
}

/**
 * Global "mission running" recovery modal.
 * If the browser has an active-session lobby stored and that lobby's
 * game_state is 'active', offer the player a way back into the mission.
 * Suppressed on the game screens.
 */
export default function MissionInProgressModal() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { lang } = useLang();
  const en = lang === "en";
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const suppressed =
    pathname.startsWith("/misija") ||
    pathname.startsWith("/capture") ||
    pathname.startsWith("/scan") ||
    pathname.startsWith("/spawn") ||
    pathname.startsWith("/admin-pregled") ||
    pathname.startsWith("/field") ||
    pathname.startsWith("/join");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLobbyId(loadLobbyId());
  }, [pathname]);

  useEffect(() => {
    if (!lobbyId || suppressed) { setShow(false); return; }
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase
        .from("spartanops_game_state")
        .select("status")
        .eq("field_id", lobbyId)
        .maybeSingle();
      if (cancelled) return;
      if ((data as any)?.status === "active") {
        // Session-scoped dismissal window: 5 minutes.
        try {
          const raw = sessionStorage.getItem(DISMISS_KEY);
          if (raw && Date.now() - Number(raw) < 5 * 60 * 1000) return;
        } catch {}
        setShow(true);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [lobbyId, suppressed]);

  if (!show || !lobbyId) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  };
  const goToMission = () => {
    setShow(false);
    navigate({ to: "/misija", search: { field: lobbyId } });
  };

  return (
    <MissionInProgressBackdrop onDismiss={dismiss}>
      <MissionInProgressCard en={en} onReturn={goToMission} onDismiss={dismiss} />
    </MissionInProgressBackdrop>
  );
}
