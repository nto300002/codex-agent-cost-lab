import type { Prisma, PrismaClient } from "../../../../generated/prisma/client";
import type {
  CustomerListCriteria,
  CustomerRepository,
} from "../application/customer-repository";
import type {
  Customer,
  CustomerCreateData,
  CustomerUpdateData,
} from "../domain/customer";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
const customerRelations = {
  owner: { select: { id: true, name: true } },
  tags: {
    select: { tag: { select: { id: true, name: true } } },
    orderBy: { tag: { name: "asc" } },
  },
} as const;
type CustomerRecord = Prisma.CustomerGetPayload<{
  include: typeof customerRelations;
}>;

function toCustomer({ tags, ...customer }: CustomerRecord): Customer {
  return { ...customer, tags: tags.map(({ tag }) => tag) };
}

export class PrismaCustomerRepository implements CustomerRepository<Prisma.TransactionClient> {
  constructor(private readonly prisma: PrismaClient) {}

  async list(criteria: CustomerListCriteria) {
    const where = this.listWhere(criteria);
    const [records, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: customerRelations,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (criteria.page - 1) * criteria.pageSize,
        take: criteria.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { customers: records.map(toCustomer), total };
  }

  async findById(id: string, transaction?: Prisma.TransactionClient) {
    const record = await this.database(transaction).customer.findUnique({
      where: { id },
      include: customerRelations,
    });
    return record === null ? null : toCustomer(record);
  }

  async activeOwnerExists(ownerId: string) {
    return (
      (await this.prisma.user.count({
        where: { id: ownerId, active: true },
      })) === 1
    );
  }

  listActiveOwners(ownerId?: string) {
    return this.prisma.user.findMany({
      where: {
        active: true,
        ...(ownerId === undefined ? {} : { id: ownerId }),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
  }

  create(data: CustomerCreateData) {
    return this.prisma.customer.create({ data });
  }

  update(id: string, data: CustomerUpdateData) {
    return this.prisma.customer.update({ where: { id }, data });
  }

  async countRelations(
    customerId: string,
    transaction: Prisma.TransactionClient,
  ) {
    const [customerTags, activities, deals] = await Promise.all([
      transaction.customerTag.count({ where: { customerId } }),
      transaction.activity.count({ where: { customerId } }),
      transaction.deal.count({ where: { customerId } }),
    ]);

    return { customerTags, activities, deals };
  }

  async deleteCustomerTags(
    customerId: string,
    transaction: Prisma.TransactionClient,
  ) {
    await transaction.customerTag.deleteMany({ where: { customerId } });
  }

  async deleteActivities(
    customerId: string,
    transaction: Prisma.TransactionClient,
  ) {
    await transaction.activity.deleteMany({ where: { customerId } });
  }

  async deleteDeals(customerId: string, transaction: Prisma.TransactionClient) {
    await transaction.deal.deleteMany({ where: { customerId } });
  }

  async deleteCustomer(
    customerId: string,
    transaction: Prisma.TransactionClient,
  ) {
    await transaction.customer.delete({ where: { id: customerId } });
  }

  async recordDeleteAudit(
    input: Parameters<
      CustomerRepository<Prisma.TransactionClient>["recordDeleteAudit"]
    >[0],
    transaction: Prisma.TransactionClient,
  ) {
    await transaction.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "DELETE",
        entityType: "Customer",
        entityId: input.customer.id,
        beforeJson: JSON.stringify({
          customer: input.customer,
          relationCounts: input.relationCounts,
        }),
      },
    });
  }

  private database(transaction?: Prisma.TransactionClient): DatabaseClient {
    return transaction ?? this.prisma;
  }

  private listWhere(criteria: CustomerListCriteria): Prisma.CustomerWhereInput {
    return {
      ...(criteria.name === undefined
        ? {}
        : { name: { contains: criteria.name } }),
      ...(criteria.email === undefined
        ? {}
        : { email: { contains: criteria.email } }),
      ...(criteria.phone === undefined
        ? {}
        : { phone: { contains: criteria.phone } }),
      ...(criteria.status === undefined ? {} : { status: criteria.status }),
      AND: [
        ...(criteria.ownerId === undefined
          ? []
          : [{ ownerId: criteria.ownerId }]),
        ...(criteria.restrictedOwnerId === undefined
          ? []
          : [{ ownerId: criteria.restrictedOwnerId }]),
      ],
    };
  }
}
