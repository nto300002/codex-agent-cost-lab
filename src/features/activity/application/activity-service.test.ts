import { UserRole } from "../../../../generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  ValidationError,
} from "../../../shared/errors/app-error";
import type { ActivityRepository } from "./activity-repository";
import { ActivityService } from "./activity-service";

const member = {
  id: "member-1",
  email: "member@example.test",
  name: "Member",
  role: UserRole.MEMBER,
};
const manager = {
  id: "manager-1",
  email: "manager@example.test",
  name: "Manager",
  role: UserRole.MANAGER,
};
const activity = {
  id: "activity-1",
  customerId: "customer-1",
  dealId: "deal-1",
  type: "CALL" as const,
  summary: "Called",
  occurredAt: new Date("2026-04-01T01:00:00.000Z"),
  createdById: member.id,
  createdAt: new Date("2026-04-01T01:00:00.000Z"),
  updatedAt: new Date("2026-04-01T01:00:00.000Z"),
  customer: { id: "customer-1", name: "Customer", ownerId: member.id },
  deal: { id: "deal-1", title: "Deal", customerId: "customer-1" },
  createdBy: { id: member.id, name: member.name },
};

function setup() {
  const repository = {
    list: vi.fn().mockResolvedValue({ activities: [], total: 0 }),
    findById: vi.fn().mockResolvedValue(activity),
    findCustomerOwnerId: vi.fn().mockResolvedValue(member.id),
    findDealCustomerId: vi.fn().mockResolvedValue("customer-1"),
    create: vi.fn().mockResolvedValue(activity),
    update: vi.fn().mockResolvedValue(activity),
    delete: vi.fn().mockResolvedValue(undefined),
  } satisfies ActivityRepository;
  return { repository, service: new ActivityService(repository) };
}

describe("ActivityService", () => {
  it("restricts a member list by the parent Customer owner", async () => {
    const { repository, service } = setup();
    await service.list(member, { page: 1, pageSize: 20 });
    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      restrictedCustomerOwnerId: member.id,
    });
  });

  it("uses the actor as the creator", async () => {
    const { repository, service } = setup();
    await service.create(member, {
      customerId: "customer-1",
      dealId: null,
      type: "NOTE",
      summary: "Note",
      occurredAt: new Date("2026-04-01T01:00:00.000Z"),
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: member.id }),
    );
  });

  it("rejects a Deal belonging to another Customer", async () => {
    const { repository, service } = setup();
    repository.findDealCustomerId.mockResolvedValue("customer-2");
    await expect(
      service.create(manager, {
        customerId: "customer-1",
        dealId: "deal-2",
        type: "MEETING",
        summary: "Meeting",
        occurredAt: new Date("2026-04-01T01:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a member deleting another owner's Activity", async () => {
    const { repository, service } = setup();
    repository.findById.mockResolvedValue({
      ...activity,
      customer: { ...activity.customer, ownerId: "member-2" },
    });
    await expect(service.delete(member, activity.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
