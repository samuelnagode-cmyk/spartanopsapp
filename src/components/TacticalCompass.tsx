import { useEffect, useRef, useState } from "react";

/**
 * Tactical compass — Slovenian cardinal letters (S/V/J/Z).
 * Perfectly centered rotating dial with fixed crosshair overlay.
 */
export function TacticalCompass({ size = 96 }: { size?: number }) {
  const [heading, setHeading] = useState(0);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const attachedRef = useRef(false);
  const headingRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const lastAbsoluteRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const normalize = (value: number) => ((value % 360) + 360) % 360;

  const commitHeading = (raw: number, reliable: boolean) => {
    const now = performance.now();
    if (now - lastUpdateRef.current < 110) return;
    const target = normalize(raw);
    const prev = headingRef.current;
    const diff = ((target - prev + 540) % 360) - 180;
    const first = lastUpdateRef.current === 0;
    const next = first ? target : normalize(prev + diff * 0.28);
    if (reliable) lastAbsoluteRef.current = now;
    headingRef.current = next;
    lastUpdateRef.current = now;
    setHeading(next);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const DOE: any = (window as any).DeviceOrientationEvent;
    if (!DOE) { setSupported(false); return; }
    if (typeof DOE.requestPermission === "function") setNeedsPermission(true);
    else attach();
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      attachedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attach = () => {
    if (attachedRef.current || typeof window === "undefined") return;
    const handler = (ev: DeviceOrientationEvent) => {
      const reliable = ev.type === "deviceorientationabsolute" || (ev as any).absolute === true || typeof (ev as any).webkitCompassHeading === "number";
      if (!reliable) return;
      const wc = (ev as any).webkitCompassHeading;
      if (typeof wc === "number" && !isNaN(wc)) commitHeading(wc, true);
      else if (typeof ev.alpha === "number") commitHeading(360 - ev.alpha, reliable);
    };
    window.addEventListener("deviceorientationabsolute" as any, handler as any, true);
    window.addEventListener("deviceorientation", handler, true);
    cleanupRef.current = () => {
      window.removeEventListener("deviceorientationabsolute" as any, handler as any, true);
      window.removeEventListener("deviceorientation", handler, true);
    };
    attachedRef.current = true;
    setEnabled(true);
  };

  const requestPerm = async () => {
    const DOE: any = (window as any).DeviceOrientationEvent;
    try {
      const res = await DOE.requestPermission();
      if (res === "granted") { setNeedsPermission(false); attach(); }
    } catch { /* denied */ }
  };

  const ACCENT = "#E0B04E";
  const rot = -heading;
  const cardinals = [
    { l: "S", a: 0, c: "#ff5a5a" },
    { l: "V", a: 90, c: ACCENT },
    { l: "J", a: 180, c: ACCENT },
    { l: "Z", a: 270, c: ACCENT },
  ];
  const radius = size / 2;
  const labelRadius = radius - size * 0.14;
  const tickOuter = radius - 2;
  const tickInnerLong = radius - 8;
  const tickInnerShort = radius - 5;

  return (
    <div
      style={{
        width: size, height: size, position: "relative",
        borderRadius: "50%", background: "rgba(8,10,7,0.72)",
        backdropFilter: "blur(6px)", border: `1px solid ${ACCENT}88`,
        boxShadow: `0 0 14px rgba(224,176,78,0.35), inset 0 0 12px rgba(0,0,0,0.6)`,
        color: ACCENT, fontFamily: "'Michroma', monospace", userSelect: "none",
        pointerEvents: needsPermission ? "auto" : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}
      title={`Heading: ${Math.round(heading)}°`}
    >
      {/* Rotating dial — absolutely centered */}
      <div
        style={{
          position: "absolute", top: "50%", left: "50%",
          width: size, height: size,
          transform: `translate(-50%,-50%) rotate(${rot}deg)`,
          transition: "transform 180ms ease-out",
        }}
      >
        {/* Dashed inner ring */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: size - 8, height: size - 8,
          transform: "translate(-50%,-50%)",
          borderRadius: "50%", border: `1px dashed ${ACCENT}55`,
        }} />
        {/* Tick marks via SVG for perfect symmetry */}
        <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, display: "block" }}>
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i * 15 * Math.PI) / 180;
            const isMajor = i % 6 === 0;
            const r1 = isMajor ? tickInnerLong : tickInnerShort;
            const x1 = radius + Math.sin(a) * r1;
            const y1 = radius - Math.cos(a) * r1;
            const x2 = radius + Math.sin(a) * tickOuter;
            const y2 = radius - Math.cos(a) * tickOuter;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isMajor ? ACCENT : `${ACCENT}66`} strokeWidth={1} />;
          })}
        </svg>
        {/* Cardinal letters */}
        {cardinals.map((m) => {
          const a = (m.a * Math.PI) / 180;
          const x = radius + Math.sin(a) * labelRadius;
          const y = radius - Math.cos(a) * labelRadius;
          return (
            <div key={m.l}
              style={{
                position: "absolute", left: x, top: y,
                transform: "translate(-50%,-50%)",
                fontSize: size * 0.14, color: m.c, fontWeight: 700,
                letterSpacing: "0.04em", lineHeight: 1,
              }}
            >{m.l}</div>
          );
        })}
      </div>
      {/* Fixed crosshair */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "60%", height: "60%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 1, height: "100%", background: `${ACCENT}88` }} />
        <div style={{ position: "absolute", height: 1, width: "100%", background: `${ACCENT}88` }} />
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
      </div>
      {needsPermission && !enabled && (
        <button type="button" onClick={(e) => { e.stopPropagation(); requestPerm(); }}
          style={{
            position: "absolute", left: "50%", bottom: -22,
            transform: "translateX(-50%)", background: "rgba(11,13,9,0.9)",
            color: ACCENT, border: `1px solid ${ACCENT}`, fontFamily: "monospace",
            fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase",
            padding: "3px 6px", cursor: "pointer", whiteSpace: "nowrap",
          }}>Omogoči senzor</button>
      )}
      {!supported && (
        <div style={{ position: "absolute", left: "50%", bottom: -18, transform: "translateX(-50%)", fontSize: 7, color: ACCENT, fontFamily: "monospace", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>N-LOCK</div>
      )}
    </div>
  );
}
