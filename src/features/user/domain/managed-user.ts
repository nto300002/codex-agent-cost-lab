import type { UserRole } from "../../../../generated/prisma/client";

export const userRoles = ["MEMBER", "MANAGER", "ADMIN"] as const;

export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserCreateData = {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
};

export type UserUpdateData = Partial<
  Pick<UserCreateData, "email" | "name" | "passwordHash" | "role" | "active">
>;

export type CreateUserInput = Omit<
  UserCreateData,
  "passwordHash" | "active"
> & {
  password: string;
};

export type UpdateUserInput = Partial<
  Pick<UserCreateData, "email" | "name" | "role" | "active">
> & {
  password?: string;
};
