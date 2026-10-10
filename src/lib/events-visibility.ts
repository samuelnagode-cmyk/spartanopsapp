/**
 * Who may see what about an event attendee. Pure, server-side only in practice:
 * every attendee/ride response is built through viewAttendee, so hidden fields
 * never leave the server. Covered cell by cell in tests/events-visibility.test.ts.
 */

export const CONTACT_DAYS_AFTER = 3;
const DEFAULT_LENGTH_MS = 6 * 3600_000;

export type RsvpRow = {
  event_id: string; user_id: string; status: "going" | "maybe";
  phone_share: "none" | "organiser" | "attendees";
  ride_role: "none" | "driver" | "rider";
  ride_from: string | null; ride_seats: number | null; ride_note: string | null;
  created_at: string;
};
export type AttendeeProfile = {
  nickname: string; first_name: string; last_name: string | null; show_full_last_name: boolean;
  age_group: "16_17" | "18_plus"; phone: string | null; club: string | null; experience_level: string;
  operator_type: string | null; primary_weapon: string | null; secondary_weapon: string | null;
  sidearm: string | null; gear_notes: string | null;
};
export type Viewer = { userId: string | null; profile: { age_group: string } | null };
export type EventTimes = { account_id: string; starts_at: string; ends_at: string | null };
export type ViewerRole = "public" | "player" | "organiser" | "self";

export type AttendeeView = {
  key: string; self: boolean; status: "going" | "maybe";
  callsign: string; first_name: string; last_initial: string | null; last_name: string | null;
  club: string | null; experience_level: string; operator_type: string | null;
  primary_weapon: string | null; secondary_weapon: string | null; sidearm: string | null; gear_notes: string | null;
  phone: string | null;
  ride: { role: "driver" | "rider"; from: string; seats: number | null; note: string | null } | null;
};

export function eventEndMs(e: { starts_at: string; ends_at: string | null }): number {
  return e.ends_at ? Date.parse(e.ends_at) : Date.parse(e.starts_at) + DEFAULT_LENGTH_MS;
}
export function contactOpen(e: { starts_at: string; ends_at: string | null }, now: number): boolean {
  return now <= eventEndMs(e) + CONTACT_DAYS_AFTER * 86400_000;
}

/** Role of the viewer towards one row. Organiser outranks player; self outranks all. */
export function roleFor(row: { user_id: string }, viewer: Viewer, event: { account_id: string }): ViewerRole {
  if (viewer.userId && viewer.userId === row.user_id) return "self";
  if (viewer.userId && viewer.userId === event.account_id) return "organiser";
  if (viewer.userId && viewer.profile) return "player";
  return "public";
}

/** Can this viewer see attendee rows at all (anyone but public). */
export function canSeeAttendees(viewer: Viewer, event: { account_id: string }): boolean {
  return !!viewer.userId && (!!viewer.profile || viewer.userId === event.account_id);
}

/** Returns null when the viewer may not see the row at all. */
export function viewAttendee(row: RsvpRow, profile: AttendeeProfile, viewer: Viewer, event: EventTimes, now: number, key: string): AttendeeView | null {
  const role = roleFor(row, viewer, event);
  if (role === "public") return null;
  const self = role === "self";
  const open = contactOpen(event, now);
  const viewerAdult = viewer.profile?.age_group === "18_plus";

  let lastName: string | null = null;
  if (self || role === "organiser") lastName = profile.last_name;
  else if (profile.show_full_last_name && viewerAdult) lastName = profile.last_name;

  let phone: string | null = null;
  if (self) phone = profile.phone;
  else if (open && role === "organiser" && (row.phone_share === "organiser" || row.phone_share === "attendees")) phone = profile.phone;
  else if (open && role === "player" && row.phone_share === "attendees" && viewerAdult) phone = profile.phone;

  let ride: AttendeeView["ride"] = null;
  const hasRide = row.ride_role !== "none" && !!row.ride_from;
  if (hasRide && (self || (open && (role === "organiser" || (role === "player" && viewerAdult))))) {
    ride = { role: row.ride_role as "driver" | "rider", from: row.ride_from as string, seats: row.ride_role === "driver" ? row.ride_seats : null, note: row.ride_note };
  }

  return {
    key, self, status: row.status,
    callsign: profile.nickname, first_name: profile.first_name,
    last_initial: profile.last_name ? profile.last_name.charAt(0).toUpperCase() + "." : null,
    last_name: lastName,
    club: profile.club, experience_level: profile.experience_level, operator_type: profile.operator_type,
    primary_weapon: profile.primary_weapon, secondary_weapon: profile.secondary_weapon, sidearm: profile.sidearm, gear_notes: profile.gear_notes,
    phone, ride,
  };
}

/** Lower-case, trimmed, diacritics folded (TypeScript twin of spartanops_fold). */
export function foldTown(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
}

export type RideEntry = { key: string; callsign: string; first_name: string; seats: number | null; note: string | null; phone: string | null };
export type RideGroup = { town: string; drivers: RideEntry[]; riders: RideEntry[]; seatsOffered: number; match: boolean };

/** Car pool board from already-filtered attendee views. */
export function buildRides(views: AttendeeView[]): RideGroup[] {
  const groups = new Map<string, { spellings: Map<string, number>; drivers: RideEntry[]; riders: RideEntry[] }>();
  for (const v of views) {
    if (!v.ride) continue;
    const k = foldTown(v.ride.from);
    if (!k) continue;
    const g = groups.get(k) ?? { spellings: new Map(), drivers: [], riders: [] };
    const sp = v.ride.from.trim();
    g.spellings.set(sp, (g.spellings.get(sp) ?? 0) + 1);
    const entry: RideEntry = { key: v.key, callsign: v.callsign, first_name: v.first_name, seats: v.ride.seats, note: v.ride.note, phone: v.phone };
    (v.ride.role === "driver" ? g.drivers : g.riders).push(entry);
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => ({
    town: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
    drivers: g.drivers, riders: g.riders,
    seatsOffered: g.drivers.reduce((s, d) => s + (d.seats ?? 0), 0),
    match: g.drivers.length > 0 && g.riders.length > 0,
  })).sort((a, b) => Number(b.match) - Number(a.match) || (b.drivers.length + b.riders.length) - (a.drivers.length + a.riders.length));
}
