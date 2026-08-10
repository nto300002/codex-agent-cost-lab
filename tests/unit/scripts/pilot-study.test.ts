import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createPilotPlan,
  verifyPilotStudy,
  type PilotConfig,
} from "../../../scripts/pilot-study";

async function config(fileName = "pilot-config.json") {
  return JSON.parse(
    await readFile(path.join(process.cwd(), "experiment", fileName), "utf8"),
  ) as PilotConfig;
}

describe("pilot study", () => {
  it("creates the deterministic balanced 45-run pilot matrix", async () => {
    const value = await config();
    const first = createPilotPlan(value);
    const second = createPilotPlan(value);
    expect(first).toEqual(second);
    expect(first.entries).toHaveLength(45);
    expect(new Set(first.entries.map(({ runId }) => runId))).toHaveLength(45);
    for (let repetition = 1; repetition <= 5; repetition += 1) {
      const block = first.entries.filter(
        (entry) => entry.repetition === repetition,
      );
      expect(block).toHaveLength(9);
      expect(
        new Set(block.map(({ taskId, condition }) => `${taskId}:${condition}`)),
      ).toHaveLength(9);
    }
  });

  it("freezes pilot v2 with a new seed and evaluator commit", async () => {
    const first = await config();
    const second = await config("pilot-config-v2.json");
    expect(second.version).toBe("pilot-v2");
    expect(second.randomizationSeed).not.toBe(first.randomizationSeed);
    expect(second.privateAssetCommit).not.toBe(first.privateAssetCommit);
    expect(createPilotPlan(second).entries).not.toEqual(
      createPilotPlan(first).entries,
    );
  });

  it("freezes pilot v3 after the pilot v2 evaluator audit", async () => {
    const second = await config("pilot-config-v2.json");
    const third = await config("pilot-config-v3.json");
    expect(third.version).toBe("pilot-v3");
    expect(third.randomizationSeed).not.toBe(second.randomizationSeed);
    expect(third.privateAssetCommit).not.toBe(second.privateAssetCommit);
    expect(createPilotPlan(third).entries).not.toEqual(
      createPilotPlan(second).entries,
    );
  });

  it("reports missing raw and evaluation artifacts without treating zero credits as measured", async () => {
    const value = await config();
    const plan = createPilotPlan(value);
    const resultRoot = await mkdtemp(path.join(tmpdir(), "pilot-empty-"));
    const report = await verifyPilotStudy({
      config: value,
      plan,
      resultRoot,
    });
    expect(report).toMatchObject({
      expectedRuns: 45,
      observedRuns: 0,
      complete: false,
      decisions: {
        granularity: "insufficient_data",
        timeout: "insufficient_data",
        budget: "credit_measurement_required",
      },
      go: false,
    });
    expect(report.missingArtifacts).toHaveLength(45);
  });

  it("validates identities, metrics, fixed settings, and explicit human decisions", async () => {
    const value = await config();
    const plan = createPilotPlan(value);
    const resultRoot = await mkdtemp(path.join(tmpdir(), "pilot-complete-"));
    for (const entry of plan.entries) {
      const directory = path.join(resultRoot, entry.runId);
      await mkdir(directory);
      const granularity = entry.runId.startsWith("GA-")
        ? "G-A"
        : entry.runId.startsWith("GB-")
          ? "G-B"
          : "G-C";
      const timeoutMs = value.timeoutMinutesByGranularity[granularity] * 60_000;
      const manifest = {
        runId: entry.runId,
        taskId: entry.taskId,
        condition: entry.condition,
        repetition: entry.repetition,
        status: "completed",
        codexCliVersion: value.settings.codexCliVersion,
        settings: {
          model: value.settings.model,
          reasoningEffort: value.settings.reasoningEffort,
          timeoutMs,
        },
      };
      const evaluated = {
        run_id: entry.runId,
        task_id: entry.taskId,
        granularity,
        prompt_condition: entry.condition,
        input_tokens: 10,
        cached_input_tokens: 4,
        uncached_input_tokens: 6,
        output_tokens: 3,
        reasoning_output_tokens: 1,
        credits:
          (6 / 1_000_000) * value.creditRate.perMillionTokens.uncachedInput +
          (4 / 1_000_000) * value.creditRate.perMillionTokens.cachedInput +
          (3 / 1_000_000) * value.creditRate.perMillionTokens.output,
        duration_seconds: 2,
        success: true,
        quality_score: 100,
        forbidden_change: false,
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
          "evaluation-log.json",
        ].map((file) => writeFile(path.join(directory, file), "fixture\n")),
      ]);
    }
    const initial = await verifyPilotStudy({ config: value, plan, resultRoot });
    expect(initial).toMatchObject({
      complete: true,
      observedRuns: 45,
      credits: { measurementAvailable: true },
      decisions: {
        granularity: "review_required",
        timeout: "review_required",
        budget: "review_required",
      },
      go: false,
    });
    const review = {
      schemaVersion: 1,
      reviewedAt: "2026-08-06T06:00:00.000Z",
      reviewerId: value.humanReviewerId,
      sourceConfigSha256: initial.configSha256,
      decisions: {
        granularity: "approved",
        timeout: "approved",
        budget: "approved",
      },
      findings: ["No missing metrics or evaluator failures."],
      changesBeforeMainExperiment: ["No changes required."],
      refrozenConditions: {
        version: "main-v1",
        recordedAt: "2026-08-06T06:10:00.000Z",
        configSha256: initial.configSha256,
      },
    };
    await expect(
      verifyPilotStudy({ config: value, plan, resultRoot, review }),
    ).resolves.toMatchObject({ go: true });
  });
});
