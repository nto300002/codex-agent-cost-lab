import type { UserRole } from "../../../../generated/prisma/client";

export type ManagedUserView = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ErrorBody = {
  error?: {
    message?: string;
    details?: Record<string, string[]>;
  };
};

export class UserApiError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

export async function userRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new UserApiError(
      body.error?.message ?? "処理を完了できませんでした",
      body.error?.details,
    );
  }
  return (await response.json()) as T;
}

export const userRoleLabels: Record<UserRole, string> = {
  MEMBER: "メンバー",
  MANAGER: "マネージャー",
  ADMIN: "管理者",
};
