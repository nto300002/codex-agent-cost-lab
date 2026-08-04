import type { Prisma, PrismaClient } from "../../../../generated/prisma/client";
import { customerStatuses } from "../../customer/domain/customer";
import { dealStages } from "../../deal/domain/deal";
import type { DashboardRepository } from "../application/dashboard-repository";
import type { DashboardActivity, DashboardCriteria } from "../domain/dashboard";

const activityRelations = {
  customer: { select: { id: true, name: true, ownerId: true } },
  deal: { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

type ActivityRecord = Prisma.ActivityGetPayload<{
  include: typeof activityRelations;
}>;

export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async summarize(criteria: DashboardCriteria) {
    const customerWhere: Prisma.CustomerWhereInput = criteria.customerOwnerId
      ? { ownerId: criteria.customerOwnerId }
      : {};
    const dealWhere: Prisma.DealWhereInput = criteria.dealOwnerId
      ? { ownerId: criteria.dealOwnerId }
      : {};
    const activityWhere: Prisma.ActivityWhereInput =
      criteria.activityCustomerOwnerId
        ? { customer: { ownerId: criteria.activityCustomerOwnerId } }
        : {};

    const [
      customerCount,
      dealCount,
      activeDealCount,
      wonAmount,
      customerGroups,
      dealGroups,
      recentActivities,
    ] = await Promise.all([
      this.prisma.customer.count({ where: customerWhere }),
      this.prisma.deal.count({ where: dealWhere }),
      this.prisma.deal.count({
        where: {
          ...dealWhere,
          stage: { in: ["NEW", "QUALIFIED", "PROPOSAL"] },
        },
      }),
      this.prisma.deal.aggregate({
        where: {
          ...dealWhere,
          stage: "WON",
          updatedAt: {
            gte: criteria.monthStart,
            lt: criteria.nextMonthStart,
          },
        },
        _sum: { amountCents: true },
      }),
      this.prisma.customer.groupBy({
        by: ["status"],
        where: customerWhere,
        _count: { _all: true },
      }),
      this.prisma.deal.groupBy({
        by: ["stage"],
        where: dealWhere,
        _count: { _all: true },
      }),
      this.prisma.activity.findMany({
        where: activityWhere,
        include: activityRelations,
        orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
        take: 5,
      }),
    ]);

    const customerStatusCounts = Object.fromEntries(
      customerStatuses.map((status) => [
        status,
        customerGroups.find((group) => group.status === status)?._count._all ??
          0,
      ]),
    ) as Record<(typeof customerStatuses)[number], number>;
    const dealStageCounts = Object.fromEntries(
      dealStages.map((stage) => [
        stage,
        dealGroups.find((group) => group.stage === stage)?._count._all ?? 0,
      ]),
    ) as Record<(typeof dealStages)[number], number>;

    return {
      customerCount,
      dealCount,
      activeDealCount,
      wonThisMonthAmountCents: wonAmount._sum.amountCents ?? 0,
      customerStatusCounts,
      dealStageCounts,
      recentActivities: recentActivities.map(
        (activity: ActivityRecord): DashboardActivity => activity,
      ),
    };
  }
}
