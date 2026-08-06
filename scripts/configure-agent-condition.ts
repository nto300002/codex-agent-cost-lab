import { access, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { sha256 } from "./validate-agent-conditions";

export type AgentCondition = "P0" | "P1" | "P2" | "P3";
type ConditionManifest = {
  schemaVersion: 1;
  conditions: Record<
    AgentCondition,
    { template: string | null; sha256: string | null }
  >;
};

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileHash(filePath: string) {
  return (await exists(filePath)) ? sha256(await readFile(filePath)) : null;
}

export function assertRecordOutsideWorkspace(
  workspace: string,
  recordPath: string,
) {
  const relative = path.relative(workspace, recordPath);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  ) {
    throw new Error(
      "AGENTS condition record must be outside the experiment workspace.",
    );
  }
}

export function assertIsolatedWorkspace(
  repositoryRoot: string,
  workspace: string,
) {
  const relative = path.relative(repositoryRoot, workspace);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  ) {
    throw new Error(
      "AGENTS conditions may only be applied to an isolated workspace outside the source repository.",
    );
  }
}

export async function findAgentContamination(
  workspace: string,
  codexHome: string,
) {
  const candidates = [
    path.join(codexHome, "AGENTS.md"),
    path.join(codexHome, "AGENTS.override.md"),
  ];
  let directory = path.dirname(workspace);
  while (true) {
    candidates.push(path.join(directory, "AGENTS.md"));
    candidates.push(path.join(directory, "AGENTS.override.md"));
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  const contamination: string[] = [];
  for (const candidate of new Set(candidates)) {
    if (await exists(candidate)) contamination.push(candidate);
  }
  return contamination.sort();
}

export async function configureAgentCondition(options: {
  root: string;
  workspace: string;
  codexHome: string;
  recordPath: string;
  condition: AgentCondition;
  apply: boolean;
}) {
  const root = path.resolve(options.root);
  const workspace = path.resolve(options.workspace);
  const codexHome = path.resolve(options.codexHome);
  const recordPath = path.resolve(options.recordPath);
  assertIsolatedWorkspace(root, workspace);
  assertRecordOutsideWorkspace(workspace, recordPath);
  assertRecordOutsideWorkspace(workspace, codexHome);

  const contamination = await findAgentContamination(workspace, codexHome);
  if (contamination.length > 0) {
    throw new Error(
      `External AGENTS.md contamination: ${contamination.join(", ")}`,
    );
  }
  const manifest = JSON.parse(
    await readFile(path.join(root, "experiment/agents/manifest.json"), "utf8"),
  ) as ConditionManifest;
  const selected = manifest.conditions[options.condition];
  if (!selected)
    throw new Error(`Unknown AGENTS condition: ${options.condition}`);

  const agentPath = path.join(workspace, "AGENTS.md");
  const overridePath = path.join(workspace, "AGENTS.override.md");
  const beforeHash = await fileHash(agentPath);
  if (options.apply) {
    if (await exists(agentPath)) await unlink(agentPath);
    if (await exists(overridePath)) await unlink(overridePath);
    if (selected.template) {
      const template = await readFile(
        path.join(root, "experiment/agents", selected.template),
        "utf8",
      );
      await writeFile(agentPath, template);
    }
  }

  const afterHash = await fileHash(agentPath);
  const overrideExists = await exists(overridePath);
  if (afterHash !== selected.sha256 || overrideExists) {
    throw new Error(
      `${options.condition}: unexpected project AGENTS state; expected ${selected.sha256 ?? "absent"}, found ${afterHash ?? "absent"}`,
    );
  }
  const record = {
    schemaVersion: 1,
    condition: options.condition,
    workspace,
    codexHome,
    applied: options.apply,
    beforeHash,
    afterHash,
    expectedHash: selected.sha256,
    externalAgentFiles: contamination,
  };
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const condition = option("--condition") as AgentCondition | undefined;
  const workspace = option("--workspace");
  const codexHome = option("--codex-home");
  const recordPath = option("--record");
  if (!condition || !workspace || !codexHome || !recordPath) {
    console.error(
      "usage: tsx scripts/configure-agent-condition.ts --condition <P0|P1|P2|P3> --workspace <path> --codex-home <path> --record <outside-path> [--apply]",
    );
    process.exitCode = 1;
  } else {
    configureAgentCondition({
      root: process.cwd(),
      workspace,
      codexHome,
      recordPath,
      condition,
      apply: process.argv.includes("--apply"),
    })
      .then((record) => console.log(JSON.stringify(record, null, 2)))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      });
  }
}
