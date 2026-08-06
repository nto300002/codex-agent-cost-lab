import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

const taskIds = ["GA-F1", "GA-I1", "GB-F1", "GB-I1", "GC-F1", "GC-I1"] as const;
const conditions = ["P0", "P1", "P2"] as const;

const manifestSchema = z.object({
  runId: z.string().regex(/^(GA|GB|GC)-(F1|I1)-P[0-2]-run\d{2}$/),
  taskId: z.enum(taskIds),
  condition: z.enum(conditions),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  settings: z.object({
    model: z.string(),
    reasoningEffort: z.string(),
  }),
  codexCliVersion: z.string().optional(),
  execution: z.object({ durationMs: z.number().nonnegative() }).optional(),
  paths: z.object({ workspace: z.string() }).optional(),
});

const operatorTaskSchema = z.object({
  id: z.enum(taskIds),
  granularity: z.enum(["G-A", "G-B", "G-C"]),
  type: z.enum(["fix", "implementation"]),
});

type Manifest = z.infer<typeof manifestSchema>;
type JsonRecord = Record<string, unknown>;

type ParseDiagnostic = {
  line: number;
  kind: "invalid_json" | "invalid_event" | "invalid_usage";
  message: string;
  raw?: string;
};

type TrackedItem = {
  key: string;
  id: string;
  type: string;
  threadId: string;
  completed: boolean;
  item: JsonRecord;
};

export type CodexTraceMetrics = {
  inputTokens: number;
  cachedInputTokens: number;
  uncachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  commandCount: number;
  explicitFileReferences: string[];
  explicitFileReferencesTotal: number;
  duplicateFileReferences: number;
  repositoryWideSearches: number;
  testRunsTotal: number;
  fullTestRuns: number;
  changedFilePaths: string[];
  linesAdded: number;
  linesDeleted: number;
  threadIds: string[];
  turnsCompleted: number;
  turnsFailed: number;
  errors: number;
  unknownEvents: Record<string, number>;
  diagnostics: ParseDiagnostic[];
  incompleteItems: Array<{ id: string; type: string; threadId: string }>;
  incompleteTurns: number;
};

const knownEventTypes = new Set([
  "thread.started",
  "turn.started",
  "turn.completed",
  "turn.failed",
  "item.started",
  "item.updated",
  "item.completed",
  "error",
]);

const knownItemTypes = new Set([
  "agent_message",
  "reasoning",
  "command_execution",
  "file_change",
  "mcp_tool_call",
  "web_search",
  "plan_update",
  "collaboration_tool_call",
]);

function record(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function nonNegativeInteger(
  usage: JsonRecord,
  field: string,
  line: number,
  diagnostics: ParseDiagnostic[],
) {
  const value = usage[field];
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  diagnostics.push({
    line,
    kind: "invalid_usage",
    message: `${field} must be a non-negative integer; received ${String(value)}`,
  });
  return 0;
}

function shellTokens(command: string) {
  return [...command.matchAll(/"([^"]*)"|'([^']*)'|([^\s|;&<>]+)/g)].map(
    (match) => match[1] ?? match[2] ?? match[3],
  );
}

function normalizeReference(token: string, workspace?: string) {
  let candidate = token
    .replace(/^[([{,]+|[\])},]+$/g, "")
    .replace(/:\d+(?::\d+)?$/, "");
  if (workspace && path.isAbsolute(candidate)) {
    const relative = path.relative(workspace, candidate);
    if (!relative.startsWith(`..${path.sep}`) && relative !== "..") {
      candidate = relative;
    }
  }
  candidate = candidate.replace(/^\.\//, "");
  if (
    !candidate ||
    candidate.startsWith("-") ||
    candidate.includes("://") ||
    candidate.includes("*") ||
    path.isAbsolute(candidate) ||
    candidate.split("/").includes("..")
  ) {
    return undefined;
  }
  const basename = path.basename(candidate);
  if (!/^[\w.@+-]+\.[A-Za-z0-9]+$/.test(basename)) return undefined;
  return candidate;
}

export function extractFileReferences(command: string, workspace?: string) {
  const references: string[] = [];
  for (const token of shellTokens(command)) {
    const normalized = normalizeReference(token, workspace);
    if (normalized) references.push(normalized);
  }
  return references;
}

function isRepositoryWideSearch(command: string) {
  return (
    /(?:^|[;&|]\s*)rg(?:\s|$)/.test(command) ||
    /\bgit\s+grep\b/.test(command) ||
    /\bgrep\b[^\n]*(?:\s-R\b|\s-r\b|--recursive)/.test(command) ||
    /(?:^|[;&|]\s*)find\s+(?:\.|[^\s]+)/.test(command)
  );
}

function isTestCommand(command: string) {
  return /(?:\b(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?test(?:\b|:)|\b(?:vitest|jest|pytest|playwright\s+test|cargo\s+test|go\s+test)\b)/.test(
    command,
  );
}

function isFullTestCommand(command: string) {
  const trimmed = command.trim();
  return (
    /^(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?test$/.test(trimmed) ||
    /^(?:cargo\s+test|pytest|vitest\s+run|jest)$/.test(trimmed) ||
    /^go\s+test\s+\.\/\.\.\.$/.test(trimmed)
  );
}

export function parseUnifiedDiff(diff: string) {
  const changedFiles = new Set<string>();
  let linesAdded = 0;
  let linesDeleted = 0;
  let insideHunk = false;
  for (const line of diff.split(/\r?\n/)) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (header) {
      changedFiles.add(header[2]);
      insideHunk = false;
      continue;
    }
    if (line.startsWith("@@")) {
      insideHunk = true;
      continue;
    }
    if (!insideHunk) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) linesAdded += 1;
    if (line.startsWith("-") && !line.startsWith("---")) linesDeleted += 1;
  }
  return {
    changedFilePaths: [...changedFiles].sort(),
    linesAdded,
    linesDeleted,
  };
}

function itemChanges(item: JsonRecord) {
  const candidates = [item.changes, item.file_changes, item.files];
  const paths: string[] = [];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const change of candidate) {
      if (typeof change === "string") paths.push(change);
      else {
        const value = record(change)?.path;
        if (typeof value === "string") paths.push(value);
      }
    }
  }
  return paths;
}

export function parseCodexJsonl(options: {
  jsonl: string;
  diff?: string;
  workspace?: string;
}): CodexTraceMetrics {
  const diagnostics: ParseDiagnostic[] = [];
  const unknownEvents: Record<string, number> = {};
  const threadIds = new Set<string>();
  const items = new Map<string, TrackedItem>();
  const fileChangePaths = new Set<string>();
  let currentThread = "unassigned";
  let turnsStarted = 0;
  let turnsCompleted = 0;
  let turnsFailed = 0;
  let errors = 0;
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  let reasoningOutputTokens = 0;

  const lines = options.jsonl.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    if (!raw.trim()) continue;
    let event: JsonRecord;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const parsedRecord = record(parsed);
      if (!parsedRecord) throw new Error("event must be a JSON object");
      event = parsedRecord;
    } catch (error) {
      diagnostics.push({
        line: index + 1,
        kind: "invalid_json",
        message: error instanceof Error ? error.message : String(error),
        raw,
      });
      continue;
    }
    const type = event.type;
    if (typeof type !== "string") {
      diagnostics.push({
        line: index + 1,
        kind: "invalid_event",
        message: "event.type must be a string",
        raw,
      });
      continue;
    }
    if (!knownEventTypes.has(type)) {
      unknownEvents[type] = (unknownEvents[type] ?? 0) + 1;
      continue;
    }
    if (type === "thread.started") {
      const threadId = event.thread_id;
      if (typeof threadId === "string") {
        currentThread = threadId;
        threadIds.add(threadId);
      } else {
        diagnostics.push({
          line: index + 1,
          kind: "invalid_event",
          message: "thread.started requires thread_id",
        });
      }
      continue;
    }
    if (type === "turn.started") {
      turnsStarted += 1;
      continue;
    }
    if (type === "turn.failed") {
      turnsFailed += 1;
      continue;
    }
    if (type === "error") {
      errors += 1;
      continue;
    }
    if (type === "turn.completed") {
      turnsCompleted += 1;
      const usage = record(event.usage);
      if (!usage) {
        diagnostics.push({
          line: index + 1,
          kind: "invalid_usage",
          message: "turn.completed requires a usage object",
        });
        continue;
      }
      inputTokens += nonNegativeInteger(
        usage,
        "input_tokens",
        index + 1,
        diagnostics,
      );
      cachedInputTokens += nonNegativeInteger(
        usage,
        "cached_input_tokens",
        index + 1,
        diagnostics,
      );
      outputTokens += nonNegativeInteger(
        usage,
        "output_tokens",
        index + 1,
        diagnostics,
      );
      reasoningOutputTokens += nonNegativeInteger(
        usage,
        "reasoning_output_tokens",
        index + 1,
        diagnostics,
      );
      continue;
    }
    const item = record(event.item);
    if (!item || typeof item.id !== "string" || typeof item.type !== "string") {
      diagnostics.push({
        line: index + 1,
        kind: "invalid_event",
        message: `${type} requires item.id and item.type`,
      });
      continue;
    }
    if (!knownItemTypes.has(item.type)) {
      const unknownType = `item.${item.type}`;
      unknownEvents[unknownType] = (unknownEvents[unknownType] ?? 0) + 1;
    }
    const key = `${currentThread}:${item.id}`;
    const previous = items.get(key);
    items.set(key, {
      key,
      id: item.id,
      type: item.type,
      threadId: currentThread,
      completed: type === "item.completed" || previous?.completed === true,
      item: { ...previous?.item, ...item },
    });
  }

  const commands: string[] = [];
  for (const tracked of items.values()) {
    if (
      tracked.type === "command_execution" &&
      typeof tracked.item.command === "string"
    ) {
      commands.push(tracked.item.command);
    }
    if (tracked.type === "file_change") {
      for (const filePath of itemChanges(tracked.item))
        fileChangePaths.add(filePath);
    }
  }
  const references = commands.flatMap((command) =>
    extractFileReferences(command, options.workspace),
  );
  const uniqueReferences = [...new Set(references)].sort();
  const diffMetrics = options.diff
    ? parseUnifiedDiff(options.diff)
    : {
        changedFilePaths: [...fileChangePaths].sort(),
        linesAdded: 0,
        linesDeleted: 0,
      };
  if (cachedInputTokens > inputTokens) {
    diagnostics.push({
      line: 0,
      kind: "invalid_usage",
      message: `cached input total exceeds input total: ${cachedInputTokens} > ${inputTokens}`,
    });
  }
  return {
    inputTokens,
    cachedInputTokens,
    uncachedInputTokens: Math.max(0, inputTokens - cachedInputTokens),
    outputTokens,
    reasoningOutputTokens,
    commandCount: commands.length,
    explicitFileReferences: uniqueReferences,
    explicitFileReferencesTotal: references.length,
    duplicateFileReferences: references.length - uniqueReferences.length,
    repositoryWideSearches: commands.filter(isRepositoryWideSearch).length,
    testRunsTotal: commands.filter(isTestCommand).length,
    fullTestRuns: commands.filter(isFullTestCommand).length,
    ...diffMetrics,
    threadIds: [...threadIds].sort(),
    turnsCompleted,
    turnsFailed,
    errors,
    unknownEvents,
    diagnostics,
    incompleteItems: [...items.values()]
      .filter(({ completed }) => !completed)
      .map(({ id, type, threadId }) => ({ id, type, threadId })),
    incompleteTurns: Math.max(0, turnsStarted - turnsCompleted - turnsFailed),
  };
}

export async function createRunJson(options: {
  root: string;
  manifest: Manifest;
  jsonl: string;
  diff?: string;
}) {
  const manifest = manifestSchema.parse(options.manifest);
  const task = operatorTaskSchema.parse(
    JSON.parse(
      await readFile(
        path.join(
          options.root,
          "experiment/tasks/operator",
          `${manifest.taskId}.json`,
        ),
        "utf8",
      ),
    ),
  );
  const trace = parseCodexJsonl({
    jsonl: options.jsonl,
    diff: options.diff,
    workspace: manifest.paths?.workspace,
  });
  const durationSeconds = manifest.execution
    ? manifest.execution.durationMs / 1_000
    : manifest.finishedAt
      ? Math.max(
          0,
          (Date.parse(manifest.finishedAt) - Date.parse(manifest.startedAt)) /
            1_000,
        )
      : 0;
  return {
    schema_version: 1,
    run_id: manifest.runId,
    task_id: manifest.taskId,
    granularity: task.granularity,
    task_type: task.type,
    prompt_condition: manifest.condition,
    codex_cli_version: manifest.codexCliVersion ?? "",
    model: manifest.settings.model,
    reasoning_effort: manifest.settings.reasoningEffort,
    input_tokens: trace.inputTokens,
    cached_input_tokens: trace.cachedInputTokens,
    uncached_input_tokens: trace.uncachedInputTokens,
    output_tokens: trace.outputTokens,
    reasoning_output_tokens: trace.reasoningOutputTokens,
    credits: 0,
    duration_seconds: durationSeconds,
    command_count: trace.commandCount,
    explicit_file_references_total: trace.explicitFileReferencesTotal,
    explicit_file_references_unique: trace.explicitFileReferences.length,
    duplicate_file_references: trace.duplicateFileReferences,
    repository_wide_searches: trace.repositoryWideSearches,
    test_runs_total: trace.testRunsTotal,
    full_test_runs: trace.fullTestRuns,
    changed_files: trace.changedFilePaths.length,
    lines_added: trace.linesAdded,
    lines_deleted: trace.linesDeleted,
    success: false,
    quality_score: 0,
    forbidden_change: false,
    human_fix_minutes: 0,
    parser: {
      thread_ids: trace.threadIds,
      turns_completed: trace.turnsCompleted,
      turns_failed: trace.turnsFailed,
      error_events: trace.errors,
      explicit_file_references: trace.explicitFileReferences,
      changed_file_paths: trace.changedFilePaths,
      unknown_events: trace.unknownEvents,
      diagnostics: trace.diagnostics,
      incomplete_items: trace.incompleteItems,
      incomplete_turns: trace.incompleteTurns,
    },
  };
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const jsonlPath = option("--jsonl");
  const manifestPath = option("--manifest");
  const diffPath = option("--diff");
  const outputPath = option("--output");
  if (!jsonlPath || !manifestPath || !outputPath) {
    throw new Error(
      "usage: tsx scripts/parse-codex-jsonl.ts --jsonl <codex.jsonl> --manifest <manifest.json> [--diff <diff.patch>] --output <run.json>",
    );
  }
  const result = await createRunJson({
    root: process.cwd(),
    manifest: JSON.parse(await readFile(manifestPath, "utf8")) as Manifest,
    jsonl: await readFile(jsonlPath, "utf8"),
    diff: diffPath ? await readFile(diffPath, "utf8") : undefined,
  });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
    flag: "wx",
  });
  console.log(
    JSON.stringify({ output: path.resolve(outputPath), runId: result.run_id }),
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
