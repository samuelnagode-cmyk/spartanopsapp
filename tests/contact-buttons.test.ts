import { describe, expect, it } from "vitest";
import { contactLinks } from "../src/components/events/ContactButtons";

describe("contact buttons", () => {
  it("only chosen methods, fixed order", () => {
    expect(contactLinks("+38641111111", ["whatsapp", "sms"], "sl").map((l) => l.method)).toEqual(["sms", "whatsapp"]);
  });
  it("null or empty means call, viber, whatsapp", () => {
    expect(contactLinks("+38641111111", null, "en").map((l) => l.method)).toEqual(["call", "viber", "whatsapp"]);
    expect(contactLinks("+38641111111", [], "en").map((l) => l.method)).toEqual(["call", "viber", "whatsapp"]);
  });
  it("sms link uses the stored phone", () => {
    expect(contactLinks("+38641111111", ["sms"], "en")[0].href).toBe("sms:+38641111111");
  });
});
