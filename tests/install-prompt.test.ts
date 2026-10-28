import { describe, expect, it } from "vitest";
import {
  detectPlatform,
  isHintSuppressed,
  isInstallHintRoute,
} from "@/lib/install-prompt";

describe("detectPlatform", () => {
  it("detects iPhone Safari as ios", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(detectPlatform(ua, 5)).toBe("ios");
  });

  it("detects iPadOS reporting as Mac with touch as ios", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    expect(detectPlatform(ua, 5)).toBe("ios");
    // A real desktop Mac has no touch points.
    expect(detectPlatform(ua, 0)).toBe("other");
  });

  it("detects Android Chrome as android", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(detectPlatform(ua, 5)).toBe("android");
  });

  it("detects Instagram in-app browser before the device token", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 312.0.0.0";
    expect(detectPlatform(ua, 5)).toBe("inapp");
  });

  it("detects Facebook in-app browser", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 [FBAN/Facebook;FBAV/440.0.0.0;]";
    expect(detectPlatform(ua, 5)).toBe("inapp");
  });

  it("returns other for desktop browsers", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(detectPlatform(ua, 0)).toBe("other");
  });
});

describe("isHintSuppressed", () => {
  const now = 1_000_000_000_000;
  it("shows when nothing was stored", () => {
    expect(isHintSuppressed({}, now)).toBe(false);
  });
  it("hides for 30 days after dismissal", () => {
    expect(isHintSuppressed({ dismissedAt: now - 1000 }, now)).toBe(true);
    expect(isHintSuppressed({ dismissedAt: now - 29 * 24 * 60 * 60 * 1000 }, now)).toBe(true);
  });
  it("never repeats the one-time prompt after dismissal or display", () => {
    expect(isHintSuppressed({ dismissedAt: now - 31 * 24 * 60 * 60 * 1000 }, now)).toBe(true);
    expect(isHintSuppressed({ shown: true }, now)).toBe(true);
  });
  it("hides for good once installed", () => {
    expect(isHintSuppressed({ installed: true }, now)).toBe(true);
    expect(isHintSuppressed({ installed: true, dismissedAt: now - 365 * 24 * 60 * 60 * 1000 }, now)).toBe(true);
  });
});

describe("isInstallHintRoute", () => {
  it("allows the joined field and player screen only", () => {
    expect(isInstallHintRoute("/field")).toBe(true);
    expect(isInstallHintRoute("/misija")).toBe(true);
  });
  it("blocks game, admin, legal and utility routes", () => {
    for (const p of [
      "/join", "/spartanops", "/events", "/events/abc123", "/me", "/me/games", "/capture", "/scan", "/spawn",
      "/admin-pregled", "/events/manage", "/reset-password",
      "/privacy", "/terms", "/print", "/", "/k", "/s",
    ]) {
      expect(isInstallHintRoute(p)).toBe(false);
    }
  });
});
