import { NextRequest } from "next/server";
import { UserRole } from "../../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import { AuditLogService } from "../../../src/features/audit/application/audit-log-service";
import {
  createAuditLogCollectionHandler,
  createAuditLogItemHandler,
} from "../../../src/features/audit/http/audit-log-handlers";
import { PrismaAuditLogRepository } from "../../../src/features/audit/infrastructure/prisma-audit-log-repository";
import type { AuthenticatedUser } from "../../../src/features/auth/domain/auth-user";
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

const auth = (actor: AuthenticatedUser) => ({
  getCurrentUser: async () => actor,
});
const request = (path: string) => new NextRequest(`http://localhost${path}`);

describe("audit log integration", () => {
  it("lists newest first and filters by actor, action and entity type for ADMIN", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.user.createMany({
        data: [buildUser(admin), buildUser(manager), buildUser(member)],
      });
      await database.prisma.auditLog.createMany({
        data: [
          {
            id: "audit-old",
            actorUserId: member.id,
            action: "LOGIN",
            entityType: "User",
            entityId: member.id,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            id: "audit-match",
            actorUserId: manager.id,
            action: "UPDATE",
            entityType: "User",
            entityId: member.id,
            afterJson: '{"role":"MANAGER"}',
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      });
      const service = new AuditLogService(
        new PrismaAuditLogRepository(database.prisma),
      );
      const collection = createAuditLogCollectionHandler(service, auth(admin));
      const item = createAuditLogItemHandler(service, auth(admin));

      const response = await collection(
        request(
          "/api/admin/audit-logs?actor=Manager&action=UPDATE&entityType=User",
        ),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: { logs: Array<{ id: string }>; pagination: { total: number } };
      };
      expect(body.data.logs.map(({ id }) => id)).toEqual(["audit-match"]);
      expect(body.data.pagination.total).toBe(1);

      const detail = await item(request("/api/admin/audit-logs/audit-match"), {
        params: Promise.resolve({ id: "audit-match" }),
      });
      expect(detail.status).toBe(200);
      await expect(detail.json()).resolves.toMatchObject({
        data: {
          log: {
            actor: { name: "Manager" },
            action: "UPDATE",
            entityType: "User",
            entityId: member.id,
          },
        },
      });
    } finally {
      await database.cleanup();
    }
  });

  it.each([manager, member])("returns 403 to $role", async (actor) => {
    const database = await createTestDatabase();
    try {
      await database.prisma.user.createMany({
        data: [buildUser(admin), buildUser(manager), buildUser(member)],
      });
      await database.prisma.auditLog.create({
        data: {
          id: "audit-1",
          actorUserId: admin.id,
          action: "LOGIN",
          entityType: "User",
        },
      });
      const service = new AuditLogService(
        new PrismaAuditLogRepository(database.prisma),
      );
      const collection = createAuditLogCollectionHandler(service, auth(actor));
      const item = createAuditLogItemHandler(service, auth(actor));
      const responses = await Promise.all([
        collection(request("/api/admin/audit-logs")),
        item(request("/api/admin/audit-logs/audit-1"), {
          params: Promise.resolve({ id: "audit-1" }),
        }),
      ]);
      expect(responses.map(({ status }) => status)).toEqual([403, 403]);
    } finally {
      await database.cleanup();
    }
  });
});
