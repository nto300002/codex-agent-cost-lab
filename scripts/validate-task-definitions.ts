import { execFile as execFileCallback } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { z } from "zod";

const execFile = promisify(execFileCallback);

const taskIds = ["GA-F1", "GA-I1", "GB-F1", "GB-I1", "GC-F1", "GC-I1"] as const;
const taskIdSchema = z.enum(taskIds);
const layerSchema = z.enum([
  "domain",
  "application",
  "infrastructure",
  "http",
  "presentation",
]);

const operatorTaskSchema = z.object({
  schemaVersion: z.literal(1),
  id: taskIdSchema,
  granularity: z.enum(["G-A", "G-B", "G-C"]),
  type: z.enum(["fix", "implementation"]),
  title: z.string().min(1),
  startingCommit: z.string().regex(/^[0-9a-f]{40}$/),
  publicBrief: z.string().regex(/^experiment\/tasks\/public\/[A-Z0-9-]+\.md$/),
  targetModule: z.string().min(1),
  reproductionSteps: z.array(z.string().min(1)).min(1),
  scope: z.object({
    fileRange: z.object({
      min: z.number().int().positive(),
      max: z.number().int().positive(),
    }),
    expectedRelevantFiles: z.array(z.string().min(1)).min(1),
    layers: z.array(layerSchema).min(1),
    rationale: z.string().min(1),
  }),
  acceptanceCriteriaCount: z.number().int().positive(),
  forbiddenChanges: z.array(z.string().min(1)).min(1),
  humanBaseline: z.object({
    minMinutes: z.number().int().positive(),
    maxMinutes: z.number().int().positive(),
    measurement: z.string().min(1),
  }),
  independence: z.object({
    setupStrategy: z.literal("fresh-workspace-from-shared-baseline"),
    resetCommand: z.literal("git reset --hard <startingCommit>"),
    notes: z.string().min(1),
  }),
  validationCommands: z.array(z.string().min(1)).min(1),
});

export type OperatorTask = z.infer<typeof operatorTaskSchema>;

const granularityRules = {
  "G-A": { idPrefix: "GA-", files: [1, 3], layers: [1, 1], minutes: [15, 30] },
  "G-B": { idPrefix: "GB-", files: [4, 8], layers: [2, 3], minutes: [60, 120] },
  "G-C": {
    idPrefix: "GC-",
    files: [9, 20],
    layers: [3, 5],
    minutes: [180, 240],
  },
} as const;

function sectionBullets(markdown: string, heading: string) {
  const marker = `## ${heading}`;
  const markerIndex = markdown.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Public brief is missing section: ${heading}`);
  }
  const sectionStart = markerIndex + marker.length;
  const remaining = markdown.slice(sectionStart);
  const nextHeading = remaining.search(/^## /m);
  const section =
    nextHeading === -1 ? remaining : remaining.slice(0, nextHeading);
  return [...section.matchAll(/^- (.+)$/gm)].map((entry) => entry[1]);
}

function validatePublicBrief(task: OperatorTask, markdown: string) {
  if (!markdown.startsWith(`# ${task.id}: `)) {
    throw new Error(`${task.id}: public brief heading does not match task id.`);
  }
  for (const heading of [
    "Request",
    "Acceptance criteria",
    "Constraints",
    "Validation",
  ]) {
    const bullets = sectionBullets(markdown, heading);
    if (bullets.length === 0) {
      throw new Error(`${task.id}: ${heading} requires at least one bullet.`);
    }
  }
  const acceptanceCount = sectionBullets(
    markdown,
    "Acceptance criteria",
  ).length;
  if (acceptanceCount !== task.acceptanceCriteriaCount) {
    throw new Error(
      `${task.id}: acceptance count is ${acceptanceCount}; operator definition says ${task.acceptanceCriteriaCount}.`,
    );
  }
  const operatorOnlyTerms = [
    "Expected relevant files",
    "Hidden evaluation",
    "Notes for experiment operator",
    "reference.patch",
    "starting commit",
  ];
  const leaked = operatorOnlyTerms.find((term) =>
    markdown.toLowerCase().includes(term.toLowerCase()),
  );
  if (leaked) {
    throw new Error(
      `${task.id}: operator-only term leaked to public brief: ${leaked}`,
    );
  }
}

function validateGranularity(task: OperatorTask) {
  const rule = granularityRules[task.granularity];
  if (!task.id.startsWith(rule.idPrefix)) {
    throw new Error(`${task.id}: id and granularity disagree.`);
  }
  const { min, max } = task.scope.fileRange;
  const [minFiles, maxFiles] = rule.files;
  if (min < minFiles || max > maxFiles || min > max) {
    throw new Error(`${task.id}: file range does not fit ${task.granularity}.`);
  }
  if (
    task.scope.expectedRelevantFiles.length < min ||
    task.scope.expectedRelevantFiles.length > max
  ) {
    throw new Error(
      `${task.id}: expected file list is outside its declared range.`,
    );
  }
  const [minLayers, maxLayers] = rule.layers;
  const uniqueLayers = new Set(task.scope.layers);
  if (uniqueLayers.size < minLayers || uniqueLayers.size > maxLayers) {
    throw new Error(
      `${task.id}: layer count does not fit ${task.granularity}.`,
    );
  }
  const [minMinutes, maxMinutes] = rule.minutes;
  if (
    task.humanBaseline.minMinutes < minMinutes ||
    task.humanBaseline.maxMinutes > maxMinutes ||
    task.humanBaseline.minMinutes > task.humanBaseline.maxMinutes
  ) {
    throw new Error(
      `${task.id}: human baseline does not fit ${task.granularity}.`,
    );
  }
}

export async function validateTaskDefinitions(root = process.cwd()) {
  const operatorDirectory = path.join(root, "experiment/tasks/operator");
  const files = (await readdir(operatorDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (files.length !== taskIds.length) {
    throw new Error(
      `Expected ${taskIds.length} operator definitions; found ${files.length}.`,
    );
  }

  const tasks: OperatorTask[] = [];
  for (const file of files) {
    const task = operatorTaskSchema.parse(
      JSON.parse(await readFile(path.join(operatorDirectory, file), "utf8")),
    );
    if (file !== `${task.id}.json`) {
      throw new Error(`${file}: filename does not match ${task.id}.`);
    }
    validateGranularity(task);
    const publicPath = path.join(root, task.publicBrief);
    validatePublicBrief(task, await readFile(publicPath, "utf8"));
    tasks.push(task);
  }

  const actualIds = [...new Set(tasks.map(({ id }) => id))].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify([...taskIds].sort())) {
    throw new Error(
      `Task matrix is incomplete or contains duplicate ids: ${actualIds.join(", ")}`,
    );
  }
  if (new Set(tasks.map(({ startingCommit }) => startingCommit)).size !== 1) {
    throw new Error("Every task must use the same starting commit.");
  }
  const startingCommit = tasks[0].startingCommit;
  try {
    await execFile("git", ["cat-file", "-e", `${startingCommit}^{commit}`], {
      cwd: root,
    });
  } catch {
    throw new Error(
      `Shared starting commit is not available: ${startingCommit}`,
    );
  }
  for (const task of tasks) {
    for (const filePath of task.scope.expectedRelevantFiles) {
      try {
        await execFile(
          "git",
          ["cat-file", "-e", `${startingCommit}:${filePath}`],
          {
            cwd: root,
          },
        );
      } catch {
        throw new Error(
          `${task.id}: expected relevant file is absent from the starting commit: ${filePath}`,
        );
      }
    }
  }
  for (const granularity of ["G-A", "G-B", "G-C"] as const) {
    const types = tasks
      .filter((task) => task.granularity === granularity)
      .map(({ type }) => type)
      .sort();
    if (JSON.stringify(types) !== JSON.stringify(["fix", "implementation"])) {
      throw new Error(
        `${granularity} must contain one fix and one implementation task.`,
      );
    }
  }

  return {
    count: tasks.length,
    startingCommit,
    tasks: tasks.map(
      ({ id, granularity, type, acceptanceCriteriaCount, scope }) => ({
        id,
        granularity,
        type,
        files: scope.fileRange,
        layers: scope.layers.length,
        acceptanceCriteria: acceptanceCriteriaCount,
      }),
    ),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  validateTaskDefinitions()
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
