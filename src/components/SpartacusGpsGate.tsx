import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useLang } from "@/lib/i18n";

const OK_KEY = "spartanops:gps_authorized";
const DISMISS_KEY = "spartanops:gps_denied_dismiss_at";

type Perm = "granted" | "denied" | "prompt" | "unknown";

async function readPermission(): Promise<Perm> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unknown";

  // Standardno preverjanje za Android in Chrome brskalnike
  if ("permissions" in navigator) {
    try {
      const r = await (navigator as any).permissions.query({ name: "geolocation" });
      return (r?.state as Perm) ?? "unknown";
    } catch {
      /* v primeru napake nadaljuj na iOS fallback */
    }
  }

  // iOS (Safari) Fallback: Ker iOS ne podpira permissions.query, opravimo hitro,
  // tiho preverjanje obstoječe lokacije brez težkega spraševanja naprave.
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve("denied");
        } else {
          // Timeouti ali nedostopnost pozicije na iOS pomenijo, da GPS samo rabi zagon
          resolve("prompt");
        }
      },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: Infinity },
    );
  });
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
  const active = pathname.startsWith("/misija") || pathname.startsWith("/capture");
  const [perm, setPerm] = useState<Perm>("unknown");
  const [permChecked, setPermChecked] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [isIOSInApp, setIsIOSInApp] = useState(false);

  useEffect(() => {
    if (!active) return;

    // Zaznavanje vgrajenih (in-app) brskalnikov na iOS IN Androidu.
    // Instagram / Facebook / TikTok / Snapchat webview pogosto blokirajo ali
    // močno degradirajo GPS in kamero — igralca je treba poslati v Safari/Chrome.
    const ua = window.navigator.userAgent;
    const uaLower = ua.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(uaLower);
    const isSafari = /safari/.test(uaLower);
    const knownInApp = /(fban|fbav|fb_iab|instagram|line\/|micromessenger|tiktok|snapchat|twitter|linkedin|pinterest|gsa\/)/i.test(ua);
    const androidWebView = /android/i.test(ua) && /\bwv\b/i.test(ua);
    if ((isIOS && !isSafari) || knownInApp || androidWebView) {
      setIsIOSInApp(true);
    }


    let live = true;
    (async () => {
      const p = await readPermission();
      if (live) {
        setPerm(p);
        setPermChecked(true);
      }
    })();

    const onFocus = async () => {
      const p = await readPermission();
      if (live) setPerm(p);
    };

    window.addEventListener("focus", onFocus);
    return () => {
      live = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [active, pathname]);

  const authorize = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => {
        try {
          localStorage.setItem(OK_KEY, "1");
        } catch {}
        setPerm("granted");
      },
      () => setPerm("denied"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  if (!active) return null;

  void authorize;

  // Pasica se prikaže, če je dostop izrecno zavrnjen ali pa če smo ujeti v iOS In-App kameri
  const showDeniedBanner = permChecked && (perm === "denied" || isIOSInApp) && !dismissedBanner;

  return (
    <>
      {showDeniedBanner && (
        <div
          style={{
            position: "fixed",
            top: "calc(68px + env(safe-area-inset-top, 0px))",
            left: 12,
            right: 12,
            zIndex: 180,
            maxWidth: 720,
            margin: "0 auto",
            background: "rgba(30,10,10,0.95)",
            border: "1.5px solid #ff3b3b",
            padding: "12px 14px",
            color: "#ffd6d6",
            fontFamily: "monospace",
            fontSize: 12,
            lineHeight: 1.6,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            boxShadow: "0 12px 24px -8px rgba(0,0,0,0.7)",
          }}
        >
          <AlertTriangle size={16} style={{ color: "#ff3b3b", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontFamily: "'Michroma', monospace",
                fontSize: 10,
                letterSpacing: "0.22em",
                color: "#ff3b3b",
                textTransform: "uppercase",
                margin: 0,
                marginBottom: 4,
                fontWeight: 700,
              }}
            >
              ⚠ {en ? "GPS LOCK REQUIRED" : "POTREBNA JE GPS POVEZAVA"}
            </p>

            {isIOSInApp ? (
              <p style={{ margin: 0, color: "#ffb3b3" }}>
                {en
                  ? "⚠️ iOS Camera detected. Apple blocks GPS inside the camera scanner. Please tap the SAFARI / COMPASS icon in the bottom right corner to open this in your real browser."
                  : "⚠️ Zaznana kamera iPhona. Apple v načinu kamere blokira GPS. Prosimo, kliknite na ikono SAFARI / KOMPAS desno spodaj, da odprete stran v pravem brskalniku."}
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                {en
                  ? "You will not be able to capture objectives or appear on the team map until GPS is enabled in your browser settings."
                  : "Dokler v nastavitvah brskalnika ne odobriš dostopa do lokacije, ne moreš skenirati točk ali se prikazati na zemljevidu ekipe."}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
              } catch {}
              setDismissedBanner(true);
            }}
            aria-label={en ? "Dismiss" : "Zapri"}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffd6d6",
              cursor: "pointer",
              padding: 4,
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
