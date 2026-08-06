import { describe, expect, it } from "vitest";

import {
  assertAssetRootOutsideRepository,
  validateAssetLock,
} from "../../../scripts/verify-task-assets";

describe("task asset guards", () => {
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
