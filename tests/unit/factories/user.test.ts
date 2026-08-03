import { describe, expect, it } from "vitest";

import { adminUserFixture, memberUserFixture } from "../../fixtures/users";

describe("user fixtures", () => {
  it("returns fresh deterministic values", () => {
    const first = memberUserFixture();
    const second = memberUserFixture();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.createdAt).not.toBe(second.createdAt);
    expect(first.updatedAt).not.toBe(second.updatedAt);
    expect(first.createdAt).not.toBe(first.updatedAt);

    const firstCreatedAt = first.createdAt as Date;
    const secondCreatedAt = second.createdAt as Date;
    firstCreatedAt.setUTCFullYear(2030);
    expect(secondCreatedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");

    expect(adminUserFixture()).toMatchObject({
      id: "test-user-admin",
      email: "test-admin@example.test",
      role: "ADMIN",
    });
  });
});
