import { describe, expect, it } from "vitest";
import { freeSeatsLabel } from "../src/lib/free-seats";
describe("free seats wording", () => {
  it("slovenian forms", () => {
    expect([1,2,3,4,5,11].map((n) => freeSeatsLabel(n, "sl"))).toEqual(["1 prosto mesto","2 prosti mesti","3 prosta mesta","4 prosta mesta","5 prostih mest","11 prostih mest"]);
    expect(freeSeatsLabel(3, "sl", true)).toBe("3 prosta");
  });
  it("english forms", () => {
    expect(freeSeatsLabel(1, "en")).toBe("1 free seat");
    expect(freeSeatsLabel(3, "en")).toBe("3 free seats");
    expect(freeSeatsLabel(3, "en", true)).toBe("3 free");
  });
});
