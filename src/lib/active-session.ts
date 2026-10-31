export const ACTIVE_SESSION_EVENT = "spartanops:active-session-changed";
export type ActiveSessionDetails = { team?: string; currentGame?: string | null; status?: string };

/** A saved session older than this is ignored by the auto-resume check. */
export const ACTIVE_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** True only when the record has a finite `at` no older than the max age. */
export function isFreshActiveSession(session: { at?: number } | null | undefined, now: number): boolean {
  if (!session || typeof session.at !== "number" || !Number.isFinite(session.at)) return false;
  const age = now - session.at;
  return age >= 0 && age <= ACTIVE_SESSION_MAX_AGE_MS;
}

/** Convenience metadata only; the existing server check-in remains authoritative. */
export function saveActiveSession(lobbyId: string, details: ActiveSessionDetails = {}) {
  try {
    const previous = JSON.parse(localStorage.getItem("spartanops.active_session") ?? "null");
    localStorage.setItem(
      "spartanops.active_session",
      JSON.stringify({ ...(previous?.lobbyId === lobbyId ? previous : {}), lobbyId, field: lobbyId, authenticated: true, ...details, at: Date.now() }),
    );
    window.dispatchEvent(new Event(ACTIVE_SESSION_EVENT));
  } catch { /* storage unavailable */ }
}
