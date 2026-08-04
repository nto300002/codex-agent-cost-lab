import { NextRequest } from "next/server";
import { UserRole, type PrismaClient } from "../../../generated/prisma/client";
import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../../src/features/auth/domain/auth-user";
import { AuditLogService } from "../../../src/features/audit/application/audit-log-service";
import { PrismaAuditLogRepository } from "../../../src/features/audit/infrastructure/prisma-audit-log-repository";
import { UserService } from "../../../src/features/user/application/user-service";
import {
  createUserCollectionHandlers,
  createUserItemHandlers,
} from "../../../src/features/user/http/user-handlers";
import { PrismaUserRepository } from "../../../src/features/user/infrastructure/prisma-user-repository";
import { PrismaTransactionManager } from "../../../src/infrastructure/database/prisma-transaction-manager";
import { buildUser } from "../../factories/user";
import { createTestDatabase } from "../../helpers/test-database";

const admin: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@example.test",
  name: "Admin",
  role: UserRole.ADMIN,
};
const manager: AuthenticatedUser = {
  id: "manager-1",
  email: "manager@example.test",
  name: "Manager",
  role: UserRole.MANAGER,
};
const member: AuthenticatedUser = {
  id: "member-1",
  email: "member@example.test",
  name: "Member",
  role: UserRole.MEMBER,
};

function auth(actor: AuthenticatedUser) {
  return { getCurrentUser: async () => actor };
}

function request(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}

function audit(prisma: PrismaClient) {
  return new AuditLogService(new PrismaAuditLogRepository(prisma));
}

describe("user management integration", () => {
  it.each([manager, member])(
    "returns 403 from every user management API for $role",
    async (actor) => {
      const database = await createTestDatabase();
      try {
        await database.prisma.user.createMany({
          data: [buildUser(admin), buildUser(manager), buildUser(member)],
        });
        const service = new UserService(
          new PrismaUserRepository(database.prisma),
          new PrismaTransactionManager(database.prisma),
          audit(database.prisma),
        );
        const collection = createUserCollectionHandlers(service, auth(actor));
        const item = createUserItemHandlers(service, auth(actor));

        const responses = await Promise.all([
          collection.GET(request("http://localhost/api/admin/users")),
          collection.POST(
            request("http://localhost/api/admin/users", "POST", {
              name: "Blocked",
              email: "blocked@example.test",
              password: "BlockedPass!1",
              role: "MEMBER",
            }),
          ),
          item.PATCH(
            request("http://localhost/api/admin/users/member-1", "PATCH", {
              role: "MANAGER",
            }),
            { params: Promise.resolve({ id: "member-1" }) },
          ),
        ]);

        expect(responses.map(({ status }) => status)).toEqual([403, 403, 403]);
      } finally {
        await database.cleanup();
      }
    },
  );

  it("creates, updates and disables a user with unique email and audit logs", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.user.create({ data: buildUser(admin) });
      const service = new UserService(
        new PrismaUserRepository(database.prisma),
        new PrismaTransactionManager(database.prisma),
        audit(database.prisma),
      );
      const collection = createUserCollectionHandlers(service, auth(admin));
      const item = createUserItemHandlers(service, auth(admin));

      const createdResponse = await collection.POST(
        request("http://localhost/api/admin/users", "POST", {
          name: "New User",
          email: "NEW.USER@EXAMPLE.TEST",
          password: "StrongPass!123",
          role: "MEMBER",
        }),
      );
      expect(createdResponse.status).toBe(201);
      const createdBody = (await createdResponse.json()) as {
        data: { user: { id: string; email: string; passwordHash?: string } };
      };
      expect(createdBody.data.user.email).toBe("new.user@example.test");
      expect(createdBody.data.user.passwordHash).toBeUndefined();
      const userId = createdBody.data.user.id;

      const duplicate = await collection.POST(
        request("http://localhost/api/admin/users", "POST", {
          name: "Duplicate",
          email: "new.user@example.test",
          password: "StrongPass!123",
          role: "MEMBER",
        }),
      );
      expect(duplicate.status).toBe(409);

      await database.prisma.session.create({
        data: {
          tokenHash: "session-hash",
          userId,
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        },
      });
      const roleResponse = await item.PATCH(
        request(`http://localhost/api/admin/users/${userId}`, "PATCH", {
          role: "MANAGER",
        }),
        { params: Promise.resolve({ id: userId }) },
      );
      expect(roleResponse.status).toBe(200);
      const disableResponse = await item.PATCH(
        request(`http://localhost/api/admin/users/${userId}`, "PATCH", {
          active: false,
        }),
        { params: Promise.resolve({ id: userId }) },
      );
      expect(disableResponse.status).toBe(200);

      expect(await database.prisma.session.count({ where: { userId } })).toBe(
        0,
      );
      const audits = await database.prisma.auditLog.findMany({
        where: { entityId: userId },
        orderBy: { createdAt: "asc" },
      });
      expect(audits.map(({ action }) => action)).toEqual([
        "CREATE",
        "ROLE_CHANGE",
        "DISABLE",
      ]);
      expect(JSON.stringify(audits)).not.toContain("passwordHash");
    } finally {
      await database.cleanup();
    }
  });

  it("rejects self-disable and removing the last active ADMIN", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.user.create({ data: buildUser(admin) });
      const service = new UserService(
        new PrismaUserRepository(database.prisma),
        new PrismaTransactionManager(database.prisma),
        audit(database.prisma),
      );

      await expect(
        service.update(admin, admin.id, { active: false }),
      ).rejects.toThrow("自分自身を無効化できません");
      await expect(
        service.update({ ...admin, id: "external-admin" }, admin.id, {
          role: UserRole.MANAGER,
        }),
      ).rejects.toThrow("最後の有効なADMIN");
    } finally {
      await database.cleanup();
    }
  });
});
