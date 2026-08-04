import { UserRole } from "../../../../generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { FixedClock } from "../../../shared/time/clock";
import type { DashboardRepository } from "./dashboard-repository";
import { DashboardService, tokyoMonthRange } from "./dashboard-service";

const summary = {
  customerCount: 0,
  dealCount: 0,
  activeDealCount: 0,
  wonThisMonthAmountCents: 0,
  customerStatusCounts: { LEAD: 0, ACTIVE: 0, INACTIVE: 0 },
  dealStageCounts: { NEW: 0, QUALIFIED: 0, PROPOSAL: 0, WON: 0, LOST: 0 },
  recentActivities: [],
};

describe("DashboardService", () => {
  it("applies each owned resource scope for a MEMBER", async () => {
    const repository = {
      summarize: vi.fn().mockResolvedValue(summary),
    } satisfies DashboardRepository;
    const service = new DashboardService(
      repository,
      new FixedClock("2026-04-15T00:00:00.000Z"),
    );
    const member = {
      id: "member-1",
      email: "member@example.test",
      name: "Member",
      role: UserRole.MEMBER,
    };

    await service.get(member);

    expect(repository.summarize).toHaveBeenCalledWith({
      customerOwnerId: member.id,
      dealOwnerId: member.id,
      activityCustomerOwnerId: member.id,
      monthStart: new Date("2026-03-31T15:00:00.000Z"),
      nextMonthStart: new Date("2026-04-30T15:00:00.000Z"),
    });
  });

  it("uses an unrestricted scope for ADMIN", async () => {
    const repository = {
      summarize: vi.fn().mockResolvedValue(summary),
    } satisfies DashboardRepository;
    const service = new DashboardService(
      repository,
      new FixedClock("2026-04-15T00:00:00.000Z"),
    );
    await service.get({
      id: "admin-1",
      email: "admin@example.test",
      name: "Admin",
      role: UserRole.ADMIN,
    });
    expect(repository.summarize).toHaveBeenCalledWith(
      expect.objectContaining({
        customerOwnerId: undefined,
        dealOwnerId: undefined,
        activityCustomerOwnerId: undefined,
      }),
    );
  });

  it("calculates December boundaries in Asia/Tokyo", () => {
    expect(tokyoMonthRange(new Date("2026-12-15T00:00:00.000Z"))).toEqual({
      monthStart: new Date("2026-11-30T15:00:00.000Z"),
      nextMonthStart: new Date("2026-12-31T15:00:00.000Z"),
    });
  });
});
