import { describe, expect, it } from "vitest";
import { RESPAWN_RESCAN_GUARD_MS, shouldIgnoreRespawnScan } from "@/lib/respawn-scan";

describe("respawn scan guard", () => {
  const first = 100_000;
  it("accepts the first scan ever", () => {
    expect(shouldIgnoreRespawnScan({ lastScanMs: 0, lockUntilMs: 0, nowMs: first })).toBe(false);
  });
  it("accepts a second scan after 20 seconds when a 15-second lock ended", () => {
    expect(shouldIgnoreRespawnScan({ lastScanMs: first, lockUntilMs: first + 15_000, nowMs: first + 20_000 })).toBe(false);
  });
  it("ignores a second scan while the lock is running", () => {
    expect(shouldIgnoreRespawnScan({ lastScanMs: first, lockUntilMs: first + 30_000, nowMs: first + 20_000 })).toBe(true);
  });
  it("ignores a scan five seconds after the previous scan", () => {
    expect(shouldIgnoreRespawnScan({ lastScanMs: first, lockUntilMs: 0, nowMs: first + 5_000 })).toBe(true);
  });
  it("accepts a scan eleven seconds later without a lock", () => {
    expect(shouldIgnoreRespawnScan({ lastScanMs: first, lockUntilMs: 0, nowMs: first + 11_000 })).toBe(false);
  });
  it("treats missing and NaN lock values as no lock", () => {
    for (const lockUntilMs of [Number(null), Number("not a number")]) {
      expect(shouldIgnoreRespawnScan({ lastScanMs: first, lockUntilMs, nowMs: first + 11_000 })).toBe(false);
    }
  });
  it("ends the double-tap guard at exactly ten seconds", () => {
    expect(RESPAWN_RESCAN_GUARD_MS).toBe(10_000);
    expect(shouldIgnoreRespawnScan({ lastScanMs: first, lockUntilMs: 0, nowMs: first + 9_999 })).toBe(true);
    expect(shouldIgnoreRespawnScan({ lastScanMs: first, lockUntilMs: 0, nowMs: first + 10_000 })).toBe(false);
  });
});