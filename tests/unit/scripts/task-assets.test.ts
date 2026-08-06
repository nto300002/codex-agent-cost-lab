import { describe, expect, it } from "vitest";

import {
  assertAssetRootOutsideRepository,
  validateAssetLock,
} from "../../../scripts/verify-task-assets";

describe("task asset guards", () => {
  it("pins the complete private evaluator and a 100-point result contract", async () => {
    const root = process.cwd();
    const lock = validateAssetLock(
      JSON.parse(
        await readFile(
          path.join(root, "experiment/task-assets.lock.json"),
          "utf8",
        ),
      ),
    );
    const resultSchema = JSON.parse(
      await readFile(
        path.join(root, "experiment/evaluation-result.schema.json"),
        "utf8",
      ),
    ) as {
      properties: {
        components: { properties: Record<string, { maximum: number }> };
      };
    };

    expect(Object.keys(lock.assets)).toHaveLength(17);
    expect(
      Object.values(resultSchema.properties.components.properties).reduce(
        (total, component) => total + component.maximum,
        0,
      ),
    ).toBe(100);
  });

  it("accepts a pinned external asset manifest", () => {
    expect(
      validateAssetLock({
        schemaVersion: 1,
        repository: "owner/private-assets",
        commit: "a".repeat(40),
        assets: { "tasks/GA-F1/setup.patch": "b".repeat(64) },
      }),
    ).toMatchObject({ schemaVersion: 1 });
  });

  it("rejects traversal in a locked asset path", () => {
    expect(() =>
      validateAssetLock({
        schemaVersion: 1,
        repository: "owner/private-assets",
        commit: "a".repeat(40),
        assets: { "../reference.patch": "b".repeat(64) },
      }),
    ).toThrow("Unsafe task asset path");
  });

  it("requires evaluation assets to remain outside the public repository", () => {
    expect(() =>
      assertAssetRootOutsideRepository(
        "/workspace/public",
        "/workspace/private",
      ),
    ).not.toThrow();
    expect(() =>
      assertAssetRootOutsideRepository(
        "/workspace/public",
        "/workspace/public/evaluation",
      ),
    ).toThrow("outside the public repository");
  });
});
import { readFile } from "node:fs/promises";
import path from "node:path";
