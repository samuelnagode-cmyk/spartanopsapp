import { useEffect, useRef, useState } from "react";
import { X, Flashlight, FlashlightOff } from "lucide-react";
import { useT } from "@/lib/i18n";

const ACCENT = "#E0B04E";
const INK = "#ece3c4";

const POINT_NAMES = new Set(["alpha", "bravo", "beta", "charlie", "gamma", "delta", "echo", "epsilon"]);

export type ScanPayload = {
  kind: "capture" | "respawn";
  fieldId: string;
  point: string;
  type: string;
  raw: string;
};

/**
 * Extract a payload from a decoded QR text. Accepts full printed URLs
 * such as `https://spartanopsapp.com/scan?field_id=...&type=domination&point=alpha`
 * (capture points) and `https://spartanopsapp.com/spawn?field=...` (universal
 * respawn code), as well as bare `field_id=...` query strings, or a partially
 * garbled string where only the query params survive. Returns null when the
 * payload is not a valid SpartanOps code.
 */
export function parseScanPayload(raw: string): ScanPayload | null {
  if (!raw || typeof raw !== "string") return null;
  const text = raw.trim();
  let params: URLSearchParams | null = null;
  let path = "";
  try {
    // Tolerate protocol-less strings by falling back to a synthetic origin.
    const url = new URL(text, "https://spartanopsapp.com");
    params = url.searchParams;
    path = url.pathname.toLowerCase();
  } catch {
    // Try to recover raw `?a=b&c=d` or `a=b&c=d` fragments.
    const q = text.includes("?") ? text.slice(text.indexOf("?") + 1) : text;
    path = text.includes("?") ? text.slice(0, text.indexOf("?")).toLowerCase() : "";
    try {
      params = new URLSearchParams(q);
    } catch {
      return null;
    }
  }
  if (!params) return null;
  const fieldId = (params.get("field_id") ?? params.get("field") ?? "").trim();
  const point = (params.get("point") ?? "").trim().toLowerCase();
  const type = (params.get("type") ?? "").trim().toLowerCase();
  if (!fieldId) return null;

  // Universal respawn code: /spawn?field=<id> (no point).
  if (path.includes("/spawn") || (!point && (!type || type === "respawn" || type === "spawn"))) {
    return { kind: "respawn", fieldId, point: "", type: "respawn", raw: text };
  }

  if (!point) return null;
  if (type && type !== "domination") return null;
  if (!POINT_NAMES.has(point) && !/^[1-5]$/.test(point)) return null;
  return { kind: "capture", fieldId, point, type: type || "domination", raw: text };
}


type Props = {
  open: boolean;
  onClose: () => void;
  onDecode: (payload: ScanPayload) => void;
};

/**
 * In-app tactical QR scanner. Uses native BarcodeDetector when available,
 * else falls back to the jsQR canvas decoder. The scanner cleanses the raw
 * decoded text into a validated payload so a poisoned printed URL (or a
 * hand-crafted string) can never bypass validation.
 */
export function QRScanner({ open, onClose, onDecode }: Props) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const decodedRef = useRef(false);
  const [err, setErr] = useState<string>("");
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Keep callbacks in refs so the camera effect only depends on `open`.
  // Otherwise every re-render (torch/err state, new inline props) tore down
  // and re-created the MediaStream, which made the viewport flicker between
  // the camera feed and a black frame.
  const onDecodeRef = useRef(onDecode);
  const tRef = useRef(t);
  useEffect(() => { onDecodeRef.current = onDecode; }, [onDecode]);
  useEffect(() => { tRef.current = t; }, [t]);

  useEffect(() => {
    if (!open) return;
    decodedRef.current = false;
    let cancelled = false;


    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        try {
          const caps = (track as any)?.getCapabilities?.() ?? {};
          if (caps.torch === true) setTorchSupported(true);
        } catch { /* ignore */ }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          try { await videoRef.current.play(); } catch { /* ignore */ }
        }
        beginDecodeLoop();
      } catch {
        setErr(tRef.current("scanner.cameraDenied"));
      }
    }

    async function beginDecodeLoop() {
      const AnyBD = (window as any).BarcodeDetector;
      let detector: any = null;
      if (typeof AnyBD === "function") {
        try {
          const formats = await AnyBD.getSupportedFormats?.();
          if (!formats || formats.includes("qr_code")) {
            detector = new AnyBD({ formats: ["qr_code"] });
          }
        } catch { detector = null; }
      }
      let jsQR: any = null;
      if (!detector) {
        const mod = await import("jsqr");
        jsQR = mod.default ?? mod;
      }

      const tick = async () => {
        if (cancelled || decodedRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes && codes.length > 0) {
              const raw = codes[0].rawValue ?? "";
              handleDecoded(raw);
              return;
            }
          } else if (jsQR) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
                if (code?.data) {
                  handleDecoded(code.data);
                  return;
                }
              }
            }
          }
        } catch { /* frame miss; continue */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    function handleDecoded(raw: string) {
      if (decodedRef.current) return;
      const payload = parseScanPayload(raw);
      if (!payload) {
        // Ignore and keep scanning — some printed codes may be misfired.
        setErr(tRef.current("scanner.invalidCode"));
        setTimeout(() => setErr(""), 1600);
        return;
      }
      decodedRef.current = true;
      stopStream();
      onDecodeRef.current(payload);
    }

    function stopStream() {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((tr) => { try { tr.stop(); } catch { /* ignore */ } });
        streamRef.current = null;
      }
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const s = streamRef.current;
      if (s) s.getTracks().forEach((tr) => { try { tr.stop(); } catch { /* ignore */ } });
      streamRef.current = null;
      decodedRef.current = false;
    };
  }, [open]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] } as any);
      setTorch(next);
    } catch {
      // iOS Safari and some Androids reject torch — silently ignore.
      setTorchSupported(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[300] flex flex-col"
      style={{ background: "rgba(0,0,0,0.90)", backdropFilter: "blur(6px)" }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${ACCENT}44` }}>
        <span style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.22em", color: ACCENT, textTransform: "uppercase" }}>
          {t("scanner.title")}
        </span>
        {torchSupported && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-label={t("scanner.torch")}
            style={{
              background: torch ? ACCENT : "transparent",
              color: torch ? "#0b0d09" : ACCENT,
              border: `1px solid ${ACCENT}`,
              padding: "8px 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontFamily: "'Michroma', monospace",
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {torch ? <FlashlightOff size={14} /> : <Flashlight size={14} />}
            {t("scanner.torch")}
          </button>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          autoPlay
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Tactical crosshair overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            style={{
              width: "min(72vw, 320px)",
              height: "min(72vw, 320px)",
              position: "relative",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            }}
          >
            {/* Corner brackets */}
            {(
              [
                { top: 0, left: 0, borderTop: `3px solid ${ACCENT}`, borderLeft: `3px solid ${ACCENT}` },
                { top: 0, right: 0, borderTop: `3px solid ${ACCENT}`, borderRight: `3px solid ${ACCENT}` },
                { bottom: 0, left: 0, borderBottom: `3px solid ${ACCENT}`, borderLeft: `3px solid ${ACCENT}` },
                { bottom: 0, right: 0, borderBottom: `3px solid ${ACCENT}`, borderRight: `3px solid ${ACCENT}` },
              ] as const
            ).map((s, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  width: 34,
                  height: 34,
                  ...s,
                  filter: `drop-shadow(0 0 6px ${ACCENT})`,
                }}
              />
            ))}
            {/* Scanning sweep */}
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
                boxShadow: `0 0 12px ${ACCENT}`,
                animation: "spops-scanner-sweep 2.2s linear infinite",
              }}
            />
          </div>
        </div>

        <p
          className="absolute left-0 right-0 text-center font-mono uppercase"
          style={{
            bottom: 96,
            color: INK,
            fontSize: 11,
            letterSpacing: "0.22em",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          }}
        >
          {t("scanner.hint")}
        </p>
        {err && (
          <p
            className="absolute left-4 right-4 text-center font-mono"
            style={{ bottom: 132, color: "#ff8a8a", fontSize: 12 }}
          >
            {err}
          </p>
        )}
      </div>

      <div className="flex justify-center py-4" style={{ borderTop: `1px solid ${ACCENT}44` }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: ACCENT,
            color: "#0b0d09",
            border: "none",
            padding: "12px 32px",
            fontFamily: "'Michroma', monospace",
            fontSize: 12,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <X size={14} /> {t("scanner.close")}
        </button>
      </div>

      <style>{`@keyframes spops-scanner-sweep{0%{top:0}50%{top:100%}100%{top:0}}`}</style>
    </div>
  );
}

export default QRScanner;
