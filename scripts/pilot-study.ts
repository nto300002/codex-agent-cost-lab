import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { createRunPlan } from "./experiment-runner";

export const pilotTaskIds = ["GA-F1", "GB-I1", "GC-F1"] as const;
const conditions = ["P0", "P1", "P2"] as const;
const granularities = ["G-A", "G-B", "G-C"] as const;

const pilotConfigSchema = z.object({
  schemaVersion: z.literal(1),
  study: z.literal("pilot"),
  version: z.string().min(1),
  randomizationSeed: z.string().min(1),
  tasks: z.tuple([z.literal("GA-F1"), z.literal("GB-I1"), z.literal("GC-F1")]),
  conditions: z.tuple([z.literal("P0"), z.literal("P1"), z.literal("P2")]),
  repetitions: z.literal(5),
  settings: z.object({
    codexCliVersion: z.string().min(1),
    model: z.string().min(1),
    reasoningEffort: z.literal("medium"),
    sandbox: z.literal("workspace-write"),
    approvalPolicy: z.literal("never"),
    networkAccess: z.literal(false),
    webSearch: z.literal("disabled"),
    fastMode: z.literal(false),
    multiAgent: z.literal(false),
    memories: z.literal(false),
  }),
  timeoutMinutesByGranularity: z.object({
    "G-A": z.number().positive(),
    "G-B": z.number().positive(),
    "G-C": z.number().positive(),
  }),
  budget: z.object({
    pilotCreditLimit: z.number().positive(),
    reviewThresholdRatio: z.number().positive().max(1),
    perRunWarningCredits: z.number().positive(),
  }),
  operatorId: z.string().min(1),
  humanReviewerId: z.string().min(1),
  creditRate: z.object({
    confirmedAt: z.string().date(),
    source: z.string().url(),
    model: z.string().min(1),
    perMillionTokens: z.object({
      uncachedInput: z.number().nonnegative(),
      cachedInput: z.number().nonnegative(),
      output: z.number().nonnegative(),
    }),
  }),
  startingCommit: z.string().regex(/^[0-9a-f]{40}$/),
  privateAssetCommit: z.string().regex(/^[0-9a-f]{40}$/),
});

const planSchema = z.object({
  schemaVersion: z.literal(1),
  seed: z.string(),
  repetitions: z.literal(5),
  entries: z.array(
    z.object({
      runId: z.string(),
      taskId: z.enum(pilotTaskIds),
      condition: z.enum(conditions),
      repetition: z.number().int().min(1).max(5),
      sequence: z.number().int().positive(),
    }),
  ),
});

const runSchema = z.object({
  run_id: z.string(),
  task_id: z.enum(pilotTaskIds),
  granularity: z.enum(granularities),
  prompt_condition: z.enum(conditions),
  input_tokens: z.number().int().nonnegative(),
  cached_input_tokens: z.number().int().nonnegative(),
  uncached_input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  reasoning_output_tokens: z.number().int().nonnegative(),
  credits: z.number().nonnegative(),
  duration_seconds: z.number().nonnegative(),
  success: z.boolean(),
  quality_score: z.number().nonnegative(),
  forbidden_change: z.boolean(),
  evaluation_status: z.enum(["completed", "error"]),
  outcome: z.enum([
    "success",
    "implementation_failure",
    "execution_failure",
    "evaluator_failure",
  ]),
});

const manifestSchema = z.object({
  runId: z.string(),
  taskId: z.enum(pilotTaskIds),
  condition: z.enum(conditions),
  repetition: z.number().int().min(1).max(5),
  status: z.enum(["completed", "failed", "timed-out"]),
  settings: z.object({
    model: z.string(),
    reasoningEffort: z.string(),
    timeoutMs: z.number().positive(),
  }),
});

const pilotReviewSchema = z.object({
  schemaVersion: z.literal(1),
  reviewedAt: z.string().datetime(),
  reviewerId: z.string().min(1),
  sourceConfigSha256: z.string().regex(/^[0-9a-f]{64}$/),
  decisions: z.object({
    granularity: z.enum(["approved", "change_required"]),
    timeout: z.enum(["approved", "change_required"]),
    budget: z.enum(["approved", "change_required"]),
  }),
  findings: z.array(z.string().min(1)),
  changesBeforeMainExperiment: z.array(z.string().min(1)),
  refrozenConditions: z.object({
    version: z.string().min(1),
    recordedAt: z.string().datetime(),
    configSha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
});

const requiredArtifacts = [
  "manifest.json",
  "prompt.md",
  "codex.jsonl",
  "stderr.log",
  "diff.patch",
  "git-status.txt",
  "run.json",
  "evaluated-run.json",
  "evaluation-log.json",
] as const;

export type PilotConfig = z.infer<typeof pilotConfigSchema>;

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createPilotPlan(config: PilotConfig) {
  const parsed = pilotConfigSchema.parse(config);
  return createRunPlan({
    seed: parsed.randomizationSeed,
    repetitions: parsed.repetitions,
    tasks: pilotTaskIds,
    conditions,
  });
}

function expectedTimeoutMs(config: PilotConfig, runId: string) {
  const granularity = runId.startsWith("GA-")
    ? "G-A"
    : runId.startsWith("GB-")
      ? "G-B"
      : "G-C";
  return config.timeoutMinutesByGranularity[granularity] * 60_000;
}

export async function verifyPilotStudy(options: {
  config: unknown;
  plan: unknown;
  resultRoot: string;
  review?: unknown;
}) {
  const config = pilotConfigSchema.parse(options.config);
  const plan = planSchema.parse(options.plan);
  const expectedPlan = createPilotPlan(config);
  if (canonicalJson(plan) !== canonicalJson(expectedPlan)) {
    throw new Error("Run plan does not match the frozen pilot configuration.");
  }
  if (plan.entries.length !== 45) {
    throw new Error(
      `Pilot plan must contain 45 runs; found ${plan.entries.length}.`,
    );
  }
  const runIds = plan.entries.map(({ runId }) => runId);
  if (new Set(runIds).size !== 45)
    throw new Error("Pilot run IDs are duplicated.");

  const missingArtifacts: Array<{ runId: string; files: string[] }> = [];
  const evaluatedRuns: Array<z.infer<typeof runSchema>> = [];
  const statuses: Record<string, number> = {};
  for (const entry of plan.entries) {
    const runDirectory = path.join(options.resultRoot, entry.runId);
    const missing = [];
    for (const artifact of requiredArtifacts) {
      if (!(await exists(path.join(runDirectory, artifact))))
        missing.push(artifact);
    }
    if (missing.length > 0) {
      missingArtifacts.push({ runId: entry.runId, files: missing });
      continue;
    }
    const manifest = manifestSchema.parse(
      JSON.parse(
        await readFile(path.join(runDirectory, "manifest.json"), "utf8"),
      ),
    );
    const evaluated = runSchema.parse(
      JSON.parse(
        await readFile(path.join(runDirectory, "evaluated-run.json"), "utf8"),
      ),
    );
    if (
      manifest.runId !== entry.runId ||
      manifest.taskId !== entry.taskId ||
      manifest.condition !== entry.condition ||
      manifest.repetition !== entry.repetition ||
      evaluated.run_id !== entry.runId ||
      evaluated.task_id !== entry.taskId ||
      evaluated.prompt_condition !== entry.condition
    ) {
      throw new Error(`Run identity mismatch: ${entry.runId}`);
    }
    if (
      manifest.settings.model !== config.settings.model ||
      manifest.settings.reasoningEffort !== config.settings.reasoningEffort ||
      manifest.settings.timeoutMs !== expectedTimeoutMs(config, entry.runId)
    ) {
      throw new Error(`Frozen execution settings mismatch: ${entry.runId}`);
    }
    if (
      evaluated.input_tokens !==
      evaluated.cached_input_tokens + evaluated.uncached_input_tokens
    ) {
      throw new Error(`Input token components do not add up: ${entry.runId}`);
    }
    const expectedCredits =
      (evaluated.uncached_input_tokens / 1_000_000) *
        config.creditRate.perMillionTokens.uncachedInput +
      (evaluated.cached_input_tokens / 1_000_000) *
        config.creditRate.perMillionTokens.cachedInput +
      (evaluated.output_tokens / 1_000_000) *
        config.creditRate.perMillionTokens.output;
    if (Math.abs(evaluated.credits - expectedCredits) > 1e-9) {
      throw new Error(`Credit calculation mismatch: ${entry.runId}`);
    }
    statuses[manifest.status] = (statuses[manifest.status] ?? 0) + 1;
    evaluatedRuns.push(evaluated);
  }

  const observedCredits = evaluatedRuns.reduce(
    (sum, run) => sum + run.credits,
    0,
  );
  const creditMeasurementAvailable = evaluatedRuns.some(
    ({ credits }) => credits > 0,
  );
  const evaluatorErrors = evaluatedRuns.filter(
    ({ evaluation_status }) => evaluation_status === "error",
  ).length;
  const invalidRuns = evaluatorErrors + (statuses.failed ?? 0);
  const invalidRate =
    evaluatedRuns.length === 0 ? null : invalidRuns / evaluatedRuns.length;
  const perGranularity = Object.fromEntries(
    granularities.map((granularity) => {
      const runs = evaluatedRuns.filter(
        (run) => run.granularity === granularity,
      );
      return [
        granularity,
        {
          runs: runs.length,
          successes: runs.filter(({ success }) => success).length,
          timedOut: runs.filter(
            ({ outcome }) => outcome === "execution_failure",
          ).length,
          maxDurationSeconds: Math.max(
            0,
            ...runs.map(({ duration_seconds }) => duration_seconds),
          ),
        },
      ];
    }),
  );
  const complete = missingArtifacts.length === 0 && evaluatedRuns.length === 45;
  const configSha256 = sha256(`${JSON.stringify(config, null, 2)}\n`);
  const review = options.review
    ? pilotReviewSchema.parse(options.review)
    : undefined;
  if (review && review.sourceConfigSha256 !== configSha256) {
    throw new Error("Pilot review refers to a different frozen configuration.");
  }
  if (review && review.refrozenConditions.configSha256 !== configSha256) {
    throw new Error(
      "Refrozen conditions do not match the verified configuration.",
    );
  }
  const measuredBudgetDecision = !creditMeasurementAvailable
    ? "credit_measurement_required"
    : observedCredits <= config.budget.pilotCreditLimit
      ? "within_limit"
      : "over_limit";
  const decisions = {
    granularity: !complete
      ? "insufficient_data"
      : (review?.decisions.granularity ?? "review_required"),
    timeout: !complete
      ? "insufficient_data"
      : (review?.decisions.timeout ?? "review_required"),
    budget:
      measuredBudgetDecision === "within_limit"
        ? (review?.decisions.budget ?? "review_required")
        : measuredBudgetDecision,
  };
  const go =
    complete &&
    invalidRate !== null &&
    invalidRate <= 0.05 &&
    decisions.budget === "approved" &&
    decisions.granularity === "approved" &&
    decisions.timeout === "approved" &&
    review !== undefined;
  return {
    schemaVersion: 1,
    study: config.study,
    version: config.version,
    configSha256,
    planSha256: sha256(`${JSON.stringify(plan, null, 2)}\n`),
    expectedRuns: 45,
    observedRuns: evaluatedRuns.length,
    complete,
    missingArtifacts,
    statuses,
    evaluatorErrors,
    invalidRate,
    credits: {
      measurementAvailable: creditMeasurementAvailable,
      observed: observedCredits,
      limit: config.budget.pilotCreditLimit,
      reviewAt:
        config.budget.pilotCreditLimit * config.budget.reviewThresholdRatio,
    },
    perGranularity,
    decisions,
    review: review ?? null,
    go,
  };
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const command = process.argv[2];
  const configPath = path.resolve(
    option("--config") ?? "experiment/pilot-config.json",
  );
  const configText = await readFile(configPath, "utf8");
  const config = pilotConfigSchema.parse(JSON.parse(configText));
  if (command === "plan") {
    const output = option("--output");
    if (!output) throw new Error("plan requires --output <outside-repo.json>");
    const plan = createPilotPlan(config);
    await writeFile(
      path.resolve(output),
      `${JSON.stringify(plan, null, 2)}\n`,
      {
        flag: "wx",
      },
    );
    console.log(
      JSON.stringify({
        output: path.resolve(output),
        runs: plan.entries.length,
      }),
    );
    return;
  }
  if (command === "verify") {
    const planPath = option("--plan");
    const resultRoot = option("--result-root");
    const output = option("--output");
    if (!planPath || !resultRoot || !output) {
      throw new Error(
        "verify requires --plan <json> --result-root <directory> --output <json>",
      );
    }
    const report = await verifyPilotStudy({
      config,
      plan: JSON.parse(await readFile(planPath, "utf8")),
      resultRoot: path.resolve(resultRoot),
      review: option("--review")
        ? JSON.parse(await readFile(option("--review")!, "utf8"))
        : undefined,
    });
    await writeFile(
      path.resolve(output),
      `${JSON.stringify(report, null, 2)}\n`,
      {
        flag: "wx",
      },
    );
    console.log(JSON.stringify(report));
    if (!report.go) process.exitCode = 1;
    return;
  }
  throw new Error("usage: pilot-study.ts <plan|verify> [...options]");
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
