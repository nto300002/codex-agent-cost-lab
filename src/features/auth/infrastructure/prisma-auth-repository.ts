import type { PrismaClient } from "../../../../generated/prisma/client";
import type { AuditRecorder } from "../../audit/application/audit-log-repository";
import type {
  AuthRepository,
  StoredSession,
} from "../application/auth-repository";
import type { AuthUserRecord } from "../domain/auth-user";

const userSelection = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  role: true,
  active: true,
} as const;

export class PrismaAuthRepository implements AuthRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditRecorder,
  ) {}

  findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: userSelection,
    });
  }

  async createSessionWithLoginAudit(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
  }) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.session.create({ data: input });
      await this.audit.record(
        {
          actorUserId: input.userId,
          action: "LOGIN",
          entityType: "User",
          entityId: input.userId,
        },
        transaction,
      );
    });
  }

  findSessionByTokenHash(tokenHash: string): Promise<StoredSession | null> {
    return this.prisma.session.findUnique({
      where: { tokenHash },
      select: {
        tokenHash: true,
        expiresAt: true,
        user: { select: userSelection },
      },
    });
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async deleteSessionWithLogoutAudit(tokenHash: string) {
    await this.prisma.$transaction(async (transaction) => {
      const session = await transaction.session.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      await transaction.session.deleteMany({ where: { tokenHash } });
      if (session !== null) {
        await this.audit.record(
          {
            actorUserId: session.userId,
            action: "LOGOUT",
            entityType: "User",
            entityId: session.userId,
          },
          transaction,
        );
      }
    });
  }

  async deleteSessionsByUserId(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
