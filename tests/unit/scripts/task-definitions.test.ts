import { describe, expect, it } from "vitest";

import { validateTaskDefinitions } from "../../../scripts/validate-task-definitions";

describe("experiment task definitions", () => {
  it("contains the complete balanced task matrix on one baseline", async () => {
    const result = await validateTaskDefinitions();

    expect(result.count).toBe(6);
    expect(result.startingCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.tasks.map(({ id }) => id)).toEqual([
      "GA-F1",
      "GA-I1",
      "GB-F1",
      "GB-I1",
      "GC-F1",
      "GC-I1",
    ]);
    expect(
      result.tasks.map(({ acceptanceCriteria }) => acceptanceCriteria),
    ).toEqual([5, 5, 6, 6, 7, 9]);
  });
});
