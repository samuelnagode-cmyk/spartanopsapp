import { describe, expect, it } from "vitest";
import { FIELD_ATTEMPT_RETENTION_SEC, throttleState } from "../src/lib/field-attempts";

const now = 1_800_000_000_000;

describe("field password attempts", () => {
  for (const count of [0, 9, 10, 39]) {
    it(`does not throttle ${count} failures`, () => {
      expect(throttleState(Array(count).fill(now), now)).toEqual({ throttled: false, retryAfterSec: 0 });
    });
  }
  it("throttles 40 failures for a ten-minute window", () => {
    expect(throttleState(Array(40).fill(now), now)).toEqual({ throttled: true, retryAfterSec: 600 });
  });
  it("does not count failures older than ten minutes", () => {
    expect(throttleState([...Array(39).fill(now), now - 600_001], now)).toEqual({ throttled: false, retryAfterSec: 0 });
  });
  it("calculates the wait from the oldest in-window failure, even when unsorted", () => {
    expect(throttleState([...Array(39).fill(now), now - 123_456, now - 600_001], now)).toEqual({ throttled: true, retryAfterSec: 477 });
  });
  it("includes the exact window boundary and waits at least one second", () => {
    expect(throttleState([...Array(39).fill(now), now - 600_000], now)).toEqual({ throttled: true, retryAfterSec: 1 });
  });
  it("keeps attempt retention at 24 hours", () => {
    expect(FIELD_ATTEMPT_RETENTION_SEC).toBe(86_400);
  });
});