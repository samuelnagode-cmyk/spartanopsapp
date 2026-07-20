import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useLang } from "@/lib/i18n";

const OK_KEY = "spartanops:gps_authorized";
const DISMISS_KEY = "spartanops:gps_denied_dismiss_at";

type Perm = "granted" | "denied" | "prompt" | "unknown";

async function readPermission(): Promise<Perm> {
  if (typeof navigator === "undefined" || !("permissions" in navigator) || !navigator.geolocation) return "unknown";
  try {
    const r = await (navigator as any).permissions.query({ name: "geolocation" });
    return (r?.state as Perm) ?? "unknown";
  } catch { return "unknown"; }
}

/**
 * GPS satellite-link gate for the Player HUD (/misija).
 * - Shows a tactical modal on first entry if permission is 'prompt' or unknown.
 * - Shows a warning banner if the user has denied location access.
 * Silent once the browser reports 'granted'.
 */
export default function SpartacusGpsGate() {
  const { pathname } = useLocation();
  const { lang } = useLang();
  const en = lang === "en";
  const active = pathname.startsWith("/misija");
  const [perm, setPerm] = useState<Perm>("unknown");
  const [dismissedBanner, setDismissedBanner] = useState(false);

  useEffect(() => {
    if (!active) return;
    let live = true;
    (async () => {
      const p = await readPermission();
      if (live) setPerm(p);
    })();
    const onFocus = async () => {
      const p = await readPermission();
      if (live) setPerm(p);
    };
    window.addEventListener("focus", onFocus);
    return () => { live = false; window.removeEventListener("focus", onFocus); };
  }, [active, pathname]);

  const authorize = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => { try { localStorage.setItem(OK_KEY, "1"); } catch {} setPerm("granted"); },
      () => setPerm("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  if (!active) return null;

  // Auto-modal removed — GPS activation is inline inside the Player HUD via
  // the <TelemetryStatusStrip /> component. This gate now only surfaces a
  // subtle warning banner if the user has explicitly denied permission.
  void authorize;
  const showDeniedBanner = perm === "denied" && !dismissedBanner;

  return (
    <>
      {showDeniedBanner && (
        <div
          style={{
            position: "fixed", top: 68, left: 12, right: 12, zIndex: 180,
            maxWidth: 720, margin: "0 auto",
            background: "rgba(30,10,10,0.95)",
            border: "1.5px solid #ff3b3b",
            padding: "12px 14px",
            color: "#ffd6d6",
            fontFamily: "monospace",
            fontSize: 12, lineHeight: 1.6,
            display: "flex", alignItems: "flex-start", gap: 10,
            boxShadow: "0 12px 24px -8px rgba(0,0,0,0.7)",
          }}
        >
          <AlertTriangle size={16} style={{ color: "#ff3b3b", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.22em", color: "#ff3b3b", textTransform: "uppercase", margin: 0, marginBottom: 4, fontWeight: 700 }}>
              ⚠ {en ? "GPS OFFLINE" : "GPS POVEZAVA PREKINJENA"}
            </p>
            <p style={{ margin: 0 }}>
              {en
                ? "You will not be able to capture objectives or appear on the team map until GPS is enabled in your browser settings."
                : "Dokler v nastavitvah brskalnika ne odobriš dostopa do lokacije, ne moreš zavzemati točk ali se prikazati na zemljevidu ekipe."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { try { sessionStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {} setDismissedBanner(true); }}
            aria-label={en ? "Dismiss" : "Zapri"}
            style={{ background: "transparent", border: "none", color: "#ffd6d6", cursor: "pointer", padding: 4, fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
