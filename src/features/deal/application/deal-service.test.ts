import { UserRole } from "../../../../generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  ValidationError,
} from "../../../shared/errors/app-error";
import type { DealRepository } from "./deal-repository";
import { DealService } from "./deal-service";

const member = {
  id: "member-1",
  email: "m@test",
  name: "M",
  role: UserRole.MEMBER,
};
const manager = {
  id: "manager-1",
  email: "g@test",
  name: "G",
  role: UserRole.MANAGER,
};
const deal = {
  id: "deal-1",
  customerId: "customer-1",
  title: "Deal",
  amountCents: 1000,
  stage: "LOST" as const,
  ownerId: member.id,
  expectedCloseDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
function setup() {
  const repository = {
    list: vi.fn().mockResolvedValue({ deals: [], total: 0 }),
    findById: vi.fn().mockResolvedValue(deal),
    activeOwnerExists: vi.fn().mockResolvedValue(true),
    findCustomerOwnerId: vi.fn().mockResolvedValue(member.id),
    create: vi.fn().mockResolvedValue(deal),
    update: vi.fn().mockResolvedValue(deal),
  } satisfies DealRepository;
  return { repository, service: new DealService(repository) };
}

describe("DealService", () => {
  it("rejects a member updating another owner's deal", async () => {
    const { repository, service } = setup();
    repository.findById.mockResolvedValue({ ...deal, ownerId: "member-2" });
    await expect(
      service.update(member, deal.id, { title: "Changed" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(repository.update).not.toHaveBeenCalled();
  });
  it("rejects LOST to WON", async () => {
    const { repository, service } = setup();
    await expect(
      service.update(manager, deal.id, { stage: "WON" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repository.update).not.toHaveBeenCalled();
  });
  it("restricts member lists to their owner id", async () => {
    const { repository, service } = setup();
    await service.list(member, { page: 1, pageSize: 20 });
    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      restrictedOwnerId: member.id,
    });
  });
});
