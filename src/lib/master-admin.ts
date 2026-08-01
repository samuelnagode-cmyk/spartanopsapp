import { useEffect, useState } from "react";

/** Session storage key holding the master admin password (plaintext, session-scoped). */
export const MASTER_PW_STORAGE_KEY = "spartanops:master_pw";

const EVENT_NAME = "spartanops:master-admin-changed";

export function getMasterPw(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(MASTER_PW_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function setMasterPw(pw: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(MASTER_PW_STORAGE_KEY, pw);
  } catch {}
  emitChange();
}

export function clearMasterPw() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(MASTER_PW_STORAGE_KEY);
  } catch {}
  emitChange();
}

/** Reactive "is the master admin session unlocked" flag, shared across components. */
export function useMasterAdmin(): boolean {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const sync = () => setUnlocked(getMasterPw().length > 0);
    sync();
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return unlocked;
}
