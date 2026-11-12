import { describe, expect, it } from "vitest";
import { shareNodes, shareSpawns, rankInShareTeam, shareMapCrop } from "@/lib/debrief-share";

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

describe("share map crop", () => {
  it("pads a normal cluster by 15% of the box, at least 6 points", () => {
    expect(shareMapCrop([{ x: 20, y: 20 }, { x: 40, y: 60 }])).toEqual({ x: 14, y: 14, w: 32, h: 52 });
  });
  it("clamps the padded box to the image edges", () => {
    expect(shareMapCrop([{ x: 2, y: 30 }, { x: 8, y: 40 }])).toEqual({ x: 0, y: 24, w: 14, h: 22 });
    expect(shareMapCrop([{ x: 10, y: 10 }, { x: 90, y: 10 }])).toEqual({ x: 0, y: 4, w: 100, h: 12 });
    expect(shareMapCrop([{ x: 0, y: 0 }, { x: 100, y: 100 }])).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it("returns the full image for a single point or an empty list", () => {
    expect(shareMapCrop([{ x: 45, y: 55 }])).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(shareMapCrop([])).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it("returns the full image when any point is invalid", () => {
    expect(shareMapCrop([{ x: 10, y: 10 }, { x: NaN, y: 20 }])).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(shareMapCrop([{ x: 10, y: 10 }, { x: 20 } as { x: number; y: number }])).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
});