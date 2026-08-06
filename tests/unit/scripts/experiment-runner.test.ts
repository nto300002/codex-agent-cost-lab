import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, describe, expect, it } from "vitest";

import {
  assertSafeExperimentRoots,
  buildCodexArguments,
  createRunPlan,
  runExperiment,
  type FixedRunSettings,
} from "../../../scripts/experiment-runner";

const settings: FixedRunSettings = {
  model: "test-model",
  reasoningEffort: "medium",
  sandbox: "workspace-write",
  networkAccess: false,
  webSearch: "disabled",
  approvalPolicy: "never",
  timeoutMs: 5_000,
};
const createdWorktrees: string[] = [];

afterAll(async () => {
  for (const workspace of createdWorktrees) {
    await promisify(execFileCallback)(
      "git",
      ["worktree", "remove", "--force", workspace],
      { cwd: process.cwd() },
    );
  }
});

describe("experiment runner", () => {
  it("creates deterministic balanced blocks with unique run IDs", () => {
    const first = createRunPlan({ seed: "lt-2026", repetitions: 5 });
    const second = createRunPlan({ seed: "lt-2026", repetitions: 5 });
    expect(first).toEqual(second);
    expect(first.entries).toHaveLength(90);
    expect(new Set(first.entries.map(({ runId }) => runId))).toHaveLength(90);
    for (let repetition = 1; repetition <= 5; repetition += 1) {
      const block = first.entries.filter(
        (entry) => entry.repetition === repetition,
      );
      expect(block).toHaveLength(18);
      expect(
        new Set(block.map(({ taskId, condition }) => `${taskId}:${condition}`)),
      ).toHaveLength(18);
    }
    expect(first.entries.some(({ runId }) => runId === "GB-I1-P2-run03")).toBe(
      true,
    );
  });

  it("pins all Codex execution settings", () => {
    const args = buildCodexArguments({
      workspace: "/tmp/workspace",
      outputLastMessage: "/tmp/result/last.txt",
      settings,
    });
    expect(args).toEqual(
      expect.arrayContaining([
        "--json",
        "--ephemeral",
        "--strict-config",
        "--ignore-user-config",
        "--ignore-rules",
        "workspace-write",
        "test-model",
        'model_reasoning_effort="medium"',
        "sandbox_workspace_write.network_access=false",
        'web_search="disabled"',
      ]),
    );
  });

  it("rejects artifact roots inside the source repository", () => {
    expect(() =>
      assertSafeExperimentRoots({
        repositoryRoot: process.cwd(),
        workRoot: path.join(process.cwd(), "runs"),
        resultRoot: path.join(tmpdir(), "results"),
      }),
    ).toThrow("outside the source repository");
  });

  it("runs the same task twice from clean worktrees and preserves artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "experiment-runner-"));
    const workRoot = path.join(root, "worktrees");
    const resultRoot = path.join(root, "results");
    const assetRoot = path.join(root, "assets");
    await mkdir(assetRoot);
    const fakeCodex = path.join(process.cwd(), "tests/fixtures/fake-codex.mjs");
    const baseEntry = createRunPlan({
      seed: "isolation",
      repetitions: 2,
      tasks: ["GB-I1"],
      conditions: ["P1"],
    }).entries;

    const first = await runExperiment({
      repositoryRoot: process.cwd(),
      assetRoot,
      workRoot,
      resultRoot,
      entry: baseEntry[0],
      settings,
      prepareCommands: [],
      codexCommand: process.execPath,
      codexArgs: [fakeCodex],
      codexEnvironment: { RUN_MARKER: "first" },
      skipAssetVerification: true,
    });
    createdWorktrees.push(first.workspace);
    const second = await runExperiment({
      repositoryRoot: process.cwd(),
      assetRoot,
      workRoot,
      resultRoot,
      entry: baseEntry[1],
      settings,
      prepareCommands: [],
      codexCommand: process.execPath,
      codexArgs: [fakeCodex],
      codexEnvironment: {
        RUN_MARKER: "second",
        PREVIOUS_RUN_MARKER: "fake-codex-marker.txt",
      },
      skipAssetVerification: true,
    });
    createdWorktrees.push(second.workspace);

    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    expect(first.workspace).not.toBe(second.workspace);
    expect(
      await readFile(
        path.join(first.workspace, "fake-codex-marker.txt"),
        "utf8",
      ),
    ).toBe("first");
    expect(
      await readFile(
        path.join(second.workspace, "fake-codex-marker.txt"),
        "utf8",
      ),
    ).toBe("second");
    expect(
      await readFile(path.join(second.resultDirectory, "codex.jsonl"), "utf8"),
    ).toContain("isolated");
    expect(
      await readFile(path.join(second.resultDirectory, "stderr.log"), "utf8"),
    ).toContain("fake codex stderr");
    expect(
      await readFile(
        path.join(second.resultDirectory, "git-status.txt"),
        "utf8",
      ),
    ).toContain("fake-codex-marker.txt");
  }, 20_000);

  it("retains the worktree and partial logs after a timeout", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "experiment-timeout-"));
    const assetRoot = path.join(root, "assets");
    await mkdir(assetRoot);
    const entry = createRunPlan({
      seed: "timeout",
      repetitions: 1,
      tasks: ["GA-F1"],
      conditions: ["P0"],
    }).entries[0];
    const result = await runExperiment({
      repositoryRoot: process.cwd(),
      assetRoot,
      workRoot: path.join(root, "worktrees"),
      resultRoot: path.join(root, "results"),
      entry,
      settings: { ...settings, timeoutMs: 100 },
      prepareCommands: [],
      codexCommand: process.execPath,
      codexArgs: [path.join(process.cwd(), "tests/fixtures/fake-codex.mjs")],
      codexEnvironment: { FAKE_CODEX_DELAY_MS: "2000" },
      skipAssetVerification: true,
    });
    createdWorktrees.push(result.workspace);
    expect(result).toMatchObject({ status: "timed-out", timedOut: true });
    expect(
      await readFile(path.join(result.resultDirectory, "codex.jsonl"), "utf8"),
    ).toContain("thread.started");
    expect(
      await readFile(
        path.join(result.resultDirectory, "manifest.json"),
        "utf8",
      ),
    ).toContain('"status": "timed-out"');
    await expect(
      readFile(path.join(result.workspace, "fake-codex-marker.txt"), "utf8"),
    ).resolves.toContain("marker");
  }, 20_000);
});
