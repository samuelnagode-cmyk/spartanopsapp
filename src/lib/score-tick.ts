/** Pure helpers for when a player phone should drive the shared score tick. No imports. */
export const SCORE_TICK_MS = 30_000;

/** Same rule as the SQL: COALESCE(score_ticked_at, match_started_at). */
export function scoreTickBaseMs(scoreTickedAt?: string | null, matchStartedAt?: string | null): number | null {
  const a = scoreTickedAt ? Date.parse(scoreTickedAt) : NaN;
  if (Number.isFinite(a)) return a;
  const b = matchStartedAt ? Date.parse(matchStartedAt) : NaN;
  return Number.isFinite(b) ? b : null;
}

export function isScoreTickDue(baseMs: number | null, nowMs: number, jitterMs: number): boolean {
  if (baseMs === null) return false;
  return nowMs >= baseMs + SCORE_TICK_MS + jitterMs;
}
