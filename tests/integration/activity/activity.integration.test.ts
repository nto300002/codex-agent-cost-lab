import { NextRequest } from "next/server";
import { UserRole } from "../../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import { ActivityService } from "../../../src/features/activity/application/activity-service";
import {
  createActivityCollectionHandlers,
  createActivityItemHandlers,
} from "../../../src/features/activity/http/activity-handlers";
import { PrismaActivityRepository } from "../../../src/features/activity/infrastructure/prisma-activity-repository";
import type { AuthenticatedUser } from "../../../src/features/auth/domain/auth-user";
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

async function seedReferences(
  database: Awaited<ReturnType<typeof createTestDatabase>>,
) {
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
  await database.prisma.deal.createMany({
    data: [
      {
        id: "deal-1",
        customerId: "customer-1",
        title: "Deal 1",
        amountCents: 100,
        stage: "NEW",
        ownerId: member1.id,
      },
      {
        id: "deal-2",
        customerId: "customer-2",
        title: "Deal 2",
        amountCents: 200,
        stage: "NEW",
        ownerId: member2.id,
      },
    ],
  });
}

describe("activity integration", () => {
  it("creates, lists, updates and deletes an owned activity", async () => {
    const database = await createTestDatabase();
    try {
      await seedReferences(database);
      const service = new ActivityService(
        new PrismaActivityRepository(database.prisma),
      );
      const collection = createActivityCollectionHandlers(
        service,
        auth(member1),
      );
      const item = createActivityItemHandlers(service, auth(member1));

      const created = await collection.POST(
        request("/api/activities", "POST", {
          customerId: "customer-1",
          dealId: "deal-1",
          type: "CALL",
          summary: "Initial call",
          occurredAt: "2026-04-01T01:00:00.000Z",
        }),
      );
      expect(created.status).toBe(201);
      const body = (await created.json()) as {
        data: { activity: { id: string; createdById: string } };
      };
      const activityId = body.data.activity.id;
      expect(body.data.activity.createdById).toBe(member1.id);

      const list = await collection.GET(
        request("/api/activities?customerId=customer-1&dealId=deal-1"),
      );
      await expect(list.json()).resolves.toMatchObject({
        data: { activities: [{ id: activityId }], pagination: { total: 1 } },
      });

      const updated = await item.PATCH(
        request(`/api/activities/${activityId}`, "PATCH", {
          summary: "Updated call",
        }),
        { params: Promise.resolve({ id: activityId }) },
      );
      expect(updated.status).toBe(200);
      await expect(updated.json()).resolves.toMatchObject({
        data: { activity: { summary: "Updated call" } },
      });

      const deleted = await item.DELETE(
        request(`/api/activities/${activityId}`, "DELETE"),
        { params: Promise.resolve({ id: activityId }) },
      );
      expect(deleted.status).toBe(204);
      expect(await database.prisma.activity.count()).toBe(0);
    } finally {
      await database.cleanup();
    }
  });

  it("rejects a mismatched Deal and another owner's activity", async () => {
    const database = await createTestDatabase();
    try {
      await seedReferences(database);
      await database.prisma.activity.create({
        data: {
          id: "activity-2",
          customerId: "customer-2",
          dealId: "deal-2",
          type: "EMAIL",
          summary: "Outside scope",
          occurredAt: new Date("2026-04-02T00:00:00.000Z"),
          createdById: member2.id,
        },
      });
      const service = new ActivityService(
        new PrismaActivityRepository(database.prisma),
      );
      const collection = createActivityCollectionHandlers(
        service,
        auth(member1),
      );
      const item = createActivityItemHandlers(service, auth(member1));

      const mismatched = await collection.POST(
        request("/api/activities", "POST", {
          customerId: "customer-1",
          dealId: "deal-2",
          type: "CALL",
          summary: "Mismatched",
          occurredAt: "2026-04-01T01:00:00.000Z",
        }),
      );
      expect(mismatched.status).toBe(400);

      const responses = await Promise.all([
        item.GET(request("/api/activities/activity-2"), {
          params: Promise.resolve({ id: "activity-2" }),
        }),
        item.PATCH(
          request("/api/activities/activity-2", "PATCH", {
            summary: "Blocked",
          }),
          { params: Promise.resolve({ id: "activity-2" }) },
        ),
        item.DELETE(request("/api/activities/activity-2", "DELETE"), {
          params: Promise.resolve({ id: "activity-2" }),
        }),
      ]);
      expect(responses.map(({ status }) => status)).toEqual([403, 403, 403]);
    } finally {
      await database.cleanup();
    }
  });
});
