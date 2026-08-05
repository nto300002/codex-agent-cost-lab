import { prisma } from "../../../infrastructure/database/prisma";
import { AuditLogService } from "../application/audit-log-service";
import { PrismaAuditLogRepository } from "./prisma-audit-log-repository";

export const auditLogService = new AuditLogService(
  new PrismaAuditLogRepository(prisma),
);
