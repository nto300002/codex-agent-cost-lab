import { NextRequest } from "next/server";
import { UserRole } from "../../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import type { AuthenticatedUser } from "../../../src/features/auth/domain/auth-user";
import { PrismaCustomerRepository } from "../../../src/features/customer/infrastructure/prisma-customer-repository";
import { PrismaDealRepository } from "../../../src/features/deal/infrastructure/prisma-deal-repository";
import { ExportService } from "../../../src/features/export/application/export-service";
import {
  createCustomerExportHandler,
  createDealExportHandler,
} from "../../../src/features/export/http/export-handlers";
import { PrismaExportAuditRepository } from "../../../src/features/export/infrastructure/prisma-export-audit-repository";
import { buildUser } from "../../factories/user";
import { createTestDatabase } from "../../helpers/test-database";

const manager: AuthenticatedUser = {
  id: "manager-1",
  email: "manager@example.test",
  name: "Manager",
  role: UserRole.MANAGER,
};
const admin: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@example.test",
  name: "Admin",
  role: UserRole.ADMIN,
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

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("CSV export integration", () => {
  it("exports the same filtered Customer and Deal rows for a manager", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.user.createMany({
        data: [buildUser(manager), buildUser(admin), buildUser(member)],
      });
      await database.prisma.customer.createMany({
        data: [
          {
            id: "customer-active",
            name: "=Danger, Inc.",
            email: "safe@example.test",
            phone: "03-1111-1111",
            status: "ACTIVE",
            ownerId: member.id,
            notes: 'first "quote"\nsecond line',
          },
          {
            id: "customer-lead",
            name: "Excluded customer",
            email: null,
            phone: null,
            status: "LEAD",
            ownerId: member.id,
          },
        ],
      });
      await database.prisma.deal.createMany({
        data: [
          {
            id: "deal-proposal",
            customerId: "customer-active",
            title: "@Dangerous deal",
            amountCents: 123456,
            stage: "PROPOSAL",
            ownerId: member.id,
            expectedCloseDate: new Date("2026-09-01T00:00:00.000Z"),
          },
          {
            id: "deal-new",
            customerId: "customer-active",
            title: "Excluded deal",
            amountCents: 500,
            stage: "NEW",
            ownerId: member.id,
          },
        ],
      });

      const service = new ExportService(
        new PrismaCustomerRepository(database.prisma),
        new PrismaDealRepository(database.prisma),
        new PrismaExportAuditRepository(database.prisma),
      );
      const customerResponse = await createCustomerExportHandler(
        service,
        auth(manager),
      )(request("/api/exports/customers.csv?status=ACTIVE"));
      const dealResponse = await createDealExportHandler(
        service,
        auth(manager),
      )(request("/api/exports/deals.csv?stage=PROPOSAL"));

      expect(customerResponse.status).toBe(200);
      expect(customerResponse.headers.get("content-type")).toBe(
        "text/csv; charset=utf-8",
      );
      expect(customerResponse.headers.get("content-disposition")).toContain(
        "customers.csv",
      );
      const customerCsv = await customerResponse.text();
      expect(customerCsv).toContain('"\'=Danger, Inc."');
      expect(customerCsv).toContain('"first ""quote""\nsecond line"');
      expect(customerCsv).not.toContain("Excluded customer");

      expect(dealResponse.status).toBe(200);
      const dealCsv = await dealResponse.text();
      expect(dealCsv).toContain('"\'@Dangerous deal"');
      expect(dealCsv).toContain('"123456"');
      expect(dealCsv).not.toContain("Excluded deal");

      const audits = await database.prisma.auditLog.findMany({
        where: { actorUserId: manager.id, action: "EXPORT" },
        orderBy: { entityType: "asc" },
      });
      expect(audits).toHaveLength(2);
      expect(audits.map(({ entityType }) => entityType)).toEqual([
        "Customer",
        "Deal",
      ]);
      expect(
        audits.map(({ afterJson }) => JSON.parse(afterJson ?? "{}")),
      ).toEqual([
        { filters: { status: "ACTIVE" }, rowCount: 1 },
        { filters: { stage: "PROPOSAL" }, rowCount: 1 },
      ]);
    } finally {
      await database.cleanup();
    }
  });

  it("allows ADMIN and rejects MEMBER on both export APIs", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.user.createMany({
        data: [buildUser(admin), buildUser(member)],
      });
      const service = new ExportService(
        new PrismaCustomerRepository(database.prisma),
        new PrismaDealRepository(database.prisma),
        new PrismaExportAuditRepository(database.prisma),
      );

      const [adminCustomers, adminDeals, memberCustomers, memberDeals] =
        await Promise.all([
          createCustomerExportHandler(
            service,
            auth(admin),
          )(request("/api/exports/customers.csv")),
          createDealExportHandler(
            service,
            auth(admin),
          )(request("/api/exports/deals.csv")),
          createCustomerExportHandler(
            service,
            auth(member),
          )(request("/api/exports/customers.csv")),
          createDealExportHandler(
            service,
            auth(member),
          )(request("/api/exports/deals.csv")),
        ]);

      expect([adminCustomers.status, adminDeals.status]).toEqual([200, 200]);
      expect([memberCustomers.status, memberDeals.status]).toEqual([403, 403]);
      expect(
        await database.prisma.auditLog.count({
          where: { actorUserId: member.id },
        }),
      ).toBe(0);
    } finally {
      await database.cleanup();
    }
  });
});
