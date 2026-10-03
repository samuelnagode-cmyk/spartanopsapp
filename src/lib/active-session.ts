/** Saved-session note read by capture, scan, spawn and the recovery modal. */
export function saveActiveSession(lobbyId: string) {
  try {
    localStorage.setItem(
      "spartanops.active_session",
      JSON.stringify({ lobbyId, authenticated: true, at: Date.now() }),
    );
  } catch { /* storage unavailable */ }
}
