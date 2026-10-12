/** Pure helpers for the airsoft events calendar. No server imports: used by pages and server functions. */
import { createElement, Fragment, useEffect, useState, type ReactNode } from "react";

export const EVENT_TZ = "Europe/Ljubljana";
export const MAX_UPCOMING_PER_FIELD = 30;
export const MAX_REPEAT = 12;
export const SITE = "https://spartanopsapp.com";

export const EVENT_KINDS = [
  { id: "skirmish", sl: "Igra", en: "Skirmish", color: "#E0B04E" },
  { id: "scenario", sl: "Scenarij", en: "Scenario", color: "#9eff3d" },
  { id: "milsim", sl: "Milsim", en: "Milsim", color: "#d97a6c" },
  { id: "night", sl: "Nočna igra", en: "Night game", color: "#7aa2f7" },
  { id: "tournament", sl: "Turnir", en: "Tournament", color: "#c39bff" },
  { id: "training", sl: "Trening", en: "Training", color: "#5ec8c0" },
  { id: "other", sl: "Drugo", en: "Other", color: "rgba(236,227,196,0.6)" },
] as const;
export type EventKind = (typeof EVENT_KINDS)[number]["id"];
export const KIND_IDS = EVENT_KINDS.map((k) => k.id) as EventKind[];
export function kindInfo(id: string) {
  return EVENT_KINDS.find((k) => k.id === id) ?? EVENT_KINDS[EVENT_KINDS.length - 1];
}
export type Lang = "sl" | "en";

/* ---------- time zones ---------- */

/** Offset (ms) of `tz` at instant `ms`: local wall clock minus UTC. */
export function tzOffsetMs(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return local - Math.floor(ms / 1000) * 1000;
}

/**
 * Wall-clock date + time in an IANA zone to a UTC ISO string. DST-safe:
 * a time inside the spring gap moves forward one hour; an ambiguous autumn time uses the first one.
 */
export function zonedToUtc(dateYmd: string, timeHm: string, tz: string = EVENT_TZ): string {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const [h, mi] = timeHm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (!Number.isFinite(guess)) throw new Error("invalid_date");
  const o1 = tzOffsetMs(guess - 86400000, tz);
  const o2 = tzOffsetMs(guess + 86400000, tz);
  const valid = [guess - o1, guess - o2].filter((c, i) => tzOffsetMs(c, tz) === (i === 0 ? o1 : o2));
  const ms = valid.length ? Math.min(...valid) : guess - o1;
  return new Date(ms).toISOString();
}

/** Wall-clock parts of an instant in a zone. */
export function zonedParts(iso: string | number | Date, tz: string = EVENT_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { ymd: `${g("year")}-${g("month")}-${g("day")}`, hm: `${g("hour")}:${g("minute")}` };
}

/** Add n days to a YYYY-MM-DD string (calendar arithmetic, no time zone). */
export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** 0 = Monday … 6 = Sunday. */
export function weekdayMon0(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}
/** Next given weekday (0 = Mon … 6 = Sun) strictly after today in Ljubljana. */
export function nextWeekday(target: number, now = new Date()): string {
  const today = zonedParts(now).ymd;
  let diff = (target - weekdayMon0(today) + 7) % 7;
  if (diff === 0) diff = 7;
  return addDaysYmd(today, diff);
}

/* ---------- formatting ---------- */

const locale = (lang: Lang) => (lang === "en" ? "en-GB" : "sl-SI");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatEventWhen(startsAt: string, endsAt: string | null, tz: string, lang: Lang, viewerTz?: string): string {
  const day = new Intl.DateTimeFormat(locale(lang), { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(startsAt));
  const time = (iso: string) => zonedParts(iso, tz).hm;
  let out = `${cap(day)} · ${time(startsAt)}`;
  if (endsAt) {
    const sameDay = zonedParts(endsAt, tz).ymd === zonedParts(startsAt, tz).ymd;
    out += sameDay ? `–${time(endsAt)}` : ` – ${new Intl.DateTimeFormat(locale(lang), { timeZone: tz, day: "numeric", month: "short" }).format(new Date(endsAt))} ${time(endsAt)}`;
  }
  // Only add the zone label when the caller passes the viewer's zone (after mount),
  // so server HTML and the first browser render always match.
  const ms = Date.parse(startsAt);
  if (viewerTz && tzOffsetMs(ms, viewerTz) !== tzOffsetMs(ms, tz)) {
    const abbr = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(startsAt)).find((p) => p.type === "timeZoneName")?.value;
    if (abbr) out += ` ${abbr}`;
  }
  return out;
}

/** Viewer's timezone, available only after mount (undefined on server and first client render). */
export function useViewerTz(): string | undefined {
  const [tz, setTz] = useState<string | undefined>(undefined);
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* ignore */ } }, []);
  return tz;
}

export function formatTimeRange(startsAt: string, endsAt: string | null, tz: string): string {
  return endsAt ? `${zonedParts(startsAt, tz).hm}–${zonedParts(endsAt, tz).hm}` : zonedParts(startsAt, tz).hm;
}

export function dateTileParts(iso: string, tz: string, lang: Lang) {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(lang), { timeZone: tz, ...o }).format(d).replace(".", "");
  return { weekday: f({ weekday: "short" }).toUpperCase(), day: f({ day: "numeric" }), month: f({ month: "short" }).toUpperCase() };
}

/** Short date like "Sob 11. jul" / "Sat 11 Jul". */
export function shortDate(iso: string, tz: string, lang: Lang): string {
  return cap(new Intl.DateTimeFormat(locale(lang), { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso))).replace(/,/g, "").replace(/(\p{L})\./gu, "$1");
}

/** "this_week", "next_week" or "YYYY-MM" (Monday-start weeks, Ljubljana calendar). */
export function weekBucket(startsAt: string, now = new Date()): string {
  const today = zonedParts(now, EVENT_TZ).ymd;
  const day = zonedParts(startsAt, EVENT_TZ).ymd;
  const monday = addDaysYmd(today, -weekdayMon0(today));
  if (day < addDaysYmd(monday, 7)) return "this_week";
  if (day < addDaysYmd(monday, 14)) return "next_week";
  return day.slice(0, 7);
}
export function bucketLabel(bucket: string, lang: Lang): string {
  if (bucket === "this_week") return lang === "en" ? "This week" : "Ta teden";
  if (bucket === "next_week") return lang === "en" ? "Next week" : "Naslednji teden";
  const [y, m] = bucket.split("-").map(Number);
  return new Intl.DateTimeFormat(locale(lang), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
}

export function eventEndMs(e: { starts_at: string; ends_at: string | null }): number {
  return e.ends_at ? Date.parse(e.ends_at) : Date.parse(e.starts_at) + 6 * 3600000;
}
export function isOngoingOrUpcoming(e: { starts_at: string; ends_at: string | null }, now = new Date()): boolean {
  return eventEndMs(e) >= now.getTime();
}
export function isToday(iso: string, tz: string, now = new Date()): boolean {
  return zonedParts(iso, tz).ymd === zonedParts(now, tz).ymd;
}

/** Saturday 00:00 to Monday 00:00 (Ljubljana) of the coming / current weekend, as UTC ms. */
export function weekendRange(now = new Date()): [number, number] {
  const today = zonedParts(now, EVENT_TZ).ymd;
  const wd = weekdayMon0(today);
  const sat = wd === 6 ? addDaysYmd(today, -1) : addDaysYmd(today, 5 - wd);
  return [Date.parse(zonedToUtc(sat, "00:00")), Date.parse(zonedToUtc(addDaysYmd(sat, 2), "00:00"))];
}

/** Accent/case-insensitive fold (mirrors the database's spartanops_fold for search). */
export function fold(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/* ---------- links ---------- */

export function safeUrl(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? t : null;
  } catch {
    return null;
  }
}

/** Plain text with only http(s) URLs turned into links. Never injects HTML. Render inside white-space: pre-wrap. */
export function linkify(text: string): ReactNode {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
  return createElement(Fragment, null, ...parts.map((p, i) => {
    if (i % 2 === 1) {
      const trail = p.match(/[.,;:!?)]+$/)?.[0] ?? "";
      const url = trail ? p.slice(0, -trail.length) : p;
      if (safeUrl(url)) {
        return createElement(Fragment, { key: i },
          createElement("a", { href: url, target: "_blank", rel: "noopener noreferrer nofollow ugc", style: { color: "#E0B04E", wordBreak: "break-all" } }, url), trail);
      }
    }
    return createElement(Fragment, { key: i }, p);
  }));
}

export function looksLikePhone(s: string): string | null {
  const t = s.trim();
  if (!/^\+?[\d\s\-/().]{7,20}$/.test(t)) return null;
  const digits = t.replace(/[^\d+]/g, "");
  return digits.replace(/\+/g, "").length >= 7 ? digits : null;
}

/** First number in a price text (e.g. "25 €" -> 25), or null. */
export function priceNumber(s: string | null | undefined): number | null {
  const m = (s ?? "").match(/(\d+(?:[.,]\d{1,2})?)/);
  return m ? Number(m[1].replace(",", ".")) : null;
}

export function slugify(s: string): string {
  return fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
}

/* ---------- calendar export ---------- */

export type IcsEvent = {
  id: string; title: string; starts_at: string; ends_at: string | null; description?: string | null;
  location_text?: string | null; status?: string; field?: { name?: string | null; city?: string | null } | null;
  /** Only set when the exact location is public. */
  geo?: { lat: number; lng: number } | null;
};

const icsDate = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold a content line at 75 octets (UTF-8 safe), continuation lines start with a space. */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (curLen + len > limit) { out.push(cur); cur = ""; curLen = 0; }
    cur += ch; curLen += len;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function eventLocation(e: IcsEvent): string {
  return e.location_text || [e.field?.name, e.field?.city].filter(Boolean).join(", ");
}
export function eventEndForCalendar(e: { starts_at: string; ends_at: string | null }): number {
  return e.ends_at ? Date.parse(e.ends_at) : Date.parse(e.starts_at) + 4 * 3600000;
}

export function buildIcs(events: IcsEvent[], opts: { name?: string; now?: Date } = {}): string {
  const stamp = icsDate((opts.now ?? new Date()).getTime());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SpartanOps//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (opts.name) lines.push(`X-WR-CALNAME:${icsEscape(opts.name)}`);
  for (const e of events) {
    const url = `${SITE}/events/${e.id}`;
    const desc = `${(e.description ?? "").slice(0, 500)}${e.description ? "\n\n" : ""}${url}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@spartanopsapp.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(Date.parse(e.starts_at))}`,
      `DTEND:${icsDate(eventEndForCalendar(e))}`,
      `SUMMARY:${icsEscape(e.title)}`,
    );
    const loc = eventLocation(e);
    if (loc) lines.push(`LOCATION:${icsEscape(loc)}`);
    if (e.geo) lines.push(`GEO:${e.geo.lat};${e.geo.lng}`);
    lines.push(`DESCRIPTION:${icsEscape(desc)}`, `URL:${url}`);
    if (e.status === "cancelled") lines.push("STATUS:CANCELLED");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: IcsEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(Date.parse(e.starts_at))}/${icsDate(eventEndForCalendar(e))}`,
    details: `${(e.description ?? "").slice(0, 500)}\n\n${SITE}/events/${e.id}`,
    location: eventLocation(e),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/* ---------- price ---------- */

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CZK", "PLN", "HUF", "RON", "RSD", "BAM", "SEK", "DKK", "NOK", "BGN"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "EUR";

/** Currency symbol for a code in the given language, e.g. EUR -> "€". */
export function currencySymbol(code: string, lang: Lang = "en"): string {
  try {
    return new Intl.NumberFormat(locale(lang), { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0).find((p) => p.type === "currency")?.value ?? code;
  } catch { return code; }
}

/** "25 €" (sl) / "€25" (en); 0 is "Brezplačno" / "Free". No decimals for whole amounts. */
export function formatPrice(amount: number, currency: string, lang: Lang): string {
  if (amount === 0) return lang === "en" ? "Free" : "Brezplačno";
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(locale(lang), {
    style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

/** Price label for cards: structured price first, else the old free text. */
export function priceLabel(e: { price_amount?: number | string | null; price_currency?: string | null; price_text?: string | null }, lang: Lang): string | null {
  if (e.price_amount !== null && e.price_amount !== undefined && e.price_currency) return formatPrice(Number(e.price_amount), e.price_currency, lang);
  return e.price_text || null;
}

/* ---------- exact location ---------- */

export type LatLng = { lat: number; lng: number };
export type ParsedLocation = { kind: "point"; lat: number; lng: number } | { kind: "resolve"; url: string } | { kind: "error"; error: "invalid" | "range" };

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function validLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

function point(lat: number, lng: number): ParsedLocation {
  return validLatLng(lat, lng) ? { kind: "point", lat: round6(lat), lng: round6(lng) } : { kind: "error", error: "range" };
}

const NUM = String.raw`-?\d{1,3}(?:\.\d+)?`;

/** Coordinates found in a Google Maps URL (`!3d…!4d…`, `@lat,lng`, or q/query/ll/center/destination params). */
export function latLngFromMapsUrl(raw: string): LatLng | null {
  let s = raw;
  try { s = decodeURIComponent(raw); } catch { /* keep raw */ }
  const d34 = s.match(new RegExp(`!3d(${NUM})!4d(${NUM})`));
  if (d34) return { lat: Number(d34[1]), lng: Number(d34[2]) };
  const at = s.match(new RegExp(`@(${NUM}),(${NUM})`));
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  try {
    const u = new URL(raw);
    for (const k of ["q", "query", "ll", "center", "destination", "daddr"]) {
      const v = u.searchParams.get(k);
      const m = v?.trim().match(new RegExp(`^(?:loc:)?\\s*(${NUM})\\s*,\\s*(${NUM})$`));
      if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
    }
  } catch { /* not a URL */ }
  return null;
}

/** Hosts we may fetch while resolving a Maps short link. */
export function mapsHostAllowed(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase();
  if (h === "goo.gl") return u.pathname.startsWith("/maps");
  return ["maps.app.goo.gl", "google.com", "www.google.com", "maps.google.com", "www.google.si"].includes(h);
}

function isShortLink(raw: string): boolean {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return h === "maps.app.goo.gl" || (h === "goo.gl" && u.pathname.startsWith("/maps"));
  } catch { return false; }
}

/**
 * Parses pasted text into a point. Accepts decimal coordinates (comma, space or semicolon separated,
 * decimal comma when unambiguous), degrees/minutes/seconds, and Google Maps links. Short links need resolving.
 */
export function parseLocationInput(text: string): ParsedLocation {
  const t = (text ?? "").trim();
  if (!t || t.length > 2000) return { kind: "error", error: "invalid" };
  const urlText = /^https?:\/\//i.test(t) ? t : /^(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.)/i.test(t) ? `https://${t}` : null;
  if (urlText) {
    if (isShortLink(urlText)) return { kind: "resolve", url: urlText.replace(/^http:/i, "https:") };
    const p = latLngFromMapsUrl(urlText);
    return p ? point(p.lat, p.lng) : { kind: "error", error: "invalid" };
  }
  const dms = t.match(/^(\d{1,3})\s*°\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["″”]|'')?\s*([NS])[\s,;]*(\d{1,3})\s*°\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["″”]|'')?\s*([EW])$/i);
  if (dms) {
    const conv = (d: string, m: string, s: string, h: string) => (Number(d) + Number(m) / 60 + Number(s.replace(",", ".")) / 3600) * (/[SW]/i.test(h) ? -1 : 1);
    return point(conv(dms[1], dms[2], dms[3], dms[4]), conv(dms[5], dms[6], dms[7], dms[8]));
  }
  const dec = t.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (dec) return point(Number(dec[1]), Number(dec[2]));
  const comma = t.match(/^(-?\d{1,3},\d+)\s*(?:;|\s)\s*(-?\d{1,3},\d+)$/);
  if (comma) return point(Number(comma[1].replace(",", ".")), Number(comma[2].replace(",", ".")));
  return { kind: "error", error: "invalid" };
}

export const fmtLatLng = (p: LatLng) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
export const googleMapsUrl = (p: LatLng) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
export const wazeUrl = (p: LatLng) => `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
export const appleMapsUrl = (p: LatLng, name: string) => `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${encodeURIComponent(name)}`;

/**
 * Follows a Maps short link with manual redirects (max 4 hops), checking every hop's host.
 * Reads only Location headers and the final URL; never returns page content.
 */
export async function resolveMapsChain(url: string, fetchFn: typeof fetch = fetch): Promise<LatLng | null> {
  let cur = url;
  for (let hop = 0; hop <= 4; hop++) {
    if (!mapsHostAllowed(cur)) return null;
    const direct = latLngFromMapsUrl(cur);
    if (direct && validLatLng(direct.lat, direct.lng)) return direct;
    if (hop === 4) return null;
    let res: Response;
    try {
      res = await fetchFn(cur, { redirect: "manual", signal: AbortSignal.timeout(4000), headers: { "User-Agent": "Mozilla/5.0 (SpartanOps link check)" } });
    } catch { return null; }
    try { await res.body?.cancel(); } catch { /* ignore */ }
    const loc = res.headers.get("location");
    if (!loc) return null;
    let next: URL;
    try { next = new URL(loc, cur); } catch { return null; }
    if (next.hostname.toLowerCase() === "consent.google.com") {
      const cont = next.searchParams.get("continue");
      if (!cont) return null;
      cur = cont;
    } else cur = next.toString();
  }
  return null;
}
