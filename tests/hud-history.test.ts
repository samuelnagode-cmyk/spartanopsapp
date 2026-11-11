import { describe, it, expect, beforeEach } from "vitest";
import { writeDeathEvents, readDeathEvents, mapDeathRow } from "@/lib/hud-history";

describe("hud death history", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as any).window = {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    };
  });

  it("writeDeathEvents replaces the stored list", () => {
    writeDeathEvents("f1", [{ id: "a-1", callsign: "A", team: "modra", at: 1 }]);
    writeDeathEvents("f1", [{ id: "b-2", callsign: "B", team: "rdeca", at: 2 }]);
    expect(readDeathEvents("f1")).toEqual([{ id: "b-2", callsign: "B", team: "rdeca", at: 2 }]);
  });

  it("maps a server row keeping the check-in id prefix", () => {
    const d = mapDeathRow({ id: "row9", checkin_id: "chk-123", callsign: "VIPER", team: "modra", died_at: "2026-11-11T12:00:00.000Z" });
    expect(d.id).toBe("chk-123-row9");
    expect(d.id.startsWith("chk-123-")).toBe(true);
    expect(d.at).toBe(Date.parse("2026-11-11T12:00:00.000Z"));
    expect(d.callsign).toBe("VIPER");
  });
});
