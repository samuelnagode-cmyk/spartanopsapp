import { describe, it, expect } from "vitest";
import { friendlyAuthError, isExistingAccountSignup } from "../src/lib/auth-errors";

describe("isExistingAccountSignup", () => {
  it("recognizes an empty identities array", () => {
    expect(isExistingAccountSignup({ identities: [] })).toBe(true);
  });

  it("does not flag a user with one identity", () => {
    expect(isExistingAccountSignup({ identities: [{}] })).toBe(false);
  });

  it("does not flag missing identities", () => {
    expect(isExistingAccountSignup({})).toBe(false);
  });

  it("does not flag null identities", () => {
    expect(isExistingAccountSignup({ identities: null })).toBe(false);
  });

  it("does not flag non-array identities", () => {
    expect(isExistingAccountSignup({ identities: "x" })).toBe(false);
  });

  it("does not flag a null user", () => {
    expect(isExistingAccountSignup(null)).toBe(false);
  });

  it("does not flag an undefined user", () => {
    expect(isExistingAccountSignup(undefined)).toBe(false);
  });
});

const RAW_SNIPPETS = [
  "Invalid login credentials",
  "Email not confirmed",
  "User already registered",
  "Password is known to be weak",
  "over_email_send_rate_limit",
];

describe("friendlyAuthError", () => {
  it("invalid_credentials by code, both languages", () => {
    expect(friendlyAuthError({ code: "invalid_credentials" }, false).text).toBe(
      "Napačen e-naslov ali geslo. Če si račun šele ustvaril, najprej potrdi e-pošto.",
    );
    expect(friendlyAuthError({ code: "invalid_credentials" }, true).text).toBe(
      "Wrong email or password. If you just created the account, confirm your email first.",
    );
  });

  it("invalid credentials by message only (no code)", () => {
    const r = friendlyAuthError({ message: "Invalid login credentials" }, true);
    expect(r.text).toContain("Wrong email or password");
    expect(r.kind).toBe("other");
  });

  it("email_not_confirmed maps to kind unconfirmed, both languages", () => {
    const sl = friendlyAuthError({ code: "email_not_confirmed" }, false);
    expect(sl.kind).toBe("unconfirmed");
    expect(sl.text).toContain("še ni potrjen");
    const en = friendlyAuthError({ message: "Email not confirmed" }, true);
    expect(en.kind).toBe("unconfirmed");
    expect(en.text).toContain("not confirmed yet");
  });

  it("user_already_exists by code and by message", () => {
    expect(friendlyAuthError({ code: "user_already_exists" }, false).text).toContain("že obstaja");
    expect(friendlyAuthError({ message: "User already registered" }, true).text).toContain("already exists");
  });

  it("weak_password by code and by message variants", () => {
    expect(friendlyAuthError({ code: "weak_password" }, false).text).toContain("prešibko");
    expect(friendlyAuthError({ message: "Password is known to be weak and easy to guess" }, true).text).toContain("too weak");
    expect(friendlyAuthError({ message: "Password found in leaked database" }, true).text).toContain("too weak");
  });

  it("email_address_invalid by code and by message", () => {
    expect(friendlyAuthError({ code: "email_address_invalid" }, false).text).toBe("E-naslov ni veljaven.");
    expect(friendlyAuthError({ message: "Invalid email address" }, true).text).toBe("That email address is not valid.");
  });

  it("rate limits by code and by status 429", () => {
    expect(friendlyAuthError({ code: "over_email_send_rate_limit" }, false).text).toContain("Preveč poskusov");
    expect(friendlyAuthError({ code: "over_request_rate_limit" }, true).text).toContain("Too many attempts");
    expect(friendlyAuthError({ status: 429 }, true).text).toContain("Too many attempts");
    expect(friendlyAuthError({ message: "Request rate limit reached" }, false).text).toContain("Preveč poskusov");
  });

  it("network failures: TypeError and fetch messages", () => {
    expect(friendlyAuthError(new TypeError("Failed to fetch"), false).text).toContain("Ni povezave");
    expect(friendlyAuthError({ message: "Load failed" }, true).text).toContain("No connection");
    expect(friendlyAuthError({ message: "NetworkError when attempting to fetch resource." }, true).text).toContain("No connection");
  });

  it("unknown error falls back to a generic message", () => {
    expect(friendlyAuthError({ code: "something_new", message: "Unexpected XYZ" }, false).text).toBe("Prijava ni uspela. Poskusi znova.");
    expect(friendlyAuthError({ code: "something_new" }, true).text).toBe("Something went wrong. Please try again.");
    expect(friendlyAuthError({ code: "something_new" }, true).kind).toBe("other");
  });

  it("null and undefined fall back to the generic message", () => {
    expect(friendlyAuthError(null, false).text).toBe("Prijava ni uspela. Poskusi znova.");
    expect(friendlyAuthError(undefined, true).text).toBe("Something went wrong. Please try again.");
  });

  it("never returns the raw library text", () => {
    const cases: ({ code?: string; message?: string; status?: number } | null)[] = [
      { code: "invalid_credentials", message: "Invalid login credentials" },
      { code: "email_not_confirmed", message: "Email not confirmed" },
      { code: "user_already_exists", message: "User already registered" },
      { code: "weak_password", message: "Password is known to be weak" },
      { code: "over_email_send_rate_limit", message: "over_email_send_rate_limit" },
      null,
    ];
    for (const c of cases) {
      for (const en of [false, true]) {
        const { text } = friendlyAuthError(c, en);
        if (c?.message) expect(text).not.toBe(c.message);
        for (const raw of RAW_SNIPPETS) expect(text).not.toContain(raw);
      }
    }
  });
});
