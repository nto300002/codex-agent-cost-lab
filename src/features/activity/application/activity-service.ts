import {
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app-error";
import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import {
  authorizationScope,
  authorize,
} from "../../auth/domain/authorization-policy";
import type {
  ActivityCreateData,
  ActivitySearch,
  ActivityUpdateData,
} from "../domain/activity";
import type { ActivityRepository } from "./activity-repository";

type CreateInput = Omit<ActivityCreateData, "createdById">;

export class ActivityService {
  constructor(private readonly repository: ActivityRepository) {}

  async list(actor: AuthenticatedUser, search: ActivitySearch) {
    const restrictedCustomerOwnerId =
      authorizationScope(actor, "activity:read") === "owned"
        ? actor.id
        : undefined;
    const { activities, total } = await this.repository.list({
      ...search,
      restrictedCustomerOwnerId,
    });
    return {
      activities,
      pagination: {
        page: search.page,
        pageSize: search.pageSize,
        total,
        totalPages: Math.ceil(total / search.pageSize),
      },
    };
  }

  async get(actor: AuthenticatedUser, id: string) {
    const activity = await this.findActivity(id);
    authorize(actor, "activity:read", {
      ownerId: activity.customer?.ownerId,
    });
    return activity;
  }

  async create(actor: AuthenticatedUser, data: CreateInput) {
    const ownerId = await this.requireCustomerOwner(data.customerId);
    authorize(actor, "activity:create", { ownerId });
    await this.assertDealMatchesCustomer(data.dealId, data.customerId);
    return this.repository.create({ ...data, createdById: actor.id });
  }

  async update(actor: AuthenticatedUser, id: string, data: ActivityUpdateData) {
    const activity = await this.findActivity(id);
    authorize(actor, "activity:update", {
      ownerId: activity.customer?.ownerId,
    });
    return this.repository.update(id, data);
  }

  async delete(actor: AuthenticatedUser, id: string) {
    const activity = await this.findActivity(id);
    authorize(actor, "activity:delete", {
      ownerId: activity.customer?.ownerId,
    });
    await this.repository.delete(id);
  }

  private async findActivity(id: string) {
    const activity = await this.repository.findById(id);
    if (!activity) throw new NotFoundError("活動が見つかりません");
    return activity;
  }

  private async requireCustomerOwner(customerId: string) {
    const ownerId = await this.repository.findCustomerOwnerId(customerId);
    if (!ownerId) {
      throw new ValidationError({
        customerId: ["有効な顧客を指定してください"],
      });
    }
    return ownerId;
  }

  private async assertDealMatchesCustomer(
    dealId: string | null,
    customerId: string,
  ) {
    if (!dealId) return;
    const dealCustomerId = await this.repository.findDealCustomerId(dealId);
    if (dealCustomerId !== customerId) {
      throw new ValidationError({
        dealId: ["選択した顧客に属する商談を指定してください"],
      });
    }
  }
}
