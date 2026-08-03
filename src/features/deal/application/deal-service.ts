import {
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app-error";
import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import {
  authorizationScope,
  authorize,
} from "../../auth/domain/authorization-policy";
import {
  canTransitionDealStage,
  type DealCreateData,
  type DealSearch,
  type DealUpdateData,
} from "../domain/deal";
import type { DealRepository } from "./deal-repository";

export class DealService {
  constructor(private readonly repository: DealRepository) {}

  async list(actor: AuthenticatedUser, search: DealSearch) {
    const restrictedOwnerId =
      authorizationScope(actor, "deal:read") === "owned" ? actor.id : undefined;
    const { deals, total } = await this.repository.list({
      ...search,
      restrictedOwnerId,
    });
    return {
      deals,
      pagination: {
        page: search.page,
        pageSize: search.pageSize,
        total,
        totalPages: Math.ceil(total / search.pageSize),
      },
    };
  }

  async get(actor: AuthenticatedUser, id: string) {
    const deal = await this.findDeal(id);
    authorize(actor, "deal:read", { ownerId: deal.ownerId });
    return deal;
  }

  async create(actor: AuthenticatedUser, data: DealCreateData) {
    authorize(actor, "deal:create", { ownerId: data.ownerId });
    await this.assertReferences(actor, data.customerId, data.ownerId);
    return this.repository.create(data);
  }

  async update(actor: AuthenticatedUser, id: string, data: DealUpdateData) {
    const deal = await this.findDeal(id);
    authorize(actor, "deal:update", { ownerId: deal.ownerId });

    const ownerId = data.ownerId ?? deal.ownerId;
    const customerId = data.customerId ?? deal.customerId;
    authorize(actor, "deal:update", { ownerId });
    await this.assertReferences(actor, customerId, ownerId);

    if (data.stage && !canTransitionDealStage(deal.stage, data.stage)) {
      throw new ValidationError({
        stage: [`${deal.stage}から${data.stage}へ変更できません`],
      });
    }

    return this.repository.update(id, data);
  }

  private async findDeal(id: string) {
    const deal = await this.repository.findById(id);
    if (!deal) throw new NotFoundError("商談が見つかりません");
    return deal;
  }

  private async assertReferences(
    actor: AuthenticatedUser,
    customerId: string,
    ownerId: string,
  ) {
    const [customerOwnerId, ownerExists] = await Promise.all([
      this.repository.findCustomerOwnerId(customerId),
      this.repository.activeOwnerExists(ownerId),
    ]);
    if (customerOwnerId === null) {
      throw new ValidationError({
        customerId: ["有効な顧客を指定してください"],
      });
    }
    authorize(actor, "customer:read", { ownerId: customerOwnerId });
    if (!ownerExists) {
      throw new ValidationError({
        ownerId: ["有効な担当者を指定してください"],
      });
    }
  }
}
