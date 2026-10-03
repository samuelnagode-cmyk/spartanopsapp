import { describe, it, expect } from "vitest";
import { signFieldToken, verifyFieldToken } from "./spartanops-field-token";

const SECRET = "test-secret-0123456789abcdef";
const FIELD = "486ee790-12b0-4954-805f-a70b07935c86";

describe("verifyFieldToken", () => {
  it("accepts a valid token", async () => {
    const t = await signFieldToken(FIELD, 3, 3600, SECRET);
    expect(await verifyFieldToken(t, FIELD, 3, SECRET)).toBe(true);
  });
  it("rejects a tampered token", async () => {
    const t = await signFieldToken(FIELD, 3, 3600, SECRET);
    const [body, sig] = t.split(".");
    const forged = btoa(JSON.stringify({ f: FIELD, v: 3, exp: 9999999999 })).replace(/=+$/, "");
    expect(await verifyFieldToken(`${forged}.${sig}`, FIELD, 3, SECRET)).toBe(false);
    expect(await verifyFieldToken(`${body}.${sig.slice(0, -2)}AA`, FIELD, 3, SECRET)).toBe(false);
  });
  it("rejects an expired token", async () => {
    const t = await signFieldToken(FIELD, 3, -10, SECRET);
    expect(await verifyFieldToken(t, FIELD, 3, SECRET)).toBe(false);
  });
  it("rejects a token for a different field", async () => {
    const t = await signFieldToken(FIELD, 3, 3600, SECRET);
    expect(await verifyFieldToken(t, "00000000-0000-0000-0000-000000000000", 3, SECRET)).toBe(false);
  });
  it("rejects an old password version", async () => {
    const t = await signFieldToken(FIELD, 2, 3600, SECRET);
    expect(await verifyFieldToken(t, FIELD, 3, SECRET)).toBe(false);
  });
  it("rejects malformed tokens without throwing", async () => {
    expect(await verifyFieldToken(undefined, FIELD, 3, SECRET)).toBe(false);
    expect(await verifyFieldToken("garbage", FIELD, 3, SECRET)).toBe(false);
    expect(await verifyFieldToken("a.b.c", FIELD, 3, SECRET)).toBe(false);
  });
});
