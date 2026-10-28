export const ACTIVE_SESSION_EVENT = "spartanops:active-session-changed";
export type ActiveSessionDetails = { team?: string; currentGame?: string | null; status?: string };

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
