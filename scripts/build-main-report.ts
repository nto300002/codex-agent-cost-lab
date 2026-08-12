import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import {
  aggregateExperimentResults,
  writeAggregationArtifacts,
} from "./aggregate-experiment-results";
import { experimentConditions, experimentTaskIds } from "./experiment-runner";

const planSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(
    z.object({
      runId: z.string(),
      taskId: z.enum(experimentTaskIds),
      condition: z.enum(experimentConditions),
      sequence: z.number().int().positive(),
    }),
  ),
});

const identitySchema = z
  .object({
    run_id: z.string(),
    task_id: z.enum(experimentTaskIds),
    granularity: z.enum(["G-A", "G-B", "G-C"]),
    prompt_condition: z.enum(experimentConditions),
    success: z.boolean(),
    quality_score: z.number(),
    outcome: z.string(),
    credits: z.number(),
    duration_seconds: z.number(),
    input_tokens: z.number(),
    cached_input_tokens: z.number(),
    uncached_input_tokens: z.number(),
    output_tokens: z.number(),
    command_count: z.number(),
    explicit_file_references_unique: z.number(),
    repository_wide_searches: z.number(),
    test_runs_total: z.number(),
    changed_files: z.number(),
    lines_added: z.number(),
    lines_deleted: z.number(),
  })
  .passthrough();

function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function collectEvaluatedRuns(options: {
  plan: unknown;
  resultRoot: string;
}) {
  const plan = planSchema.parse(options.plan);
  if (plan.entries.length !== 90)
    throw new Error(`Expected 90 plan entries; found ${plan.entries.length}.`);
  const ordered = [...plan.entries].sort(
    (left, right) => left.sequence - right.sequence,
  );
  if (
    new Set(ordered.map(({ runId }) => runId)).size !== 90 ||
    new Set(ordered.map(({ sequence }) => sequence)).size !== 90
  ) {
    throw new Error("Run IDs or plan sequences are duplicated.");
  }
  const runs = [];
  for (const entry of ordered) {
    const file = path.join(
      options.resultRoot,
      entry.runId,
      "evaluated-run.json",
    );
    let parsed: z.infer<typeof identitySchema>;
    try {
      parsed = identitySchema.parse(JSON.parse(await readFile(file, "utf8")));
    } catch (error) {
      throw new Error(
        `Unable to collect evaluated run ${entry.runId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (
      parsed.run_id !== entry.runId ||
      parsed.task_id !== entry.taskId ||
      parsed.prompt_condition !== entry.condition
    ) {
      throw new Error(`Run identity mismatch: ${entry.runId}`);
    }
    runs.push(parsed);
  }
  return runs;
}

export function createPublicSummary(rawRuns: unknown[], pricing: unknown) {
  const aggregation = aggregateExperimentResults(rawRuns, pricing);
  const runs = rawRuns.map((run) => identitySchema.parse(run));
  const representativeIds = [
    "GC-I1-P0-run03",
    "GC-I1-P1-run03",
    "GC-I1-P2-run03",
  ];
  const representativeRuns = representativeIds.map((runId) => {
    const run = runs.find(({ run_id }) => run_id === runId);
    if (!run) throw new Error(`Representative run is missing: ${runId}`);
    return {
      runId: run.run_id,
      condition: run.prompt_condition,
      success: run.success,
      qualityScore: run.quality_score,
      outcome: run.outcome,
      credits: run.credits,
      durationSeconds: run.duration_seconds,
      inputTokens: run.input_tokens,
      cachedInputTokens: run.cached_input_tokens,
      uncachedInputTokens: run.uncached_input_tokens,
      outputTokens: run.output_tokens,
      commands: run.command_count,
      explicitFiles: run.explicit_file_references_unique,
      repositorySearches: run.repository_wide_searches,
      testRuns: run.test_runs_total,
      changedFiles: run.changed_files,
      linesAdded: run.lines_added,
      linesDeleted: run.lines_deleted,
    };
  });
  const granularity = aggregation.summary_by_granularity.map((summary) => ({
    granularity: summary.granularity,
    condition: summary.prompt_condition,
    runs: summary.run_count,
    successes: summary.success_count,
    successRate: summary.success_rate,
    credits: summary.metrics.credits,
    creditsPerSuccess: summary.per_success.metrics.credits,
    medianInputTokens: summary.metrics.input_tokens.median,
    medianOutputTokens: summary.metrics.output_tokens.median,
    medianExplicitFiles: summary.metrics.explicit_file_references_unique.median,
    medianRepositorySearches: summary.metrics.repository_wide_searches.median,
    medianTestRuns: summary.metrics.test_runs_total.median,
    medianDurationSeconds: summary.metrics.duration_seconds.median,
  }));
  const tasks = aggregation.summary_by_task.map((summary) => ({
    taskId: summary.task_id,
    condition: summary.prompt_condition,
    runs: summary.run_count,
    successes: summary.success_count,
    successRate: summary.success_rate,
    medianCredits: summary.metrics.credits.median,
    creditsPerSuccess: summary.per_success.metrics.credits,
    medianQualityScore: summary.metrics.quality_score.median,
  }));
  const successful = runs.filter(({ success }) => success).length;
  const totalCredits = runs.reduce((sum, run) => sum + run.credits, 0);
  const summary = {
    schemaVersion: 1,
    study: "main-v1",
    comparisonPolicy: "within_granularity_only",
    totals: {
      runs: runs.length,
      successful,
      implementationFailures: runs.filter(
        ({ outcome }) => outcome === "implementation_failure",
      ).length,
      executionFailures: runs.filter(
        ({ outcome }) => outcome === "execution_failure",
      ).length,
      totalCredits,
      maxRunCredits: Math.max(...runs.map(({ credits }) => credits)),
    },
    granularity,
    tasks,
    representativeTask: {
      taskId: "GC-I1",
      repetition: 3,
      runs: representativeRuns,
      p1FailureReason:
        "The candidate changed 21 files, exceeding the frozen 1..20 change-scope limit.",
    },
    companyScenarios: {
      kind: "illustrative_not_forecast",
      users: 60,
      tasksPerUserDay: 6,
      workingDaysPerMonth: 20,
      monthlyTasks: 7200,
      rows: [10, 50, 100].map((yenPerTask) => ({
        yenPerTask,
        monthlyYen: 7200 * yenPerTask,
        annualYen: 7200 * yenPerTask * 12,
      })),
    },
  };
  return {
    ...summary,
    summarySha256: sha256(`${canonicalJson(summary)}\n`),
  };
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const planPath = option("--plan");
  const resultRoot = option("--result-root");
  const pricingPath = option("--pricing");
  const outputDirectory = option("--output-dir");
  const expectedPath = option("--expected");
  if (!planPath || !resultRoot || !pricingPath || !outputDirectory) {
    throw new Error(
      "usage: build-main-report.ts --plan <json> --result-root <raw> --pricing <json> --output-dir <new-directory> [--expected <public-summary.json>]",
    );
  }
  const runs = await collectEvaluatedRuns({
    plan: JSON.parse(await readFile(path.resolve(planPath), "utf8")),
    resultRoot: path.resolve(resultRoot),
  });
  const pricing = JSON.parse(await readFile(path.resolve(pricingPath), "utf8"));
  const publicSummary = createPublicSummary(runs, pricing);
  if (expectedPath) {
    const expected = JSON.parse(
      await readFile(path.resolve(expectedPath), "utf8"),
    );
    if (canonicalJson(publicSummary) !== canonicalJson(expected)) {
      throw new Error("Regenerated public summary differs from --expected.");
    }
  }
  const resolvedOutput = path.resolve(outputDirectory);
  await mkdir(resolvedOutput, { recursive: false });
  const runsPath = path.join(resolvedOutput, "evaluated-runs.jsonl");
  await writeFile(
    runsPath,
    `${runs.map((run) => JSON.stringify(run)).join("\n")}\n`,
    { flag: "wx" },
  );
  await writeFile(
    path.join(resolvedOutput, "public-summary.json"),
    `${JSON.stringify(publicSummary, null, 2)}\n`,
    { flag: "wx" },
  );
  await writeAggregationArtifacts({
    runsJsonlPath: runsPath,
    pricingPath: path.resolve(pricingPath),
    outputDirectory: path.join(resolvedOutput, "aggregation"),
  });
  console.log(
    JSON.stringify({
      outputDirectory: resolvedOutput,
      runs: runs.length,
      summarySha256: publicSummary.summarySha256,
      expectedMatched: Boolean(expectedPath),
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
