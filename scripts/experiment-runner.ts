import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import {
  type AgentCondition,
  configureAgentCondition,
} from "./configure-agent-condition";
import { verifyTaskAssets } from "./verify-task-assets";

export const experimentTaskIds = [
  "GA-F1",
  "GA-I1",
  "GB-F1",
  "GB-I1",
  "GC-F1",
  "GC-I1",
] as const;
export const experimentConditions = ["P0", "P1", "P2"] as const;

export type ExperimentTaskId = (typeof experimentTaskIds)[number];
export type ExperimentCondition = (typeof experimentConditions)[number];

export type RunPlanEntry = {
  runId: string;
  taskId: ExperimentTaskId;
  condition: ExperimentCondition;
  repetition: number;
  sequence: number;
};

export type FixedRunSettings = {
  model: string;
  reasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh";
  sandbox: "workspace-write";
  networkAccess: false;
  webSearch: "disabled";
  approvalPolicy: "never";
  timeoutMs: number;
};

type Command = { command: string; args: string[] };
type CommandResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
};

type OperatorTask = {
  id: ExperimentTaskId;
  startingCommit: string;
};

const operatorTaskSchema = z.object({
  id: z.enum(experimentTaskIds),
  startingCommit: z.string().regex(/^[0-9a-f]{40}$/),
});

const runIdSchema = z.string().regex(/^(GA|GB|GC)-(F1|I1)-P[0-2]-run\d{2}$/);

function isInside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  );
}

export function assertSafeExperimentRoots(options: {
  repositoryRoot: string;
  workRoot: string;
  resultRoot: string;
}) {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const workRoot = path.resolve(options.workRoot);
  const resultRoot = path.resolve(options.resultRoot);
  if (
    isInside(repositoryRoot, workRoot) ||
    isInside(repositoryRoot, resultRoot)
  ) {
    throw new Error(
      "Experiment work and result roots must be outside the source repository.",
    );
  }
  if (isInside(workRoot, resultRoot) || isInside(resultRoot, workRoot)) {
    throw new Error(
      "Experiment work and result roots must not contain each other.",
    );
  }
  if (
    workRoot === path.parse(workRoot).root ||
    resultRoot === path.parse(resultRoot).root
  ) {
    throw new Error(
      "Filesystem roots cannot be used for experiment artifacts.",
    );
  }
}

function seedToUint32(seed: string) {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32LE(0);
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffle<T>(values: T[], random: () => number) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

export function createRunPlan(options: {
  seed: string;
  repetitions: number;
  tasks?: readonly ExperimentTaskId[];
  conditions?: readonly ExperimentCondition[];
}) {
  if (!options.seed.trim())
    throw new Error("A non-empty randomization seed is required.");
  if (
    !Number.isInteger(options.repetitions) ||
    options.repetitions < 1 ||
    options.repetitions > 99
  ) {
    throw new Error("Repetitions must be an integer from 1 through 99.");
  }
  const tasks = options.tasks ?? experimentTaskIds;
  const conditions = options.conditions ?? experimentConditions;
  const random = mulberry32(seedToUint32(options.seed));
  const entries: RunPlanEntry[] = [];
  for (let repetition = 1; repetition <= options.repetitions; repetition += 1) {
    const block = tasks.flatMap((taskId) =>
      conditions.map((condition) => ({ taskId, condition })),
    );
    for (const item of shuffle(block, random)) {
      entries.push({
        ...item,
        repetition,
        runId: `${item.taskId}-${item.condition}-run${String(repetition).padStart(2, "0")}`,
        sequence: entries.length + 1,
      });
    }
  }
  const ids = entries.map(({ runId }) => runId);
  if (
    ids.some((id) => !runIdSchema.safeParse(id).success) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("Generated run IDs are invalid or duplicated.");
  }
  return {
    schemaVersion: 1 as const,
    seed: options.seed,
    repetitions: options.repetitions,
    entries,
  };
}

export function buildCodexArguments(options: {
  workspace: string;
  outputLastMessage: string;
  settings: FixedRunSettings;
}) {
  const { settings } = options;
  return [
    "--ask-for-approval",
    settings.approvalPolicy,
    "exec",
    "--json",
    "--ephemeral",
    "--strict-config",
    "--ignore-user-config",
    "--ignore-rules",
    "--color",
    "never",
    "--sandbox",
    settings.sandbox,
    "--cd",
    options.workspace,
    "--model",
    settings.model,
    "--config",
    `model_reasoning_effort=${JSON.stringify(settings.reasoningEffort)}`,
    "--config",
    `sandbox_workspace_write.network_access=${settings.networkAccess}`,
    "--config",
    `web_search=${JSON.stringify(settings.webSearch)}`,
    "--output-last-message",
    options.outputLastMessage,
    "-",
  ];
}

export async function runCommand(
  command: Command,
  options: {
    cwd: string;
    env?: Record<string, string | undefined>;
    stdin?: string;
    timeoutMs: number;
  },
): Promise<CommandResult> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: options.cwd,
      env: options.env as NodeJS.ProcessEnv | undefined,
      stdio: "pipe",
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        timedOut,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        durationMs: Date.now() - started,
      });
    });
    child.stdin.end(options.stdin);
  });
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOperatorTask(root: string, taskId: ExperimentTaskId) {
  return operatorTaskSchema.parse(
    JSON.parse(
      await readFile(
        path.join(root, "experiment/tasks/operator", `${taskId}.json`),
        "utf8",
      ),
    ),
  ) as OperatorTask;
}

async function gitCapture(root: string, args: string[]) {
  const result = await runCommand(
    { command: "git", args },
    { cwd: root, timeoutMs: 60_000 },
  );
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

export type ExperimentRunOptions = {
  repositoryRoot: string;
  assetRoot: string;
  workRoot: string;
  resultRoot: string;
  entry: RunPlanEntry;
  settings: FixedRunSettings;
  prepareCommands?: Command[];
  codexCommand?: string;
  codexArgs?: string[];
  codexVersion?: string;
  codexEnvironment?: Record<string, string | undefined>;
  skipAssetVerification?: boolean;
};

export async function runExperiment(options: ExperimentRunOptions) {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const workRoot = path.resolve(options.workRoot);
  const resultRoot = path.resolve(options.resultRoot);
  assertSafeExperimentRoots({ repositoryRoot, workRoot, resultRoot });
  runIdSchema.parse(options.entry.runId);

  const workspace = path.join(workRoot, options.entry.runId);
  const resultDirectory = path.join(resultRoot, options.entry.runId);
  const codexHome = path.join(workRoot, `${options.entry.runId}-codex-home`);
  for (const candidate of [workspace, resultDirectory, codexHome]) {
    if (await exists(candidate))
      throw new Error(`Run path already exists: ${candidate}`);
  }
  await Promise.all([
    mkdir(workRoot, { recursive: true }),
    mkdir(resultRoot, { recursive: true }),
  ]);
  await Promise.all([mkdir(resultDirectory), mkdir(codexHome)]);

  const task = await readOperatorTask(repositoryRoot, options.entry.taskId);
  const promptPath = path.join(
    repositoryRoot,
    "experiment/prompts",
    options.entry.condition,
    `${options.entry.taskId}.md`,
  );
  const prompt = await readFile(promptPath, "utf8");
  await copyFile(promptPath, path.join(resultDirectory, "prompt.md"));
  const startedAt = new Date().toISOString();
  const manifest: Record<string, unknown> = {
    schemaVersion: 1,
    ...options.entry,
    startingCommit: task.startingCommit,
    settings: options.settings,
    paths: { workspace, resultDirectory, codexHome },
    startedAt,
    status: "preparing",
  };
  const writeManifest = () =>
    writeFile(
      path.join(resultDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  await writeManifest();

  let codexResult: CommandResult | undefined;
  try {
    if (!options.skipAssetVerification) {
      await verifyTaskAssets(repositoryRoot, options.assetRoot);
    }
    await gitCapture(repositoryRoot, [
      "worktree",
      "add",
      "--detach",
      workspace,
      task.startingCommit,
    ]);

    const setupPatch = path.join(
      options.assetRoot,
      "tasks",
      task.id,
      "setup.patch",
    );
    if (await exists(setupPatch)) {
      await gitCapture(workspace, ["apply", "--whitespace=nowarn", setupPatch]);
    }
    const prepareCommands = options.prepareCommands ?? [
      { command: "pnpm", args: ["install", "--frozen-lockfile"] },
      { command: "pnpm", args: ["db:reset"] },
    ];
    const preparation: Array<Command & CommandResult> = [];
    for (const command of prepareCommands) {
      const result = await runCommand(command, {
        cwd: workspace,
        timeoutMs: options.settings.timeoutMs,
      });
      preparation.push({ ...command, ...result });
      await writeFile(
        path.join(resultDirectory, "preparation.json"),
        `${JSON.stringify(preparation, null, 2)}\n`,
      );
      if (result.exitCode !== 0 || result.timedOut) {
        throw new Error(
          `Preparation command failed: ${command.command} ${command.args.join(" ")}`,
        );
      }
    }
    if (prepareCommands.length === 0) {
      await writeFile(
        path.join(resultDirectory, "preparation.json"),
        `${JSON.stringify(preparation, null, 2)}\n`,
      );
    }

    const agentsRecordPath = path.join(
      resultDirectory,
      "agents-condition.json",
    );
    await configureAgentCondition({
      root: repositoryRoot,
      workspace,
      codexHome,
      recordPath: agentsRecordPath,
      condition: options.entry.condition as AgentCondition,
      apply: true,
    });
    const agentsPath = path.join(workspace, "AGENTS.md");
    if (await exists(agentsPath)) {
      await copyFile(agentsPath, path.join(resultDirectory, "agents.md"));
    }

    await gitCapture(workspace, ["add", "--all"]);
    await gitCapture(workspace, [
      "-c",
      "user.name=Codex Experiment Runner",
      "-c",
      "user.email=experiment-runner@invalid.local",
      "commit",
      "--allow-empty",
      "--no-gpg-sign",
      "--quiet",
      "-m",
      `Prepare ${options.entry.runId}`,
    ]);
    manifest.preparedCommit = (
      await gitCapture(workspace, ["rev-parse", "HEAD"])
    ).trim();

    manifest.status = "running";
    await writeManifest();
    const outputLastMessage = path.join(resultDirectory, "last-message.txt");
    const codexCommand = options.codexCommand ?? "codex";
    if (options.codexVersion) {
      manifest.codexCliVersion = options.codexVersion;
    } else {
      const version = await runCommand(
        { command: codexCommand, args: ["--version"] },
        { cwd: workspace, timeoutMs: 30_000 },
      );
      if (version.exitCode !== 0 || version.timedOut) {
        throw new Error(
          `Unable to record Codex CLI version: ${version.stderr.trim()}`,
        );
      }
      manifest.codexCliVersion = version.stdout.trim();
    }
    const codexArgs =
      options.codexArgs ??
      buildCodexArguments({
        workspace,
        outputLastMessage,
        settings: options.settings,
      });
    await Promise.all([
      writeFile(path.join(resultDirectory, "codex.jsonl"), ""),
      writeFile(path.join(resultDirectory, "stderr.log"), ""),
    ]);
    codexResult = await runCommand(
      { command: codexCommand, args: codexArgs },
      {
        cwd: workspace,
        env: {
          ...process.env,
          ...options.codexEnvironment,
          CODEX_HOME: codexHome,
        },
        stdin: prompt,
        timeoutMs: options.settings.timeoutMs,
      },
    );
    await Promise.all([
      writeFile(path.join(resultDirectory, "codex.jsonl"), codexResult.stdout),
      writeFile(path.join(resultDirectory, "stderr.log"), codexResult.stderr),
    ]);
    manifest.status = codexResult.timedOut
      ? "timed-out"
      : codexResult.exitCode === 0
        ? "completed"
        : "failed";
    manifest.execution = {
      command: codexCommand,
      args: codexArgs,
      exitCode: codexResult.exitCode,
      signal: codexResult.signal,
      timedOut: codexResult.timedOut,
      durationMs: codexResult.durationMs,
    };
  } catch (error) {
    manifest.status = "failed";
    manifest.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (await exists(workspace)) {
      const [diff, status] = await Promise.all([
        gitCapture(workspace, ["diff", "--binary", "--no-ext-diff", "HEAD"]),
        gitCapture(workspace, [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ]),
      ]);
      await Promise.all([
        writeFile(path.join(resultDirectory, "diff.patch"), diff),
        writeFile(path.join(resultDirectory, "git-status.txt"), status),
      ]);
    }
    manifest.finishedAt = new Date().toISOString();
    await writeManifest();
  }
  return {
    runId: options.entry.runId,
    status: manifest.status,
    workspace,
    resultDirectory,
    exitCode: codexResult?.exitCode ?? null,
    timedOut: codexResult?.timedOut ?? false,
  };
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const command = process.argv[2];
  if (command === "plan") {
    const seed = option("--seed");
    const output = option("--output");
    const repetitions = Number(option("--repetitions") ?? "5");
    if (!seed || !output) {
      console.error(
        "usage: tsx scripts/experiment-runner.ts plan --seed <seed> --output <outside-repo.json> [--repetitions 5]",
      );
      process.exitCode = 1;
    } else {
      const resolvedOutput = path.resolve(output);
      if (isInside(process.cwd(), resolvedOutput)) {
        throw new Error(
          "Run plans must be written outside the source repository.",
        );
      }
      const plan = createRunPlan({ seed, repetitions });
      await mkdir(path.dirname(resolvedOutput), { recursive: true });
      await writeFile(resolvedOutput, `${JSON.stringify(plan, null, 2)}\n`, {
        flag: "wx",
      });
      console.log(
        JSON.stringify({
          output: resolvedOutput,
          runs: plan.entries.length,
          seed,
        }),
      );
    }
  } else if (command === "run") {
    const taskId = z.enum(experimentTaskIds).parse(option("--task"));
    const condition = z.enum(experimentConditions).parse(option("--condition"));
    const repetition = z.coerce
      .number()
      .int()
      .min(1)
      .max(99)
      .parse(option("--repetition"));
    const model = z.string().min(1).parse(option("--model"));
    const reasoningEffort = z
      .enum(["minimal", "low", "medium", "high", "xhigh"])
      .parse(option("--reasoning-effort"));
    const timeoutMinutes = z.coerce
      .number()
      .positive()
      .parse(option("--timeout-minutes"));
    const workRoot = z.string().min(1).parse(option("--work-root"));
    const resultRoot = z.string().min(1).parse(option("--result-root"));
    const assetRoot = z
      .string()
      .min(1)
      .parse(option("--asset-root") ?? process.env.EXPERIMENT_ASSET_ROOT);
    const entry: RunPlanEntry = {
      taskId,
      condition,
      repetition,
      runId: `${taskId}-${condition}-run${String(repetition).padStart(2, "0")}`,
      sequence: 1,
    };
    const result = await runExperiment({
      repositoryRoot: process.cwd(),
      assetRoot,
      workRoot,
      resultRoot,
      entry,
      settings: {
        model,
        reasoningEffort,
        sandbox: "workspace-write",
        networkAccess: false,
        webSearch: "disabled",
        approvalPolicy: "never",
        timeoutMs: Math.round(timeoutMinutes * 60_000),
      },
    });
    console.log(JSON.stringify(result));
    if (result.status !== "completed") process.exitCode = 1;
  } else {
    console.error(`usage:
  tsx scripts/experiment-runner.ts plan --seed <seed> --output <outside-repo.json> [--repetitions 5]
  tsx scripts/experiment-runner.ts run --task <id> --condition <P0|P1|P2> --repetition <1-99> --model <model> --reasoning-effort <effort> --timeout-minutes <n> --work-root <outside-repo> --result-root <outside-repo> [--asset-root <private-repo>]`);
    process.exitCode = 1;
  }
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
