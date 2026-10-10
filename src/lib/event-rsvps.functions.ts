import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { PRIVACY_VERSION, cleanText } from "./player-validation";
import {
  buildRides, canSeeAttendees, eventEndMs, viewAttendee,
  type AttendeeProfile, type AttendeeView, type RideGroup, type RsvpRow, type Viewer,
} from "./events-visibility";

/* All access to spartanops_event_rsvps goes through here with the service role.
   Personal data is masked by viewAttendee before anything is returned. Never log rows. */

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

const UUID_RE = /^[0-9a-f-]{36}$/i;
const PROFILE_COLS = "user_id, nickname, first_name, last_name, show_full_last_name, age_group, phone, club, experience_level, operator_type, primary_weapon, secondary_weapon, sidearm, gear_notes";
const RSVP_COLS = "event_id, user_id, status, phone_share, ride_role, ride_from, ride_seats, ride_note, created_at";

export type Counts = { going: number; maybe: number; seatsOffered: number };

async function userFromToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token) return null;
  const db = await admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}
async function requireUserId(token: unknown): Promise<string> {
  const id = await userFromToken(token);
  if (!id) throw new Error("login_required");
  return id;
}

/** Public counts for many events in one query. */
export async function countsFor(eventIds: string[]): Promise<Record<string, Counts>> {
  const out: Record<string, Counts> = {};
  for (const id of eventIds) out[id] = { going: 0, maybe: 0, seatsOffered: 0 };
  if (eventIds.length === 0) return out;
  const db = await admin();
  const { data } = await db.from("spartanops_event_rsvps").select("event_id, status, ride_role, ride_seats").in("event_id", eventIds).limit(20000);
  for (const r of data ?? []) {
    const c = out[r.event_id];
    if (!c) continue;
    if (r.status === "going") c.going++; else if (r.status === "maybe") c.maybe++;
    if (r.ride_role === "driver" && r.ride_seats) c.seatsOffered += r.ride_seats;
  }
  return out;
}

const rowKey = (eventId: string, userId: string) => createHash("sha256").update(`${eventId}:${userId}`).digest("hex").slice(0, 16);

type EventRow = { id: string; account_id: string; starts_at: string; ends_at: string | null; capacity: number | null; status: string };

async function visibleEvent(eventId: unknown): Promise<EventRow | null> {
  if (typeof eventId !== "string" || !UUID_RE.test(eventId)) return null;
  const db = await admin();
  const { data } = await db.from("spartanops_events")
    .select("id, account_id, starts_at, ends_at, capacity, status, account:spartanops_accounts!inner(listing_blocked)")
    .eq("id", eventId).maybeSingle();
  const r = data as unknown as (EventRow & { account: { listing_blocked: boolean } }) | null;
  if (!r || r.status === "hidden" || r.account.listing_blocked) return null;
  return { id: r.id, account_id: r.account_id, starts_at: r.starts_at, ends_at: r.ends_at, capacity: r.capacity, status: r.status };
}

export type MyRsvp = { status: "going" | "maybe"; phone_share: string; ride_role: string; ride_from: string | null; ride_seats: number | null; ride_note: string | null };
export type ViewerInfo = { signedIn: boolean; hasProfile: boolean; adult: boolean; hasPhone: boolean; needsReconsent: boolean; organiser: boolean };
export type Attendance = Counts & {
  capacity: number | null;
  viewer: ViewerInfo;
  me?: MyRsvp | null;
  attendees?: AttendeeView[];
  rides?: RideGroup[];
};

export const eventAttendance = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { eventId?: unknown; accessToken?: unknown };
    return { eventId: String(o.eventId ?? "").slice(0, 40), accessToken: typeof o.accessToken === "string" ? o.accessToken : "" };
  })
  .handler(async ({ data }): Promise<Attendance> => {
    const ev = await visibleEvent(data.eventId);
    if (!ev) throw new Error("not_found");
    const counts = (await countsFor([ev.id]))[ev.id];
    const db = await admin();
    const userId = await userFromToken(data.accessToken);
    let vp: { age_group: string; phone: string | null; privacy_version: string } | null = null;
    if (userId) {
      const { data: p } = await db.from("spartanops_players").select("age_group, phone, privacy_version").eq("user_id", userId).maybeSingle();
      vp = p ?? null;
    }
    const viewerInfo: ViewerInfo = {
      signedIn: !!userId, hasProfile: !!vp, adult: vp?.age_group === "18_plus", hasPhone: !!vp?.phone,
      needsReconsent: !!vp && vp.privacy_version !== PRIVACY_VERSION, organiser: !!userId && userId === ev.account_id,
    };
    const base: Attendance = { ...counts, capacity: ev.capacity, viewer: viewerInfo };
    const viewer: Viewer = { userId, profile: vp ? { age_group: vp.age_group } : null };
    if (!canSeeAttendees(viewer, ev)) return base;

    const { data: rows } = await db.from("spartanops_event_rsvps").select(RSVP_COLS).eq("event_id", ev.id)
      .order("status", { ascending: true }).order("created_at", { ascending: true }).limit(300);
    const list = (rows ?? []) as RsvpRow[];
    const ids = list.map((r) => r.user_id);
    const { data: profs } = ids.length ? await db.from("spartanops_players").select(PROFILE_COLS).in("user_id", ids) : { data: [] };
    const byId = new Map(((profs ?? []) as (AttendeeProfile & { user_id: string })[]).map((p) => [p.user_id, p]));
    const now = Date.now();
    const attendees: AttendeeView[] = [];
    for (const r of list) {
      const p = byId.get(r.user_id);
      if (!p) continue;
      const view = viewAttendee(r, p, viewer, ev, now, rowKey(ev.id, r.user_id));
      if (view) attendees.push(view);
    }
    let me: MyRsvp | null = null;
    if (userId) {
      const { data: mine } = await db.from("spartanops_event_rsvps").select("status, phone_share, ride_role, ride_from, ride_seats, ride_note").eq("event_id", ev.id).eq("user_id", userId).maybeSingle();
      me = (mine as MyRsvp | null) ?? null;
    }
    return { ...base, me, attendees, rides: buildRides(attendees) };
  });

/* ---------- write ---------- */

const RPC_ERRORS = new Set(["full", "event_closed", "event_over", "not_found"]);

export const eventRsvpSet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as Record<string, unknown>;
    return {
      accessToken: String(o.accessToken ?? ""), eventId: String(o.eventId ?? "").slice(0, 40),
      status: o.status, phoneShare: o.phoneShare, rideRole: o.rideRole, rideFrom: o.rideFrom, rideSeats: o.rideSeats, rideNote: o.rideNote,
    };
  })
  .handler(async ({ data }) => {
    const userId = await requireUserId(data.accessToken);
    if (!UUID_RE.test(data.eventId)) throw new Error("not_found");
    const db = await admin();
    const { data: p } = await db.from("spartanops_players").select("age_group, phone, privacy_version").eq("user_id", userId).maybeSingle();
    if (!p) throw new Error("needs_profile");
    if (p.privacy_version !== PRIVACY_VERSION) throw new Error("needs_reconsent");
    if (data.status !== "going" && data.status !== "maybe") throw new Error("validation:status");

    let phoneShare = ["none", "organiser", "attendees"].includes(data.phoneShare as string) ? (data.phoneShare as string) : "none";
    let rideRole = ["none", "driver", "rider"].includes(data.rideRole as string) ? (data.rideRole as string) : "none";
    if (p.age_group !== "18_plus") { phoneShare = "none"; rideRole = "none"; }

    let rideFrom: string | null = null;
    let rideSeats: number | null = null;
    let rideNote: string | null = null;
    if (rideRole !== "none") {
      phoneShare = "attendees";
      if (!p.phone) throw new Error("needs_phone");
      rideFrom = cleanText(data.rideFrom, 60);
      if (rideFrom.length < 2) throw new Error("validation:ride_from");
      rideNote = cleanText(data.rideNote, 120) || null;
      if (rideRole === "driver") {
        const s = Number(data.rideSeats);
        if (!Number.isInteger(s) || s < 1 || s > 8) throw new Error("validation:ride_seats");
        rideSeats = s;
      }
    }

    const { data: res, error } = await db.rpc("spartanops_rsvp_set", {
      p_event: data.eventId, p_user: userId, p_status: data.status, p_phone_share: phoneShare,
      p_ride_role: rideRole, p_ride_from: rideFrom as string, p_ride_seats: rideSeats as number, p_ride_note: rideNote as string,
    });
    if (error) { console.error("[eventRsvpSet]", error.code); throw new Error("save_failed"); }
    if (res !== "ok") throw new Error(RPC_ERRORS.has(res as string) ? (res as string) : "save_failed");
    return { ok: true };
  });

export const eventRsvpRemove = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; eventId?: unknown };
    return { accessToken: String(o.accessToken ?? ""), eventId: String(o.eventId ?? "").slice(0, 40) };
  })
  .handler(async ({ data }) => {
    const userId = await requireUserId(data.accessToken);
    if (!UUID_RE.test(data.eventId)) throw new Error("not_found");
    const db = await admin();
    const { error } = await db.from("spartanops_event_rsvps").delete().eq("event_id", data.eventId).eq("user_id", userId);
    if (error) throw new Error("save_failed");
    return { ok: true };
  });

export type MyEventAnswer = {
  event_id: string; status: "going" | "maybe"; title: string; starts_at: string; ends_at: string | null; tz: string;
  event_status: string; field: string; past: boolean;
};

export const eventsMyRsvps = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ({ accessToken: String((d as { accessToken?: unknown })?.accessToken ?? "") }))
  .handler(async ({ data }): Promise<{ upcoming: MyEventAnswer[]; past: MyEventAnswer[]; gamesAttended: number }> => {
    const userId = await requireUserId(data.accessToken);
    const db = await admin();
    const { data: rows } = await db.from("spartanops_event_rsvps")
      .select("event_id, status, event:spartanops_events!inner(title, starts_at, ends_at, tz, status, account:spartanops_accounts!inner(business_name))")
      .eq("user_id", userId).limit(500);
    type R = { event_id: string; status: "going" | "maybe"; event: { title: string; starts_at: string; ends_at: string | null; tz: string; status: string; account: { business_name: string } } };
    const now = Date.now();
    const all: MyEventAnswer[] = ((rows ?? []) as unknown as R[])
      .filter((r) => r.event.status !== "hidden")
      .map((r) => ({
        event_id: r.event_id, status: r.status, title: r.event.title, starts_at: r.event.starts_at, ends_at: r.event.ends_at,
        tz: r.event.tz, event_status: r.event.status, field: r.event.account.business_name, past: eventEndMs(r.event) < now,
      }));
    const upcoming = all.filter((a) => !a.past).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    const past = all.filter((a) => a.past).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
    return { upcoming, past, gamesAttended: past.filter((a) => a.status === "going" && a.event_status !== "cancelled").length };
  });

export const eventsCounts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const ids = (d as { eventIds?: unknown })?.eventIds;
    return { eventIds: Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)).slice(0, 24) : [] };
  })
  .handler(async ({ data }) => countsFor(data.eventIds));

/** Own RSVP rows for the data export (step 1 playerExportMine). */
export async function exportRsvpsFor(userId: string) {
  const db = await admin();
  const { data } = await db.from("spartanops_event_rsvps")
    .select("status, phone_share, ride_role, ride_from, ride_seats, ride_note, created_at, updated_at, event:spartanops_events(title, starts_at)")
    .eq("user_id", userId).limit(1000);
  type R = { status: string; phone_share: string; ride_role: string; ride_from: string | null; ride_seats: number | null; ride_note: string | null; created_at: string; updated_at: string; event: { title: string; starts_at: string } | null };
  return ((data ?? []) as unknown as R[]).map(({ event, ...r }) => ({ event_title: event?.title ?? null, event_date: event?.starts_at ?? null, ...r }));
}
