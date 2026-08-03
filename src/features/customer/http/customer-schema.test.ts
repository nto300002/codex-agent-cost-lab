import { describe, expect, it } from "vitest";

import {
  createCustomerSchema,
  customerSearchSchema,
  updateCustomerSchema,
} from "./customer-schema";

describe("customer schemas", () => {
  it("trims values and normalizes optional empty strings to null", () => {
    expect(
      createCustomerSchema.parse({
        name: "  Example Customer  ",
        email: "  ",
        phone: "   ",
        status: "LEAD",
        ownerId: " owner-1 ",
        notes: " ",
      }),
    ).toEqual({
      name: "Example Customer",
      email: null,
      phone: null,
      status: "LEAD",
      ownerId: "owner-1",
      notes: null,
    });
  });

  it("preserves omitted patch fields while normalizing supplied fields", () => {
    expect(
      updateCustomerSchema.parse({
        email: " CUSTOMER@EXAMPLE.TEST ",
        phone: "",
      }),
    ).toEqual({
      email: "customer@example.test",
      phone: null,
    });
  });

  it("uses fixed pagination defaults and validates its upper bound", () => {
    expect(customerSearchSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(() => customerSearchSchema.parse({ pageSize: "101" })).toThrow();
  });
});
