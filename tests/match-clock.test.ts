import { describe, it, expect } from "vitest";
import { matchClock, formatMmSs } from "@/lib/match-clock";

const S = 1_000_000_000_000;
const base = { matchStartedAtMs: S, durationMin: 30, pausedAtMs: null };

describe("matchClock", () => {
  it("inactive with no start", () => {
    const c = matchClock({ ...base, status: "lobby", matchStartedAtMs: null, nowMs: S });
    expect(c.phase).toBe("inactive"); expect(c.remainingSec).toBe(1800);
  });
  it("inactive for closed even with start", () => {
    expect(matchClock({ ...base, status: "closed", nowMs: S }).phase).toBe("inactive");
  });
  it("prestart rounds up (9.2s -> 10)", () => {
    const c = matchClock({ ...base, status: "active", nowMs: S - 9200 });
    expect(c.phase).toBe("prestart"); expect(c.countdownSec).toBe(10); expect(c.remainingSec).toBe(1800);
  });
  it("live after 90s of 30 min is 1710", () => {
    const c = matchClock({ ...base, status: "active", nowMs: S + 90_000 });
    expect(c.phase).toBe("live"); expect(c.remainingSec).toBe(1710); expect(c.elapsedSec).toBe(90);
  });
  it("time up exactly at the end", () => {
    const c = matchClock({ ...base, status: "active", nowMs: S + 1_800_000 });
    expect(c.phase).toBe("timeup"); expect(c.remainingSec).toBe(0);
  });
  it("paused stays frozen when now moves on", () => {
    const a = matchClock({ ...base, status: "paused", pausedAtMs: S + 60_000, nowMs: S + 100_000 });
    const b = matchClock({ ...base, status: "paused", pausedAtMs: S + 60_000, nowMs: S + 900_000 });
    expect(a.phase).toBe("paused"); expect(a.remainingSec).toBe(1740); expect(b.remainingSec).toBe(1740);
  });
  it("paused without pausedAt falls back to now", () => {
    expect(matchClock({ ...base, status: "paused", nowMs: S + 30_000 }).remainingSec).toBe(1770);
  });
  it("ended", () => {
    const c = matchClock({ ...base, status: "ended", nowMs: S + 5000 });
    expect(c.phase).toBe("ended"); expect(c.remainingSec).toBe(0);
  });
  it("formats 120 minutes", () => { expect(formatMmSs(7200)).toBe("120:00"); expect(formatMmSs(65)).toBe("01:05"); });
});
