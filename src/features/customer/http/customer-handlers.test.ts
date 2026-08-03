import { NextRequest } from "next/server";
import { UserRole } from "../../../../generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../../shared/errors/app-error";
import { sessionCookieName } from "../../auth/http/auth-handlers";
import {
  createCustomerCollectionHandlers,
  createCustomerOwnersHandler,
} from "./customer-handlers";

const actor = {
  id: "admin-1",
  email: "admin@example.test",
  name: "Admin",
  role: UserRole.ADMIN,
};

function customerOperations(overrides: Record<string, unknown>) {
  return {
    list: vi.fn(),
    listOwners: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

function request(
  path: string,
  init?: { method?: string; body?: BodyInit; headers?: HeadersInit },
) {
  return new NextRequest(`http://localhost${path}`, {
    ...init,
    headers: {
      cookie: `${sessionCookieName}=session-token`,
      ...init?.headers,
    },
  });
}

describe("customer handlers", () => {
  it("returns authenticated owner options", async () => {
    const listOwners = vi
      .fn()
      .mockResolvedValue([{ id: actor.id, name: actor.name }]);
    const handler = createCustomerOwnersHandler(
      { listOwners },
      { getCurrentUser: vi.fn().mockResolvedValue(actor) },
    );
    const response = await handler(request("/api/customer-owners"));

    expect(response.status).toBe(200);
    expect(listOwners).toHaveBeenCalledWith(actor);
    await expect(response.json()).resolves.toEqual({
      data: { owners: [{ id: actor.id, name: actor.name }] },
    });
  });

  it("parses search and returns the common success envelope", async () => {
    const list = vi.fn().mockResolvedValue({
      customers: [],
      pagination: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
    });
    const handlers = createCustomerCollectionHandlers(
      customerOperations({ list }),
      { getCurrentUser: vi.fn().mockResolvedValue(actor) },
    );
    const response = await handlers.GET(
      request("/api/customers?name=Example&page=2&pageSize=10"),
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(actor, {
      name: "Example",
      page: 2,
      pageSize: 10,
    });
    await expect(response.json()).resolves.toEqual({
      data: {
        customers: [],
        pagination: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
      },
    });
  });

  it("normalizes optional strings before creating a customer", async () => {
    const create = vi.fn().mockResolvedValue({ id: "customer-1" });
    const handlers = createCustomerCollectionHandlers(
      customerOperations({ create }),
      { getCurrentUser: vi.fn().mockResolvedValue(actor) },
    );
    const response = await handlers.POST(
      request("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: " Example ",
          email: "",
          phone: " ",
          status: "ACTIVE",
          ownerId: "member-1",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(actor, {
      name: "Example",
      email: null,
      phone: null,
      status: "ACTIVE",
      ownerId: "member-1",
      notes: null,
    });
  });

  it("converts application errors to the common API error shape", async () => {
    const handlers = createCustomerCollectionHandlers(
      customerOperations({
        list: vi.fn().mockRejectedValue(new AuthorizationError()),
      }),
      { getCurrentUser: vi.fn().mockResolvedValue(actor) },
    );
    const response = await handlers.GET(request("/api/customers"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "AUTHORIZATION_ERROR",
        message: "この操作を実行する権限がありません",
      },
    });
  });
});
