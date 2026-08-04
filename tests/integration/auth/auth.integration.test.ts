import { UserRole } from "../../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import { AuthService } from "../../../src/features/auth/application/auth-service";
import { hashPassword } from "../../../src/features/auth/domain/password";
import { hashSessionToken } from "../../../src/features/auth/domain/session-token";
import { PrismaAuthRepository } from "../../../src/features/auth/infrastructure/prisma-auth-repository";
import { AuditLogService } from "../../../src/features/audit/application/audit-log-service";
import { PrismaAuditLogRepository } from "../../../src/features/audit/infrastructure/prisma-audit-log-repository";
import { AuthenticationError } from "../../../src/shared/errors/app-error";
import { FixedClock } from "../../../src/shared/time/clock";
import { buildUser } from "../../factories/user";
import { createTestDatabase } from "../../helpers/test-database";

describe("authentication integration", () => {
  it("logs in all seed roles and prevents reuse after logout", async () => {
    const database = await createTestDatabase();
    const password = "TraceCRM!2026";
    const passwordHash = await hashPassword(password, Buffer.alloc(16, 9));
    const users = [
      {
        id: "test-admin",
        email: "admin@example.test",
        name: "Admin",
        role: UserRole.ADMIN,
      },
      {
        id: "test-manager",
        email: "manager@example.test",
        name: "Manager",
        role: UserRole.MANAGER,
      },
      {
        id: "test-member",
        email: "member1@example.test",
        name: "Member",
        role: UserRole.MEMBER,
      },
    ];
    let tokenSequence = 0;
    const service = new AuthService(
      new PrismaAuthRepository(
        database.prisma,
        new AuditLogService(new PrismaAuditLogRepository(database.prisma)),
      ),
      new FixedClock("2026-01-01T00:00:00.000Z"),
      () => `opaque-token-${++tokenSequence}`,
    );

    try {
      for (const user of users) {
        await database.prisma.user.create({
          data: buildUser({ ...user, passwordHash }),
        });
        const result = await service.login({
          email: user.email,
          password,
        });

        expect(result.user.role).toBe(user.role);
        await expect(
          service.getCurrentUser(result.sessionToken),
        ).resolves.toMatchObject({ id: user.id, role: user.role });
      }

      const firstToken = "opaque-token-1";
      await service.logout(firstToken);
      await expect(service.getCurrentUser(firstToken)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
      expect(
        await database.prisma.session.findUnique({
          where: { tokenHash: hashSessionToken(firstToken) },
        }),
      ).toBeNull();
      const audits = await database.prisma.auditLog.findMany({
        orderBy: { createdAt: "asc" },
      });
      expect(audits.map(({ action }) => action)).toEqual([
        "LOGIN",
        "LOGIN",
        "LOGIN",
        "LOGOUT",
      ]);
      expect(JSON.stringify(audits)).not.toContain("opaque-token");
      expect(JSON.stringify(audits)).not.toContain("password");
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back session creation and deletion when audit recording fails", async () => {
    const database = await createTestDatabase();
    const password = "TraceCRM!2026";
    const passwordHash = await hashPassword(password, Buffer.alloc(16, 8));
    const failingAudit = {
      async record() {
        throw new Error("audit failed");
      },
    };

    try {
      await database.prisma.user.create({
        data: buildUser({
          id: "atomic-user",
          email: "atomic@example.test",
          passwordHash,
        }),
      });
      const failingService = new AuthService(
        new PrismaAuthRepository(database.prisma, failingAudit),
        new FixedClock("2026-01-01T00:00:00.000Z"),
        () => "atomic-token",
      );

      await expect(
        failingService.login({ email: "atomic@example.test", password }),
      ).rejects.toThrow("audit failed");
      expect(await database.prisma.session.count()).toBe(0);

      const workingAudit = new AuditLogService(
        new PrismaAuditLogRepository(database.prisma),
      );
      const workingService = new AuthService(
        new PrismaAuthRepository(database.prisma, workingAudit),
        new FixedClock("2026-01-01T00:00:00.000Z"),
        () => "atomic-token",
      );
      await workingService.login({ email: "atomic@example.test", password });
      expect(await database.prisma.session.count()).toBe(1);

      await expect(failingService.logout("atomic-token")).rejects.toThrow(
        "audit failed",
      );
      expect(await database.prisma.session.count()).toBe(1);
    } finally {
      await database.cleanup();
    }
  });
});
