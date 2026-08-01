import { describe, expect, it } from "vitest";

import { adminUserFixture, memberUserFixture } from "../../fixtures/users";

describe("user fixtures", () => {
  it("returns fresh deterministic values", () => {
    const first = memberUserFixture();
    const second = memberUserFixture();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(adminUserFixture()).toMatchObject({
      id: "test-user-admin",
      email: "test-admin@example.test",
      role: "ADMIN",
    });
  });
});
