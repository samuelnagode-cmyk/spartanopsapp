import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  CURRENCIES, EVENT_TZ, KIND_IDS, MAX_REPEAT, MAX_UPCOMING_PER_FIELD, addDaysYmd, fold, isOngoingOrUpcoming,
  parseLocationInput, resolveMapsChain, safeUrl, validLatLng, weekendRange, zonedToUtc, type LatLng,
} from "./events";
import { countsFor } from "./event-rsvps.functions";
import { fieldMediaUrl } from "./field-media";

/* ---------- shared ---------- */

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Same constant-time master-password check as spartanops-plan.functions.ts. */
function checkMaster(pw: unknown): boolean {
  const master = process.env.SPARTANOPS_MASTER_PASSWORD;
  if (!master) return false;
  if (typeof pw !== "string" || pw.length === 0 || pw.length > 200) return false;
  const a = createHash("sha256").update(pw, "utf8").digest();
  const b = createHash("sha256").update(master, "utf8").digest();
  return timingSafeEqual(a, b);
}

const LIST_COLS = "id, title, description, kind, starts_at, ends_at, tz, location_text, price_text, price_amount, price_currency, price_note, capacity, min_age, status, updated_at, visibility, lat, lng, location_visibility";
const FULL_COLS = "id, series_id, title, kind, starts_at, ends_at, tz, description, rules_text, location_text, maps_url, price_text, price_amount, price_currency, price_note, lat, lng, location_visibility, show_field_map, capacity, min_age, signup_url, contact_text, visibility, status, cancel_reason, created_at, updated_at, schedule_changed_at";
const FIELD_JOIN = "account:spartanops_accounts!inner(id, business_name, city, country, listed_publicly, listing_blocked)";

type AccountJoin = { id: string; business_name: string; city: string | null; country: string | null; listed_publicly: boolean; listing_blocked: boolean };
export type EventField = { id: string; name: string; city: string | null; country: string | null; logoUrl?: string | null; mapUrl?: string | null };
export type EventListItem = {
  id: string; title: string; kind: string; starts_at: string; ends_at: string | null; tz: string;
  location_text: string | null; price_text: string | null; capacity: number | null; min_age: number | null;
  price_amount: number | null; price_currency: string | null; price_note: string | null;
  status: string; field: EventField;
  going?: number; maybe?: number; seatsOffered?: number;
};
export type EventFull = EventListItem & {
  series_id: string | null; description: string; rules_text: string | null; maps_url: string | null;
  signup_url: string | null; contact_text: string | null; visibility: string; cancel_reason: string | null;
  created_at: string; updated_at: string; schedule_changed_at: string | null;
  location_visibility: string;
  show_field_map: boolean;
  /** Effective exact location (event point, else the field's). Null when restricted or unset. */
  location: LatLng | null;
  locationRestricted: boolean;
};
/** Organiser's view: also carries the event's own stored point (null = use the field's). */
export type EventMine = EventFull & { lat: number | null; lng: number | null };

const toField = (a: AccountJoin): EventField => ({ id: a.id, name: a.business_name, city: a.city, country: a.country });

type Row = Record<string, unknown> & { account: AccountJoin };

function toListItem(r: Row): EventListItem {
  return {
    id: r.id as string, title: r.title as string, kind: r.kind as string, starts_at: r.starts_at as string,
    ends_at: (r.ends_at as string) ?? null, tz: r.tz as string, location_text: (r.location_text as string) ?? null,
    price_text: (r.price_text as string) ?? null,
    price_amount: r.price_amount === null || r.price_amount === undefined ? null : Number(r.price_amount),
    price_currency: (r.price_currency as string) ?? null, price_note: (r.price_note as string) ?? null, capacity: (r.capacity as number) ?? null, min_age: (r.min_age as number) ?? null,
    status: r.status as string, field: toField(r.account),
  };
}

/** Saved field locations by account id. */
async function fieldPoints(ids: string[]): Promise<Record<string, LatLng>> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return {};
  const db = await admin();
  const { data } = await db.from("spartanops_field_profiles").select("account_id, lat, lng").in("account_id", uniq);
  const out: Record<string, LatLng> = {};
  for (const p of data ?? []) if (p.lat !== null && p.lng !== null) out[p.account_id] = { lat: p.lat, lng: p.lng };
  return out;
}

/** Public URLs of field logos / outline images by account id (never paths). */
async function fieldMedia(ids: string[]): Promise<Record<string, { logoUrl: string | null; mapUrl: string | null }>> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return {};
  const db = await admin();
  const { data } = await db.from("spartanops_field_profiles").select("account_id, logo_path, map_path").in("account_id", uniq);
  const out: Record<string, { logoUrl: string | null; mapUrl: string | null }> = {};
  for (const p of data ?? []) out[p.account_id] = { logoUrl: fieldMediaUrl(p.logo_path), mapUrl: fieldMediaUrl(p.map_path) };
  return out;
}

function effectivePoint(r: Record<string, unknown>, field: LatLng | undefined): LatLng | null {
  if (typeof r.lat === "number" && typeof r.lng === "number") return { lat: r.lat, lng: r.lng };
  return field ?? null;
}

/**
 * Public, listable events (not hidden, public visibility, field listed and not blocked).
 * Shared by the list, the calendar feed and the sitemap.
 */
export async function queryPublicEvents(opts: { past?: boolean; sinceMs?: number; limit?: number }): Promise<(EventListItem & { updated_at: string; description: string; geo: LatLng | null })[]> {
  const db = await admin();
  const now = Date.now();
  let q = db.from("spartanops_events").select(`${LIST_COLS}, ${FIELD_JOIN}`)
    .neq("status", "hidden").eq("visibility", "public")
    .eq("account.listed_publicly", true).eq("account.listing_blocked", false);
  if (opts.past) q = q.lt("starts_at", new Date(now).toISOString()).order("starts_at", { ascending: false });
  else q = q.gte("starts_at", new Date(opts.sinceMs ?? now - 14 * 86400000).toISOString()).order("starts_at", { ascending: true });
  const { data, error } = await q.limit(opts.limit ?? 500);
  if (error) throw new Error("query_failed");
  const rows = ((data ?? []) as unknown as Row[])
    .filter((r) => (opts.sinceMs !== undefined ? true : opts.past ? !isOngoingOrUpcoming(r as never) : isOngoingOrUpcoming(r as never)));
  const pts = await fieldPoints(rows.filter((r) => r.location_visibility === "public").map((r) => r.account.id));
  return rows.map((r) => ({
    ...toListItem(r), updated_at: r.updated_at as string, description: (r.description as string) ?? "",
    // Never expose a restricted point.
    geo: r.location_visibility === "public" ? effectivePoint(r, pts[r.account.id]) : null,
  }));
}

/* ---------- public ---------- */

export const eventsList = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as Record<string, unknown>;
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    return {
      q: str(o.q, 80), country: str(o.country, 2).toUpperCase(), accountId: str(o.accountId, 40),
      kind: KIND_IDS.includes(o.kind as never) ? (o.kind as string) : "", past: o.past === true, weekend: o.weekend === true,
      offset: Math.max(0, Math.floor(Number(o.offset) || 0)), limit: Math.min(24, Math.max(1, Math.floor(Number(o.limit) || 12))),
    };
  })
  .handler(async ({ data }) => {
    const all = await queryPublicEvents({ past: data.past });
    const countries = [...new Set(all.filter(() => !data.past).map((e) => e.field.country).filter(Boolean) as string[])].sort();
    const needle = fold(data.q);
    const [wkStart, wkEnd] = weekendRange();
    const filtered = all.filter((e) =>
      (!data.country || e.field.country === data.country)
      && (!data.accountId || e.field.id === data.accountId)
      && (!data.kind || e.kind === data.kind)
      && (!data.weekend || (Date.parse(e.starts_at) < wkEnd && Date.parse(e.ends_at ?? e.starts_at) >= wkStart))
      && (!needle || fold(e.title).includes(needle) || fold(e.field.name).includes(needle) || fold(e.field.city).includes(needle)));
    let fieldName: string | null = null;
    if (data.accountId) {
      const db = await admin();
      const { data: acc } = await db.from("spartanops_accounts").select("business_name, listing_blocked").eq("id", data.accountId).maybeSingle();
      fieldName = acc && !acc.listing_blocked ? acc.business_name : null;
    }
    const page = filtered.slice(data.offset, data.offset + data.limit);
    const counts = await countsFor(page.map((e) => e.id));
    const media = await fieldMedia(page.map((e) => e.field.id));
    return {
      events: page.map(({ updated_at: _u, description: _d, geo: _g, ...e }) => ({ ...e, field: { ...e.field, logoUrl: media[e.field.id]?.logoUrl ?? null }, going: counts[e.id]?.going ?? 0, seatsOffered: counts[e.id]?.seatsOffered ?? 0 })),
      total: filtered.length,
      countries,
      fieldName,
    };
  });

export const eventsGet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ({ id: String((d as { id?: unknown })?.id ?? "").slice(0, 40) }))
  .handler(async ({ data }): Promise<{ event: EventFull | null }> => {
    if (!/^[0-9a-f-]{36}$/i.test(data.id)) return { event: null };
    const db = await admin();
    const { data: r } = await db.from("spartanops_events").select(`${FULL_COLS}, ${FIELD_JOIN}`).eq("id", data.id).maybeSingle();
    const row = r as unknown as Row | null;
    if (!row || row.status === "hidden" || row.account.listing_blocked) return { event: null };
    const { account, lat: _lat, lng: _lng, ...rest } = row;
    const restricted = row.location_visibility === "going";
    let location: LatLng | null = null;
    if (!restricted) location = effectivePoint(row, (await fieldPoints([account.id]))[account.id]);
    const med = (await fieldMedia([account.id]))[account.id];
    return {
      event: {
        ...(rest as unknown as EventFull),
        price_amount: row.price_amount === null || row.price_amount === undefined ? null : Number(row.price_amount),
        field: { ...toField(account), logoUrl: med?.logoUrl ?? null, mapUrl: row.show_field_map !== false ? med?.mapUrl ?? null : null },
        location, locationRestricted: restricted,
      },
    };
  });

/** Exact location for the event's organiser or a player who answered "going"; otherwise restricted. */
export const eventLocationForViewer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { eventId?: unknown; accessToken?: unknown };
    return { eventId: String(o.eventId ?? "").slice(0, 40), accessToken: String(o.accessToken ?? "") };
  })
  .handler(async ({ data }): Promise<{ location: LatLng | null } | { restricted: true }> => {
    if (!/^[0-9a-f-]{36}$/i.test(data.eventId)) return { restricted: true };
    const db = await admin();
    const { data: ev } = await db.from("spartanops_events").select("id, account_id, status, lat, lng").eq("id", data.eventId).maybeSingle();
    if (!ev || ev.status === "hidden" || !data.accessToken) return { restricted: true };
    const { data: u, error } = await db.auth.getUser(data.accessToken);
    if (error || !u?.user) return { restricted: true };
    let allowed = ev.account_id === u.user.id;
    if (!allowed) {
      const { data: rsvp } = await db.from("spartanops_event_rsvps").select("status").eq("event_id", ev.id).eq("user_id", u.user.id).maybeSingle();
      allowed = rsvp?.status === "going";
    }
    if (!allowed) return { restricted: true };
    return { location: effectivePoint(ev as Record<string, unknown>, (await fieldPoints([ev.account_id]))[ev.account_id]) };
  });

/* ---------- marshal ---------- */

type Marshal = { userId: string; account: { business_name: string; city: string | null; country: string | null; field_password_hash: string | null; listed_publicly: boolean } };

async function requireMarshal(accessToken: unknown): Promise<Marshal> {
  if (typeof accessToken !== "string" || !accessToken) throw new Error("login_required");
  const db = await admin();
  const { data: u, error } = await db.auth.getUser(accessToken);
  if (error || !u?.user) throw new Error("login_required");
  const { data: acc } = await db.from("spartanops_accounts")
    .select("business_name, city, country, field_password_hash, listed_publicly").eq("id", u.user.id).maybeSingle();
  if (!acc) throw new Error("account_required");
  return { userId: u.user.id, account: acc as Marshal["account"] };
}

function readiness(a: Marshal["account"]) {
  const missing: string[] = [];
  if (!a.field_password_hash) missing.push("password");
  if (!a.city) missing.push("city");
  if (!a.country) missing.push("country");
  return { ready: missing.length === 0, missing };
}

/** Loads an event owned by the caller's field, else not_found (never reveals other fields' events). */
async function ownEvent(userId: string, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("not_found");
  const db = await admin();
  const { data } = await db.from("spartanops_events").select("id, status, account_id").eq("id", id).eq("account_id", userId).maybeSingle();
  if (!data) throw new Error("not_found");
  return data;
}

const tokenOnly = (d: unknown) => ({ accessToken: String((d as { accessToken?: unknown })?.accessToken ?? "") });

export const eventsMine = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const m = await requireMarshal(data.accessToken);
    const db = await admin();
    const { data: rows } = await db.from("spartanops_events").select(FULL_COLS).eq("account_id", m.userId).order("starts_at", { ascending: true }).limit(500);
    const r = readiness(m.account);
    const med = (await fieldMedia([m.userId]))[m.userId];
    const field: EventField = { id: m.userId, name: m.account.business_name, city: m.account.city, country: m.account.country, logoUrl: med?.logoUrl ?? null, mapUrl: med?.mapUrl ?? null };
    const list = (rows ?? []) as unknown as Omit<EventMine, "field" | "location" | "locationRestricted">[];
    const counts = await countsFor(list.map((e) => e.id));
    const fp = (await fieldPoints([m.userId]))[m.userId];
    return {
      events: list.map((e): EventMine => ({
        ...e, price_amount: e.price_amount === null ? null : Number(e.price_amount), field,
        location: effectivePoint(e as Record<string, unknown>, fp), locationRestricted: false,
        going: counts[e.id]?.going ?? 0, maybe: counts[e.id]?.maybe ?? 0,
      })),
      fieldReady: r.ready, missing: r.missing, field, listedPublicly: m.account.listed_publicly !== false,
    };
  });

export type EventInput = {
  title: string; kind: string; date: string; startTime: string; endTime?: string | null;
  description?: string; rules_text?: string | null; location_text?: string | null; maps_url?: string | null;
  price_text?: string | null; capacity?: number | string | null; min_age?: number | string | null;
  signup_url?: string | null; contact_text?: string | null; visibility?: string;
  price_amount?: number | string | null; price_currency?: string | null; price_note?: string | null;
  lat?: number | null; lng?: number | null; location_visibility?: string; show_field_map?: boolean;
};

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

/** Validates one event and returns the database columns for a given date. */
export function validateEventInput(e: EventInput): { ok: true; build: (dateYmd: string) => Record<string, unknown> } | { ok: false; error: string } {
  const title = clean(e.title, 100).replace(/\s+/g, " ");
  if (title.length < 3) return { ok: false, error: "validation:title" };
  if (!KIND_IDS.includes(e.kind as never)) return { ok: false, error: "validation:kind" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? "")) return { ok: false, error: "validation:date" };
  if (!/^\d{2}:\d{2}$/.test(e.startTime ?? "")) return { ok: false, error: "validation:start" };
  const end = e.endTime ? String(e.endTime) : "";
  if (end && !/^\d{2}:\d{2}$/.test(end)) return { ok: false, error: "validation:end" };
  const mapsRaw = clean(e.maps_url, 300);
  const maps = mapsRaw ? safeUrl(mapsRaw) : null;
  if (mapsRaw && !maps) return { ok: false, error: "validation:maps_url" };
  const signupRaw = clean(e.signup_url, 300);
  const signup = signupRaw ? safeUrl(signupRaw) : null;
  if (signupRaw && !signup) return { ok: false, error: "validation:signup_url" };
  const capRaw = e.capacity === null || e.capacity === undefined || e.capacity === "" ? null : Number(e.capacity);
  if (capRaw !== null && (!Number.isInteger(capRaw) || capRaw < 2 || capRaw > 500)) return { ok: false, error: "validation:capacity" };
  const ageRaw = e.min_age === null || e.min_age === undefined || e.min_age === "" ? null : Number(e.min_age);
  if (ageRaw !== null && (!Number.isInteger(ageRaw) || ageRaw < 10 || ageRaw > 21)) return { ok: false, error: "validation:min_age" };
  const visibility = e.visibility === "link" ? "link" : "public";
  // Structured price: amount and currency together, or neither.
  const amtRaw = e.price_amount === null || e.price_amount === undefined || e.price_amount === "" ? null : String(e.price_amount).replace(",", ".");
  const cur = e.price_currency ? String(e.price_currency) : null;
  if (amtRaw !== null && !/^\d{1,4}(\.\d{1,2})?$/.test(amtRaw)) return { ok: false, error: "validation:price" };
  const amount = amtRaw === null ? null : Number(amtRaw);
  if (amount !== null && (amount < 0 || amount > 9999.99)) return { ok: false, error: "validation:price" };
  if ((amount === null) !== (cur === null)) return { ok: false, error: "validation:price" };
  if (cur !== null && !CURRENCIES.includes(cur as never)) return { ok: false, error: "validation:price" };
  const hasLat = e.lat !== null && e.lat !== undefined;
  const hasLng = e.lng !== null && e.lng !== undefined;
  if (hasLat !== hasLng || (hasLat && !validLatLng(Number(e.lat), Number(e.lng)))) return { ok: false, error: "validation:location" };
  const lat = hasLat ? Number(e.lat) : null;
  const lng = hasLng ? Number(e.lng) : null;
  const description = clean(e.description, 4000);
  const fields = {
    title, kind: e.kind, tz: EVENT_TZ, description,
    rules_text: clean(e.rules_text, 1500) || null, location_text: clean(e.location_text, 160) || null,
    // The old free-text price is replaced on every save.
    maps_url: maps, price_text: null, price_amount: amount, price_currency: cur, price_note: clean(e.price_note, 60) || null,
    lat, lng, location_visibility: e.location_visibility === "going" ? "going" : "public",
    show_field_map: e.show_field_map !== false,
    capacity: capRaw, min_age: ageRaw,
    signup_url: signup, contact_text: clean(e.contact_text, 120) || null, visibility,
  };
  // Validate the end against the first date; later dates in a series keep the same wall clock.
  const s0 = zonedToUtc(e.date, e.startTime);
  if (end) {
    const e0 = zonedToUtc(end > e.startTime ? e.date : addDaysYmd(e.date, 1), end);
    if (Date.parse(e0) <= Date.parse(s0)) return { ok: false, error: "validation:end" };
  }
  return {
    ok: true,
    build: (ymd) => ({
      ...fields,
      starts_at: zonedToUtc(ymd, e.startTime),
      // An end time earlier than the start means the game runs past midnight.
      ends_at: end ? zonedToUtc(end > e.startTime ? ymd : addDaysYmd(ymd, 1), end) : null,
    }),
  };
}

export const eventsSave = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; id?: unknown; event?: unknown; repeatWeeks?: unknown };
    return {
      accessToken: String(o.accessToken ?? ""), id: typeof o.id === "string" && o.id ? o.id : null,
      event: (o.event ?? {}) as EventInput, repeatWeeks: Math.floor(Number(o.repeatWeeks) || 1),
    };
  })
  .handler(async ({ data }) => {
    const m = await requireMarshal(data.accessToken);
    const v = validateEventInput(data.event);
    if (!v.ok) throw new Error(v.error);
    const db = await admin();
    const now = new Date().toISOString();

    if (data.id) {
      await ownEvent(m.userId, data.id);
      const built = v.build(data.event.date);
      const { data: prev } = await db.from("spartanops_events").select("starts_at").eq("id", data.id).single();
      let scheduleChanged = {};
      if (prev && Date.parse(prev.starts_at) !== Date.parse(built.starts_at as string)) {
        const { count } = await db.from("spartanops_event_rsvps").select("event_id", { count: "exact", head: true }).eq("event_id", data.id);
        if ((count ?? 0) > 0) scheduleChanged = { schedule_changed_at: now };
      }
      const { data: row, error } = await db.from("spartanops_events")
        .update({ ...built, ...scheduleChanged, updated_at: now } as never)
        .eq("id", data.id).eq("account_id", m.userId).select("id").single();
      if (error || !row) throw new Error("save_failed");
      return { ids: [row.id as string] };
    }

    const r = readiness(m.account);
    if (!r.ready) throw new Error(`field_not_ready:${r.missing.join(",")}`);
    const count = data.repeatWeeks >= 2 ? Math.min(MAX_REPEAT, data.repeatWeeks) : 1;
    const rows = Array.from({ length: count }, (_, i) => v.build(addDaysYmd(data.event.date, i * 7)));
    if (rows.some((x) => Date.parse(x.starts_at as string) < Date.now() - 86400000)) throw new Error("validation:date");

    const { count: upcoming } = await db.from("spartanops_events").select("id", { count: "exact", head: true })
      .eq("account_id", m.userId).eq("status", "published").gte("starts_at", now);
    if ((upcoming ?? 0) + count > MAX_UPCOMING_PER_FIELD) throw new Error("event_limit");

    const seriesId = count > 1 ? crypto.randomUUID() : null;
    const { data: inserted, error } = await db.from("spartanops_events")
      .insert(rows.map((x) => ({ ...x, account_id: m.userId, series_id: seriesId })) as never)
      .select("id, starts_at").order("starts_at", { ascending: true });
    if (error) { console.error("[eventsSave]", error.code); throw new Error("save_failed"); }
    return { ids: (inserted ?? []).map((x) => x.id as string) };
  });

export const eventsCancel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; id?: unknown; reason?: unknown };
    return { accessToken: String(o.accessToken ?? ""), id: String(o.id ?? ""), reason: clean(o.reason, 140) || null };
  })
  .handler(async ({ data }) => {
    const m = await requireMarshal(data.accessToken);
    const ev = await ownEvent(m.userId, data.id);
    if (ev.status === "hidden") throw new Error("not_found");
    const db = await admin();
    await db.from("spartanops_events").update({ status: "cancelled", cancel_reason: data.reason, updated_at: new Date().toISOString() } as never).eq("id", data.id).eq("account_id", m.userId);
    return { ok: true };
  });

export const eventsReopen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ({ accessToken: String((d as { accessToken?: unknown })?.accessToken ?? ""), id: String((d as { id?: unknown })?.id ?? "") }))
  .handler(async ({ data }) => {
    const m = await requireMarshal(data.accessToken);
    const ev = await ownEvent(m.userId, data.id);
    if (ev.status !== "cancelled") throw new Error("not_found");
    const db = await admin();
    await db.from("spartanops_events").update({ status: "published", cancel_reason: null, updated_at: new Date().toISOString() } as never).eq("id", data.id).eq("account_id", m.userId);
    return { ok: true };
  });

export const eventsDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ({ accessToken: String((d as { accessToken?: unknown })?.accessToken ?? ""), id: String((d as { id?: unknown })?.id ?? "") }))
  .handler(async ({ data }) => {
    const m = await requireMarshal(data.accessToken);
    await ownEvent(m.userId, data.id);
    const db = await admin();
    const { count } = await db.from("spartanops_event_rsvps").select("event_id", { count: "exact", head: true }).eq("event_id", data.id);
    if ((count ?? 0) > 0) throw new Error("has_answers");
    await db.from("spartanops_events").delete().eq("id", data.id).eq("account_id", m.userId);
    return { ok: true };
  });

/* ---------- master admin ---------- */

export const eventsAdminHide = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { masterPassword?: unknown; id?: unknown; hidden?: unknown };
    return { masterPassword: o.masterPassword, id: String(o.id ?? ""), hidden: o.hidden === true };
  })
  .handler(async ({ data }) => {
    if (!checkMaster(data.masterPassword)) throw new Error("forbidden");
    const db = await admin();
    const { error } = await db.from("spartanops_events").update({ status: data.hidden ? "hidden" : "published", updated_at: new Date().toISOString() } as never).eq("id", data.id);
    if (error) throw new Error("save_failed");
    return { ok: true };
  });

/* ---------- maps short links ---------- */

export const resolveMapsLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; url?: unknown };
    return { accessToken: String(o.accessToken ?? ""), url: String(o.url ?? "").trim().slice(0, 500) };
  })
  .handler(async ({ data }): Promise<LatLng | { error: "not_found" }> => {
    await requireMarshal(data.accessToken);
    const parsed = parseLocationInput(data.url);
    if (parsed.kind === "point") return { lat: parsed.lat, lng: parsed.lng };
    if (parsed.kind !== "resolve") return { error: "not_found" };
    const p = await resolveMapsChain(parsed.url);
    return p && validLatLng(p.lat, p.lng) ? { lat: p.lat, lng: p.lng } : { error: "not_found" };
  });
