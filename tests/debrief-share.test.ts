import { describe, expect, it } from "vitest";
import { shareNodes, shareSpawns, rankInShareTeam } from "@/lib/debrief-share";

describe("share sectors", () => {
  it("includes only sector keys 1 through 5, never spawns or other keys", () => {
    const point = { x: 25, y: 75 };
    const nodes = shareNodes({ "1": point, "2": point, "3": point, "4": point, "5": point, "6": point, "01": point, spawn_modra: point, compass: point }, {});
    expect(nodes.map((n) => n.n)).toEqual([1, 2, 3, 4, 5]);
    expect(nodes.map((n) => n.name)).toEqual(["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"]);
    expect(nodes[0]).toMatchObject({ x: 25, y: 75 });
  });
  it("uses the final holder colour and a pale neutral colour", () => {
    const p = { x: 50, y: 50 };
    expect(shareNodes({ "1": p, "2": p, "3": p, "4": p, "5": p }, { "1": "modra", "2": "rdeca", "3": "rumena", "4": null, "5": "unknown" }).map((n) => n.color))
      .toEqual(["#3b82f6", "#ef4444", "#eab308", "#ece3c4", "#ece3c4"]);
  });
  it("keeps only valid existing spawn markers", () => {
    expect(shareSpawns({ spawn_modra: { x: 8, y: 90 }, spawn_rdeca: null, spawn_unknown: { x: 1, y: 1 }, "1": { x: 2, y: 2 } }))
      .toEqual([{ team: "modra", x: 8, y: 90, color: "#3b82f6" }]);
  });
  it("handles missing positions", () => expect(shareNodes(null, null)).toEqual([]));
});

describe("personal team rank", () => {
  const players = [{ id: "r", assigned_team: "rdeca" }, { id: "b1", assigned_team: "modra" }, { id: "b2", assigned_team: "modra" }, { id: "spectator", assigned_team: "none" }];
  it("preserves the debrief ordering within the player's own team", () => {
    expect(rankInShareTeam(players, "b2")).toEqual({ rankInTeam: 2, teamSize: 2 });
  });
  it("omits spectators and missing players", () => {
    expect(rankInShareTeam(players, "spectator")).toBeUndefined();
    expect(rankInShareTeam(players, "missing")).toBeUndefined();
  });
});