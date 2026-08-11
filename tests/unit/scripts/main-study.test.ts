import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createMainPlan,
  verifyMainStudy,
  type MainConfig,
} from "../../../scripts/main-study";

async function fixture() {
  const config = JSON.parse(
    await readFile(
      path.join(process.cwd(), "experiment/main-config.json"),
      "utf8",
    ),
  ) as MainConfig;
  const pricing = JSON.parse(
    await readFile(
      path.join(process.cwd(), "experiment/main-pricing.json"),
      "utf8",
    ),
  );
  return { config, pricing };
}

describe("main experiment study", () => {
  it("creates the deterministic balanced 90-run matrix", async () => {
    const { config } = await fixture();
    const first = createMainPlan(config);
    expect(createMainPlan(config)).toEqual(first);
    expect(first.entries).toHaveLength(90);
    expect(new Set(first.entries.map(({ runId }) => runId))).toHaveLength(90);
    for (let repetition = 1; repetition <= 5; repetition += 1) {
      const block = first.entries.filter(
        (entry) => entry.repetition === repetition,
      );
      expect(block).toHaveLength(18);
      expect(
        new Set(block.map(({ taskId, condition }) => `${taskId}:${condition}`)),
      ).toHaveLength(18);
    }
  });

  it("reports incomplete artifacts and worktrees", async () => {
    const { config, pricing } = await fixture();
    const root = await mkdtemp(path.join(tmpdir(), "main-empty-"));
    const resultRoot = path.join(root, "raw");
    const workRoot = path.join(root, "work");
    await Promise.all([mkdir(resultRoot), mkdir(workRoot)]);
    const report = await verifyMainStudy({
      config,
      plan: createMainPlan(config),
      resultRoot,
      workRoot,
      eventLog: path.join(root, "events.jsonl"),
      pricing,
    });
    expect(report).toMatchObject({
      expectedRuns: 90,
      observedRuns: 0,
      complete: false,
      artifactCount: 0,
      aggregation: null,
    });
    expect(report.missingArtifacts).toHaveLength(90);
  });

  it("verifies all files, retained worktrees, event reasons, and reproducible groups", async () => {
    const { config, pricing } = await fixture();
    const plan = createMainPlan(config);
    const root = await mkdtemp(path.join(tmpdir(), "main-complete-"));
    const resultRoot = path.join(root, "raw");
    const workRoot = path.join(root, "work");
    await Promise.all([mkdir(resultRoot), mkdir(workRoot)]);
    for (const entry of plan.entries) {
      const directory = path.join(resultRoot, entry.runId);
      await Promise.all([
        mkdir(directory),
        mkdir(path.join(workRoot, entry.runId)),
      ]);
      const granularity = entry.runId.startsWith("GA-")
        ? "G-A"
        : entry.runId.startsWith("GB-")
          ? "G-B"
          : "G-C";
      const manifest = {
        runId: entry.runId,
        taskId: entry.taskId,
        condition: entry.condition,
        repetition: entry.repetition,
        status: "completed",
        codexCliVersion: config.settings.codexCliVersion,
        settings: {
          model: config.settings.model,
          reasoningEffort: config.settings.reasoningEffort,
          timeoutMs: config.timeoutMinutesByGranularity[granularity] * 60_000,
        },
      };
      const evaluated = {
        run_id: entry.runId,
        task_id: entry.taskId,
        granularity,
        prompt_condition: entry.condition,
        model: config.settings.model,
        input_tokens: 10,
        cached_input_tokens: 4,
        uncached_input_tokens: 6,
        output_tokens: 3,
        reasoning_output_tokens: 1,
        credits: 0.00305,
        duration_seconds: 2,
        command_count: 1,
        explicit_file_references_unique: 1,
        repository_wide_searches: 0,
        test_runs_total: 1,
        changed_files: 1,
        lines_added: 1,
        lines_deleted: 0,
        success: true,
        quality_score: 100,
        forbidden_change: false,
        human_fix_minutes: 0,
        included_in_cost_analysis: true,
        evaluation_status: "completed",
        outcome: "success",
      };
      await Promise.all([
        writeFile(
          path.join(directory, "manifest.json"),
          JSON.stringify(manifest),
        ),
        writeFile(
          path.join(directory, "evaluated-run.json"),
          JSON.stringify(evaluated),
        ),
        ...[
          "prompt.md",
          "codex.jsonl",
          "stderr.log",
          "diff.patch",
          "git-status.txt",
          "run.json",
          "automatic-evaluation.json",
          "evaluation-log.json",
        ].map((file) =>
          writeFile(path.join(directory, file), `${entry.runId}:${file}\n`),
        ),
      ]);
    }
    const eventLog = path.join(root, "events.jsonl");
    await writeFile(
      eventLog,
      `${JSON.stringify({ schemaVersion: 1, recordedAt: "2026-08-11T00:00:00.000Z", operatorId: config.operatorId, event: "deviation", runId: plan.entries[0].runId, reason: "Synthetic audit fixture." })}\n`,
    );
    const first = await verifyMainStudy({
      config,
      plan,
      resultRoot,
      workRoot,
      eventLog,
      pricing,
    });
    const second = await verifyMainStudy({
      config,
      plan,
      resultRoot,
      workRoot,
      eventLog,
      pricing,
    });
    expect(first).toMatchObject({
      complete: true,
      observedRuns: 90,
      artifactCount: 900,
    });
    expect(first.deviations).toHaveLength(1);
    expect(first.aggregation?.summary_by_task).toHaveLength(18);
    expect(first.aggregation?.summary_by_granularity).toHaveLength(9);
    expect(first.artifactInventorySha256).toBe(second.artifactInventorySha256);
    expect(first.aggregationSha256).toBe(second.aggregationSha256);
  });
});
