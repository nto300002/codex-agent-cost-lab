import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import { authorize } from "../../auth/domain/authorization-policy";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  AuditLogRepository,
  AuditRecordInput,
} from "./audit-log-repository";
import type { AuditLogSearch } from "../domain/audit-log";

const maximumJsonLength = 16_000;
const secretKey =
  /(?:password|passwordhash|session|token|cookie|authorization)/i;

function removeSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeSecrets);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !secretKey.test(key))
      .map(([key, nested]) => [key, removeSecrets(nested)]),
  );
}

export function safeAuditJson(value: unknown) {
  if (value === undefined) return null;
  const json = JSON.stringify(removeSecrets(value)) ?? "null";
  if (json.length <= maximumJsonLength) return json;
  return JSON.stringify({ truncated: true, preview: json.slice(0, 15_800) });
}

export class AuditLogService<TTransaction = unknown> {
  constructor(private readonly repository: AuditLogRepository<TTransaction>) {}

  async list(actor: AuthenticatedUser, search: AuditLogSearch) {
    authorize(actor, "auditLog:read");
    const { logs, total } = await this.repository.list(search);
    return {
      logs,
      pagination: {
        page: search.page,
        pageSize: search.pageSize,
        total,
        totalPages: Math.ceil(total / search.pageSize),
      },
    };
  }

  async get(actor: AuthenticatedUser, id: string) {
    authorize(actor, "auditLog:read");
    const log = await this.repository.findById(id);
    if (log === null) throw new NotFoundError("監査ログが見つかりません");
    return log;
  }

  record(input: AuditRecordInput, transaction?: TTransaction) {
    return this.repository.record(
      {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeJson: safeAuditJson(input.before),
        afterJson: safeAuditJson(input.after),
      },
      transaction,
    );
  }
}
