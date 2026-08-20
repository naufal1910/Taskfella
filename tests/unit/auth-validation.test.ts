import { describe, expect, it } from "vitest";
import { validateAuthFields } from "@/components/auth/validation";

describe("authentication field validation", () => {
  it("reports invalid signup values by field", () => {
    expect(
      validateAuthFields("signup", {
        email: "not-an-email",
        password: "short",
        confirmation: "",
      }),
    ).toEqual({
      email: "Enter a valid email address.",
      password: "Use at least 12 characters.",
    });
  });

  it("reports password confirmation errors by field", () => {
    expect(
      validateAuthFields("reset", {
        email: "",
        password: "a sufficiently long passphrase",
        confirmation: "a different passphrase",
      }),
    ).toEqual({ confirmation: "Passwords must match." });
  });

  it("accepts valid values without field errors", () => {
    expect(
      validateAuthFields("login", {
        email: "person@example.test",
        password: "a sufficiently long passphrase",
        confirmation: "",
      }),
    ).toEqual({});
  });
});
