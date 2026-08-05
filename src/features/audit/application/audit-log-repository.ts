import type { AuditAction } from "../../../../generated/prisma/client";
import type { AuditLog, AuditLogSearch } from "../domain/audit-log";

export type AuditRecordInput = {
  actorUserId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

export type StoredAuditRecord = Omit<AuditRecordInput, "before" | "after"> & {
  beforeJson: string | null;
  afterJson: string | null;
};

export interface AuditLogRepository<TTransaction = unknown> {
  list(search: AuditLogSearch): Promise<{ logs: AuditLog[]; total: number }>;
  findById(id: string): Promise<AuditLog | null>;
  record(input: StoredAuditRecord, transaction?: TTransaction): Promise<void>;
}

export type AuditRecorder<TTransaction = unknown> = Pick<
  AuditLogServiceContract<TTransaction>,
  "record"
>;

export interface AuditLogServiceContract<TTransaction = unknown> {
  record(input: AuditRecordInput, transaction?: TTransaction): Promise<void>;
}
