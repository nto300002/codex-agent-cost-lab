import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { runCommand } from "./experiment-runner";
import { verifyTaskAssets } from "./verify-task-assets";

const taskIds = ["GA-F1", "GA-I1", "GB-F1", "GB-I1", "GC-F1", "GC-I1"] as const;

const automaticEvaluationSchema = z.object({
  schemaVersion: z.literal(1),
  taskId: z.enum(taskIds),
  evaluatedAt: z.string().datetime(),
  success: z.boolean(),
  qualityScore: z.number().int().min(0).max(100),
  maxScore: z.literal(100),
  components: z.object({
    hiddenEvaluation: z.number().int().min(0).max(60),
    publicRegression: z.number().int().min(0).max(20),
    changeScope: z.number().int().min(0).max(10),
    forbiddenChanges: z.number().int().min(0).max(10),
  }),
  changedFiles: z
    .array(z.string())
    .refine((values) => new Set(values).size === values.length),
  forbiddenFiles: z
    .array(z.string())
    .refine((values) => new Set(values).size === values.length),
  failures: z.array(z.string()),
  hidden: z.unknown().optional(),
  regression: z.unknown().optional(),
});

const reviewFindingSchema = z.object({
  category: z.enum([
    "accuracy",
    "scope",
    "design",
    "readability",
    "maintainability",
    "security",
    "other",
  ]),
  severity: z.enum(["info", "minor", "major", "critical"]),
  comment: z.string().min(1),
});

export const humanReviewSchema = z.object({
  schemaVersion: z.literal(1),
  reviewId: z
    .string()
    .regex(/^review-[a-z0-9-]{8,}$/)
    .refine((value) => !/-P[0-2]-/i.test(value), {
      message: "reviewId must not reveal the prompt condition",
    }),
  reviewer: z.string().min(1),
  recordedAt: z.string().datetime(),
  fixMinutes: z.number().nonnegative(),
  conditionVisible: z.literal(false),
  findings: z.array(reviewFindingSchema),
});

const runJsonSchema = z
  .object({
    run_id: z.string().regex(/^(GA|GB|GC)-(F1|I1)-P[0-2]-run\d{2}$/),
    task_id: z.enum(taskIds),
  })
  .passthrough();

const manifestSchema = z.object({
  runId: z.string(),
  taskId: z.enum(taskIds),
  status: z.enum(["preparing", "running", "completed", "failed", "timed-out"]),
});

export type AutomaticEvaluation = z.infer<typeof automaticEvaluationSchema>;
export type HumanReview = z.infer<typeof humanReviewSchema>;

type EvaluatorFailure = {
  message: string;
  exitCode: number | null;
  timedOut: boolean;
};

export function integrateEvaluation(options: {
  run: z.infer<typeof runJsonSchema>;
  manifest: z.infer<typeof manifestSchema>;
  automatic?: AutomaticEvaluation;
  evaluatorFailure?: EvaluatorFailure;
  humanReview?: HumanReview;
}) {
  const run = runJsonSchema.parse(options.run);
  const manifest = manifestSchema.parse(options.manifest);
  if (run.run_id !== manifest.runId || run.task_id !== manifest.taskId) {
    throw new Error("Run JSON and manifest identify different runs.");
  }
  const automatic = options.automatic
    ? automaticEvaluationSchema.parse(options.automatic)
    : undefined;
  const humanReview = options.humanReview
    ? humanReviewSchema.parse(options.humanReview)
    : undefined;
  if (automatic && automatic.taskId !== run.task_id) {
    throw new Error("Automatic evaluation task does not match the run.");
  }
  if (!automatic && !options.evaluatorFailure) {
    throw new Error("Automatic evaluation or evaluator failure is required.");
  }

  const executionStatus =
    manifest.status === "timed-out" ? "timed_out" : manifest.status;
  const evaluationStatus = automatic ? "completed" : "error";
  const outcome = options.evaluatorFailure
    ? "evaluator_failure"
    : executionStatus !== "completed"
      ? "execution_failure"
      : automatic?.success
        ? "success"
        : "implementation_failure";
  return {
    ...run,
    execution_status: executionStatus,
    evaluation_status: evaluationStatus,
    outcome,
    included_in_cost_analysis: true,
    success: automatic?.success ?? false,
    quality_score: automatic?.qualityScore ?? 0,
    forbidden_change: (automatic?.forbiddenFiles.length ?? 0) > 0,
    human_fix_minutes: humanReview?.fixMinutes ?? 0,
    automatic_evaluation: automatic
      ? {
          evaluated_at: automatic.evaluatedAt,
          max_score: automatic.maxScore,
          components: automatic.components,
          changed_files: automatic.changedFiles,
          forbidden_files: automatic.forbiddenFiles,
          failures: automatic.failures,
        }
      : null,
    evaluation_error: options.evaluatorFailure ?? null,
    human_review: humanReview
      ? {
          review_id: humanReview.reviewId,
          reviewer: humanReview.reviewer,
          recorded_at: humanReview.recordedAt,
          condition_visible: humanReview.conditionVisible,
          findings: humanReview.findings,
        }
      : null,
  };
}

export async function evaluateExperimentRun(options: {
  root: string;
  assetRoot: string;
  workspace: string;
  diffPath: string;
  runJsonPath: string;
  manifestPath: string;
  outputPath: string;
  logPath: string;
  humanReviewPath?: string;
  evaluatorScript?: string;
  timeoutMs?: number;
  skipAssetVerification?: boolean;
}) {
  const root = path.resolve(options.root);
  const run = runJsonSchema.parse(
    JSON.parse(await readFile(options.runJsonPath, "utf8")),
  );
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(options.manifestPath, "utf8")),
  );
  const humanReview = options.humanReviewPath
    ? humanReviewSchema.parse(
        JSON.parse(await readFile(options.humanReviewPath, "utf8")),
      )
    : undefined;
  await Promise.all([
    mkdir(path.dirname(path.resolve(options.outputPath)), { recursive: true }),
    mkdir(path.dirname(path.resolve(options.logPath)), { recursive: true }),
  ]);

  const automaticOutputPath = path.join(
    path.dirname(path.resolve(options.outputPath)),
    "automatic-evaluation.json",
  );
  for (const artifactPath of [
    automaticOutputPath,
    path.resolve(options.outputPath),
    path.resolve(options.logPath),
  ]) {
    try {
      await access(artifactPath);
      throw new Error(`Evaluation artifact already exists: ${artifactPath}`);
    } catch (error) {
      if (
        error instanceof Error &&
        !("code" in error && (error as NodeJS.ErrnoException).code === "ENOENT")
      ) {
        throw error;
      }
    }
  }
  const evaluatorScript =
    options.evaluatorScript ??
    path.join(options.assetRoot, "scripts/score-candidate.mjs");
  let automatic: AutomaticEvaluation | undefined;
  let evaluatorFailure: EvaluatorFailure | undefined;
  let commandResult: Awaited<ReturnType<typeof runCommand>> | undefined;
  let commandArgs: string[] = [];
  try {
    if (!options.skipAssetVerification) {
      await verifyTaskAssets(root, options.assetRoot);
    }
    commandArgs = [
      evaluatorScript,
      "--task",
      run.task_id,
      "--workspace",
      path.resolve(options.workspace),
      "--candidate-patch",
      path.resolve(options.diffPath),
      "--output",
      automaticOutputPath,
      "--run-regression",
    ];
    commandResult = await runCommand(
      { command: process.execPath, args: commandArgs },
      {
        cwd: options.assetRoot,
        timeoutMs: options.timeoutMs ?? 30 * 60_000,
      },
    );
    try {
      const parsed = automaticEvaluationSchema.parse(
        JSON.parse(await readFile(automaticOutputPath, "utf8")),
      );
      if (
        commandResult.timedOut ||
        commandResult.exitCode === null ||
        ![0, 1].includes(commandResult.exitCode)
      ) {
        evaluatorFailure = {
          message: `Evaluator exited abnormally with code ${String(commandResult.exitCode)}.`,
          exitCode: commandResult.exitCode,
          timedOut: commandResult.timedOut,
        };
      } else {
        automatic = parsed;
      }
    } catch (error) {
      evaluatorFailure = {
        message: `Evaluator did not produce a valid result: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: commandResult.exitCode,
        timedOut: commandResult.timedOut,
      };
    }
  } catch (error) {
    evaluatorFailure = {
      message: error instanceof Error ? error.message : String(error),
      exitCode: commandResult?.exitCode ?? null,
      timedOut: commandResult?.timedOut ?? false,
    };
  }

  const integrated = integrateEvaluation({
    run,
    manifest,
    automatic,
    evaluatorFailure,
    humanReview,
  });
  const log = {
    schemaVersion: 1,
    runId: run.run_id,
    recordedAt: new Date().toISOString(),
    evaluator: {
      command: process.execPath,
      args: commandArgs,
      exitCode: commandResult?.exitCode ?? null,
      timedOut: commandResult?.timedOut ?? false,
      durationMs: commandResult?.durationMs ?? 0,
      stdout: commandResult?.stdout ?? "",
      stderr: commandResult?.stderr ?? "",
    },
    evaluationStatus: integrated.evaluation_status,
    outcome: integrated.outcome,
    error: evaluatorFailure ?? null,
  };
  await Promise.all([
    writeFile(options.outputPath, `${JSON.stringify(integrated, null, 2)}\n`, {
      flag: "wx",
    }),
    writeFile(options.logPath, `${JSON.stringify(log, null, 2)}\n`, {
      flag: "wx",
    }),
  ]);
  return integrated;
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const required = {
    assetRoot: option("--asset-root") ?? process.env.EXPERIMENT_ASSET_ROOT,
    workspace: option("--workspace"),
    diffPath: option("--diff"),
    runJsonPath: option("--run-json"),
    manifestPath: option("--manifest"),
    outputPath: option("--output"),
    logPath: option("--log"),
  };
  if (Object.values(required).some((value) => !value)) {
    throw new Error(
      "usage: tsx scripts/evaluate-experiment-run.ts --asset-root <private-repo> --workspace <run-worktree> --diff <diff.patch> --run-json <run.json> --manifest <manifest.json> --output <evaluated-run.json> --log <evaluation-log.json> [--human-review <review.json>]",
    );
  }
  const result = await evaluateExperimentRun({
    root: process.cwd(),
    assetRoot: required.assetRoot!,
    workspace: required.workspace!,
    diffPath: required.diffPath!,
    runJsonPath: required.runJsonPath!,
    manifestPath: required.manifestPath!,
    outputPath: required.outputPath!,
    logPath: required.logPath!,
    humanReviewPath: option("--human-review"),
  });
  console.log(
    JSON.stringify({
      runId: result.run_id,
      outcome: result.outcome,
      evaluationStatus: result.evaluation_status,
    }),
  );
  if (result.evaluation_status === "error") process.exitCode = 2;
  else if (!result.success) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
}
