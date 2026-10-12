import { describe, expect, it } from "vitest";
import { formatEventWhen } from "../src/lib/events";

const S = "2026-11-14T07:00:00Z", E = "2026-11-14T15:00:00Z", TZ = "Europe/Ljubljana";

describe("formatEventWhen hydration safety", () => {
  it("never adds a zone label without viewerTz, whatever the process timezone", () => {
    expect(formatEventWhen(S, E, TZ, "sl")).toBe("Sobota, 14. november · 08:00–16:00");
  });
  it("adds no label when the viewer zone matches", () => {
    expect(formatEventWhen(S, E, TZ, "sl", "Europe/Berlin")).toBe("Sobota, 14. november · 08:00–16:00");
  });
  it("adds the label when the viewer zone differs", () => {
    expect(formatEventWhen(S, E, TZ, "sl", "America/New_York")).toBe("Sobota, 14. november · 08:00–16:00 CET");
  });
});
