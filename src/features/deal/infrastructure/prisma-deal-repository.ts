import type { Prisma, PrismaClient } from "../../../../generated/prisma/client";
import type { DealRepository } from "../application/deal-repository";
import type {
  Deal,
  DealCreateData,
  DealSearch,
  DealUpdateData,
} from "../domain/deal";

const relations = {
  customer: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
} as const;
type DealRecord = Prisma.DealGetPayload<{ include: typeof relations }>;
function toDeal(record: DealRecord): Deal {
  return record;
}

export class PrismaDealRepository implements DealRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(criteria: DealSearch & { restrictedOwnerId?: string }) {
    const where: Prisma.DealWhereInput = {
      ...(criteria.customerId ? { customerId: criteria.customerId } : {}),
      ...(criteria.stage ? { stage: criteria.stage } : {}),
      AND: [
        ...(criteria.ownerId ? [{ ownerId: criteria.ownerId }] : []),
        ...(criteria.restrictedOwnerId
          ? [{ ownerId: criteria.restrictedOwnerId }]
          : []),
      ],
      ...(!criteria.expectedFrom && !criteria.expectedTo
        ? {}
        : {
            expectedCloseDate: {
              ...(criteria.expectedFrom ? { gte: criteria.expectedFrom } : {}),
              ...(criteria.expectedTo ? { lte: criteria.expectedTo } : {}),
            },
          }),
    };
    const [records, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        include: relations,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { deals: records.map(toDeal), total };
  }

  async findById(id: string) {
    const record = await this.prisma.deal.findUnique({
      where: { id },
      include: relations,
    });
    return record ? toDeal(record) : null;
  }
  async activeOwnerExists(ownerId: string) {
    return (
      (await this.prisma.user.count({
        where: { id: ownerId, active: true },
      })) === 1
    );
  }
  async findCustomerOwnerId(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { ownerId: true },
    });
    return customer?.ownerId ?? null;
  }
  create(data: DealCreateData) {
    return this.prisma.deal.create({ data, include: relations });
  }
  update(id: string, data: DealUpdateData) {
    return this.prisma.deal.update({ where: { id }, data, include: relations });
  }
}
