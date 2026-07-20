import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

/**
 * Premium Access Framework (MVP — local/session validation).
 * Master key is hardcoded per spec; premium state lives only for the current
 * browser session (sessionStorage) so it resets on tab close.
 */
export const PREMIUM_MASTER_KEY = "spartanjenajaci123";
const PREMIUM_STORAGE_KEY = "spartanops:premium";
const CONTACT_EMAIL = "info@spartanopsapp.com";
const REQUEST_SUBJECT = "SpartanOps Premium Access Request";

type PremiumContextValue = {
  isPremium: boolean;
  activatePremium: (key: string) => boolean;
  deactivatePremium: () => void;
  openPremiumModal: () => void;
  closePremiumModal: () => void;
};

const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  activatePremium: () => false,
  deactivatePremium: () => {},
  openPremiumModal: () => {},
  closePremiumModal: () => {},
});

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PREMIUM_STORAGE_KEY) === "1") setIsPremium(true);
    } catch {}
  }, []);

  const activatePremium = useCallback((key: string) => {
    if (key.trim() === PREMIUM_MASTER_KEY) {
      setIsPremium(true);
      try { sessionStorage.setItem(PREMIUM_STORAGE_KEY, "1"); } catch {}
      return true;
    }
    return false;
  }, []);

  const deactivatePremium = useCallback(() => {
    setIsPremium(false);
    try { sessionStorage.removeItem(PREMIUM_STORAGE_KEY); } catch {}
  }, []);

  const openPremiumModal = useCallback(() => setModalOpen(true), []);
  const closePremiumModal = useCallback(() => setModalOpen(false), []);

  return (
    <PremiumContext.Provider
      value={{ isPremium, activatePremium, deactivatePremium, openPremiumModal, closePremiumModal }}
    >
      {children}
      {modalOpen && <PremiumUpgradeModal onClose={closePremiumModal} />}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  return useContext(PremiumContext);
}

function PremiumUpgradeModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(REQUEST_SUBJECT)}`;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460, width: "100%",
          background: "linear-gradient(180deg, #14180f 0%, #0b0d09 100%)",
          border: "1px solid #E0B04E",
          boxShadow: "0 0 40px rgba(224,176,78,0.35), inset 0 0 0 1px rgba(224,176,78,0.08)",
          padding: "28px 24px 22px",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 8, right: 10,
            background: "transparent", border: "none",
            color: "#ece3c4", fontSize: 22, cursor: "pointer", lineHeight: 1,
          }}
        >
          ×
        </button>
        <div
          style={{
            fontFamily: "'Michroma', monospace",
            fontSize: 13,
            letterSpacing: "0.18em",
            color: "#E0B04E",
            textTransform: "uppercase",
            textShadow: "0 0 12px rgba(224,176,78,0.55)",
            marginBottom: 14,
          }}
        >
          {t("premium.modalTitle")}
        </div>
        <p
          style={{
            color: "#ece3c4", fontFamily: "monospace",
            fontSize: 13, lineHeight: 1.6, letterSpacing: "0.02em",
            marginBottom: 22,
          }}
        >
          {t("premium.modalDesc")}
        </p>
        <a
          href={mailto}
          onClick={() => setTimeout(onClose, 100)}
          style={{
            display: "block", textAlign: "center",
            padding: "12px 14px",
            background: "#E0B04E", color: "#0b0d09",
            fontFamily: "'Michroma', monospace",
            fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
            fontWeight: 700, textDecoration: "none",
            boxShadow: "0 0 22px rgba(224,176,78,0.45)",
          }}
        >
          {t("premium.modalBtn")}
        </a>
      </div>
    </div>
  );
}

export function PremiumStatusBadge({ compact = false }: { compact?: boolean }) {
  const { isPremium } = usePremium();
  const t = useT();
  const label = isPremium ? t("premium.statusPremium") : t("premium.statusFree");
  const color = isPremium ? "#E0B04E" : "rgba(180,190,205,0.75)";
  const glow = isPremium ? "0 0 10px rgba(224,176,78,0.55)" : "none";
  return (
    <span
      title={label}
      style={{
        display: "inline-flex", alignItems: "center",
        fontFamily: "'Michroma', monospace",
        fontSize: compact ? 8.5 : 9.5,
        letterSpacing: "0.14em",
        color,
        textShadow: glow,
        border: `1px solid ${isPremium ? "rgba(224,176,78,0.55)" : "rgba(180,190,205,0.28)"}`,
        padding: compact ? "3px 6px" : "4px 8px",
        whiteSpace: "nowrap",
        background: isPremium ? "rgba(224,176,78,0.08)" : "transparent",
      }}
    >
      {label}
    </span>
  );
}
