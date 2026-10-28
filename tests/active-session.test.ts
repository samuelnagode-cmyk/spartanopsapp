import { afterEach, describe, expect, it, vi } from "vitest";
import { saveActiveSession } from "../src/lib/active-session";

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