import { describe, expect, it } from "vitest";
import { normalizePhone, safeNext, validatePlayer } from "../src/lib/player-validation";

const base = { nickname: "Ghost", first_name: "Miha", experience_level: "dobro" };

describe("player validation", () => {
  it("drops surname, phone and full-surname for 16-17", () => {
    const r = validatePlayer({ ...base, age_group: "16_17", last_name: "Novak", phone: "041123456", show_full_last_name: true });
    expect(r.ok && r.data).toMatchObject({ last_name: null, phone: null, show_full_last_name: false });
  });
  it("refuses under 16", () => {
    expect(validatePlayer({ ...base, age_group: "under_16" })).toEqual({ ok: false, error: "validation:under_16" });
  });
  it("treats a leading 0 as Slovenian and 00 as +", () => {
    expect(normalizePhone("041 123 456")).toEqual({ ok: true, value: "+38641123456" });
    expect(normalizePhone("0044 20 7946 0958")).toEqual({ ok: true, value: "+442079460958" });
  });
  it("rejects a 1-character callsign", () => {
    expect(validatePlayer({ ...base, nickname: "G", age_group: "18_plus" })).toEqual({ ok: false, error: "validation:nickname" });
  });
  it("only honours same-site next paths", () => {
    expect(safeNext("/events")).toBe("/events");
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
  });
});

import { playerKeyFor } from "../src/lib/player.functions";
describe("playerKeyFor", () => {
  it("matches SQL encode(digest('test-session-123','sha256'),'hex')", async () => {
    expect(await playerKeyFor("test-session-123")).toBe("bd7065173b6ba0b1c30b65779119747b3710fac4d3bbb1520311cf5332b2df51");
  });
});

describe("avatar validation", () => {
  const a = { ...base, age_group: "18_plus" };
  it("accepts a valid pair", () => {
    const r = validatePlayer({ ...a, avatar_icon: "wolf", avatar_color: "teal" });
    expect(r.ok && r.data).toMatchObject({ avatar_icon: "wolf", avatar_color: "teal" });
  });
  it("accepts no avatar", () => {
    const r = validatePlayer({ ...a, avatar_icon: null, avatar_color: null });
    expect(r.ok && r.data).toMatchObject({ avatar_icon: null, avatar_color: null });
  });
  it("refuses an unknown icon", () => {
    expect(validatePlayer({ ...a, avatar_icon: "skull", avatar_color: "gold" })).toEqual({ ok: false, error: "validation:avatar" });
  });
  it("refuses an icon without a colour", () => {
    expect(validatePlayer({ ...a, avatar_icon: "wolf" })).toEqual({ ok: false, error: "validation:avatar" });
  });
});
