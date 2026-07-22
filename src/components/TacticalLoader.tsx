import { useEffect, useState } from "react";

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";

const EN_LINES = [
  "// CONNECTING TO TACTICAL SATELLITE...",
  "// SYNCHRONIZING LOBBY DATA...",
  "// CALIBRATING GRID COORDINATES...",
  "// AUTHENTICATING FIELD OPERATIVES...",
  "// STREAMING LIVE TELEMETRY...",
];

const SLO_LINES = [
  "// POVEZOVANJE S TAKTIČNIM SATELITOM...",
  "// SINHRONIZACIJA PODATKOV LOBIJA...",
  "// KALIBRACIJA MREŽNIH KOORDINAT...",
  "// AVTENTIKACIJA OPERATIVCEV...",
  "// PRENOS ŽIVE TELEMETRIJE...",
];

function useLatency() {
  const [ms, setMs] = useState(24);
  useEffect(() => {
    const id = setInterval(() => setMs(18 + Math.floor(Math.random() * 22)), 900);
    return () => clearInterval(id);
  }, []);
  return ms;
}

/**
 * Full-screen tactical "uplink" loader — animated radar, flickering status line,
 * and a live ping indicator. Non-blocking: safe to unmount instantly when data arrives.
 */
export function TacticalUplinkLoader({ en = true, compact = false }: { en?: boolean; compact?: boolean }) {
  const lines = en ? EN_LINES : SLO_LINES;
  const [idx, setIdx] = useState(0);
  const latency = useLatency();

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % lines.length), 1400);
    return () => clearInterval(id);
  }, [lines.length]);

  return (
    <div
      style={{
        background: BG,
        color: INK,
        minHeight: compact ? 260 : "100vh",
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes tl-radar { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes tl-pulse { 0% { transform: scale(0.4); opacity: 0.9; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes tl-flicker { 0%,19%,21%,23%,80%,100% { opacity: 1; } 20%,22%,79% { opacity: 0.55; } }
        @keyframes tl-blink { 50% { opacity: 0.2; } }
        @keyframes tl-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(200%); } }
      `}</style>

      {/* Scanning line */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `linear-gradient(180deg, transparent 0%, ${ACCENT}22 50%, transparent 100%)`,
        height: 120, animation: "tl-scan 3.2s linear infinite",
      }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, zIndex: 1 }}>
        {/* Radar */}
        <div style={{ position: "relative", width: 120, height: 120 }}>
          {[60, 44, 28].map((r, i) => (
            <div key={i} style={{
              position: "absolute", inset: `${60 - r}px`, borderRadius: "50%",
              border: `1px solid ${ACCENT}${i === 0 ? "55" : i === 1 ? "35" : "22"}`,
            }} />
          ))}
          {/* Pulse */}
          <div style={{
            position: "absolute", inset: 40, borderRadius: "50%",
            border: `1px solid ${ACCENT}`, animation: "tl-pulse 1.8s ease-out infinite",
          }} />
          {/* Sweeper */}
          <div style={{
            position: "absolute", inset: 0, animation: "tl-radar 2.2s linear infinite",
          }}>
            <div style={{
              position: "absolute", top: "50%", left: "50%", width: 60, height: 2,
              background: `linear-gradient(90deg, ${ACCENT} 0%, transparent 100%)`,
              transformOrigin: "0 50%",
            }} />
          </div>
          {/* Center dot */}
          <div style={{
            position: "absolute", top: "calc(50% - 3px)", left: "calc(50% - 3px)",
            width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 10px ${ACCENT}`,
          }} />
        </div>

        {/* Flickering status line */}
        <div style={{ minHeight: 20, textAlign: "center" }}>
          <p
            key={idx}
            style={{
              fontFamily: "monospace", fontSize: 12, letterSpacing: "0.24em",
              color: ACCENT, textTransform: "uppercase",
              animation: "tl-flicker 1.4s linear",
            }}
          >
            {lines[idx]}
          </p>
        </div>

        {/* Live ping */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          fontFamily: "monospace", fontSize: 10, letterSpacing: "0.20em",
          color: MUTED, textTransform: "uppercase",
          border: `1px solid ${ACCENT}30`, padding: "6px 12px", background: PANEL,
        }}>
          <span style={{
            display: "inline-block", width: 6, height: 6, borderRadius: "50%",
            background: "#3ddc84", animation: "tl-blink 1.2s ease-in-out infinite",
          }} />
          SIGNAL: OPTIMAL
          <span style={{ color: `${INK}80` }}>|</span>
          LATENCY: {latency}MS
        </div>
      </div>
    </div>
  );
}

/**
 * Non-blocking pulsing skeleton card — outlines mission cards immediately
 * so the grid does not collapse while data streams in.
 */
export function MissionCardSkeleton() {
  return (
    <div
      style={{
        position: "relative",
        background: `linear-gradient(180deg, rgba(224,176,78,0.04) 0%, rgba(0,0,0,0) 60%), ${PANEL}`,
        border: `1px solid ${ACCENT}30`,
        padding: "20px 20px 18px",
        minHeight: 148,
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes tl-skel { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes tl-dim { 0%,100% { opacity: 0.35; } 50% { opacity: 0.7; } }
      `}</style>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `linear-gradient(90deg, transparent 0%, ${ACCENT}12 50%, transparent 100%)`,
        animation: "tl-skel 1.6s linear infinite",
      }} />
      <div style={{ animation: "tl-dim 1.4s ease-in-out infinite" }}>
        <div style={{ height: 10, width: "38%", background: `${ACCENT}30`, marginBottom: 14 }} />
        <div style={{ height: 16, width: "72%", background: `${INK}22`, marginBottom: 10 }} />
        <div style={{ height: 10, width: "54%", background: `${INK}18`, marginBottom: 22 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ height: 8, width: 60, background: `${ACCENT}25` }} />
          <div style={{ height: 8, width: 44, background: `${INK}18` }} />
          <div style={{ height: 8, width: 52, background: `${INK}18` }} />
        </div>
      </div>
    </div>
  );
}

export function MissionCardSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      {Array.from({ length: count }).map((_, i) => <MissionCardSkeleton key={i} />)}
    </div>
  );
}
