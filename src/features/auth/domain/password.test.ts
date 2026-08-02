import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

const seededAdminHash =
  "scrypt$v1$16384$8$1$00000000000000000000000000000001$aa91af95d328345382fc835efc86be8a49b2cf2f719f2bb239a91c44022fb1642799fabd0cf8bbe01105dda833bebf3f15d228795ce6f0e8bf6020ea97622d6c";

describe("password", () => {
  it("verifies the fixed seed password format", async () => {
    await expect(
      verifyPassword("TraceCRM!2026", seededAdminHash),
    ).resolves.toBe(true);
    await expect(
      verifyPassword("wrong-password", seededAdminHash),
    ).resolves.toBe(false);
  });

  it("hashes passwords with a supplied per-user salt", async () => {
    const hash = await hashPassword("password", Buffer.alloc(16, 7));

    await expect(verifyPassword("password", hash)).resolves.toBe(true);
    expect(hash).not.toContain("password");
  });

  it("rejects malformed or unsupported hashes", async () => {
    await expect(verifyPassword("password", "malformed")).resolves.toBe(false);
    await expect(
      verifyPassword("password", seededAdminHash.replace("v1", "v2")),
    ).resolves.toBe(false);
  });
});
