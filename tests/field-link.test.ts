import { describe, it, expect } from "vitest";
import { parseFieldLink } from "../src/lib/field-link";

const ID = "486ee790-12b0-4954-805f-a70b07935c86";

describe("parseFieldLink", () => {
  it("accepts a valid code and uppercases it", () => {
    expect(parseFieldLink("https://spartanopsapp.com/field?code=9hxnk7")).toBe("/field?code=9HXNK7");
  });
  it("accepts a valid id", () => {
    expect(parseFieldLink(`https://spartanopsapp.com/field?id=${ID}`)).toBe(`/field?id=${ID}`);
  });
  it("rejects a wrong path", () => {
    expect(parseFieldLink("https://spartanopsapp.com/scan?code=9HXNK7")).toBeNull();
  });
  it("ignores a foreign host and returns only the app path", () => {
    expect(parseFieldLink("https://evil.example/field?code=9HXNK7")).toBe("/field?code=9HXNK7");
  });
  it("rejects garbage", () => {
    expect(parseFieldLink("hello world")).toBeNull();
    expect(parseFieldLink("https://spartanopsapp.com/field?code=AB1")).toBeNull();
  });
  it("rejects an overlong string", () => {
    expect(parseFieldLink("https://spartanopsapp.com/field?code=9HXNK7&x=" + "a".repeat(5000))).toBeNull();
  });
});
