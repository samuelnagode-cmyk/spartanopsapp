import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/event-rsvps.functions", () => ({ countsFor: vi.fn(async (ids: string[]) => ({ [ids[0]]: { going: 3, maybe: 1, seatsOffered: 0 } })) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import { diffEventChanges } from "../src/lib/event-changes";
import { saveEventEdit } from "../src/lib/events.functions";

const base = { starts_at: "2026-11-01T09:00:00.000Z", ends_at: null as string | null, location_text: "Gozd", lat: 46.1, lng: 14.5 };

describe("diffEventChanges", () => {
  it("same instant written differently is not a change", () => {
    expect(diffEventChanges(base, { ...base, starts_at: "2026-11-01T10:00:00+01:00" })).toEqual({ time: false, place: false });
  });
  it("only the end time", () => {
    expect(diffEventChanges(base, { ...base, ends_at: "2026-11-01T15:00:00Z" })).toEqual({ time: true, place: false });
  });
  it("only the place text (trimmed)", () => {
    expect(diffEventChanges(base, { ...base, location_text: "  Gozd  " }).place).toBe(false);
    expect(diffEventChanges(base, { ...base, location_text: "Travnik" })).toEqual({ time: false, place: true });
  });
  it("lat/lng within tolerance", () => {
    expect(diffEventChanges(base, { ...base, lat: 46.100005 }).place).toBe(false);
    expect(diffEventChanges(base, { ...base, lat: 46.1001 }).place).toBe(true);
  });
  it("null versus value", () => {
    expect(diffEventChanges({ ...base, lat: null, lng: null }, base).place).toBe(true);
    expect(diffEventChanges({ ...base, location_text: null }, { ...base, location_text: "" }).place).toBe(false);
  });
});

function fakeDb(opts: { prev: Record<string, unknown>; recipients: number; rsvpCount?: number }) {
  const updates: Record<string, unknown>[] = [];
  const from = (table: string) => {
    let mode = "select";
    const self: Record<string, unknown> = {};
    const p = new Proxy(self, {
      get(_t, prop) {
        if (prop === "then") {
          if (table === "spartanops_event_rsvps") return (res: (v: unknown) => void) => res({ count: opts.rsvpCount ?? 0 });
          return undefined;
        }
        if (prop === "update") return (row: Record<string, unknown>) => { mode = "update"; updates.push(row); return p; };
        if (prop === "single") return async () => (mode === "update" ? { data: { id: "e1" }, error: null } : { data: opts.prev });
        return () => p;
      },
    });
    return p;
  };
  const rpc = vi.fn(async () => ({ data: Array.from({ length: opts.recipients }, (_, i) => ({ user_id: String(i), email: `p${i}@x.test` })) }));
  return { db: { from, rpc }, updates };
}

const prevPub = { ...base, status: "published" };
const movedBuilt = { ...base, starts_at: "2026-11-08T09:00:00.000Z" };
const sendOk = () => vi.fn(async () => ({ recipients: 2, sent: 2, failed: 0 }));

describe("saveEventEdit", () => {
  it("time changed with recipients and no notify asks and saves nothing", async () => {
    const { db, updates } = fakeDb({ prev: prevPub, recipients: 2 });
    const send = sendOk();
    const r = await saveEventEdit(db, "u", "e1", movedBuilt, undefined, send);
    expect(r).toEqual({ needsDecision: true, changes: { time: true, place: false }, recipients: 2, answers: 4 });
    expect(updates).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });
  it("send true saves and notifies once", async () => {
    const { db, updates } = fakeDb({ prev: prevPub, recipients: 2, rsvpCount: 4 });
    const send = sendOk();
    const r = await saveEventEdit(db, "u", "e1", movedBuilt, { send: true, note: "Sorry" }, send);
    expect(updates).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ kind: "moved", oldStartsAt: base.starts_at, newStartsAt: movedBuilt.starts_at, placeChanged: false, note: "Sorry" });
    expect(r).toMatchObject({ ids: ["e1"], notice: { sent: 2 } });
  });
  it("send false saves and sends nothing", async () => {
    const { db, updates } = fakeDb({ prev: prevPub, recipients: 2 });
    const send = sendOk();
    expect(await saveEventEdit(db, "u", "e1", movedBuilt, { send: false }, send)).toEqual({ ids: ["e1"] });
    expect(updates).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });
  it("no time/place change saves normally and never asks", async () => {
    const { db, updates } = fakeDb({ prev: prevPub, recipients: 2 });
    const send = sendOk();
    expect(await saveEventEdit(db, "u", "e1", { ...base, title: "New title" }, undefined, send)).toEqual({ ids: ["e1"] });
    expect(updates).toHaveLength(1);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("zero recipients saves normally and never asks", async () => {
    const { db, updates } = fakeDb({ prev: prevPub, recipients: 0 });
    expect(await saveEventEdit(db, "u", "e1", movedBuilt, undefined, sendOk())).toEqual({ ids: ["e1"] });
    expect(updates).toHaveLength(1);
  });
  it("a cancelled event never sends or asks", async () => {
    const { db, updates } = fakeDb({ prev: { ...base, status: "cancelled" }, recipients: 2 });
    const send = sendOk();
    expect(await saveEventEdit(db, "u", "e1", movedBuilt, { send: true }, send)).toEqual({ ids: ["e1"] });
    expect(updates).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });
  it("schedule_changed_at rule unchanged: only new start time with answers", async () => {
    const a = fakeDb({ prev: prevPub, recipients: 0, rsvpCount: 3 });
    await saveEventEdit(a.db, "u", "e1", movedBuilt, undefined, sendOk());
    expect(a.updates[0]).toHaveProperty("schedule_changed_at");
    const b = fakeDb({ prev: prevPub, recipients: 0, rsvpCount: 0 });
    await saveEventEdit(b.db, "u", "e1", movedBuilt, undefined, sendOk());
    expect(b.updates[0]).not.toHaveProperty("schedule_changed_at");
    const c = fakeDb({ prev: prevPub, recipients: 0, rsvpCount: 3 });
    await saveEventEdit(c.db, "u", "e1", { ...base, ends_at: "2026-11-01T15:00:00Z" }, undefined, sendOk());
    expect(c.updates[0]).not.toHaveProperty("schedule_changed_at");
  });
});
