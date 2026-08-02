import type { PrismaClient } from "../../../../generated/prisma/client";
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
  constructor(private readonly prisma: PrismaClient) {}

  findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: userSelection,
    });
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
  }) {
    await this.prisma.session.create({ data: input });
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

  async deleteSessionsByUserId(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
