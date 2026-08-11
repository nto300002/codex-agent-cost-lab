import { createHash } from "node:crypto";
import {
  access,
  appendFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { aggregateExperimentResults } from "./aggregate-experiment-results";
import { evaluateExperimentRun } from "./evaluate-experiment-run";
import {
  createRunPlan,
  experimentConditions,
  experimentTaskIds,
  runExperiment,
  type FixedRunSettings,
} from "./experiment-runner";
import { createRunJson } from "./parse-codex-jsonl";

const granularities = ["G-A", "G-B", "G-C"] as const;
const mainConfigSchema = z.object({
  schemaVersion: z.literal(1),
  study: z.literal("main"),
  version: z.string().min(1),
  randomizationSeed: z.string().min(1),
  tasks: z.tuple([
    z.literal("GA-F1"),
    z.literal("GA-I1"),
    z.literal("GB-F1"),
    z.literal("GB-I1"),
    z.literal("GC-F1"),
    z.literal("GC-I1"),
  ]),
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
  budget: z
    .object({
      creditLimit: z.number().positive(),
      stopAtCredits: z.number().positive(),
      perRunStopCredits: z.number().positive(),
    })
    .refine(
      (value) => value.stopAtCredits <= value.creditLimit,
      "stopAtCredits must not exceed creditLimit",
    ),
  operatorId: z.string().min(1),
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
      taskId: z.enum(experimentTaskIds),
      condition: z.enum(experimentConditions),
      repetition: z.number().int().min(1).max(5),
      sequence: z.number().int().positive(),
    }),
  ),
});
const evaluatedSchema = z
  .object({
    run_id: z.string(),
    task_id: z.enum(experimentTaskIds),
    granularity: z.enum(granularities),
    prompt_condition: z.enum(experimentConditions),
    model: z.string(),
    input_tokens: z.number().int().nonnegative(),
    cached_input_tokens: z.number().int().nonnegative(),
    uncached_input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    credits: z.number().nonnegative(),
    evaluation_status: z.enum(["completed", "error"]),
    included_in_cost_analysis: z.boolean(),
  })
  .passthrough();
const manifestSchema = z.object({
  runId: z.string(),
  taskId: z.enum(experimentTaskIds),
  condition: z.enum(experimentConditions),
  repetition: z.number().int(),
  status: z.enum(["completed", "failed", "timed-out"]),
  codexCliVersion: z.string(),
  settings: z.object({
    model: z.string(),
    reasoningEffort: z.string(),
    timeoutMs: z.number().positive(),
  }),
});
const eventSchema = z.object({
  schemaVersion: z.literal(1),
  recordedAt: z.string().datetime(),
  operatorId: z.string().min(1),
  event: z.enum([
    "run_started",
    "run_completed",
    "run_resumed",
    "execution_stopped",
    "deviation",
    "rerun",
  ]),
  runId: z.string().nullable(),
  reason: z.string().min(1),
});

const requiredArtifacts = [
  "manifest.json",
  "prompt.md",
  "codex.jsonl",
  "stderr.log",
  "diff.patch",
  "git-status.txt",
  "run.json",
  "automatic-evaluation.json",
  "evaluated-run.json",
  "evaluation-log.json",
] as const;
export type MainConfig = z.infer<typeof mainConfigSchema>;
type MainEvent = z.infer<typeof eventSchema>;

async function exists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function digest(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
function granularity(runId: string) {
  return runId.startsWith("GA-")
    ? ("G-A" as const)
    : runId.startsWith("GB-")
      ? ("G-B" as const)
      : ("G-C" as const);
}
function timeoutMs(config: MainConfig, runId: string) {
  return config.timeoutMinutesByGranularity[granularity(runId)] * 60_000;
}

async function assertFrozenAssetCommit(
  repositoryRoot: string,
  config: MainConfig,
) {
  const lock = z
    .object({ commit: z.string().regex(/^[0-9a-f]{40}$/) })
    .parse(
      JSON.parse(
        await readFile(
          path.join(repositoryRoot, "experiment/task-assets.lock.json"),
          "utf8",
        ),
      ),
    );
  if (lock.commit !== config.privateAssetCommit)
    throw new Error(
      `Private evaluator commit mismatch: config=${config.privateAssetCommit}, lock=${lock.commit}`,
    );
}

export function createMainPlan(config: MainConfig) {
  const parsed = mainConfigSchema.parse(config);
  return createRunPlan({
    seed: parsed.randomizationSeed,
    repetitions: parsed.repetitions,
    tasks: experimentTaskIds,
    conditions: experimentConditions,
  });
}

async function appendEvent(file: string, event: MainEvent) {
  eventSchema.parse(event);
  await appendFile(file, `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
}

async function artifactInventory(root: string) {
  const inventory: Array<{ path: string; bytes: number; sha256: string }> = [];
  async function visit(directory: string) {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const content = await readFile(absolute);
        inventory.push({
          path: path.relative(root, absolute),
          bytes: (await stat(absolute)).size,
          sha256: digest(content),
        });
      }
    }
  }
  await visit(root);
  return inventory.sort((a, b) => a.path.localeCompare(b.path));
}

export async function verifyMainStudy(options: {
  repositoryRoot?: string;
  config: unknown;
  plan: unknown;
  workRoot: string;
  resultRoot: string;
  eventLog: string;
  pricing: unknown;
}) {
  const config = mainConfigSchema.parse(options.config);
  await assertFrozenAssetCommit(
    options.repositoryRoot ?? process.cwd(),
    config,
  );
  const plan = planSchema.parse(options.plan);
  if (canonical(plan) !== canonical(createMainPlan(config)))
    throw new Error("Run plan does not match the frozen main configuration.");
  if (
    plan.entries.length !== 90 ||
    new Set(plan.entries.map((entry) => entry.runId)).size !== 90
  )
    throw new Error("Main plan must contain 90 unique runs.");
  const missingArtifacts: Array<{ runId: string; files: string[] }> = [];
  const missingWorktrees: string[] = [];
  const evaluatedRuns: unknown[] = [];
  for (const entry of plan.entries) {
    const directory = path.join(options.resultRoot, entry.runId);
    const missing = [];
    for (const artifact of requiredArtifacts)
      if (!(await exists(path.join(directory, artifact))))
        missing.push(artifact);
    if (missing.length) {
      missingArtifacts.push({ runId: entry.runId, files: missing });
      continue;
    }
    if (!(await exists(path.join(options.workRoot, entry.runId))))
      missingWorktrees.push(entry.runId);
    const manifest = manifestSchema.parse(
      JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")),
    );
    const evaluated = evaluatedSchema.parse(
      JSON.parse(
        await readFile(path.join(directory, "evaluated-run.json"), "utf8"),
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
    )
      throw new Error(`Run identity mismatch: ${entry.runId}`);
    if (
      manifest.codexCliVersion !== config.settings.codexCliVersion ||
      manifest.settings.model !== config.settings.model ||
      manifest.settings.reasoningEffort !== config.settings.reasoningEffort ||
      manifest.settings.timeoutMs !== timeoutMs(config, entry.runId)
    )
      throw new Error(`Frozen execution settings mismatch: ${entry.runId}`);
    if (
      evaluated.input_tokens !==
      evaluated.cached_input_tokens + evaluated.uncached_input_tokens
    )
      throw new Error(`Input token components do not add up: ${entry.runId}`);
    const expectedCredits =
      (evaluated.uncached_input_tokens / 1_000_000) *
        config.creditRate.perMillionTokens.uncachedInput +
      (evaluated.cached_input_tokens / 1_000_000) *
        config.creditRate.perMillionTokens.cachedInput +
      (evaluated.output_tokens / 1_000_000) *
        config.creditRate.perMillionTokens.output;
    if (Math.abs(evaluated.credits - expectedCredits) > 1e-9)
      throw new Error(`Credit calculation mismatch: ${entry.runId}`);
    evaluatedRuns.push(evaluated);
  }
  const events: MainEvent[] = (await exists(options.eventLog))
    ? (await readFile(options.eventLog, "utf8"))
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => eventSchema.parse(JSON.parse(line)))
    : [];
  const complete =
    evaluatedRuns.length === 90 &&
    missingArtifacts.length === 0 &&
    missingWorktrees.length === 0;
  const aggregation = complete
    ? aggregateExperimentResults(evaluatedRuns, options.pricing)
    : null;
  if (
    aggregation &&
    (aggregation.summary_by_task.length !== 18 ||
      aggregation.summary_by_granularity.length !== 9 ||
      aggregation.summary_by_task.some((group) => group.run_count !== 5) ||
      aggregation.summary_by_granularity.some(
        (group) => group.run_count !== 10,
      ))
  )
    throw new Error("Aggregated task/granularity matrix is incomplete.");
  const artifacts = (await exists(options.resultRoot))
    ? await artifactInventory(options.resultRoot)
    : [];
  return {
    schemaVersion: 1,
    study: config.study,
    version: config.version,
    expectedRuns: 90,
    observedRuns: evaluatedRuns.length,
    complete,
    configSha256: digest(`${JSON.stringify(config, null, 2)}\n`),
    planSha256: digest(`${JSON.stringify(plan, null, 2)}\n`),
    missingArtifacts,
    missingWorktrees,
    deviations: events.filter(({ event }) => event === "deviation"),
    reruns: events.filter(({ event }) => event === "rerun"),
    eventsSha256: digest(
      events.map((event) => JSON.stringify(event)).join("\n") +
        (events.length ? "\n" : ""),
    ),
    artifactCount: artifacts.length,
    artifacts,
    artifactInventorySha256: digest(`${canonical(artifacts)}\n`),
    aggregation,
    aggregationSha256: aggregation
      ? digest(`${canonical(aggregation)}\n`)
      : null,
  };
}

export async function executeMainStudy(options: {
  repositoryRoot: string;
  assetRoot: string;
  authFile: string;
  config: unknown;
  plan: unknown;
  workRoot: string;
  resultRoot: string;
  eventLog: string;
}) {
  const config = mainConfigSchema.parse(options.config);
  await assertFrozenAssetCommit(options.repositoryRoot, config);
  const plan = planSchema.parse(options.plan);
  if (canonical(plan) !== canonical(createMainPlan(config)))
    throw new Error("Run plan does not match the frozen main configuration.");
  await mkdir(path.dirname(options.eventLog), { recursive: true });
  let completed = 0;
  let credits = 0;
  for (const entry of plan.entries) {
    const directory = path.join(options.resultRoot, entry.runId);
    const evaluatedPath = path.join(directory, "evaluated-run.json");
    if (await exists(evaluatedPath)) {
      const evaluated = evaluatedSchema.parse(
        JSON.parse(await readFile(evaluatedPath, "utf8")),
      );
      credits += evaluated.credits;
      completed += 1;
      await appendEvent(options.eventLog, {
        schemaVersion: 1,
        recordedAt: new Date().toISOString(),
        operatorId: config.operatorId,
        event: "run_resumed",
        runId: entry.runId,
        reason: "Existing complete evaluated run retained during resume.",
      });
      continue;
    }
    if (await exists(directory))
      throw new Error(
        `Partial run directory requires a recorded deviation or rerun decision before resume: ${directory}`,
      );
    if (credits >= config.budget.stopAtCredits) {
      await appendEvent(options.eventLog, {
        schemaVersion: 1,
        recordedAt: new Date().toISOString(),
        operatorId: config.operatorId,
        event: "execution_stopped",
        runId: entry.runId,
        reason: `Cumulative stop threshold reached: ${credits} credits.`,
      });
      return {
        status: "cumulative_budget_stop" as const,
        completed,
        credits,
        nextRunId: entry.runId,
      };
    }
    await appendEvent(options.eventLog, {
      schemaVersion: 1,
      recordedAt: new Date().toISOString(),
      operatorId: config.operatorId,
      event: "run_started",
      runId: entry.runId,
      reason: "Scheduled main experiment run started.",
    });
    const settings: FixedRunSettings = {
      model: config.settings.model,
      reasoningEffort: config.settings.reasoningEffort,
      sandbox: config.settings.sandbox,
      networkAccess: config.settings.networkAccess,
      webSearch: config.settings.webSearch,
      approvalPolicy: config.settings.approvalPolicy,
      timeoutMs: timeoutMs(config, entry.runId),
    };
    const execution = await runExperiment({
      repositoryRoot: options.repositoryRoot,
      assetRoot: options.assetRoot,
      authFile: options.authFile,
      workRoot: options.workRoot,
      resultRoot: options.resultRoot,
      entry,
      settings,
    });
    const manifestPath = path.join(directory, "manifest.json");
    const jsonlPath = path.join(directory, "codex.jsonl");
    const diffPath = path.join(directory, "diff.patch");
    if (
      !(await exists(manifestPath)) ||
      !(await exists(jsonlPath)) ||
      !(await exists(diffPath))
    )
      throw new Error(`Run failed before measurable artifacts: ${entry.runId}`);
    const run = await createRunJson({
      root: options.repositoryRoot,
      manifest: JSON.parse(await readFile(manifestPath, "utf8")),
      jsonl: await readFile(jsonlPath, "utf8"),
      diff: await readFile(diffPath, "utf8"),
      creditRate: config.creditRate,
    });
    const runJsonPath = path.join(directory, "run.json");
    await writeFile(runJsonPath, `${JSON.stringify(run, null, 2)}\n`, {
      flag: "wx",
    });
    const evaluated = await evaluateExperimentRun({
      root: options.repositoryRoot,
      assetRoot: options.assetRoot,
      workspace: execution.workspace,
      diffPath,
      runJsonPath,
      manifestPath,
      outputPath: evaluatedPath,
      logPath: path.join(directory, "evaluation-log.json"),
    });
    completed += 1;
    credits += run.credits;
    await appendEvent(options.eventLog, {
      schemaVersion: 1,
      recordedAt: new Date().toISOString(),
      operatorId: config.operatorId,
      event: "run_completed",
      runId: entry.runId,
      reason: `Execution=${execution.status}; evaluation=${evaluated.evaluation_status}; credits=${run.credits}.`,
    });
    console.log(
      JSON.stringify({
        sequence: entry.sequence,
        runId: entry.runId,
        executionStatus: execution.status,
        outcome: evaluated.outcome,
        runCredits: run.credits,
        totalCredits: credits,
        completed,
      }),
    );
    const stop =
      evaluated.evaluation_status === "error"
        ? "evaluator_error_stop"
        : run.credits > config.budget.perRunStopCredits
          ? "per_run_budget_stop"
          : credits >= config.budget.stopAtCredits
            ? "cumulative_budget_stop"
            : null;
    if (stop) {
      await appendEvent(options.eventLog, {
        schemaVersion: 1,
        recordedAt: new Date().toISOString(),
        operatorId: config.operatorId,
        event: "execution_stopped",
        runId: entry.runId,
        reason: stop,
      });
      return {
        status: stop,
        completed,
        credits,
        nextRunId: plan.entries[entry.sequence]?.runId ?? null,
      };
    }
  }
  return { status: "completed" as const, completed, credits, nextRunId: null };
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
async function main() {
  const command = process.argv[2];
  const config = mainConfigSchema.parse(
    JSON.parse(
      await readFile(
        path.resolve(option("--config") ?? "experiment/main-config.json"),
        "utf8",
      ),
    ),
  );
  if (command === "plan") {
    const output = option("--output");
    if (!output) throw new Error("plan requires --output");
    const plan = createMainPlan(config);
    await writeFile(
      path.resolve(output),
      `${JSON.stringify(plan, null, 2)}\n`,
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({
        output: path.resolve(output),
        runs: plan.entries.length,
      }),
    );
    return;
  }
  if (command === "record") {
    const eventLog = option("--event-log");
    const event = option("--event");
    const reason = option("--reason");
    if (!eventLog || !reason || (event !== "deviation" && event !== "rerun"))
      throw new Error(
        "record requires --event-log, --event <deviation|rerun>, and --reason",
      );
    await mkdir(path.dirname(path.resolve(eventLog)), { recursive: true });
    await appendEvent(path.resolve(eventLog), {
      schemaVersion: 1,
      recordedAt: new Date().toISOString(),
      operatorId: config.operatorId,
      event,
      runId: option("--run-id") ?? null,
      reason,
    });
    return;
  }
  const planPath = option("--plan");
  const workRoot = option("--work-root");
  const resultRoot = option("--result-root");
  const eventLog = option("--event-log");
  if (!planPath || !workRoot || !resultRoot || !eventLog)
    throw new Error(
      `${command} requires --plan, --work-root, --result-root, and --event-log`,
    );
  const plan = JSON.parse(await readFile(path.resolve(planPath), "utf8"));
  if (command === "verify") {
    const pricingPath = option("--pricing") ?? "experiment/main-pricing.json";
    const output = option("--output");
    if (!output) throw new Error("verify requires --output");
    const report = await verifyMainStudy({
      config,
      plan,
      workRoot: path.resolve(workRoot),
      resultRoot: path.resolve(resultRoot),
      eventLog: path.resolve(eventLog),
      pricing: JSON.parse(await readFile(path.resolve(pricingPath), "utf8")),
    });
    await writeFile(
      path.resolve(output),
      `${JSON.stringify(report, null, 2)}\n`,
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({
        complete: report.complete,
        observedRuns: report.observedRuns,
        artifactCount: report.artifactCount,
      }),
    );
    if (!report.complete) process.exitCode = 1;
    return;
  }
  if (command === "run-all") {
    const assetRoot =
      option("--asset-root") ?? process.env.EXPERIMENT_ASSET_ROOT;
    const authFile = option("--auth-file") ?? process.env.CODEX_AUTH_FILE;
    if (!assetRoot || !authFile)
      throw new Error("run-all requires --asset-root and --auth-file");
    const result = await executeMainStudy({
      repositoryRoot: process.cwd(),
      assetRoot,
      authFile,
      config,
      plan,
      workRoot: path.resolve(workRoot),
      resultRoot: path.resolve(resultRoot),
      eventLog: path.resolve(eventLog),
    });
    console.log(JSON.stringify(result));
    if (result.status !== "completed") process.exitCode = 2;
    return;
  }
  throw new Error("usage: main-study.ts <plan|record|run-all|verify>");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
