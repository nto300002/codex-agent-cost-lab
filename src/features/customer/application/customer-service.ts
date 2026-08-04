import type { TransactionManager } from "../../../shared/database/transaction-manager";
import {
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app-error";
import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import type { AuditRecorder } from "../../audit/application/audit-log-repository";
import {
  authorizationScope,
  authorize,
} from "../../auth/domain/authorization-policy";
import type {
  CustomerCreateData,
  CustomerSearch,
  CustomerUpdateData,
} from "../domain/customer";
import type { CustomerRepository } from "./customer-repository";

const customerNotFoundMessage = "顧客が見つかりません";

export class CustomerService<TTransaction> {
  constructor(
    private readonly repository: CustomerRepository<TTransaction>,
    private readonly transactionManager: TransactionManager<TTransaction>,
    private readonly audit: AuditRecorder<TTransaction>,
  ) {}

  async list(actor: AuthenticatedUser, search: CustomerSearch) {
    const restrictedOwnerId =
      authorizationScope(actor, "customer:read") === "owned"
        ? actor.id
        : undefined;
    const { customers, total } = await this.repository.list({
      ...search,
      restrictedOwnerId,
    });

    return {
      customers,
      pagination: {
        page: search.page,
        pageSize: search.pageSize,
        total,
        totalPages: Math.ceil(total / search.pageSize),
      },
    };
  }

  listOwners(actor: AuthenticatedUser) {
    const ownerId =
      authorizationScope(actor, "customer:create") === "owned"
        ? actor.id
        : undefined;
    return this.repository.listActiveOwners(ownerId);
  }

  async get(actor: AuthenticatedUser, id: string) {
    const customer = await this.findCustomer(id);
    authorize(actor, "customer:read", { ownerId: customer.ownerId });
    return customer;
  }

  async create(actor: AuthenticatedUser, data: CustomerCreateData) {
    authorize(actor, "customer:create", { ownerId: data.ownerId });
    await this.assertActiveOwner(data.ownerId);
    return this.repository.create(data);
  }

  async update(actor: AuthenticatedUser, id: string, data: CustomerUpdateData) {
    const customer = await this.findCustomer(id);
    authorize(actor, "customer:update", { ownerId: customer.ownerId });

    if (data.ownerId !== undefined) {
      authorize(actor, "customer:update", { ownerId: data.ownerId });
      await this.assertActiveOwner(data.ownerId);
    }

    return this.repository.update(id, data);
  }

  async delete(actor: AuthenticatedUser, id: string) {
    await this.transactionManager.run(async (transaction) => {
      const customer = await this.repository.findById(id, transaction);
      if (customer === null) {
        throw new NotFoundError(customerNotFoundMessage);
      }

      authorize(actor, "customer:delete", { ownerId: customer.ownerId });
      const relationCounts = await this.repository.countRelations(
        id,
        transaction,
      );

      await this.repository.deleteCustomerTags(id, transaction);
      await this.repository.deleteActivities(id, transaction);
      await this.repository.deleteDeals(id, transaction);
      await this.repository.deleteCustomer(id, transaction);
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: "DELETE",
          entityType: "Customer",
          entityId: customer.id,
          before: {
            id: customer.id,
            status: customer.status,
            ownerId: customer.ownerId,
            relationCounts,
          },
        },
        transaction,
      );
    });
  }

  private async findCustomer(id: string) {
    const customer = await this.repository.findById(id);
    if (customer === null) {
      throw new NotFoundError(customerNotFoundMessage);
    }

    return customer;
  }

  private async assertActiveOwner(ownerId: string) {
    if (!(await this.repository.activeOwnerExists(ownerId))) {
      throw new ValidationError({
        ownerId: ["有効な担当者を指定してください"],
      });
    }
  }
}
