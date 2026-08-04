import type { Prisma, PrismaClient } from "../../../../generated/prisma/client";
import type {
  UserAuditInput,
  UserRepository,
} from "../application/user-repository";
import type { UserCreateData, UserUpdateData } from "../domain/managed-user";

const userSelection = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaUserRepository implements UserRepository<Prisma.TransactionClient> {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.user.findMany({
      select: userSelection,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  findById(id: string, transaction: Prisma.TransactionClient) {
    return transaction.user.findUnique({
      where: { id },
      select: userSelection,
    });
  }

  async emailExists(
    email: string,
    excludedUserId: string | undefined,
    transaction: Prisma.TransactionClient,
  ) {
    return (
      (await transaction.user.count({
        where: {
          email,
          ...(excludedUserId === undefined
            ? {}
            : { id: { not: excludedUserId } }),
        },
      })) > 0
    );
  }

  countActiveAdmins(transaction: Prisma.TransactionClient) {
    return transaction.user.count({ where: { active: true, role: "ADMIN" } });
  }

  create(data: UserCreateData, transaction: Prisma.TransactionClient) {
    return transaction.user.create({ data, select: userSelection });
  }

  update(
    id: string,
    data: UserUpdateData,
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.user.update({
      where: { id },
      data,
      select: userSelection,
    });
  }

  async deleteSessions(userId: string, transaction: Prisma.TransactionClient) {
    await transaction.session.deleteMany({ where: { userId } });
  }

  async recordAudit(
    input: UserAuditInput,
    transaction: Prisma.TransactionClient,
  ) {
    const target = input.after ?? input.before;
    await transaction.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: "User",
        entityId: target?.id,
        beforeJson:
          input.before === undefined ? null : JSON.stringify(input.before),
        afterJson:
          input.after === undefined ? null : JSON.stringify(input.after),
      },
    });
  }
}
