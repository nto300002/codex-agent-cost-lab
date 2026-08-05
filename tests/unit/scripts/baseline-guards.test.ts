import { describe, expect, it } from "vitest";

import {
  classifyForbiddenPath,
  findSecretMarker,
} from "../../../scripts/check-forbidden-changes";
import {
  assertCleanStatus,
  assertRecordPathOutsideRepository,
} from "../../../scripts/verify-baseline";

describe("baseline guards", () => {
  it.each([
    [".next/server/app.js", "generated artifact"],
    ["prisma/dev.db", "generated artifact"],
    [".env.local", "environment secret file"],
    ["credentials.json", "secret-bearing file"],
    ["tasks/GA-F1/hidden-tests/evaluator.ts", "hidden evaluation asset"],
    ["tasks/GC-I1/reference.patch", "hidden evaluation asset"],
  ])("classifies %s", (filePath, reason) => {
    expect(classifyForbiddenPath(filePath)).toBe(reason);
  });

  it.each([".env.example", "src/app/page.tsx", "tests/e2e/deal.spec.ts"])(
    "allows %s",
    (filePath) => {
      expect(classifyForbiddenPath(filePath)).toBeNull();
    },
  );

  it("detects secret values in otherwise ordinary files", () => {
    expect(findSecretMarker(`token=${"ghp"}_${"1".repeat(20)}`)).toBe(
      "GitHub token",
    );
    expect(findSecretMarker("safe placeholder")).toBeNull();
  });

  it("requires a clean worktree", () => {
    expect(() => assertCleanStatus("")).not.toThrow();
    expect(() => assertCleanStatus(" M src/app/page.tsx\n")).toThrow(
      "Baseline worktree is not clean",
    );
  });

  it("records the immutable manifest outside the workspace", () => {
    expect(() =>
      assertRecordPathOutsideRepository(
        "/workspace/base-repo",
        "/workspace/results/experiment-manifest.json",
      ),
    ).not.toThrow();
    expect(() =>
      assertRecordPathOutsideRepository(
        "/workspace/base-repo",
        "/workspace/base-repo/experiment-manifest.json",
      ),
    ).toThrow("outside the Codex workspace");
  });
});
