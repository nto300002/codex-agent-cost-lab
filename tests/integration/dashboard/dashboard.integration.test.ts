import { UserRole } from "../../../generated/prisma/client";
import { describe, expect, it } from "vitest";
import { seedDatabase } from "../../../prisma/seed";
import { DashboardService } from "../../../src/features/dashboard/application/dashboard-service";
import { PrismaDashboardRepository } from "../../../src/features/dashboard/infrastructure/prisma-dashboard-repository";
import { FixedClock } from "../../../src/shared/time/clock";
import { createTestDatabase } from "../../helpers/test-database";

const member1Id = "00000000-0000-4000-8000-000000000003";

describe("dashboard fixed Seed integration", () => {
  it("returns the complete fixed Seed summary for ADMIN", async () => {
    const database = await createTestDatabase();
    try {
      await seedDatabase(database.prisma);
      const service = new DashboardService(
        new PrismaDashboardRepository(database.prisma),
        new FixedClock("2026-04-15T00:00:00.000Z"),
      );
      const result = await service.get({
        id: "00000000-0000-4000-8000-000000000001",
        email: "admin@example.test",
        name: "管理者",
        role: UserRole.ADMIN,
      });

      expect(result).toMatchObject({
        customerCount: 40,
        dealCount: 80,
        activeDealCount: 48,
        wonThisMonthAmountCents: 19_875_000,
        customerStatusCounts: { LEAD: 14, ACTIVE: 13, INACTIVE: 13 },
        dealStageCounts: {
          NEW: 16,
          QUALIFIED: 16,
          PROPOSAL: 16,
          WON: 16,
          LOST: 16,
        },
      });
      expect(result.recentActivities.map(({ id }) => id)).toEqual([
        "30000000-0000-4000-8000-000000000160",
        "30000000-0000-4000-8000-000000000159",
        "30000000-0000-4000-8000-000000000158",
        "30000000-0000-4000-8000-000000000157",
        "30000000-0000-4000-8000-000000000156",
      ]);
    } finally {
      await database.cleanup();
    }
  });

  it("does not include another owner's fixed Seed data for MEMBER", async () => {
    const database = await createTestDatabase();
    try {
      await seedDatabase(database.prisma);
      const service = new DashboardService(
        new PrismaDashboardRepository(database.prisma),
        new FixedClock("2026-04-15T00:00:00.000Z"),
      );
      const result = await service.get({
        id: member1Id,
        email: "member1@example.test",
        name: "担当者 一郎",
        role: UserRole.MEMBER,
      });

      expect(result).toMatchObject({
        customerCount: 20,
        dealCount: 40,
        activeDealCount: 24,
        wonThisMonthAmountCents: 9_625_000,
        customerStatusCounts: { LEAD: 7, ACTIVE: 6, INACTIVE: 7 },
        dealStageCounts: {
          NEW: 8,
          QUALIFIED: 8,
          PROPOSAL: 8,
          WON: 8,
          LOST: 8,
        },
      });
      expect(
        result.recentActivities.every(
          ({ customer }) => customer.ownerId === member1Id,
        ),
      ).toBe(true);
      expect(result.recentActivities.map(({ id }) => id)).toEqual([
        "30000000-0000-4000-8000-000000000156",
        "30000000-0000-4000-8000-000000000155",
        "30000000-0000-4000-8000-000000000154",
        "30000000-0000-4000-8000-000000000153",
        "30000000-0000-4000-8000-000000000148",
      ]);
    } finally {
      await database.cleanup();
    }
  });
});
