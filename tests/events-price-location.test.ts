import { describe, expect, it, vi } from "vitest";
import { formatPrice, mapsHostAllowed, parseLocationInput, resolveMapsChain } from "../src/lib/events";

const nb = (s: string) => s.replace(/\u00a0|\u202f/g, " ");

describe("parseLocationInput", () => {
  const pt = { kind: "point", lat: 46.0569, lng: 14.5058 };
  it.each([
    ["46.0569, 14.5058", pt],
    ["46.0569 14.5058", pt],
    ["46.0569;14.5058", pt],
    ["46,0569 14,5058", pt],
    ["https://www.google.com/maps/place/X/@46.0569,14.5058,17z", pt],
    ["https://www.google.com/maps/place/X/data=!3d46.0569!4d14.5058", pt],
    ["https://maps.google.com/?q=46.0569,14.5058", pt],
  ])("%s", (input, out) => expect(parseLocationInput(input)).toEqual(out));
  it("DMS", () => {
    const r = parseLocationInput(`46°03'24.8"N 14°30'21.0"E`);
    expect(r.kind).toBe("point");
    if (r.kind === "point") { expect(r.lat).toBeCloseTo(46.05689, 4); expect(r.lng).toBeCloseTo(14.50583, 4); }
  });
  it("rejects 0,0 / out of range / text", () => {
    expect(parseLocationInput("0, 0").kind).toBe("error");
    expect(parseLocationInput("91, 14").kind).toBe("error");
    expect(parseLocationInput("hello").kind).toBe("error");
  });
  it("short link needs resolving", () => {
    expect(parseLocationInput("https://maps.app.goo.gl/abc123")).toEqual({ kind: "resolve", url: "https://maps.app.goo.gl/abc123" });
  });
});

describe("formatPrice", () => {
  it("formats with currency", () => {
    expect(nb(formatPrice(25, "EUR", "sl"))).toBe("25 €");
    expect(formatPrice(25, "EUR", "en")).toBe("€25");
    expect(nb(formatPrice(25.5, "EUR", "sl"))).toBe("25,50 €");
    expect(formatPrice(0, "EUR", "sl")).toBe("Brezplačno");
    expect(formatPrice(0, "EUR", "en")).toBe("Free");
  });
});

describe("resolveMapsChain host rules", () => {
  it("refuses other hosts and http without fetching", async () => {
    const f = vi.fn();
    expect(await resolveMapsChain("https://example.com/x", f as never)).toBeNull();
    expect(await resolveMapsChain("http://maps.app.goo.gl/x", f as never)).toBeNull();
    expect(f).not.toHaveBeenCalled();
    expect(mapsHostAllowed("https://goo.gl/other")).toBe(false);
  });
  it("stops at a redirect to another host without fetching it", async () => {
    const f = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://evil.example/@46.1,14.5" } }));
    expect(await resolveMapsChain("https://maps.app.goo.gl/x", f as never)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("follows an allowed redirect and consent continue", async () => {
    const f = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://consent.google.com/m?continue=" + encodeURIComponent("https://www.google.com/maps/@46.0569,14.5058,17z") } }));
    expect(await resolveMapsChain("https://maps.app.goo.gl/x", f as never)).toEqual({ lat: 46.0569, lng: 14.5058 });
  });
});
