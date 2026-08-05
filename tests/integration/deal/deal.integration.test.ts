import { NextRequest } from "next/server";
import { UserRole } from "../../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import type { AuthenticatedUser } from "../../../src/features/auth/domain/auth-user";
import { DealService } from "../../../src/features/deal/application/deal-service";
import {
  createDealCollectionHandlers,
  createDealItemHandlers,
} from "../../../src/features/deal/http/deal-handlers";
import { PrismaDealRepository } from "../../../src/features/deal/infrastructure/prisma-deal-repository";
import { buildUser } from "../../factories/user";
import { createTestDatabase } from "../../helpers/test-database";

const member1: AuthenticatedUser = {
  id: "member-1",
  email: "member1@example.test",
  name: "Member 1",
  role: UserRole.MEMBER,
};
const member2: AuthenticatedUser = {
  id: "member-2",
  email: "member2@example.test",
  name: "Member 2",
  role: UserRole.MEMBER,
};
const manager: AuthenticatedUser = {
  id: "manager-1",
  email: "manager@example.test",
  name: "Manager",
  role: UserRole.MANAGER,
};

const auth = (actor: AuthenticatedUser) => ({
  getCurrentUser: async () => actor,
});
function request(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}

describe("deal integration", () => {
  it("creates, filters and updates a deal through the API", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.user.createMany({
        data: [buildUser(member1), buildUser(member2), buildUser(manager)],
      });
      await database.prisma.customer.createMany({
        data: [
          {
            id: "customer-1",
            name: "Customer 1",
            status: "ACTIVE",
            ownerId: member1.id,
          },
          {
            id: "customer-2",
            name: "Customer 2",
            status: "ACTIVE",
            ownerId: member2.id,
          },
        ],
      });
      const service = new DealService(
        new PrismaDealRepository(database.prisma),
      );
      const memberCollection = createDealCollectionHandlers(
        service,
        auth(member1),
      );
      const memberItem = createDealItemHandlers(service, auth(member1));

      const created = await memberCollection.POST(
        request("/api/deals", "POST", {
          customerId: "customer-1",
          title: "New Deal",
          amountCents: 100000,
          stage: "NEW",
          ownerId: member1.id,
          expectedCloseDate: "2026-09-30",
        }),
      );
      expect(created.status).toBe(201);
      const createdBody = (await created.json()) as {
        data: { deal: { id: string } };
      };
      const dealId = createdBody.data.deal.id;

      const list = await memberCollection.GET(
        request(
          `/api/deals?customerId=customer-1&stage=NEW&ownerId=${member1.id}`,
        ),
      );
      await expect(list.json()).resolves.toMatchObject({
        data: { deals: [{ id: dealId }], pagination: { total: 1 } },
      });

      const updated = await memberItem.PATCH(
        request(`/api/deals/${dealId}`, "PATCH", { stage: "QUALIFIED" }),
        { params: Promise.resolve({ id: dealId }) },
      );
      expect(updated.status).toBe(200);
      await expect(updated.json()).resolves.toMatchObject({
        data: { deal: { id: dealId, stage: "QUALIFIED" } },
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects another owner's customer and an invalid stage transition", async () => {
    const database = await createTestDatabase();
    try {
      await database.prisma.user.createMany({
        data: [buildUser(member1), buildUser(member2)],
      });
      await database.prisma.customer.createMany({
        data: [
          {
            id: "customer-1",
            name: "Customer 1",
            status: "ACTIVE",
            ownerId: member1.id,
          },
          {
            id: "customer-2",
            name: "Customer 2",
            status: "ACTIVE",
            ownerId: member2.id,
          },
        ],
      });
      await database.prisma.deal.create({
        data: {
          id: "lost-deal",
          customerId: "customer-1",
          title: "Lost Deal",
          amountCents: 100,
          stage: "LOST",
          ownerId: member1.id,
        },
      });
      const service = new DealService(
        new PrismaDealRepository(database.prisma),
      );
      const collection = createDealCollectionHandlers(service, auth(member1));
      const item = createDealItemHandlers(service, auth(member1));

      const outsideScope = await collection.POST(
        request("/api/deals", "POST", {
          customerId: "customer-2",
          title: "Blocked",
          amountCents: 100,
          stage: "NEW",
          ownerId: member1.id,
          expectedCloseDate: null,
        }),
      );
      expect(outsideScope.status).toBe(403);

      const invalidTransition = await item.PATCH(
        request("/api/deals/lost-deal", "PATCH", { stage: "WON" }),
        { params: Promise.resolve({ id: "lost-deal" }) },
      );
      expect(invalidTransition.status).toBe(400);
      await expect(invalidTransition.json()).resolves.toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
    } finally {
      await database.cleanup();
    }
  });
});
