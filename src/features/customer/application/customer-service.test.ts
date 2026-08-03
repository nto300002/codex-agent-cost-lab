import { UserRole } from "../../../../generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { TransactionManager } from "../../../shared/database/transaction-manager";
import { AuthorizationError } from "../../../shared/errors/app-error";
import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import type { Customer } from "../domain/customer";
import type { CustomerRepository } from "./customer-repository";
import { CustomerService } from "./customer-service";

const member: AuthenticatedUser = {
  id: "member-1",
  email: "member@example.test",
  name: "Member",
  role: UserRole.MEMBER,
};
const admin: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@example.test",
  name: "Admin",
  role: UserRole.ADMIN,
};
const customer: Customer = {
  id: "customer-1",
  name: "Customer",
  email: null,
  phone: null,
  status: "LEAD",
  ownerId: member.id,
  notes: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

function dependencies() {
  const events: string[] = [];
  const repository = {
    list: vi.fn().mockResolvedValue({ customers: [customer], total: 1 }),
    findById: vi.fn().mockResolvedValue(customer),
    activeOwnerExists: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue(customer),
    update: vi.fn().mockResolvedValue(customer),
    countRelations: vi.fn().mockImplementation(async () => {
      events.push("count");
      return { customerTags: 2, activities: 3, deals: 1 };
    }),
    deleteCustomerTags: vi.fn().mockImplementation(async () => {
      events.push("customerTags");
    }),
    deleteActivities: vi.fn().mockImplementation(async () => {
      events.push("activities");
    }),
    deleteDeals: vi.fn().mockImplementation(async () => {
      events.push("deals");
    }),
    deleteCustomer: vi.fn().mockImplementation(async () => {
      events.push("customer");
    }),
    recordDeleteAudit: vi.fn().mockImplementation(async () => {
      events.push("audit");
    }),
  } satisfies CustomerRepository<string>;
  const transactionManager: TransactionManager<string> = {
    async run(operation) {
      events.push("transaction:start");
      const result = await operation("transaction");
      events.push("transaction:end");
      return result;
    },
  };

  return {
    events,
    repository,
    service: new CustomerService(repository, transactionManager),
  };
}

describe("CustomerService", () => {
  it("restricts a member list to their own customers and returns pagination", async () => {
    const { repository, service } = dependencies();
    const result = await service.list(member, {
      page: 2,
      pageSize: 20,
      status: "LEAD",
    });

    expect(repository.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      status: "LEAD",
      restrictedOwnerId: member.id,
    });
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("rejects access to a customer owned by another member", async () => {
    const { repository, service } = dependencies();
    repository.findById.mockResolvedValue({
      ...customer,
      ownerId: "member-2",
    });

    await expect(service.get(member, customer.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("prevents a member from reassigning their customer", async () => {
    const { repository, service } = dependencies();

    await expect(
      service.update(member, customer.id, { ownerId: "member-2" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("deletes related records and records the audit inside one transaction", async () => {
    const { events, repository, service } = dependencies();

    await service.delete(admin, customer.id);

    expect(events).toEqual([
      "transaction:start",
      "count",
      "customerTags",
      "activities",
      "deals",
      "customer",
      "audit",
      "transaction:end",
    ]);
    expect(repository.recordDeleteAudit).toHaveBeenCalledWith(
      {
        actorUserId: admin.id,
        customer,
        relationCounts: { customerTags: 2, activities: 3, deals: 1 },
      },
      "transaction",
    );
  });

  it("rejects customer deletion by a member before mutating relations", async () => {
    const { repository, service } = dependencies();

    await expect(service.delete(member, customer.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(repository.deleteCustomerTags).not.toHaveBeenCalled();
  });
});
