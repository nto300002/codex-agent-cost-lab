import { describe, expect, it } from "vitest";

import { expectedPrompts } from "../../../scripts/render-prompts";
import { validatePrompts } from "../../../scripts/validate-prompts";

describe("experiment prompts", () => {
  it("contains the balanced 6-task by 3-condition matrix", async () => {
    await expect(validatePrompts()).resolves.toEqual({
      tasks: 6,
      conditions: 3,
      prompts: 18,
    });
  });

  it("keeps P1 and P2 byte-identical for every task", async () => {
    const prompts = await expectedPrompts(process.cwd());
    for (const taskId of [
      "GA-F1",
      "GA-I1",
      "GB-F1",
      "GB-I1",
      "GC-F1",
      "GC-I1",
    ]) {
      expect(prompts.get(`P1/${taskId}.md`)).toBe(
        prompts.get(`P2/${taskId}.md`),
      );
    }
  });
});
