import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  EVENT_TZ, KIND_IDS, MAX_REPEAT, MAX_UPCOMING_PER_FIELD, addDaysYmd, fold, isOngoingOrUpcoming,
  safeUrl, weekendRange, zonedToUtc,
} from "./events";

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

const LIST_COLS = "id, title, description, kind, starts_at, ends_at, tz, location_text, price_text, capacity, min_age, status, updated_at, visibility";
const FULL_COLS = "id, series_id, title, kind, starts_at, ends_at, tz, description, rules_text, location_text, maps_url, price_text, capacity, min_age, signup_url, contact_text, visibility, status, cancel_reason, created_at, updated_at";
const FIELD_JOIN = "account:spartanops_accounts!inner(id, business_name, city, country, listed_publicly, listing_blocked)";

type AccountJoin = { id: string; business_name: string; city: string | null; country: string | null; listed_publicly: boolean; listing_blocked: boolean };
export type EventField = { id: string; name: string; city: string | null; country: string | null };
export type EventListItem = {
  id: string; title: string; kind: string; starts_at: string; ends_at: string | null; tz: string;
  location_text: string | null; price_text: string | null; capacity: number | null; min_age: number | null;
  status: string; field: EventField;
};
export type EventFull = EventListItem & {
  series_id: string | null; description: string; rules_text: string | null; maps_url: string | null;
  signup_url: string | null; contact_text: string | null; visibility: string; cancel_reason: string | null;
  created_at: string; updated_at: string;
};

const toField = (a: AccountJoin): EventField => ({ id: a.id, name: a.business_name, city: a.city, country: a.country });

type Row = Record<string, unknown> & { account: AccountJoin };

function toListItem(r: Row): EventListItem {
  return {
    id: r.id as string, title: r.title as string, kind: r.kind as string, starts_at: r.starts_at as string,
    ends_at: (r.ends_at as string) ?? null, tz: r.tz as string, location_text: (r.location_text as string) ?? null,
    price_text: (r.price_text as string) ?? null, capacity: (r.capacity as number) ?? null, min_age: (r.min_age as number) ?? null,
    status: r.status as string, field: toField(r.account),
  };
}

/**
 * Public, listable events (not hidden, public visibility, field listed and not blocked).
 * Shared by the list, the calendar feed and the sitemap.
 */
export async function queryPublicEvents(opts: { past?: boolean; sinceMs?: number; limit?: number }): Promise<(EventListItem & { updated_at: string; description: string })[]> {
  const db = await admin();
  const now = Date.now();
  let q = db.from("spartanops_events").select(`${LIST_COLS}, ${FIELD_JOIN}`)
    .neq("status", "hidden").eq("visibility", "public")
    .eq("account.listed_publicly", true).eq("account.listing_blocked", false);
  if (opts.past) q = q.lt("starts_at", new Date(now).toISOString()).order("starts_at", { ascending: false });
  else q = q.gte("starts_at", new Date(opts.sinceMs ?? now - 14 * 86400000).toISOString()).order("starts_at", { ascending: true });
  const { data, error } = await q.limit(opts.limit ?? 500);
  if (error) throw new Error("query_failed");
  const rows = (data ?? []) as unknown as Row[];
  return rows
    .filter((r) => (opts.sinceMs !== undefined ? true : opts.past ? !isOngoingOrUpcoming(r as never) : isOngoingOrUpcoming(r as never)))
    .map((r) => ({ ...toListItem(r), updated_at: r.updated_at as string, description: (r.description as string) ?? "" }));
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
    return {
      events: filtered.slice(data.offset, data.offset + data.limit).map(({ updated_at: _u, description: _d, ...e }) => e),
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
    const { account, ...rest } = row;
    return { event: { ...(rest as unknown as EventFull), field: toField(account) } };
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
    const field: EventField = { id: m.userId, name: m.account.business_name, city: m.account.city, country: m.account.country };
    return {
      events: ((rows ?? []) as unknown as Omit<EventFull, "field">[]).map((e) => ({ ...e, field })),
      fieldReady: r.ready, missing: r.missing, field, listedPublicly: m.account.listed_publicly !== false,
    };
  });

export type EventInput = {
  title: string; kind: string; date: string; startTime: string; endTime?: string | null;
  description?: string; rules_text?: string | null; location_text?: string | null; maps_url?: string | null;
  price_text?: string | null; capacity?: number | string | null; min_age?: number | string | null;
  signup_url?: string | null; contact_text?: string | null; visibility?: string;
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
  const description = clean(e.description, 4000);
  const fields = {
    title, kind: e.kind, tz: EVENT_TZ, description,
    rules_text: clean(e.rules_text, 1500) || null, location_text: clean(e.location_text, 160) || null,
    maps_url: maps, price_text: clean(e.price_text, 80) || null, capacity: capRaw, min_age: ageRaw,
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
      const { data: row, error } = await db.from("spartanops_events")
        .update({ ...v.build(data.event.date), updated_at: now } as never)
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
    // STEP 3: refuse here (e.g. throw "has_answers") when players have answered this event.
    const db = await admin();
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
