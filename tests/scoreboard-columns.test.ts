import { describe, it, expect } from "vitest";
import { scoreboardColumns, deathsEffectivelyPublic } from "../src/lib/scoreboard-columns";

describe("scoreboardColumns", () => {
  it("points follow capturePointsScoring", () => {
    expect(scoreboardColumns({ capturePointsScoring: true }, "modra", "modra").points).toBe(true);
    expect(scoreboardColumns({ capturePointsScoring: false }, "modra", "modra").points).toBe(false);
  });

  it("respawn off with stale publicDeaths shows no deaths and no respawn status", () => {
    const s = { respawn: { enabled: false, publicDeaths: true, visibility: "all" as const } };
    expect(scoreboardColumns(s, "modra", "modra")).toEqual({ points: false, deaths: false, respawnStatus: false });
    expect(deathsEffectivelyPublic(s)).toBe(false);
  });

  it("respawn on with private deaths shows respawn status only", () => {
    const s = { respawn: { enabled: true, publicDeaths: false, visibility: "all" as const } };
    expect(scoreboardColumns(s, "rdeca", "modra")).toEqual({ points: false, deaths: false, respawnStatus: true });
  });

  it("public deaths with visibility all show for every team", () => {
    const s = { respawn: { enabled: true, publicDeaths: true, visibility: "all" as const } };
    expect(scoreboardColumns(s, "rdeca", "modra")).toEqual({ points: false, deaths: true, respawnStatus: true });
    expect(deathsEffectivelyPublic(s)).toBe(true);
  });

  it("team only: viewer on the row's team sees deaths and respawn", () => {
    const s = { respawn: { enabled: true, publicDeaths: true, visibility: "team" as const } };
    expect(scoreboardColumns(s, "modra", "modra")).toEqual({ points: false, deaths: true, respawnStatus: true });
  });

  it("team only: viewer on another team sees neither", () => {
    const s = { respawn: { enabled: true, publicDeaths: true, visibility: "team" as const } };
    expect(scoreboardColumns(s, "rdeca", "modra")).toEqual({ points: false, deaths: false, respawnStatus: false });
  });

  it("team only: viewer without a team sees neither", () => {
    const s = { respawn: { enabled: true, publicDeaths: true, visibility: "team" as const } };
    expect(scoreboardColumns(s, "modra", undefined)).toEqual({ points: false, deaths: false, respawnStatus: false });
    expect(scoreboardColumns(s, "modra", "none").deaths).toBe(false);
  });
});
