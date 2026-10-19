// A field can have 20–30 players behind one shared IP. Forty failures per
// 10 minutes still limits scripted guessing to about 240/hour/IP against
// a password that only lets someone join a game as a player.
export const FIELD_ATTEMPT_MAX_FAILURES = 40;
export const FIELD_ATTEMPT_WINDOW_SEC = 10 * 60;
export const FIELD_ATTEMPT_RETENTION_SEC = 24 * 3600;

/** Attempt timestamps and now are Unix milliseconds (matching Date.now()). */
export function throttleState(attemptTimes: number[], now: number): { throttled: boolean; retryAfterSec: number } {
  const windowStart = now - FIELD_ATTEMPT_WINDOW_SEC * 1000;
  const recent = attemptTimes.filter((at) => at >= windowStart);
  if (recent.length < FIELD_ATTEMPT_MAX_FAILURES) {
    return { throttled: false, retryAfterSec: 0 };
  }
  const oldest = Math.min(...recent);
  return {
    throttled: true,
    retryAfterSec: Math.max(1, Math.ceil((oldest + FIELD_ATTEMPT_WINDOW_SEC * 1000 - now) / 1000)),
  };
}