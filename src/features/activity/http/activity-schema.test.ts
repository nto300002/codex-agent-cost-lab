import { describe, expect, it } from "vitest";
import { createActivitySchema, updateActivitySchema } from "./activity-schema";

describe("Activity schemas", () => {
  it("converts an offset activity time to UTC", () => {
    const result = createActivitySchema.parse({
      customerId: "customer-1",
      dealId: "",
      type: "CALL",
      summary: " Called customer ",
      occurredAt: "2026-04-01T10:30:00+09:00",
    });
    expect(result.occurredAt.toISOString()).toBe("2026-04-01T01:30:00.000Z");
    expect(result.dealId).toBeNull();
    expect(result.summary).toBe("Called customer");
  });

  it("rejects an activity time without an offset", () => {
    const result = createActivitySchema.safeParse({
      customerId: "customer-1",
      type: "NOTE",
      summary: "Note",
      occurredAt: "2026-04-01T10:30:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty updates", () => {
    expect(updateActivitySchema.safeParse({}).success).toBe(false);
  });
});
