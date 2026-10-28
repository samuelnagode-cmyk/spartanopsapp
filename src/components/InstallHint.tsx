import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import { ACTIVE_SESSION_EVENT } from "@/lib/active-session";
import {
  getVisitStart,
  hasActiveGameSession,
  isHintSuppressed,
  isInstallHintRoute,
  readInstallHint,
  useInstallState,
  VISIT_MIN_MS,
  writeInstallHint,
  type InstallPlatform,
} from "@/lib/install-prompt";

/**
 * Soft, dismissible "add to home screen" reminder for new mobile visitors.
 * Appears late (20 s into the session), only on a few public pages, never
 * during a game, and goes away for 30 days (or for good once installed).
 */

const PANEL = "#13160f";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.65)";
const ACCENT = "#E0B04E";

export const OPEN_INSTALL_HELP_EVENT = "spartanops:open-install-help";

type SheetProps = {
  en: boolean;
  platform: InstallPlatform;
  canPromptNatively: boolean;
  onNativeInstall?: () => void;
  onClose: () => void;
  /** Render inline (absolute) instead of fixed — used by the dev preview. */
  fixed?: boolean;
  autoFocus?: boolean;
};

/** Instruction sheet: how to add the app to the home screen, per platform. */
export function InstallSheet({ en, platform, canPromptNatively, onNativeInstall, onClose, fixed = true, autoFocus = true }: SheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<Element | null>(null);
  const id = useRef(`install-help-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    prevFocus.current = document.activeElement;
    if (autoFocus) closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const prev = prevFocus.current as HTMLElement | null;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [autoFocus, onClose]);

  const step: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.55, color: INK };
  const listWrap: React.CSSProperties = { margin: 0, paddingLeft: 22, display: "grid", gap: 8 };

  let body: React.ReactNode;
  if (platform === "inapp") {
    body = (
      <p style={{ ...step, color: MUTED }}>
        {en
          ? "Open this page in Chrome or Safari (the ⋯ menu, then \"Open in browser\") so you can add it to your home screen."
          : "Odpri to stran v Chromu ali Safariju (meni ⋯, nato »Odpri v brskalniku«), da jo lahko dodaš na začetni zaslon."}
      </p>
    );
  } else if (platform === "ios") {
    body = (
      <>
        <ol style={listWrap}>
          <li style={step}>{en ? "Open this page in Safari." : "Odpri to stran v Safariju."}</li>
          <li style={step}>{en ? "Tap the Share button (the square with an arrow up) in the bottom bar." : "Tapni gumb Deli (kvadrat s puščico navzgor) v spodnji vrstici."}</li>
          <li style={step}>{en ? "Choose \"Add to Home Screen\" and confirm with \"Add\"." : "Izberi »Dodaj na začetni zaslon« in potrdi z »Dodaj«."}</li>
        </ol>
        <p style={{ ...step, color: MUTED, marginTop: 14 }}>
          {en
          ? "On iPhone, the installed app may have separate sign-in storage. If asked, join your field once in the installed app."
            : "Na iPhonu ima nameščena aplikacija lahko ločeno prijavo. Če te vpraša, v nameščeni aplikaciji enkrat znova vstopi na poligon."}
        </p>
      </>
    );
  } else {
    // android (and anything else that can reach the sheet)
    body = (
      <>
        {canPromptNatively && onNativeInstall ? (
          <button
            type="button"
            onClick={onNativeInstall}
            style={{
              width: "100%", minHeight: 52, background: ACCENT, color: "#0b0d09", border: "none",
              fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.14em",
              fontWeight: 700, cursor: "pointer", padding: "0 12px", marginBottom: 14,
            }}
          >
            {en ? "INSTALL" : "NAMESTI"}
          </button>
        ) : (
          <ol style={listWrap}>
            <li style={step}>{en ? "Tap the ⋮ menu in Chrome." : "Tapni meni ⋮ v Chromu."}</li>
            <li style={step}>{en ? "Choose \"Install app\" (or \"Add to Home screen\")." : "Izberi »Namesti aplikacijo« (ali »Dodaj na začetni zaslon«)."}</li>
            <li style={step}>{en ? "Confirm with \"Install\"." : "Potrdi z »Namesti«."}</li>
          </ol>
        )}
        <p style={{ ...step, color: MUTED, marginTop: 14 }}>
          {en ? "Install it before the game, not during one." : "Namesti jo pred igro, ne med igro."}
        </p>
      </>
    );
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: fixed ? "fixed" : "absolute", inset: 0, zIndex: fixed ? 1150 : undefined,
        background: "rgba(0,0,0,0.85)",
        display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        style={{
          background: PANEL,
          border: `1px solid ${ACCENT}`,
          borderLeft: `3px solid ${ACCENT}`,
          maxWidth: 420, width: "100%", boxSizing: "border-box",
          padding: 20, color: INK,
        }}
      >
        <h2
          id={`${id}-title`}
          style={{ fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.14em", color: ACCENT, fontWeight: 700, margin: 0, marginBottom: 14, textTransform: "uppercase", lineHeight: 1.4 }}
        >
          {en ? "The app on your phone" : "Aplikacija na telefonu"}
        </h2>
        {body}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          style={{
            width: "100%", minHeight: 44, marginTop: 18, background: "transparent",
            border: `1px solid ${ACCENT}66`, color: INK, fontSize: 14, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {en ? "Close" : "Zapri"}
        </button>
      </div>
    </div>
  );
}

type CardProps = {
  en: boolean;
  canPromptNatively: boolean;
  onPrimary: () => void;
  onDismiss: () => void;
  fixed?: boolean;
};

/** The small reminder card fixed at the bottom of the screen. */
export function InstallHintCard({ en, canPromptNatively, onPrimary, onDismiss, fixed = true }: CardProps) {
  const title = en ? "The app on your phone" : "Aplikacija na telefonu";
  return (
    <div
      role="region"
      aria-label={title}
      data-install-hint=""
      style={{
        position: fixed ? "fixed" : "absolute",
        left: 12, right: 12,
        bottom: "max(12px, env(safe-area-inset-bottom))",
        maxWidth: 420,
        margin: "0 auto",
        zIndex: fixed ? 900 : undefined,
        background: PANEL,
        border: `1px solid ${ACCENT}`,
        borderLeft: `3px solid ${ACCENT}`,
        padding: 14,
        animation: "install-hint-in 150ms ease-out",
      }}
    >
      <style>{`@keyframes install-hint-in{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion: reduce){[data-install-hint]{animation:none !important}}`}</style>
      <p style={{ margin: 0, marginBottom: 6, fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.14em", color: ACCENT, fontWeight: 700, textTransform: "uppercase" }}>
        {title}
      </p>
      <p style={{ margin: 0, marginBottom: 12, fontSize: 14, lineHeight: 1.55, color: MUTED }}>
        {en
          ? "Install SpartanOps for quick access during the game"
          : "Namesti SpartanOps za hiter dostop med igro"}
      </p>
      <div style={{ display: "grid", gap: 6 }}>
        <button
          type="button"
          onClick={onPrimary}
          style={{
            width: "100%", minHeight: 44, background: ACCENT, color: "#0b0d09", border: "none",
            fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.14em",
            fontWeight: 700, cursor: "pointer", padding: "0 12px",
          }}
        >
          {canPromptNatively ? (en ? "INSTALL" : "NAMESTI") : (en ? "SHOW ME HOW" : "POKAŽI KAKO")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            width: "100%", minHeight: 44, background: "transparent", border: "none",
            color: MUTED, fontSize: 14, cursor: "pointer",
          }}
        >
          {en ? "Not now" : "Ne zdaj"}
        </button>
      </div>
    </div>
  );
}

/**
 * Smart wrapper: decides when (and whether) the reminder card appears, opens
 * the instruction sheet, and listens for the footer's help event.
 */
export default function InstallHint() {
  const { pathname } = useLocation();
  const { lang } = useLang();
  const en = lang === "en";
  const [installedFlash, setInstalledFlash] = useState(false);
  const onInstalled = useCallback(() => {
    setInstalledFlash(true);
    setSheetOpen(false);
    setCardVisible(false);
  }, []);
  const { platform, standalone, canPromptNatively, installed, promptInstall } = useInstallState(onInstalled);

  const [cardVisible, setCardVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const shownThisLoad = useRef(false);
  const [sessionRevision, setSessionRevision] = useState(0);

  useEffect(() => {
    const changed = () => setSessionRevision((n) => n + 1);
    window.addEventListener(ACTIVE_SESSION_EVENT, changed);
    return () => window.removeEventListener(ACTIVE_SESSION_EVENT, changed);
  }, []);

  // Decide once per page load, after the 20 s session mark.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (shownThisLoad.current) return;
    if (platform === "other" || standalone || installed) return;
    if (!isInstallHintRoute(pathname)) return;
    if (isHintSuppressed(readInstallHint(), Date.now())) return;
    if (!hasActiveGameSession()) return;

    const wait = Math.max(0, getVisitStart() + VISIT_MIN_MS - Date.now());
    const timer = window.setTimeout(() => {
      if (shownThisLoad.current) return;
      // Re-check the volatile conditions at show time.
      if (isHintSuppressed(readInstallHint(), Date.now())) return;
      if (!hasActiveGameSession()) return;
      shownThisLoad.current = true;
      writeInstallHint({ shown: true });
      setCardVisible(true);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [pathname, platform, standalone, installed, sessionRevision]);

  // Footer help event reopens the sheet on demand.
  useEffect(() => {
    const open = () => setSheetOpen(true);
    window.addEventListener(OPEN_INSTALL_HELP_EVENT, open);
    return () => window.removeEventListener(OPEN_INSTALL_HELP_EVENT, open);
  }, []);

  if (installedFlash) return null;

  const dismiss = () => {
    writeInstallHint({ dismissedAt: Date.now() });
    setCardVisible(false);
  };
  const primary = () => {
    if (canPromptNatively) {
      void promptInstall();
      return;
    }
    setCardVisible(false);
    setSheetOpen(true);
  };
  const closeSheet = () => setSheetOpen(false);

  return (
    <>
      {cardVisible && (
        <InstallHintCard en={en} canPromptNatively={canPromptNatively} onPrimary={primary} onDismiss={dismiss} />
      )}
      {sheetOpen && (
        <InstallSheet
          en={en}
          platform={platform}
          canPromptNatively={canPromptNatively}
          onNativeInstall={() => void promptInstall()}
          onClose={closeSheet}
        />
      )}
    </>
  );
}
