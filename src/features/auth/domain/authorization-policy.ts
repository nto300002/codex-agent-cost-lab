import { AuthorizationError } from "../../../shared/errors/app-error";
import type { AuthenticatedUser } from "./auth-user";

export const permissions = [
  "customer:read",
  "customer:create",
  "customer:update",
  "customer:delete",
  "customer:export",
  "deal:read",
  "deal:create",
  "deal:update",
  "deal:delete",
  "deal:export",
  "activity:read",
  "activity:create",
  "activity:update",
  "activity:delete",
  "user:read",
  "user:create",
  "user:update",
  "user:disable",
  "user:changeRole",
  "auditLog:read",
] as const;

export type Permission = (typeof permissions)[number];
export type AuthorizationActor = Pick<AuthenticatedUser, "id" | "role">;
export type AccessContext = { ownerId?: string };
type AccessScope = "none" | "owned" | "all";
type UserRole = AuthenticatedUser["role"];

export const authorizationMatrix = {
  MEMBER: {
    "customer:read": "owned",
    "customer:create": "owned",
    "customer:update": "owned",
    "customer:delete": "none",
    "customer:export": "none",
    "deal:read": "owned",
    "deal:create": "owned",
    "deal:update": "owned",
    "deal:delete": "none",
    "deal:export": "none",
    "activity:read": "owned",
    "activity:create": "owned",
    "activity:update": "owned",
    "activity:delete": "owned",
    "user:read": "none",
    "user:create": "none",
    "user:update": "none",
    "user:disable": "none",
    "user:changeRole": "none",
    "auditLog:read": "none",
  },
  MANAGER: {
    "customer:read": "all",
    "customer:create": "all",
    "customer:update": "all",
    "customer:delete": "none",
    "customer:export": "all",
    "deal:read": "all",
    "deal:create": "all",
    "deal:update": "all",
    "deal:delete": "all",
    "deal:export": "all",
    "activity:read": "all",
    "activity:create": "all",
    "activity:update": "all",
    "activity:delete": "all",
    "user:read": "all",
    "user:create": "none",
    "user:update": "none",
    "user:disable": "none",
    "user:changeRole": "none",
    "auditLog:read": "none",
  },
  ADMIN: {
    "customer:read": "all",
    "customer:create": "all",
    "customer:update": "all",
    "customer:delete": "all",
    "customer:export": "all",
    "deal:read": "all",
    "deal:create": "all",
    "deal:update": "all",
    "deal:delete": "all",
    "deal:export": "all",
    "activity:read": "all",
    "activity:create": "all",
    "activity:update": "all",
    "activity:delete": "all",
    "user:read": "all",
    "user:create": "all",
    "user:update": "all",
    "user:disable": "all",
    "user:changeRole": "all",
    "auditLog:read": "all",
  },
} as const satisfies Record<UserRole, Record<Permission, AccessScope>>;

export function can(
  actor: AuthorizationActor,
  permission: Permission,
  context: AccessContext = {},
) {
  const scope = authorizationMatrix[actor.role][permission];

  if (scope === "all") {
    return true;
  }

  if (scope === "owned") {
    return context.ownerId !== undefined && context.ownerId === actor.id;
  }

  return false;
}

export function authorize(
  actor: AuthorizationActor,
  permission: Permission,
  context: AccessContext = {},
) {
  if (!can(actor, permission, context)) {
    throw new AuthorizationError();
  }
}
