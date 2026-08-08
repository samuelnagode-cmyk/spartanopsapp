/**
 * Monotonic guard for live game-state updates.
 *
 * Both the Marshal console and the player HUD receive the same row from two
 * independent paths (REST reads + realtime broadcasts). Postgres read replicas
 * and delayed broadcasts can deliver an OLDER snapshot after a newer one, which
 * made the pre-start countdown appear, vanish, then re-appear on its own.
 * Rejecting any payload whose `updated_at` predates what we already hold makes
 * the state strictly forward-moving.
 */
export function isStaleState(
  prev: { updated_at?: string | null } | null | undefined,
  incoming: { updated_at?: string | null } | null | undefined,
): boolean {
  if (!prev || !incoming) return false;
  const a = prev.updated_at ? Date.parse(prev.updated_at) : NaN;
  const b = incoming.updated_at ? Date.parse(incoming.updated_at) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return b < a;
}
