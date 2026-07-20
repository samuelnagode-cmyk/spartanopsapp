import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const CREAM = "#FAF6EC";
const BROWN = "#8B7355";
const TEXT = "#3A4A3D";

const BOOKING_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;overflow-y:auto;}</style></head><body><script src="https://www.bentral.com/service/embed/booking.js?id=5f546b7a4d775f4e&width=full&poweredby=0&lang=sl&key=dd51ba089066a9b71bef6341a38a2161"></script></body></html>`;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function BentralBookingModal({ isOpen, onClose }: Props) {
  const [hasOpened, setHasOpened] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setHasOpened(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bentral-booking-modal-title"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, animation: "rezFade .25s ease",
      }}
    >
      <style>{`
        @keyframes rezFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes rezScale { from { opacity: 0; transform: scale(.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bentral-modal-container"
        style={{
          width: "95%", maxWidth: 720,
          background: CREAM, borderRadius: 16, padding: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
          animation: "rezScale .25s ease",
          display: "flex", flexDirection: "column",
          maxHeight: "95vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid rgba(139,115,85,0.2)", paddingBottom: 16, marginBottom: 16, position: "sticky", top: 0, background: CREAM, zIndex: 2 }}>
          <h2 id="bentral-booking-modal-title" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 500, color: TEXT, margin: 0 }}>
            Rezervacija — Glamping Zeleni raj
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Zapri"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: BROWN, padding: 4, display: "flex" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={(e) => (e.currentTarget.style.color = BROWN)}
          >
            <X size={24} />
          </button>
        </div>
        <div className="bentral-iframe-wrap" style={{ overflow: "visible" }}>
          {hasOpened && (
            <iframe
              srcDoc={BOOKING_HTML}
              scrolling="yes"
              className="bentral-iframe"
              title="Rezervacija — Glamping Zeleni raj"
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                height: "800px",
                border: "none",
              }}
            />
          )}
        </div>
        <style>{`
          .bentral-modal-container,
          .bentral-iframe-wrap {
            overflow: visible !important;
          }
          .bentral-iframe {
            display: block !important;
            width: 100% !important;
            height: 800px !important;
            min-height: 800px !important;
            border: none !important;
            overflow-y: scroll !important;
            -webkit-overflow-scrolling: touch !important;
          }
        `}</style>
      </div>
    </div>
  );
}
