import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

/** Full-screen field outline viewer: contain-fit, pinch/zoom/pan, Esc/backdrop close, focus returns to the opener. */
export function FieldMapViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab") { e.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={name}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "max(10px, env(safe-area-inset-top)) 12px 10px" }}>
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.12em", color: "#ece3c4", textTransform: "uppercase", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
        <button ref={closeRef} type="button" aria-label="Close" onClick={onClose}
          style={{ width: 44, height: 44, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#13160f", color: "#E0B04E", border: "1px solid #E0B04E", cursor: "pointer" }}>
          <X size={20} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, background: "#050605" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <TransformWrapper minScale={1} maxScale={6} centerOnInit doubleClick={{ mode: "toggle" }}>
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
            <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "contain", userSelect: "none" }} draggable={false} />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>,
    document.body,
  );
}
