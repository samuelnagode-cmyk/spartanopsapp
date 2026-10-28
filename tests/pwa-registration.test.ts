import { describe, expect, it } from "vitest";
import { shouldRegisterPwa } from "../src/lib/pwa-registration";

describe("PWA registration safety", () => {
  it("allows the published custom domain and published Lovable domain", () => {
    expect(shouldRegisterPwa(true, "spartanopsapp.com", false, false)).toBe(true);
    expect(shouldRegisterPwa(true, "spartanopsapp.lovable.app", false, false)).toBe(true);
  });
  it("blocks development, frames and the kill switch", () => {
    expect(shouldRegisterPwa(false, "spartanopsapp.com", false, false)).toBe(false);
    expect(shouldRegisterPwa(true, "spartanopsapp.com", true, false)).toBe(false);
    expect(shouldRegisterPwa(true, "spartanopsapp.com", false, true)).toBe(false);
  });
  it("blocks all preview hostname families", () => {
    for (const host of ["id-preview--test.lovable.app", "preview-2--test.gpt-eng.com", "project--test-dev.lovable.app", "test.lovableproject.com", "test.lovableproject-dev.com", "beta.lovable.dev"]) {
      expect(shouldRegisterPwa(true, host, false, false)).toBe(false);
    }
    expect(shouldRegisterPwa(true, "preview-v2--shop.example.com", false, false)).toBe(true);
  });
});