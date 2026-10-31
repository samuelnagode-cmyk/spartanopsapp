import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_SESSION_MAX_AGE_MS, isFreshActiveSession, saveActiveSession } from "../src/lib/active-session";

afterEach(() => vi.unstubAllGlobals());

describe("player recovery metadata", () => {
  it("saves field, team and current game without changing the device identity", () => {
    const data = new Map<string, string>([["spartanops:session_id", "same-device"]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    saveActiveSession("field-one", { team: "modra", currentGame: "2026-10-28T19:00:00Z", status: "active" });
    const saved = JSON.parse(data.get("spartanops.active_session") ?? "null");
    expect(saved.field).toBe("field-one");
    expect(saved.team).toBe("modra");
    expect(saved.currentGame).toBe("2026-10-28T19:00:00Z");
    expect(data.get("spartanops:session_id")).toBe("same-device");
    saveActiveSession("field-two");
    expect(JSON.parse(data.get("spartanops.active_session") ?? "null").team).toBeUndefined();
  });
});

describe("isFreshActiveSession", () => {
  const now = 1_800_000_000_000;
  it("accepts a record saved just now", () => {
    expect(isFreshActiveSession({ at: now }, now)).toBe(true);
  });
  it("accepts an 11-hour-old record", () => {
    expect(isFreshActiveSession({ at: now - 11 * 60 * 60 * 1000 }, now)).toBe(true);
  });
  it("accepts a record exactly 12 hours old", () => {
    expect(isFreshActiveSession({ at: now - ACTIVE_SESSION_MAX_AGE_MS }, now)).toBe(true);
  });
  it("rejects a 13-hour-old record", () => {
    expect(isFreshActiveSession({ at: now - 13 * 60 * 60 * 1000 }, now)).toBe(false);
  });
  it("rejects a timestamp in the future", () => {
    expect(isFreshActiveSession({ at: now + 1000 }, now)).toBe(false);
  });
  it("rejects a record without at", () => {
    expect(isFreshActiveSession({}, now)).toBe(false);
  });
  it("rejects a non-numeric at", () => {
    expect(isFreshActiveSession({ at: "yesterday" as unknown as number }, now)).toBe(false);
  });
  it("rejects null and undefined", () => {
    expect(isFreshActiveSession(null, now)).toBe(false);
    expect(isFreshActiveSession(undefined, now)).toBe(false);
  });
});