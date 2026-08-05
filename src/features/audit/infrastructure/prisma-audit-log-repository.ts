import type { Prisma, PrismaClient } from "../../../../generated/prisma/client";
import type {
  AuditLogRepository,
  StoredAuditRecord,
} from "../application/audit-log-repository";
import type { AuditLogSearch } from "../domain/audit-log";

type Database = PrismaClient | Prisma.TransactionClient;
const includeActor = { actor: { select: { id: true, name: true } } } as const;

export class PrismaAuditLogRepository implements AuditLogRepository<Prisma.TransactionClient> {
  constructor(private readonly prisma: PrismaClient) {}

  async list(search: AuditLogSearch) {
    const where: Prisma.AuditLogWhereInput = {
      ...(search.action ? { action: search.action } : {}),
      ...(search.entityType
        ? { entityType: { contains: search.entityType } }
        : {}),
      ...(search.actor
        ? {
            OR: [
              { actorUserId: { contains: search.actor } },
              { actor: { name: { contains: search.actor } } },
              { actor: { email: { contains: search.actor } } },
            ],
          }
        : {}),
    };
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: includeActor,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (search.page - 1) * search.pageSize,
        take: search.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { logs, total };
  }

  findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: includeActor,
    });
  }

  async record(
    input: StoredAuditRecord,
    transaction?: Prisma.TransactionClient,
  ) {
    await this.database(transaction).auditLog.create({ data: input });
  }

  private database(transaction?: Prisma.TransactionClient): Database {
    return transaction ?? this.prisma;
  }
}
