import { describe, expect, it } from "vitest";

import { FixedClock, SystemClock } from "./clock";

describe("Clock", () => {
  it("returns a fixed instant without sharing a mutable Date", () => {
    const clock = new FixedClock("2026-01-01T00:00:00.000Z");
    const first = clock.now();
    first.setUTCFullYear(2030);

    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects invalid fixed dates", () => {
    expect(() => new FixedClock("invalid")).toThrow(RangeError);
  });

  it("returns the current time from SystemClock", () => {
    const before = Date.now();
    const current = new SystemClock().now().getTime();
    const after = Date.now();

    expect(current).toBeGreaterThanOrEqual(before);
    expect(current).toBeLessThanOrEqual(after);
  });
});
