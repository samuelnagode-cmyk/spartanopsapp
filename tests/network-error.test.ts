import { describe, it, expect } from "vitest";
import { isNetworkError } from "../src/lib/network-error";

describe("isNetworkError", () => {
  it("Chrome TypeError 'Failed to fetch'", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"), true)).toBe(true);
  });
  it("Safari 'Load failed'", () => {
    expect(isNetworkError(new Error("Load failed"), true)).toBe(true);
  });
  it("Firefox 'NetworkError when attempting to fetch resource'", () => {
    expect(isNetworkError(new Error("NetworkError when attempting to fetch resource."), true)).toBe(true);
  });
  it("offline flag with an unrelated error", () => {
    expect(isNetworkError(new Error("Point already captured"), false)).toBe(true);
  });
  it("ordinary server error while online is not a network error", () => {
    expect(isNetworkError(new Error("Point already captured"), true)).toBe(false);
  });
});
