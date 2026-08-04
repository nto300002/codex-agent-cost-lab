import { describe, expect, it } from "vitest";
import { toTokyoDateTimeInput, tokyoDateTimeToUtc } from "./activity-api";

describe("Activity time presentation", () => {
  it("round trips between UTC and the fixed Asia/Tokyo input", () => {
    const utc = "2026-04-01T01:30:00.000Z";
    const input = toTokyoDateTimeInput(utc);
    expect(input).toBe("2026-04-01T10:30");
    expect(tokyoDateTimeToUtc(input)).toBe(utc);
  });
});
