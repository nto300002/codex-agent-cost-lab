import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { collectEvaluatedRuns } from "../../../scripts/build-main-report";

describe("main report builder", () => {
  it("collects 90 evaluated runs in plan sequence order", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "main-report-"));
    const entries = Array.from({ length: 90 }, (_, index) => {
      const taskId = index % 2 === 0 ? "GA-F1" : "GA-I1";
      const condition = ["P0", "P1", "P2"][index % 3];
      return {
        runId: `${taskId}-${condition}-run${String(Math.floor(index / 18) + 1).padStart(2, "0")}-${index}`,
        taskId,
        condition,
        sequence: 90 - index,
      };
    });
    for (const entry of entries) {
      const directory = path.join(root, entry.runId);
      await mkdir(directory);
      await writeFile(
        path.join(directory, "evaluated-run.json"),
        JSON.stringify({
          run_id: entry.runId,
          task_id: entry.taskId,
          granularity: "G-A",
          prompt_condition: entry.condition,
          success: true,
          quality_score: 100,
          outcome: "success",
          credits: 1,
          duration_seconds: 1,
          input_tokens: 1,
          cached_input_tokens: 0,
          uncached_input_tokens: 1,
          output_tokens: 1,
          command_count: 1,
          explicit_file_references_unique: 1,
          repository_wide_searches: 1,
          test_runs_total: 1,
          changed_files: 1,
          lines_added: 1,
          lines_deleted: 0,
        }),
      );
    }
    const runs = await collectEvaluatedRuns({
      plan: { schemaVersion: 1, entries },
      resultRoot: root,
    });
    expect(runs).toHaveLength(90);
    expect(runs.map(({ run_id }) => run_id)).toEqual(
      [...entries]
        .sort((left, right) => left.sequence - right.sequence)
        .map(({ runId }) => runId),
    );
  });

  it("rejects an incomplete plan before reading raw data", async () => {
    await expect(
      collectEvaluatedRuns({
        plan: { schemaVersion: 1, entries: [] },
        resultRoot: "/does/not/matter",
      }),
    ).rejects.toThrow("Expected 90 plan entries");
  });
});
