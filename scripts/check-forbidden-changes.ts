import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const execFile = promisify(execFileCallback);

const skippedWalkDirectories = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "generated",
  "node_modules",
  "out",
  "playwright-report",
  "test-results",
]);

const generatedSegments = new Set([
  ".next",
  "build",
  "coverage",
  "generated",
  "out",
  "playwright-report",
  "test-results",
]);

const hiddenAssetNames = new Set(["evaluation.json", "reference.patch"]);

const secretPatterns: Array<[RegExp, string]> = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/, "GitHub token"],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, "API key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
];

export interface ForbiddenFinding {
  path: string;
  reason: string;
}

function normalizedSegments(filePath: string) {
  return filePath.replaceAll("\\", "/").split("/").filter(Boolean);
}

export function classifyForbiddenPath(filePath: string) {
  const segments = normalizedSegments(filePath);
  const basename = segments.at(-1) ?? "";

  if (
    segments.some(
      (segment) =>
        segment === "hidden-tests" || segment === "hidden-evaluation",
    ) ||
    hiddenAssetNames.has(basename)
  ) {
    return "hidden evaluation asset";
  }
  if (
    (basename === ".env" || basename.startsWith(".env.")) &&
    basename !== ".env.example"
  ) {
    return "environment secret file";
  }
  if (
    basename === "credentials.json" ||
    basename === "id_rsa" ||
    basename.endsWith(".pem") ||
    basename.endsWith(".key") ||
    basename.startsWith("secrets.")
  ) {
    return "secret-bearing file";
  }
  if (
    segments.some((segment) => generatedSegments.has(segment)) ||
    basename.endsWith(".tsbuildinfo") ||
    /\.db(?:-journal|-shm|-wal)?$/.test(basename)
  ) {
    return "generated artifact";
  }
  return null;
}

export function findSecretMarker(contents: string) {
  return (
    secretPatterns.find(([pattern]) => pattern.test(contents))?.[1] ?? null
  );
}

async function gitInventory(root: string) {
  const { stdout } = await execFile(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout.split("\0").filter(Boolean);
}

async function inspectSensitiveWorkspaceFiles(
  root: string,
  directory = root,
): Promise<ForbiddenFinding[]> {
  const findings: ForbiddenFinding[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedWalkDirectories.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath);
    const stat = await lstat(absolutePath);
    if (stat.isSymbolicLink()) {
      const resolved = await realpath(absolutePath);
      const relativeTarget = path.relative(root, resolved);
      if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
        findings.push({
          path: relativePath,
          reason: "symbolic link escapes the Codex workspace",
        });
      }
      continue;
    }
    if (stat.isDirectory()) {
      const reason = classifyForbiddenPath(relativePath);
      if (reason === "hidden evaluation asset" || reason?.includes("secret")) {
        findings.push({ path: relativePath, reason });
        continue;
      }
      findings.push(
        ...(await inspectSensitiveWorkspaceFiles(root, absolutePath)),
      );
      continue;
    }
    const reason = classifyForbiddenPath(relativePath);
    if (reason === "hidden evaluation asset" || reason?.includes("secret")) {
      findings.push({ path: relativePath, reason });
    }
  }
  return findings;
}

export async function findForbiddenChanges(root: string) {
  const inventory = await gitInventory(root);
  const findings: ForbiddenFinding[] = [];

  for (const filePath of inventory) {
    const reason = classifyForbiddenPath(filePath);
    if (reason) {
      findings.push({ path: filePath, reason });
      continue;
    }
    const absolutePath = path.join(root, filePath);
    const stat = await lstat(absolutePath).catch(() => null);
    if (!stat?.isFile() || stat.size > 1024 * 1024) {
      continue;
    }
    const contents = await readFile(absolutePath, "utf8").catch(() => null);
    const secret = contents === null ? null : findSecretMarker(contents);
    if (secret) {
      findings.push({ path: filePath, reason: `${secret} marker` });
    }
  }

  findings.push(...(await inspectSensitiveWorkspaceFiles(root)));
  return Array.from(
    new Map(
      findings.map((finding) => [
        `${finding.path}\0${finding.reason}`,
        finding,
      ]),
    ).values(),
  ).sort((left, right) => left.path.localeCompare(right.path));
}

export async function checkForbiddenChanges(root = process.cwd()) {
  const gitRoot = (
    await execFile("git", ["rev-parse", "--show-toplevel"], {
      cwd: root,
      encoding: "utf8",
    })
  ).stdout.trim();
  const findings = await findForbiddenChanges(gitRoot);
  if (findings.length > 0) {
    const details = findings
      .map(({ path: filePath, reason }) => `- ${filePath}: ${reason}`)
      .join("\n");
    throw new Error(`Forbidden workspace content detected:\n${details}`);
  }
  return { root: gitRoot, checked: true };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkForbiddenChanges()
    .then(() => console.log("Forbidden-change check passed."))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
