import type { Prisma } from "../../../generated/prisma/client";
import { UserRole } from "../../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import { CustomerService } from "../../../src/features/customer/application/customer-service";
import type { CustomerRelationCounts } from "../../../src/features/customer/application/customer-repository";
import type { Customer } from "../../../src/features/customer/domain/customer";
import { PrismaCustomerRepository } from "../../../src/features/customer/infrastructure/prisma-customer-repository";
import { PrismaTransactionManager } from "../../../src/infrastructure/database/prisma-transaction-manager";
import { buildUser } from "../../factories/user";
import { createTestDatabase } from "../../helpers/test-database";

const admin = {
  id: "admin-1",
  email: "admin@example.test",
  name: "Admin",
  role: UserRole.ADMIN,
};

async function seedCustomerGraph(
  prisma: Prisma.TransactionClient,
  suffix: string,
) {
  const memberId = `member-${suffix}`;
  const customerId = `customer-${suffix}`;
  const dealId = `deal-${suffix}`;

  await prisma.user.createMany({
    data: [
      buildUser(admin),
      buildUser({
        id: memberId,
        email: `${memberId}@example.test`,
        name: "Member",
        role: UserRole.MEMBER,
      }),
    ],
  });
  await prisma.customer.create({
    data: {
      id: customerId,
      name: `Customer ${suffix}`,
      email: null,
      phone: null,
      status: "LEAD",
      ownerId: memberId,
      notes: null,
    },
  });
  await prisma.tag.create({
    data: { id: `tag-${suffix}`, name: `Tag ${suffix}` },
  });
  await prisma.customerTag.create({
    data: { customerId, tagId: `tag-${suffix}` },
  });
  await prisma.deal.create({
    data: {
      id: dealId,
      customerId,
      title: "Deal",
      amountCents: 1000,
      stage: "NEW",
      ownerId: memberId,
    },
  });
  await prisma.activity.create({
    data: {
      id: `activity-${suffix}`,
      customerId,
      dealId,
      type: "CALL",
      summary: "Call",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      createdById: memberId,
    },
  });

  return customerId;
}

class FailingAuditCustomerRepository extends PrismaCustomerRepository {
  override async recordDeleteAudit(
    _input: {
      actorUserId: string;
      customer: Customer;
      relationCounts: CustomerRelationCounts;
    },
    _transaction: Prisma.TransactionClient,
  ): Promise<void> {
    void _input;
    void _transaction;
    throw new Error("audit failed");
  }
}

describe("customer integration", () => {
  it("combines every search filter and applies stable pagination order", async () => {
    const database = await createTestDatabase();

    try {
      await database.prisma.user.createMany({
        data: [
          buildUser({
            id: "owner-1",
            email: "owner1@example.test",
            name: "Owner 1",
            role: UserRole.MEMBER,
          }),
          buildUser({
            id: "owner-2",
            email: "owner2@example.test",
            name: "Owner 2",
            role: UserRole.MEMBER,
          }),
        ],
      });
      await database.prisma.customer.createMany({
        data: [
          {
            id: "customer-a",
            name: "Alpha Trading",
            email: "alpha@example.test",
            phone: "03-1111-1111",
            status: "ACTIVE",
            ownerId: "owner-1",
            updatedAt: new Date("2026-01-03T00:00:00.000Z"),
          },
          {
            id: "customer-b",
            name: "Beta Systems",
            email: "beta@example.test",
            phone: "03-2222-2222",
            status: "LEAD",
            ownerId: "owner-2",
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      });
      const repository = new PrismaCustomerRepository(database.prisma);
      const filtered = await repository.list({
        name: "alpha",
        email: "alpha@",
        phone: "1111",
        status: "ACTIVE",
        ownerId: "owner-1",
        page: 1,
        pageSize: 20,
      });
      const firstPage = await repository.list({ page: 1, pageSize: 1 });
      const secondPage = await repository.list({ page: 2, pageSize: 1 });

      expect(filtered.customers.map(({ id }) => id)).toEqual(["customer-a"]);
      expect(filtered.total).toBe(1);
      expect(firstPage.customers[0]?.id).toBe("customer-a");
      expect(secondPage.customers[0]?.id).toBe("customer-b");
    } finally {
      await database.cleanup();
    }
  });

  it("deletes the complete customer graph and records one audit atomically", async () => {
    const database = await createTestDatabase();

    try {
      const customerId = await seedCustomerGraph(database.prisma, "success");
      const service = new CustomerService(
        new PrismaCustomerRepository(database.prisma),
        new PrismaTransactionManager(database.prisma),
      );

      await service.delete(admin, customerId);

      expect(
        await database.prisma.customer.findUnique({
          where: { id: customerId },
        }),
      ).toBeNull();
      expect(await database.prisma.deal.count({ where: { customerId } })).toBe(
        0,
      );
      expect(
        await database.prisma.activity.count({ where: { customerId } }),
      ).toBe(0);
      expect(
        await database.prisma.customerTag.count({ where: { customerId } }),
      ).toBe(0);
      const audit = await database.prisma.auditLog.findFirst({
        where: { entityType: "Customer", entityId: customerId },
      });
      expect(audit).toMatchObject({
        actorUserId: admin.id,
        action: "DELETE",
      });
      expect(JSON.parse(audit?.beforeJson ?? "{}")).toMatchObject({
        customer: { id: customerId },
        relationCounts: { customerTags: 1, activities: 1, deals: 1 },
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back every deletion when audit recording fails", async () => {
    const database = await createTestDatabase();

    try {
      const customerId = await seedCustomerGraph(database.prisma, "rollback");
      const service = new CustomerService(
        new FailingAuditCustomerRepository(database.prisma),
        new PrismaTransactionManager(database.prisma),
      );

      await expect(service.delete(admin, customerId)).rejects.toThrow(
        "audit failed",
      );

      expect(
        await database.prisma.customer.count({ where: { id: customerId } }),
      ).toBe(1);
      expect(await database.prisma.deal.count({ where: { customerId } })).toBe(
        1,
      );
      expect(
        await database.prisma.activity.count({ where: { customerId } }),
      ).toBe(1);
      expect(
        await database.prisma.customerTag.count({ where: { customerId } }),
      ).toBe(1);
    } finally {
      await database.cleanup();
    }
  });
});
