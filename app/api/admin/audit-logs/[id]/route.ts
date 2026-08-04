import { authService } from "../../../../../src/features/auth/infrastructure/auth-service";
import { createAuditLogItemHandler } from "../../../../../src/features/audit/http/audit-log-handlers";
import { auditLogService } from "../../../../../src/features/audit/infrastructure/audit-log-service";

export const GET = createAuditLogItemHandler(auditLogService, authService);
