import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";

/**
 * Banner shown when the browser loses network connectivity. Sits above the
 * fixed header (z-index 1000). The "restored" message auto-dismisses after 1.4 s.
 */
export function OfflineBanner() {
  const { lang } = useLang();
  const en = lang === "en";
  // Always initialize as online for SSR/hydration parity; sync from navigator
  // after mount to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  const [recoveryFlash, setRecoveryFlash] = useState(false);
  const recoveryTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    const clearRecovery = () => {
      if (recoveryTimer.current !== undefined) {
        window.clearTimeout(recoveryTimer.current);
        recoveryTimer.current = undefined;
      }
    };
    const goOff = () => {
      clearRecovery();
      setRecoveryFlash(false);
      setOnline(false);
    };
    const goOn = () => {
      clearRecovery();
      setOnline(true);
      setRecoveryFlash(true);
      recoveryTimer.current = window.setTimeout(() => {
        recoveryTimer.current = undefined;
        setRecoveryFlash(false);
      }, 1400);
    };
    window.addEventListener("offline", goOff);
    window.addEventListener("online", goOn);
    return () => {
      clearRecovery();
      window.removeEventListener("offline", goOff);
      window.removeEventListener("online", goOn);
    };
  }, []);

  if (!mounted) return null;
  if (online && !recoveryFlash) return null;
  const bg = online ? "#1f3a17" : "#3a1717";
  const border = online ? "#9eff3d" : "#ff7070";
  const text = online
    ? (en ? "Connection restored" : "Povezava obnovljena")
    : (en
      ? "No connection. The score is not updating and scanning will not work."
      : "Ni povezave. Rezultat se ne posodablja in skeniranje ne deluje.");

  return (
    <div
      role="status"
      aria-live="polite"
      data-offline-banner=""
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        background: bg,
        borderBottom: `1px solid ${border}`,
        color: "#fff",
        textAlign: "center",
        padding: "8px 14px",
        paddingTop: "max(8px, env(safe-area-inset-top))",
        fontFamily: "monospace",
        fontSize: 12,
        letterSpacing: "0.08em",
        whiteSpace: "normal",
        overflowWrap: "break-word",
        boxShadow: `0 2px 18px ${border}55`,
      }}
    >
      {text}
    </div>
  );
}
