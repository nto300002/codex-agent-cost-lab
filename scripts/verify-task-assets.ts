import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { z } from "zod";

const execFile = promisify(execFileCallback);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const assetLockSchema = z.object({
  schemaVersion: z.literal(1),
  repository: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  assets: z.record(z.string().min(1), sha256),
});

export type TaskAssetLock = z.infer<typeof assetLockSchema>;

export function validateAssetLock(value: unknown) {
  const lock = assetLockSchema.parse(value);
  if (Object.keys(lock.assets).length === 0) {
    throw new Error("Task asset lock must contain at least one asset.");
  }
  for (const assetPath of Object.keys(lock.assets)) {
    if (
      path.isAbsolute(assetPath) ||
      assetPath.split(path.sep).includes("..")
    ) {
      throw new Error(`Unsafe task asset path: ${assetPath}`);
    }
  }
  return lock;
}

export function assertAssetRootOutsideRepository(
  repositoryRoot: string,
  assetRoot: string,
) {
  const relative = path.relative(repositoryRoot, assetRoot);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  ) {
    throw new Error("Task assets must remain outside the public repository.");
  }
}

export async function sha256File(filePath: string) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

export async function verifyTaskAssets(
  repositoryRoot: string,
  assetRoot: string,
  execute = false,
) {
  const resolvedRepository = await realpath(repositoryRoot);
  const resolvedAssets = await realpath(assetRoot);
  assertAssetRootOutsideRepository(resolvedRepository, resolvedAssets);

  const lock = validateAssetLock(
    JSON.parse(
      await readFile(
        path.join(resolvedRepository, "experiment/task-assets.lock.json"),
        "utf8",
      ),
    ),
  );
  const { stdout: head } = await execFile("git", ["rev-parse", "HEAD"], {
    cwd: resolvedAssets,
  });
  if (head.trim() !== lock.commit) {
    throw new Error(
      `Task asset commit mismatch: ${head.trim()} != ${lock.commit}`,
    );
  }

  for (const [assetPath, expectedHash] of Object.entries(lock.assets)) {
    const actualHash = await sha256File(path.join(resolvedAssets, assetPath));
    if (actualHash !== expectedHash) {
      throw new Error(`Task asset hash mismatch: ${assetPath}`);
    }
  }

  if (execute) {
    for (const script of ["verify-task.mjs", "verify-evaluator.mjs"]) {
      await execFile(
        process.execPath,
        [
          path.join(resolvedAssets, "scripts", script),
          ...(script === "verify-task.mjs" ? ["--all"] : []),
          resolvedRepository,
        ],
        { cwd: resolvedAssets },
      );
    }
  }
  return { commit: lock.commit, assetCount: Object.keys(lock.assets).length };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const assetRoot = process.env.EXPERIMENT_ASSET_ROOT;
  if (!assetRoot) {
    console.error(
      "EXPERIMENT_ASSET_ROOT must point to the private evaluation repository.",
    );
    process.exitCode = 1;
  } else {
    verifyTaskAssets(
      process.cwd(),
      assetRoot,
      process.argv.includes("--execute"),
    )
      .then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      });
  }
}
