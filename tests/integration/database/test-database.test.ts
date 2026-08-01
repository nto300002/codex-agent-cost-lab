import { describe, expect, it } from "vitest";

import { memberUserFixture } from "../../fixtures/users";
import { createTestDatabase } from "../../helpers/test-database";

describe("createTestDatabase", () => {
  it("creates an independently migrated database", async () => {
    const first = await createTestDatabase();
    const second = await createTestDatabase();

    try {
      await first.prisma.user.create({ data: memberUserFixture() });

      await expect(first.prisma.user.count()).resolves.toBe(1);
      await expect(second.prisma.user.count()).resolves.toBe(0);
      expect(first.databasePath).not.toBe(second.databasePath);
    } finally {
      await Promise.all([first.cleanup(), second.cleanup()]);
    }
  });
});
