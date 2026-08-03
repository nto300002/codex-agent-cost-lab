import { describe, expect, it } from "vitest";
import { canTransitionDealStage, dealStages } from "./deal";

describe("deal stage transitions", () => {
  it.each([
    ["NEW", "QUALIFIED", true],
    ["NEW", "LOST", true],
    ["QUALIFIED", "PROPOSAL", true],
    ["PROPOSAL", "WON", true],
    ["PROPOSAL", "LOST", true],
    ["WON", "PROPOSAL", false],
    ["LOST", "WON", false],
    ["QUALIFIED", "NEW", false],
  ] as const)("validates %s -> %s", (from, to, expected) => {
    expect(canTransitionDealStage(from, to)).toBe(expected);
  });

  it("keeps the shared stage definition stable", () => {
    expect(dealStages).toEqual(["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"]);
  });
});
