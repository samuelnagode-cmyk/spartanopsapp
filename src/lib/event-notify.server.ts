/* Server only. Emails players who answered an event (going/maybe) and kept
   notifications on, when the organiser cancels (or, in part 2, moves) it.
   Never throws, never logs addresses, keys or request bodies. */
import { formatEventWhen, SITE } from "./events";

// The domain must be verified in Resend. Until it is, Resend refuses the send
// and every email in the notice is counted as failed.
export const NOTIFY_FROM = "SpartanOps <notify@spartanopsapp.com>";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
export const BATCH_SIZE = 100;
const TIMEOUT_MS = 8000;
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

export type NoticeKind = "cancelled" | "moved";
export type NoticeArgs = {
  eventId: string;
  kind: NoticeKind;
  oldStartsAt?: string;
  newStartsAt?: string;
  placeChanged?: boolean;
  note?: string;
};
export type NoticeResult = { recipients: number; sent: number; failed: number; reason?: "not_configured" | "duplicate" | "none" };

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export type NoticeEvent = { id: string; title: string; tz: string; cancel_reason: string | null };

/** Pure: builds subject + html + text for one notice. Same content for every recipient. */
export function buildNoticeEmail(ev: NoticeEvent, args: Omit<NoticeArgs, "eventId">) {
  const t = escapeHtml(ev.title);
  const link = `${SITE}/events/${encodeURIComponent(ev.id)}`;
  const when = (iso: string | undefined, lang: "sl" | "en") => (iso ? formatEventWhen(iso, null, ev.tz, lang) : "");
  const p = (s: string) => `<p style="margin:0 0 10px;">${s}</p>`;
  const sl: string[] = [];
  const en: string[] = [];
  let subject: string;
  if (args.kind === "cancelled") {
    subject = `Odpovedano / Cancelled: ${ev.title}`;
    sl.push(`Dogodek »${t}« je odpovedan.`);
    en.push(`The event "${t}" has been cancelled.`);
    if (ev.cancel_reason) {
      sl.push(`Razlog: ${escapeHtml(ev.cancel_reason)}`);
      en.push(`Reason: ${escapeHtml(ev.cancel_reason)}`);
    }
  } else {
    subject = `Nov termin / New time: ${ev.title}`;
    sl.push(`Dogodek »${t}« je prestavljen.`);
    en.push(`The event "${t}" has been moved.`);
    if (args.oldStartsAt) { sl.push(`Prej / Before: ${escapeHtml(when(args.oldStartsAt, "sl"))}`); en.push(`Before: ${escapeHtml(when(args.oldStartsAt, "en"))}`); }
    if (args.newStartsAt) { sl.push(`Zdaj / Now: ${escapeHtml(when(args.newStartsAt, "sl"))}`); en.push(`Now: ${escapeHtml(when(args.newStartsAt, "en"))}`); }
    if (args.placeChanged) { sl.push("Kraj se je spremenil, poglej stran dogodka."); en.push("The place changed, see the event page."); }
    if (args.note) { sl.push(`Sporočilo organizatorja: ${escapeHtml(args.note)}`); en.push(`Note from the organiser: ${escapeHtml(args.note)}`); }
  }
  sl.push(`Stran dogodka: <a href="${link}">${link}</a>`);
  en.push(`Event page: <a href="${link}">${link}</a>`);
  const footer = "Ta e-pošta je prišla, ker si odgovoril na ta dogodek in imaš obvestila vklopljena. Izklopiš jih lahko na strani dogodka.<br/>You got this email because you answered this event and notifications are on. You can switch them off on the event page.";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px;">${sl.map(p).join("")}<hr style="border:none;border-top:1px solid #ddd;margin:16px 0;"/>${en.map(p).join("")}<p style="margin:20px 0 0;font-size:12px;color:#666;">${footer}</p></div>`;
  const strip = (s: string) => s.replace(/<a href="[^"]*">([^<]*)<\/a>/g, "$1").replace(/<br\/>/g, "\n")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const text = [...sl, "", ...en, "", footer].map(strip).join("\n");
  return { subject, html, text };
}

type Db = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};
export type NoticeDeps = { db?: Db; fetch?: typeof fetch; env?: Record<string, string | undefined> };

async function postWithTimeout(f: typeof fetch, url: string, init: RequestInit): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try { return await f(url, { ...init, signal: ctrl.signal }); }
  catch { return null; }
  finally { clearTimeout(timer); }
}

export async function sendEventNotice(args: NoticeArgs, deps: NoticeDeps = {}): Promise<NoticeResult> {
  const res: NoticeResult = { recipients: 0, sent: 0, failed: 0 };
  try {
    const env = deps.env ?? process.env;
    const lovableKey = env.LOVABLE_API_KEY;
    const resendKey = env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) return { ...res, reason: "not_configured" };
    const db: Db = deps.db ?? ((await import("@/integrations/supabase/client.server")).supabaseAdmin as unknown as Db);
    const f = deps.fetch ?? fetch;

    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const { data: recent } = await db.from("spartanops_event_notices").select("id")
      .eq("event_id", args.eventId).eq("kind", args.kind).gte("created_at", since).limit(1);
    if (recent && recent.length > 0) return { ...res, reason: "duplicate" };

    const { data: ev } = await db.from("spartanops_events").select("id, title, tz, status, cancel_reason").eq("id", args.eventId).maybeSingle();
    if (!ev) return { ...res, reason: "none" };
    const { data: rec, error: recErr } = await db.rpc("spartanops_event_notice_recipients", { p_event: args.eventId });
    if (recErr) console.error("[sendEventNotice] recipients", recErr.code);
    const emails = Array.from(new Set(((rec ?? []) as { email: string | null }[]).map((r) => r.email).filter((e): e is string => !!e)));
    res.recipients = emails.length;
    if (emails.length === 0) {
      await logNotice(db, args, res);
      return { ...res, reason: "none" };
    }

    const { subject, html, text } = buildNoticeEmail(ev as NoticeEvent, args);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": resendKey };
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const chunk = emails.slice(i, i + BATCH_SIZE);
      // One email object per player: each "to" holds exactly one address.
      const body = chunk.map((to) => ({ from: NOTIFY_FROM, to: [to], subject, html, text }));
      const r = await postWithTimeout(f, `${GATEWAY_URL}/emails/batch`, { method: "POST", headers, body: JSON.stringify(body) });
      if (r && r.ok) res.sent += chunk.length;
      else {
        res.failed += chunk.length;
        if (r) console.error("[sendEventNotice] batch failed", r.status);
        else console.error("[sendEventNotice] batch failed (network/timeout)");
      }
    }
    await logNotice(db, args, res);
    return res;
  } catch (e) {
    console.error("[sendEventNotice] error", e instanceof Error ? e.name : "unknown");
    res.failed = Math.max(res.failed, res.recipients - res.sent);
    return res;
  }
}

async function logNotice(db: Db, args: NoticeArgs, r: NoticeResult) {
  try {
    await db.from("spartanops_event_notices").insert({ event_id: args.eventId, kind: args.kind, recipients: r.recipients, sent: r.sent, failed: r.failed });
  } catch { /* counts only; never block */ }
}
