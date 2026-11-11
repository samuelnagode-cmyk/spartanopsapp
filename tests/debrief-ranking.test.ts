import { describe, expect, it } from "vitest";
import { compareDebriefPlayers } from "@/lib/debrief-ranking";

describe("debrief ranking", () => {
  const alpha = { callsign: "alpha", pts: 4, death_count: 5 };
  const bravo = { callsign: "BRAVO", pts: 4, death_count: 1 };
  it("breaks tied captures by fewer deaths when public", () => {
    expect([alpha, bravo].sort((a, b) => compareDebriefPlayers(a, b, true))).toEqual([bravo, alpha]);
  });
  it("ignores private deaths and breaks ties by case-insensitive callsign", () => {
    expect([bravo, alpha].sort((a, b) => compareDebriefPlayers(a, b, false))).toEqual([alpha, bravo]);
  });
  it("breaks equal public deaths by case-insensitive callsign", () => {
    const tied = { ...bravo, death_count: 5 };
    expect([tied, alpha].sort((a, b) => compareDebriefPlayers(a, b, true))).toEqual([alpha, tied]);
  });
  it("always ranks more captures above fewer regardless of deaths", () => {
    const more = { callsign: "Zulu", pts: 5, death_count: 99 };
    for (const publicDeaths of [true, false]) {
      expect([bravo, more].sort((a, b) => compareDebriefPlayers(a, b, publicDeaths))).toEqual([more, bravo]);
    }
  });
});