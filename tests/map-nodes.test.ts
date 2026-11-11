import { describe, it, expect } from "vitest";
import { rotateSpawns, type NodePositions } from "@/lib/map-nodes";

const top = { x: 50, y: 10 }, br = { x: 90, y: 90 }, bl = { x: 10, y: 90 };

describe("rotateSpawns", () => {
  it("2 teams swap, twice restores", () => {
    const p: NodePositions = { spawn_modra: { x: 1, y: 2 }, spawn_rdeca: { x: 3, y: 4 } };
    const r = rotateSpawns(p, 2)!;
    expect(r.spawn_modra).toEqual({ x: 3, y: 4 });
    expect(r.spawn_rdeca).toEqual({ x: 1, y: 2 });
    expect(rotateSpawns(r, 2)).toEqual(p);
  });
  it("3 teams clockwise arrangement", () => {
    const r = rotateSpawns({ spawn_modra: top, spawn_rdeca: br, spawn_rumena: bl }, 3)!;
    expect(r.spawn_modra).toEqual(br); expect(r.spawn_rdeca).toEqual(bl); expect(r.spawn_rumena).toEqual(top);
  });
  it("3 teams counter-clockwise arrangement still rotates clockwise", () => {
    const r = rotateSpawns({ spawn_modra: top, spawn_rdeca: bl, spawn_rumena: br }, 3)!;
    expect(r.spawn_modra).toEqual(br); expect(r.spawn_rumena).toEqual(bl); expect(r.spawn_rdeca).toEqual(top);
  });
  it("three rotations restore", () => {
    const p: NodePositions = { spawn_modra: top, spawn_rdeca: br, spawn_rumena: bl };
    expect(rotateSpawns(rotateSpawns(rotateSpawns(p, 3)!, 3)!, 3)).toEqual(p);
  });
  it("keeps sectors and compass, does not mutate input", () => {
    const p: NodePositions = { "1": { x: 5, y: 5 }, compass: { x: 7, y: 7 }, "2": null, spawn_modra: top, spawn_rdeca: br, spawn_rumena: bl };
    const copy = JSON.parse(JSON.stringify(p));
    const r = rotateSpawns(p, 3)!;
    expect(r["1"]).toEqual({ x: 5, y: 5 }); expect(r.compass).toEqual({ x: 7, y: 7 }); expect(r["2"]).toBeNull();
    expect(p).toEqual(copy); expect(r).not.toBe(p);
  });
  it("missing spawn or 1 team returns null", () => {
    expect(rotateSpawns({ spawn_modra: top, spawn_rdeca: br }, 3)).toBeNull();
    expect(rotateSpawns({ spawn_modra: top, spawn_rdeca: null }, 2)).toBeNull();
    expect(rotateSpawns({ spawn_modra: top, spawn_rdeca: br }, 1)).toBeNull();
  });
});
