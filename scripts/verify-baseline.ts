import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { BASELINE_CLOCK_ISO } from "../src/shared/time/baseline-time";
import { FixedClock } from "../src/shared/time/clock";
import { checkForbiddenChanges } from "./check-forbidden-changes";
import { collectSeedVerification } from "./verify-seed";

const execFile = promisify(execFileCallback);

export function assertCleanStatus(status: string) {
  if (status.trim().length > 0) {
    throw new Error(`Baseline worktree is not clean:\n${status.trimEnd()}`);
  }
}

export function assertRecordPathOutsideRepository(
  repositoryRoot: string,
  recordPath: string,
) {
  const relative = path.relative(repositoryRoot, path.resolve(recordPath));
  if (!relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      "Baseline manifest must be recorded outside the Codex workspace.",
    );
  }
}

async function run(command: string, args: string[], cwd: string) {
  try {
    return await execFile(command, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const output = error as { stdout?: string; stderr?: string };
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n${output.stdout ?? ""}${output.stderr ?? ""}`,
    );
  }
}

async function fileSha256(root: string, filePath: string) {
  return createHash("sha256")
    .update(await readFile(path.join(root, filePath)))
    .digest("hex");
}

async function resetAndSnapshot(root: string) {
  await run("pnpm", ["db:reset"], root);
  return collectSeedVerification();
}

function recordArgument(args: string[]) {
  const index = args.indexOf("--record");
  if (index === -1) {
    return null;
  }
  const value = args[index + 1];
  if (!value) {
    throw new Error("--record requires an output path.");
  }
  return path.resolve(value);
}

async function verifyBaseline() {
  const root = (
    await run("git", ["rev-parse", "--show-toplevel"], process.cwd())
  ).stdout.trim();
  const status = (
    await run(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      root,
    )
  ).stdout;
  assertCleanStatus(status);
  await checkForbiddenChanges(root);

  const clock = new FixedClock(BASELINE_CLOCK_ISO);
  const clockValues = [clock.now().toISOString(), clock.now().toISOString()];
  if (clockValues.some((value) => value !== BASELINE_CLOCK_ISO)) {
    throw new Error(
      `Baseline Clock is not reproducible: ${clockValues.join(", ")}`,
    );
  }

  const firstSeed = await resetAndSnapshot(root);
  const secondSeed = await resetAndSnapshot(root);
  if (firstSeed.checksum !== secondSeed.checksum) {
    throw new Error(
      `Seed is not reproducible: ${firstSeed.checksum} != ${secondSeed.checksum}`,
    );
  }

  const manifest = {
    schemaVersion: 1,
    commit: (await run("git", ["rev-parse", "HEAD"], root)).stdout.trim(),
    fixedClock: BASELINE_CLOCK_ISO,
    seed: secondSeed,
    files: {
      lockfileSha256: await fileSha256(root, "pnpm-lock.yaml"),
      schemaSha256: await fileSha256(root, "prisma/schema.prisma"),
      seedSha256: await fileSha256(root, "prisma/seed.ts"),
    },
  };

  const outputPath = recordArgument(process.argv.slice(2));
  if (outputPath) {
    assertRecordPathOutsideRepository(root, outputPath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
    });
  }
  console.log(JSON.stringify(manifest, null, 2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  verifyBaseline().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
