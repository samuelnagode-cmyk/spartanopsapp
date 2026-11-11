import { describe, expect, it } from "vitest";
import { showAudioControl } from "../src/lib/audio-routes";

describe("showAudioControl", () => {
  it.each(["/", "/spartanops", "/events", "/events/some-id", "/me", "/join", "/field", "/admin-pregled", "/misija"])("shows %s with music off", (path) => {
    expect(showAudioControl(path, false)).toBe(true);
  });
  it.each(["/capture", "/scan", "/spawn"])("never shows %s or its subpaths", (path) => {
    for (const enabled of [false, true]) {
      expect(showAudioControl(path, enabled)).toBe(false);
      expect(showAudioControl(`${path}/next`, enabled)).toBe(false);
    }
  });
  it.each(["/print", "/qr-generator", "/field-qr", "/privacy", "/terms", "/reset-password"])("shows %s and subpaths only to stop enabled music", (path) => {
    expect(showAudioControl(path, false)).toBe(false);
    expect(showAudioControl(path, true)).toBe(true);
    expect(showAudioControl(`${path}/next`, false)).toBe(false);
    expect(showAudioControl(`${path}/next`, true)).toBe(true);
  });
  it("matches case and word boundaries like the existing audio paths", () => {
    expect(showAudioControl("/CAPTURE/next", true)).toBe(false);
    expect(showAudioControl("/capture-extra", true)).toBe(false);
    expect(showAudioControl("/captureextra", false)).toBe(true);
    expect(showAudioControl("/privacyextra", false)).toBe(true);
  });
});