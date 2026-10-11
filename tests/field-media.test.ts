import { describe, expect, it } from "vitest";
import { fieldMediaUrl, sniffImage } from "../src/lib/field-media";

describe("sniffImage", () => {
  it("refuses an SVG renamed to .png", () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>'))).toBeNull();
  });
  it("reads PNG size", () => {
    const b = new Uint8Array(24); b.set([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
    const dv = new DataView(b.buffer); dv.setUint32(16, 300); dv.setUint32(20, 200);
    expect(sniffImage(b)).toEqual({ type: "image/png", width: 300, height: 200 });
  });
  it("reads WebP VP8X size", () => {
    const b = new Uint8Array(30); b.set([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8X")]);
    b[24] = 255; b[27] = 255; // 256 x 256
    expect(sniffImage(b)).toEqual({ type: "image/webp", width: 256, height: 256 });
  });
});
describe("fieldMediaUrl", () => {
  it("never builds a URL from an unexpected path", () => {
    expect(fieldMediaUrl("../secret")).toBeNull();
    expect(fieldMediaUrl("11111111-1111-1111-1111-111111111111/logo-22222222-2222-2222-2222-222222222222.webp")).toMatch(/^\/api\/public\/field-media\//);
  });
});
