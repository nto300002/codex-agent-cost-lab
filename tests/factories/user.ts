import { Prisma, UserRole } from "../../generated/prisma/client";

const defaultDate = "2026-01-01T00:00:00.000Z";

export function buildUser(
  overrides: Partial<Prisma.UserCreateInput> = {},
): Prisma.UserCreateInput {
  return {
    id: "test-user-member",
    email: "test-member@example.test",
    name: "Test Member",
    passwordHash: "test-password-hash",
    role: UserRole.MEMBER,
    active: true,
    createdAt: new Date(defaultDate),
    updatedAt: new Date(defaultDate),
    ...overrides,
  };
}
