/**
 * Persistent player-death event log for the tactical History Log.
 *
 * Captures live in the database, but respawn/death events are only observable
 * as transient `respawn_unlock_at` transitions on the roster. We persist them
 * per mission in localStorage so the History Log can be replayed on the
 * debriefing screen after the match ends.
 */

export type DeathEvent = {
  id: string;
  callsign: string;
  team: string;
  at: number;
};

const MAX_EVENTS = 300;

function key(fieldId: string) {
  return `spartanops:deathlog:${fieldId}`;
}

export function readDeathEvents(fieldId: string): DeathEvent[] {
  if (typeof window === "undefined" || !fieldId) return [];
  try {
    const raw = window.localStorage.getItem(key(fieldId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeathEvent[]) : [];
  } catch {
    return [];
  }
}

export function appendDeathEvents(fieldId: string, events: DeathEvent[]): DeathEvent[] {
  if (typeof window === "undefined" || !fieldId || events.length === 0) return readDeathEvents(fieldId);
  const existing = readDeathEvents(fieldId);
  const seen = new Set(existing.map((e) => e.id));
  const merged = [...existing, ...events.filter((e) => !seen.has(e.id))].slice(-MAX_EVENTS);
  try {
    window.localStorage.setItem(key(fieldId), JSON.stringify(merged));
  } catch {
    /* ignore quota */
  }
  return merged;
}

export function clearDeathEvents(fieldId: string) {
  if (typeof window === "undefined" || !fieldId) return;
  try {
    window.localStorage.removeItem(key(fieldId));
  } catch {
    /* ignore */
  }
}
