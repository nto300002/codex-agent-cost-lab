import type { AuditAction } from "../../../../generated/prisma/client";

export const auditActions = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "EXPORT",
  "LOGIN",
  "LOGOUT",
  "DISABLE",
  "ROLE_CHANGE",
] as const satisfies readonly AuditAction[];

export type AuditLog = {
  id: string;
  actorUserId: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: Date;
  actor: { id: string; name: string };
};

export type AuditLogSearch = {
  actor?: string;
  action?: AuditAction;
  entityType?: string;
  page: number;
  pageSize: number;
};
