import { useEffect, useState } from "react";

/**
 * Subtle tactical banner shown when the browser loses network connectivity.
 * Auto-dismisses ~1.2s after reconnect.
 */
export function OfflineBanner() {
  // Always initialize as online for SSR/hydration parity; sync from navigator
  // after mount to avoid hydration mismatches.
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  const [recoveryFlash, setRecoveryFlash] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    const goOff = () => setOnline(false);
    const goOn = () => {
      setOnline(true);
      setRecoveryFlash(true);
      const t = setTimeout(() => setRecoveryFlash(false), 1400);
      return () => clearTimeout(t);
    };
    window.addEventListener("offline", goOff);
    window.addEventListener("online", goOn);
    return () => {
      window.removeEventListener("offline", goOff);
      window.removeEventListener("online", goOn);
    };
  }, []);

  if (!mounted) return null;
  if (online && !recoveryFlash) return null;
  const bg = online ? "#1f3a17" : "#3a1717";
  const border = online ? "#9eff3d" : "#ff7070";
  const text = online
    ? "✓ POVEZAVA OBNOVLJENA"
    : "⚠ POZOR: PREKINJENA POVEZAVA Z BAZO // POSKUS PONOVNEGA POVEZOVANJA...";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: bg,
        borderBottom: `1px solid ${border}`,
        color: "#fff",
        textAlign: "center",
        padding: "8px 14px",
        fontFamily: "monospace",
        fontSize: 11,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        boxShadow: `0 2px 18px ${border}55`,
      }}
    >
      {text}
    </div>
  );
}
