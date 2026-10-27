import { describe, expect, it, vi } from "vitest";
import { buildNoticeEmail, sendEventNotice, BATCH_SIZE } from "../src/lib/event-notify.server";

const EV = { id: "11111111-1111-1111-1111-111111111111", title: "Night <b>op</b>", tz: "Europe/Ljubljana", status: "cancelled", cancel_reason: "Rain & <script>x</script>" };
const env = { LOVABLE_API_KEY: "k1", RESEND_API_KEY: "k2" };

type Rsvp = { email: string; status: "going" | "maybe"; notify: boolean };

/** Fake db: the recipients RPC mimics the SQL filter (going/maybe + notify on). */
function fakeDb(rsvps: Rsvp[], recentNotice = false) {
  const inserts: unknown[] = [];
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    const self = new Proxy(q, {
      get(_t, prop) {
        if (prop === "insert") return (row: unknown) => { inserts.push(row); return Promise.resolve({ error: null }); };
        if (prop === "maybeSingle") return () => Promise.resolve({ data: table === "spartanops_events" ? EV : null });
        if (prop === "limit") return () => Promise.resolve({ data: recentNotice ? [{ id: "x" }] : [] });
        return () => self;
      },
    });
    return self;
  };
  const rpc = vi.fn(() => Promise.resolve({
    data: rsvps.filter((r) => r.notify && (r.status === "going" || r.status === "maybe")).map((r, i) => ({ user_id: String(i), email: r.email })),
    error: null,
  }));
  return { db: { from: chain, rpc }, inserts, rpc };
}

const okFetch = () => vi.fn(async () => new Response("{}", { status: 200 }));
const bodies = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string) as { to: string[]; html: string }[]);

describe("sendEventNotice", () => {
  it("emails going and maybe players with notifications on, never those with it off", async () => {
    const { db } = fakeDb([
      { email: "a@x.test", status: "going", notify: true },
      { email: "b@x.test", status: "maybe", notify: true },
      { email: "c@x.test", status: "going", notify: false },
    ]);
    const f = okFetch();
    const r = await sendEventNotice({ eventId: EV.id, kind: "cancelled" }, { db, fetch: f as never, env });
    expect(r).toEqual({ recipients: 2, sent: 2, failed: 0 });
    const all = bodies(f).flat();
    expect(all.map((e) => e.to)).toEqual([["a@x.test"], ["b@x.test"]]);
    expect(JSON.stringify(all)).not.toContain("c@x.test");
  });

  it("one email per player and no other player's address in any payload", async () => {
    const { db } = fakeDb([{ email: "a@x.test", status: "going", notify: true }, { email: "b@x.test", status: "going", notify: true }]);
    const f = okFetch();
    await sendEventNotice({ eventId: EV.id, kind: "cancelled" }, { db, fetch: f as never, env });
    for (const e of bodies(f).flat()) {
      expect(e.to).toHaveLength(1);
      const other = e.to[0] === "a@x.test" ? "b@x.test" : "a@x.test";
      expect(JSON.stringify(e)).not.toContain(other);
      expect(e).not.toHaveProperty("cc");
      expect(e).not.toHaveProperty("bcc");
    }
  });

  it("sends in batches of 100", async () => {
    const rs = Array.from({ length: 230 }, (_, i) => ({ email: `p${i}@x.test`, status: "going" as const, notify: true }));
    const { db, inserts } = fakeDb(rs);
    const f = okFetch();
    const r = await sendEventNotice({ eventId: EV.id, kind: "cancelled" }, { db, fetch: f as never, env });
    expect(BATCH_SIZE).toBe(100);
    expect(bodies(f).map((b) => b.length)).toEqual([100, 100, 30]);
    expect(String(f.mock.calls[0][0])).toMatch(/\/emails\/batch$/);
    expect(r.sent).toBe(230);
    expect(inserts).toHaveLength(1);
  });

  it("not_configured sends nothing", async () => {
    const { db, rpc } = fakeDb([{ email: "a@x.test", status: "going", notify: true }]);
    const f = okFetch();
    const r = await sendEventNotice({ eventId: EV.id, kind: "cancelled" }, { db, fetch: f as never, env: { LOVABLE_API_KEY: "k1" } });
    expect(r.reason).toBe("not_configured");
    expect(f).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("duplicate within 2 minutes sends nothing", async () => {
    const { db } = fakeDb([{ email: "a@x.test", status: "going", notify: true }], true);
    const f = okFetch();
    const r = await sendEventNotice({ eventId: EV.id, kind: "cancelled" }, { db, fetch: f as never, env });
    expect(r.reason).toBe("duplicate");
    expect(f).not.toHaveBeenCalled();
  });

  it("a failing send is counted as failed and does not throw", async () => {
    const { db } = fakeDb([{ email: "a@x.test", status: "going", notify: true }, { email: "b@x.test", status: "maybe", notify: true }]);
    const f = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    const r = await sendEventNotice({ eventId: EV.id, kind: "cancelled" }, { db, fetch: f as never, env });
    expect(r).toEqual({ recipients: 2, sent: 0, failed: 2 });
    const f2 = vi.fn(async () => new Response("no", { status: 403 }));
    const r2 = await sendEventNotice({ eventId: EV.id, kind: "cancelled" }, { db, fetch: f2 as never, env });
    expect(r2.failed).toBe(2);
  });
});

describe("buildNoticeEmail", () => {
  it("escapes HTML in title, reason and note", () => {
    const c = buildNoticeEmail(EV, { kind: "cancelled" });
    expect(c.html).not.toContain("<b>op</b>");
    expect(c.html).not.toContain("<script>");
    expect(c.html).toContain("Night &lt;b&gt;op&lt;/b&gt;");
    expect(c.html).toContain("Rain &amp; &lt;script&gt;");
    expect(c.subject).toBe("Odpovedano / Cancelled: Night <b>op</b>");
    const m = buildNoticeEmail(EV, { kind: "moved", oldStartsAt: "2026-11-01T09:00:00Z", newStartsAt: "2026-11-08T09:00:00Z", note: "<img src=x>" });
    expect(m.html).not.toContain("<img");
    expect(m.subject).toBe("Nov termin / New time: Night <b>op</b>");
  });

  it("links to the event page and has no address or map", () => {
    const c = buildNoticeEmail(EV, { kind: "cancelled" });
    expect(c.html).toContain(`https://spartanopsapp.com/events/${EV.id}`);
    expect(c.html).toContain("je odpovedan");
    expect(c.html).toContain("has been cancelled");
    expect(c.html).not.toMatch(/maps\.|google\.com\/maps/);
  });
});
