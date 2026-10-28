import { useEffect, useState } from "react";

/**
 * "Add to home screen" hint: platform detection, dismissal storage and the
 * beforeinstallprompt capture. No component imports (pure logic + one hook).
 */

export type InstallPlatform = "ios" | "android" | "inapp" | "other";

const INAPP_PATTERN = /instagram|fban|fbav|fb_iab|line\/|snapchat|tiktok|musical_ly/i;

/** Detect the visiting device from a user agent string. */
export function detectPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  if (!ua) return "other";
  // In-app browsers first: their UA also contains iphone/android tokens.
  if (INAPP_PATTERN.test(ua)) return "inapp";
  if (/iphone|ipod|ipad/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  // iPadOS 13+ reports itself as a Mac, but with touch points.
  if (/macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  return "other";
}

/** True when the app is already running installed (standalone). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return true;
  } catch { /* ignore */ }
  return false;
}

// ============= Dismissal storage =============

const HINT_KEY = "spartanops:install_hint";
export type InstallHintStore = { dismissedAt?: number; installed?: boolean; shown?: boolean };

export function readInstallHint(): InstallHintStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HINT_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as InstallHintStore;
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

export function writeInstallHint(patch: InstallHintStore) {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readInstallHint(), ...patch };
    localStorage.setItem(HINT_KEY, JSON.stringify(next));
  } catch { /* storage unavailable */ }
}

/** True when the reminder must stay hidden (dismissed recently or installed). */
export function isHintSuppressed(store: InstallHintStore, _now: number): boolean {
  return !!store.installed || !!store.shown || typeof store.dismissedAt === "number";
}

// ============= Route rule =============

/** The reminder shows only on a few public pages, never during a game. */
export function isInstallHintRoute(pathname: string): boolean {
  return pathname === "/field" || pathname === "/misija";
}

// ============= Visit timer (20 s rule) =============

const VISIT_KEY = "spartanops:visit_started_at";
export const VISIT_MIN_MS = 20_000;

/** Session-scoped timestamp of the first page load; survives client navigations. */
export function getVisitStart(now = Date.now()): number {
  if (typeof window === "undefined") return now;
  try {
    const raw = sessionStorage.getItem(VISIT_KEY);
    if (raw) {
      const t = Number(raw);
      if (Number.isFinite(t) && t > 0) return t;
    }
    sessionStorage.setItem(VISIT_KEY, String(now));
  } catch { /* storage unavailable */ }
  return now;
}

// ============= Active game session =============

/** True when this device has an authenticated lobby stored (game in progress). */
export function hasActiveGameSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("spartanops.active_session");
    if (!raw) return false;
    const s = JSON.parse(raw) as { lobbyId?: string; authenticated?: boolean };
    return !!(s && s.authenticated && s.lobbyId);
  } catch { return false; }
}

// ============= beforeinstallprompt capture =============

type BipEvent = Event & {
  prompt?: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let bipEvent: BipEvent | null = null;
let listenersAttached = false;
const subscribers = new Set<() => void>();

/** Attach the one-time listeners as early as possible (root layout effect). */
export function registerInstallPromptListeners(onInstalled?: () => void) {
  if (typeof window === "undefined" || listenersAttached) return;
  listenersAttached = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    bipEvent = e as BipEvent;
    subscribers.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    bipEvent = null;
    writeInstallHint({ installed: true });
    subscribers.forEach((fn) => fn());
    onInstalled?.();
  });
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

export type InstallState = {
  platform: InstallPlatform;
  standalone: boolean;
  canPromptNatively: boolean;
  installed: boolean;
  promptInstall: () => Promise<boolean>;
};

/** Reactive view of the install situation for the current device. */
export function useInstallState(onInstalled?: () => void): InstallState {
  const [, bump] = useState(0);
  useEffect(() => {
    registerInstallPromptListeners(onInstalled);
    return subscribe(() => bump((n) => n + 1));
  }, [onInstalled]);

  const platform =
    typeof navigator === "undefined"
      ? "other"
      : detectPlatform(navigator.userAgent, navigator.maxTouchPoints || 0);
  const standalone = isStandalone();
  const installed = standalone || !!readInstallHint().installed;

  const promptInstall = async (): Promise<boolean> => {
    const ev = bipEvent;
    if (!ev || typeof ev.prompt !== "function") return false;
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      if (choice && choice.outcome === "accepted") {
        bipEvent = null;
        writeInstallHint({ installed: true });
        onInstalled?.();
        return true;
      }
    } catch { /* prompt rejected */ }
    return false;
  };

  return {
    platform,
    standalone,
    canPromptNatively: !!bipEvent && platform === "android",
    installed,
    promptInstall,
  };
}
