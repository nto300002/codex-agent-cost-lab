import type { Prisma, PrismaClient } from "../../../../generated/prisma/client";
import type { ActivityRepository } from "../application/activity-repository";
import type {
  Activity,
  ActivityCreateData,
  ActivitySearch,
  ActivityUpdateData,
} from "../domain/activity";

const relations = {
  customer: { select: { id: true, name: true, ownerId: true } },
  deal: { select: { id: true, title: true, customerId: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

type ActivityRecord = Prisma.ActivityGetPayload<{ include: typeof relations }>;

function toActivity(record: ActivityRecord): Activity {
  return record;
}

export class PrismaActivityRepository implements ActivityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(
    criteria: ActivitySearch & { restrictedCustomerOwnerId?: string },
  ) {
    const where: Prisma.ActivityWhereInput = {
      ...(criteria.customerId ? { customerId: criteria.customerId } : {}),
      ...(criteria.dealId ? { dealId: criteria.dealId } : {}),
      ...(criteria.restrictedCustomerOwnerId
        ? { customer: { ownerId: criteria.restrictedCustomerOwnerId } }
        : {}),
    };
    const [records, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: relations,
        orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
      }),
      this.prisma.activity.count({ where }),
    ]);
    return { activities: records.map(toActivity), total };
  }

  async findById(id: string) {
    const record = await this.prisma.activity.findUnique({
      where: { id },
      include: relations,
    });
    return record ? toActivity(record) : null;
  }

  async findCustomerOwnerId(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { ownerId: true },
    });
    return customer?.ownerId ?? null;
  }

  async findDealCustomerId(dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { customerId: true },
    });
    return deal?.customerId ?? null;
  }

  create(data: ActivityCreateData) {
    return this.prisma.activity.create({ data, include: relations });
  }

  update(id: string, data: ActivityUpdateData) {
    return this.prisma.activity.update({
      where: { id },
      data,
      include: relations,
    });
  }

  async delete(id: string) {
    await this.prisma.activity.delete({ where: { id } });
  }
}
