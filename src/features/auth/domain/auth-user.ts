import type { UserRole } from "../../../../generated/prisma/client";

export type AuthUserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
};

export type AuthenticatedUser = Omit<AuthUserRecord, "passwordHash" | "active">;

export function toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
