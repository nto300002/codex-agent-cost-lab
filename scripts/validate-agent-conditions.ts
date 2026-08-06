import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const requiredMinimalHeadings = [
  "Technology",
  "Responsibilities",
  "Official commands",
  "Forbidden areas",
  "Stop conditions",
];
const taskIds = ["GA-F1", "GA-I1", "GB-F1", "GB-I1", "GC-F1", "GC-I1"];

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export async function expectedAgentManifest(root: string) {
  const agentRoot = path.join(root, "experiment/agents");
  const [minimal, verbose] = await Promise.all([
    readFile(path.join(agentRoot, "minimal-AGENTS.md"), "utf8"),
    readFile(path.join(agentRoot, "verbose-AGENTS.md"), "utf8"),
  ]);
  return {
    schemaVersion: 1,
    conditions: {
      P0: { template: null, sha256: null },
      P1: { template: null, sha256: null },
      P2: { template: "minimal-AGENTS.md", sha256: sha256(minimal) },
      P3: { template: "verbose-AGENTS.md", sha256: sha256(verbose) },
    },
  };
}

export async function validateAgentConditions(root = process.cwd()) {
  const agentRoot = path.join(root, "experiment/agents");
  const [minimal, verbose, manifestText] = await Promise.all([
    readFile(path.join(agentRoot, "minimal-AGENTS.md"), "utf8"),
    readFile(path.join(agentRoot, "verbose-AGENTS.md"), "utf8"),
    readFile(path.join(agentRoot, "manifest.json"), "utf8"),
  ]);
  const minimalHeadings = [...minimal.matchAll(/^## (.+)$/gm)].map(
    (match) => match[1],
  );
  if (
    JSON.stringify(minimalHeadings) !== JSON.stringify(requiredMinimalHeadings)
  ) {
    throw new Error(
      "Minimal AGENTS.md must contain only the five required sections.",
    );
  }
  if (minimal.split("\n").length > 60) {
    throw new Error("Minimal AGENTS.md is too long.");
  }
  if (verbose.length < minimal.length * 2.5) {
    throw new Error("Verbose AGENTS.md is not materially larger than minimal.");
  }
  for (const taskId of taskIds) {
    if (minimal.includes(taskId) || verbose.includes(taskId)) {
      throw new Error(
        `Task-specific information leaked into AGENTS template: ${taskId}`,
      );
    }
  }
  const expected = await expectedAgentManifest(root);
  const actual = JSON.parse(manifestText);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("AGENTS condition manifest or template hash is stale.");
  }
  return {
    conditions: 4,
    minimalLines: minimal.split("\n").length,
    verboseLines: verbose.split("\n").length,
    p2Hash: expected.conditions.P2.sha256,
    p3Hash: expected.conditions.P3.sha256,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  validateAgentConditions()
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
