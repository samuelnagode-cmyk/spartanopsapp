import { describe, it, expect } from "vitest";
import { resolveEffectivePlan, todayLjubljana, FOUNDING_OFFER, PLAN_LIMITS } from "../src/lib/plans";

const at = (iso: string) => new Date(iso);

describe("plan resolution", () => {
  it("founding offer ends 31 March 2027", () => expect(FOUNDING_OFFER.until).toBe("2027-03-31"));
  it("free allows 30 players and 2 teams", () => expect(PLAN_LIMITS.free).toEqual({ maxPlayers: 30, maxTeams: 2 }));
  it("founding and pro allow 3 teams", () => {
    expect(PLAN_LIMITS.founding.maxTeams).toBe(3);
    expect(PLAN_LIMITS.pro.maxTeams).toBe(3);
  });
  it("no row is free", () => expect(resolveEffectivePlan(null)).toBe("free"));
  it("free row is free", () => expect(resolveEffectivePlan({ plan: "free", plan_until: null })).toBe("free"));
  it("founding on its last day is founding", () =>
    expect(resolveEffectivePlan({ plan: "founding", plan_until: "2027-03-31" }, at("2027-03-31T10:00:00Z"))).toBe("founding"));
  it("founding the day after is free", () =>
    expect(resolveEffectivePlan({ plan: "founding", plan_until: "2027-03-31" }, at("2027-04-01T10:00:00Z"))).toBe("free"));
  it("founding without a date uses the offer end", () => {
    expect(resolveEffectivePlan({ plan: "founding", plan_until: null }, at("2027-03-31T12:00:00Z"))).toBe("founding");
    expect(resolveEffectivePlan({ plan: "founding", plan_until: null }, at("2027-04-01T12:00:00Z"))).toBe("free");
  });
  it("pro without a date stays pro", () =>
    expect(resolveEffectivePlan({ plan: "pro", plan_until: null }, at("2040-01-01T00:00:00Z"))).toBe("pro"));
  it("pro with a date expires", () => {
    expect(resolveEffectivePlan({ plan: "pro", plan_until: "2027-06-30" }, at("2027-06-30T12:00:00Z"))).toBe("pro");
    expect(resolveEffectivePlan({ plan: "pro", plan_until: "2027-06-30" }, at("2027-07-01T12:00:00Z"))).toBe("free");
  });
  it("boundary in Slovenian time", () => {
    const row = { plan: "founding" as const, plan_until: "2027-03-31" };
    expect(resolveEffectivePlan(row, at("2027-03-31T21:59:59Z"))).toBe("founding");
    expect(resolveEffectivePlan(row, at("2027-03-31T22:00:00Z"))).toBe("free");
    expect(todayLjubljana(at("2027-03-31T22:00:00Z"))).toBe("2027-04-01");
  });
  it("30 days before the end counts as ending soon", () => {
    expect(daysUntil("2027-03-31", at("2027-03-01T10:00:00Z"))).toBe(30);
    expect(daysUntil("2027-03-31", at("2027-02-28T10:00:00Z"))).toBe(31);
  });
  it("account's own date formats in Slovenian", () =>
    expect(formatFoundingDate("sl", "2027-06-30")).toBe("30. junija 2027"));
});
