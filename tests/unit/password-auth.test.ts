import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordHash, verifyPassword } from "@/server/modules/auth/password";

describe("password protection", () => {
  it("uses Argon2id and verifies without exposing plaintext material", async () => {
    const password = "correct horse battery staple";
    const passwordHash = await hashPassword(password);

    expect(isPasswordHash(passwordHash)).toBe(true);
    expect(passwordHash).toContain("$argon2id$");
    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect", passwordHash)).resolves.toBe(false);
  });

  it("fails closed for malformed stored hashes and invalid inputs", async () => {
    await expect(verifyPassword("password", "not-a-password-hash")).resolves.toBe(false);
    await expect(verifyPassword("", "$argon2id$v=19$m=1,t=1,p=1$invalid$invalid")).resolves.toBe(
      false,
    );
    await expect(hashPassword("")).rejects.toThrow("Password input is invalid");
  });
});
