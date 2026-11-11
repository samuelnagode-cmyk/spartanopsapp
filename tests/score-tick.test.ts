import { describe, it, expect } from "vitest";
import { scoreTickBaseMs, isScoreTickDue, SCORE_TICK_MS } from "@/lib/score-tick";

const T = "2026-11-11T12:00:00.000Z";
const S = "2026-11-11T11:50:00.000Z";

describe("scoreTickBaseMs", () => {
  it("prefers score_ticked_at", () => expect(scoreTickBaseMs(T, S)).toBe(Date.parse(T)));
  it("falls back to match_started_at", () => {
    expect(scoreTickBaseMs(null, S)).toBe(Date.parse(S));
    expect(scoreTickBaseMs("garbage", S)).toBe(Date.parse(S));
  });
  it("returns null when both missing or invalid", () => {
    expect(scoreTickBaseMs(null, null)).toBeNull();
    expect(scoreTickBaseMs("x", "y")).toBeNull();
  });
});

describe("isScoreTickDue", () => {
  const base = Date.parse(T);
  it("is false before base + 30 s + jitter", () => expect(isScoreTickDue(base, base + SCORE_TICK_MS + 1999, 2000)).toBe(false));
  it("is true at and after it", () => {
    expect(isScoreTickDue(base, base + 32_000, 2000)).toBe(true);
    expect(isScoreTickDue(base, base + 90_000, 2000)).toBe(true);
  });
  it("is false for a null base", () => expect(isScoreTickDue(null, Date.now(), 0)).toBe(false));
});
