import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

const ACTIVE_SESSION_KEY = "spartanops.active_session";
const DISMISS_KEY = "spartanops:mip_dismissed_at";

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

/**
 * Global "Mission in Progress" recovery modal.
 * If the browser has an active-session lobby stored and that lobby's
 * game_state is 'active', prompt the player to return to their HUD.
 * Suppressed while on /misija or /capture.
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
    pathname.startsWith("/admin-pregled");

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
  const goToHud = () => {
    setShow(false);
    navigate({ to: "/misija", search: { field: lobbyId } });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <div
        style={{
          background: "#13160f",
          border: "1.5px solid #E0B04E",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.8), 0 0 40px -8px rgba(224,176,78,0.35)",
          maxWidth: 460, width: "100%",
          padding: 22, position: "relative",
          color: "#ece3c4",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={en ? "Close" : "Zapri"}
          style={{
            position: "absolute", top: 10, right: 10,
            background: "transparent", border: "none",
            color: "rgba(236,227,196,0.55)", cursor: "pointer",
            padding: 6, display: "grid", placeItems: "center",
          }}
        >
          <X size={18} />
        </button>
        <p
          style={{
            fontFamily: "'Michroma', monospace", fontSize: 10,
            letterSpacing: "0.28em", color: "#E0B04E", textTransform: "uppercase", marginBottom: 8,
          }}
        >
          // {en ? "MISSION IN PROGRESS" : "MISIJA V TEKU"}
        </p>
        <h2
          style={{
            fontFamily: "'Michroma', monospace", fontSize: 17,
            letterSpacing: "0.14em", color: "#E0B04E", textTransform: "uppercase",
            fontWeight: 700, marginBottom: 12,
          }}
        >
          {en ? "Mission in Progress" : "Misija v teku"}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(236,227,196,0.85)", marginBottom: 22 }}>
          {en
            ? "You are currently registered in an active mission. Would you like to return to your Player HUD?"
            : "Trenutno si prijavljen v aktivno misijo. Se želiš vrniti na svoj nadzorni meni (Player HUD)?"}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={goToHud}
            style={{
              flex: 1, minWidth: 180,
              background: "#E0B04E22", color: "#E0B04E",
              border: "1px solid #E0B04E", padding: "12px 14px",
              fontFamily: "'Michroma', monospace", fontSize: 11,
              letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700,
            }}
          >
            [ {en ? "RETURN TO HUD" : "NAZAJ NA HUD"} ]
          </button>
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: "transparent", color: "rgba(236,227,196,0.7)",
              border: "1px solid rgba(236,227,196,0.25)", padding: "12px 14px",
              fontFamily: "'Michroma', monospace", fontSize: 11,
              letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            {en ? "Stay here" : "Ostani tukaj"}
          </button>
        </div>
      </div>
    </div>
  );
}
