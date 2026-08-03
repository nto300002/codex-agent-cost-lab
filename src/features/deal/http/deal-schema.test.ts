import { describe, expect, it } from "vitest";
import { createDealSchema } from "./deal-schema";

const valid = {
  customerId: "customer-1",
  title: " Deal ",
  amountCents: "1000",
  stage: "NEW",
  ownerId: "owner-1",
  expectedCloseDate: "",
};

describe("deal schema", () => {
  it("normalizes integer amount, title, and empty date", () => {
    expect(createDealSchema.parse(valid)).toEqual({
      customerId: "customer-1",
      title: "Deal",
      amountCents: 1000,
      stage: "NEW",
      ownerId: "owner-1",
      expectedCloseDate: null,
    });
  });
  it.each(["-1", "1.5", "not-a-number"])(
    "rejects invalid amount %s",
    (amountCents) => {
      expect(() => createDealSchema.parse({ ...valid, amountCents })).toThrow();
    },
  );
});
