import { describe, expect, it } from "vitest";
import { buildRides, contactOpen, viewAttendee, type AttendeeProfile, type RsvpRow, type Viewer } from "../src/lib/events-visibility";

const OWNER = "owner-1";
const ROW_USER = "row-user";
const event = { account_id: OWNER, starts_at: "2026-07-11T08:00:00Z", ends_at: "2026-07-11T14:00:00Z" };
const DURING = Date.parse("2026-07-10T12:00:00Z");
const AFTER_WINDOW = Date.parse("2026-07-14T14:00:01Z");
const EDGE = Date.parse("2026-07-14T14:00:00Z");

const profile: AttendeeProfile = {
  nickname: "Ghost", first_name: "Miha", last_name: "Novak", show_full_last_name: true, age_group: "18_plus",
  phone: "+38641111111", club: "Kranj ASC", experience_level: "dobro", operator_type: "DMR",
  primary_weapon: "M4", secondary_weapon: null, sidearm: "G17", gear_notes: "ghillie",
};
const row = (p: Partial<RsvpRow> = {}): RsvpRow => ({
  event_id: "e1", user_id: ROW_USER, status: "going", phone_share: "attendees", ride_role: "driver",
  ride_from: "Kranj", ride_seats: 3, ride_note: "17:00", created_at: "2026-07-01T00:00:00Z", ...p,
});
const publicSignedOut: Viewer = { userId: null, profile: null };
const signedNoProfile: Viewer = { userId: "x", profile: null };
const adult: Viewer = { userId: "p1", profile: { age_group: "18_plus" } };
const minor: Viewer = { userId: "p2", profile: { age_group: "16_17" } };
const organiser: Viewer = { userId: OWNER, profile: null };
const self: Viewer = { userId: ROW_USER, profile: { age_group: "18_plus" } };
const v = (viewer: Viewer, r = row(), p = profile, now = DURING) => viewAttendee(r, p, viewer, event, now, "k");

describe("contact window", () => {
  it("open until exactly 3 days after end, closed after", () => {
    expect(contactOpen(event, EDGE)).toBe(true);
    expect(contactOpen(event, AFTER_WINDOW)).toBe(false);
  });
  it("defaults end to start + 6 hours", () => {
    const e = { starts_at: "2026-07-11T08:00:00Z", ends_at: null };
    expect(contactOpen(e, Date.parse("2026-07-14T14:00:00Z"))).toBe(true);
    expect(contactOpen(e, Date.parse("2026-07-14T14:00:01Z"))).toBe(false);
  });
});

describe("public sees no rows", () => {
  it("signed out", () => expect(v(publicSignedOut)).toBeNull());
  it("signed in without profile", () => expect(v(signedNoProfile)).toBeNull());
});

describe("identity fields for player, organiser, self", () => {
  for (const [name, viewer] of [["player", adult], ["organiser", organiser], ["self", self]] as const) {
    it(name, () => {
      const r = v(viewer)!;
      expect(r).toMatchObject({ callsign: "Ghost", first_name: "Miha", last_initial: "N.", club: "Kranj ASC", experience_level: "dobro", operator_type: "DMR", primary_weapon: "M4", sidearm: "G17", gear_notes: "ghillie", status: "going" });
      expect(r).not.toHaveProperty("user_id");
      expect(r).not.toHaveProperty("age_group");
      expect(r).not.toHaveProperty("created_at");
    });
  }
  it("minor player also sees identity", () => expect(v(minor)!.callsign).toBe("Ghost"));
});

describe("full surname", () => {
  it("adult player sees it when allowed", () => expect(v(adult)!.last_name).toBe("Novak"));
  it("minor player does not", () => expect(v(minor)!.last_name).toBeNull());
  it("show_full_last_name false hides it from players", () => expect(v(adult, row(), { ...profile, show_full_last_name: false })!.last_name).toBeNull());
  it("but not from the organiser", () => expect(v(organiser, row(), { ...profile, show_full_last_name: false })!.last_name).toBe("Novak"));
  it("self always", () => expect(v(self, row(), { ...profile, show_full_last_name: false })!.last_name).toBe("Novak"));
  it("organiser gets null when not entered", () => expect(v(organiser, row(), { ...profile, last_name: null })!.last_name).toBeNull());
});

describe("phone", () => {
  it("player sees attendees-share", () => expect(v(adult)!.phone).toBe("+38641111111"));
  it("player does NOT see organiser-only share", () => expect(v(adult, row({ phone_share: "organiser", ride_role: "none", ride_from: null, ride_seats: null }))!.phone).toBeNull());
  it("player does not see none", () => expect(v(adult, row({ phone_share: "none", ride_role: "none", ride_from: null, ride_seats: null }))!.phone).toBeNull());
  it("minor viewer cannot see a phone", () => expect(v(minor)!.phone).toBeNull());
  it("hidden from player after the 3-day window", () => expect(v(adult, row(), profile, AFTER_WINDOW)!.phone).toBeNull());
  it("organiser sees organiser share", () => expect(v(organiser, row({ phone_share: "organiser", ride_role: "none", ride_from: null, ride_seats: null }))!.phone).toBe("+38641111111"));
  it("organiser sees attendees share", () => expect(v(organiser)!.phone).toBe("+38641111111"));
  it("organiser does not see none", () => expect(v(organiser, row({ phone_share: "none", ride_role: "none", ride_from: null, ride_seats: null }))!.phone).toBeNull());
  it("organiser loses it after the window", () => expect(v(organiser, row(), profile, AFTER_WINDOW)!.phone).toBeNull());
  it("self always, even after the window and with none", () => expect(v(self, row({ phone_share: "none", ride_role: "none", ride_from: null, ride_seats: null }), profile, AFTER_WINDOW)!.phone).toBe("+38641111111"));
});

describe("ride details", () => {
  const ride = { role: "driver", from: "Kranj", seats: 3, note: "17:00" };
  it("adult player sees ride", () => expect(v(adult)!.ride).toEqual(ride));
  it("minor player does not", () => expect(v(minor)!.ride).toBeNull());
  it("player not after window", () => expect(v(adult, row(), profile, AFTER_WINDOW)!.ride).toBeNull());
  it("organiser sees regardless of adult", () => expect(v(organiser)!.ride).toEqual(ride));
  it("organiser not after window", () => expect(v(organiser, row(), profile, AFTER_WINDOW)!.ride).toBeNull());
  it("self after window", () => expect(v(self, row(), profile, AFTER_WINDOW)!.ride).toEqual(ride));
  it("no ride when role none", () => expect(v(adult, row({ ride_role: "none", ride_from: null, ride_seats: null }))!.ride).toBeNull());
  it("rider has no seats", () => expect(v(adult, row({ ride_role: "rider", ride_seats: null }))!.ride).toEqual({ role: "rider", from: "Kranj", seats: null, note: "17:00" }));
});

describe("car pool board", () => {
  it("groups folded towns, uses most common spelling, matches first", () => {
    const a = v(adult, row({ ride_from: "Škofja Loka" }))!;
    const b = { ...v(adult, row({ ride_from: "skofja loka ", ride_role: "rider", ride_seats: null }))!, key: "b" };
    const c = { ...v(adult, row({ ride_from: "Škofja Loka" }))!, key: "c" };
    const d = { ...v(adult, row({ ride_from: "Celje" }))!, key: "d" };
    const e = { ...v(adult, row({ ride_from: "Celje" }))!, key: "e" };
    const f = { ...v(adult, row({ ride_from: "Celje" }))!, key: "f" };
    const g = buildRides([d, e, f, a, b, c]);
    expect(g[0]).toMatchObject({ town: "Škofja Loka", match: true, seatsOffered: 6 });
    expect(g[0].riders).toHaveLength(1);
    expect(g[1]).toMatchObject({ town: "Celje", match: false });
  });
});
