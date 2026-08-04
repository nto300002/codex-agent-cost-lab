import type { PrismaClient } from "../../../../generated/prisma/client";
import type {
  ExportAuditData,
  ExportAuditRepository,
} from "../application/export-repository";

export class PrismaExportAuditRepository implements ExportAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(data: ExportAuditData) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: "EXPORT",
        entityType: data.entityType,
        afterJson: JSON.stringify({
          filters: data.filters,
          rowCount: data.rowCount,
        }),
      },
    });
  }
}
