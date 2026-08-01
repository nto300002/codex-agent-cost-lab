import { UserRole } from "../../generated/prisma/client";

import { buildUser } from "../factories/user";

export function memberUserFixture() {
  return buildUser();
}

export function adminUserFixture() {
  return buildUser({
    id: "test-user-admin",
    email: "test-admin@example.test",
    name: "Test Admin",
    role: UserRole.ADMIN,
  });
}
