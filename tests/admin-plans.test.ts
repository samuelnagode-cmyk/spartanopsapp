import { describe, it, expect } from "vitest";
import { addOneMonth } from "../src/components/AdminFieldsPlans";
import { validatePlanInput } from "../src/lib/spartanops-plan.functions";

const now = new Date("2026-10-10T10:00:00Z");

describe("+1 month", () => {
  it("31 March moves to 30 April", () => expect(addOneMonth("2027-03-31", now)).toBe("2027-04-30"));
  it("31 January moves to 28 February", () => expect(addOneMonth("2027-01-31", now)).toBe("2027-02-28"));
  it("empty counts from today", () => expect(addOneMonth("", now)).toBe("2026-11-10"));
  it("past date counts from today", () => expect(addOneMonth("2025-01-15", now)).toBe("2026-11-10"));
});

describe("set plan validation", () => {
  it("rejects a bad plan", () => expect(() => validatePlanInput({ plan: "gold" })).toThrow());
  it("rejects a bad date", () => expect(() => validatePlanInput({ plan: "pro", planUntil: "2027-02-30" })).toThrow());
  it("rejects a note over 200 characters", () => expect(() => validatePlanInput({ plan: "free", note: "x".repeat(201) })).toThrow());
  it("founding without a date ends 31 March 2027", () =>
    expect(validatePlanInput({ plan: "founding", planUntil: null }).planUntil).toBe("2027-03-31"));
});
