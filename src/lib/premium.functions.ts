import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Server-side premium key verification. The key is stored as a server env
 * secret (SPARTANOPS_PREMIUM_KEY) and never shipped to the client bundle.
 */
export const verifyPremiumKey = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string }) => ({ key: String(d?.key ?? "") }))
  .handler(async ({ data }) => {
    const expected = process.env.SPARTANOPS_PREMIUM_KEY;
    if (!expected) return { ok: false as const };
    if (!data.key || data.key.length > 200) return { ok: false as const };
    const a = createHash("sha256").update(data.key.trim(), "utf8").digest();
    const b = createHash("sha256").update(expected, "utf8").digest();
    return { ok: timingSafeEqual(a, b) };
  });
