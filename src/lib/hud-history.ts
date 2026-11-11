/**
 * Persistent player-death event log for the tactical History Log.
 *
 * Deaths are recorded on the server at the respawn scan; this module keeps the
 * last good copy in localStorage so the debrief survives an offline reload.
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

/** Replace the stored list (last good server copy, for offline debrief reloads). */
export function writeDeathEvents(fieldId: string, events: DeathEvent[]) {
  if (typeof window === "undefined" || !fieldId) return;
  try {
    window.localStorage.setItem(key(fieldId), JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    /* ignore quota */
  }
}

export type DeathEventRow = { id: string; checkin_id: string; callsign: string; team: string; died_at: string };

/** Server row -> DeathEvent. The `<checkinId>-` prefix keeps canSeeDeath's own-death check working. */
export function mapDeathRow(r: DeathEventRow): DeathEvent {
  return { id: `${r.checkin_id}-${r.id}`, callsign: r.callsign, team: r.team, at: Date.parse(r.died_at) || 0 };
}

export function clearDeathEvents(fieldId: string) {
  if (typeof window === "undefined" || !fieldId) return;
  try {
    window.localStorage.removeItem(key(fieldId));
  } catch {
    /* ignore */
  }
}
