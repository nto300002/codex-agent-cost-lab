import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createRunJson,
  extractFileReferences,
  parseCodexJsonl,
  parseUnifiedDiff,
} from "../../../scripts/parse-codex-jsonl";

const fixture = (name: string) =>
  readFile(path.join(process.cwd(), "tests/fixtures", name), "utf8");

describe("Codex JSONL parser", () => {
  it("aggregates multiple turns and threads without double-counting token categories", async () => {
    const metrics = parseCodexJsonl({
      jsonl: await fixture("codex-trace.jsonl"),
      diff: await fixture("codex-trace.diff"),
    });
    expect(metrics).toMatchObject({
      inputTokens: 300,
      cachedInputTokens: 140,
      uncachedInputTokens: 160,
      outputTokens: 50,
      reasoningOutputTokens: 15,
      commandCount: 6,
      repositoryWideSearches: 2,
      testRunsTotal: 2,
      fullTestRuns: 1,
      turnsCompleted: 2,
      incompleteTurns: 1,
      linesAdded: 3,
      linesDeleted: 1,
    });
    expect(metrics.threadIds).toEqual(["root-thread", "subagent-thread"]);
    expect(metrics.changedFilePaths).toEqual([
      "src/features/customer/customer.ts",
      "tests/customer.test.ts",
    ]);
  });

  it("deduplicates started/completed items and measures explicit file references", async () => {
    const metrics = parseCodexJsonl({
      jsonl: await fixture("codex-trace.jsonl"),
    });
    expect(metrics.explicitFileReferences).toEqual([
      "src/features/customer/customer.ts",
    ]);
    expect(metrics.explicitFileReferencesTotal).toBe(2);
    expect(metrics.duplicateFileReferences).toBe(1);
    expect(metrics.incompleteItems).toEqual([
      { id: "orphan", type: "command_execution", threadId: "subagent-thread" },
    ]);
  });

  it("records unknown events, unknown item types, and malformed JSON", async () => {
    const metrics = parseCodexJsonl({
      jsonl: await fixture("codex-trace.jsonl"),
    });
    expect(metrics.unknownEvents).toEqual({
      "future.event": 1,
      "item.future_item": 1,
    });
    expect(metrics.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          line: 18,
          kind: "invalid_json",
          raw: '{"broken":',
        }),
      ]),
    );
  });

  it("extracts safe repository-relative file references", () => {
    expect(
      extractFileReferences(
        "sed -n '1,20p' /tmp/run/src/a.ts && cat ./package.json https://example.com/a.ts",
        "/tmp/run",
      ),
    ).toEqual(["src/a.ts", "package.json"]);
  });

  it("counts changed files and hunk lines from a unified diff", async () => {
    expect(parseUnifiedDiff(await fixture("codex-trace.diff"))).toEqual({
      changedFilePaths: [
        "src/features/customer/customer.ts",
        "tests/customer.test.ts",
      ],
      linesAdded: 3,
      linesDeleted: 1,
    });
  });

  it("emits the required run JSON shape with parser diagnostics", async () => {
    const run = await createRunJson({
      root: process.cwd(),
      manifest: {
        runId: "GB-I1-P2-run03",
        taskId: "GB-I1",
        condition: "P2",
        startedAt: "2026-08-06T00:00:00.000Z",
        finishedAt: "2026-08-06T00:02:03.000Z",
        settings: { model: "fixed-model", reasoningEffort: "medium" },
        codexCliVersion: "codex-cli 0.144.4",
        execution: { durationMs: 4_500 },
      },
      jsonl: await fixture("codex-trace.jsonl"),
      diff: await fixture("codex-trace.diff"),
      creditRate: {
        confirmedAt: "2026-08-06",
        source: "https://learn.chatgpt.com/docs/pricing",
        model: "fixed-model",
        perMillionTokens: {
          uncachedInput: 125,
          cachedInput: 12.5,
          output: 750,
        },
      },
    });
    expect(run).toMatchObject({
      run_id: "GB-I1-P2-run03",
      task_id: "GB-I1",
      granularity: "G-B",
      task_type: "implementation",
      prompt_condition: "P2",
      input_tokens: 300,
      cached_input_tokens: 140,
      uncached_input_tokens: 160,
      output_tokens: 50,
      reasoning_output_tokens: 15,
      credits: 0.05925,
      credit_rate: {
        confirmedAt: "2026-08-06",
        model: "fixed-model",
      },
      duration_seconds: 4.5,
      changed_files: 2,
      parser: {
        thread_ids: ["root-thread", "subagent-thread"],
        unknown_events: { "future.event": 1, "item.future_item": 1 },
      },
    });
  });

  it("rejects a credit rate for a different model", async () => {
    await expect(
      createRunJson({
        root: process.cwd(),
        manifest: {
          runId: "GA-F1-P0-run01",
          taskId: "GA-F1",
          condition: "P0",
          startedAt: "2026-08-06T00:00:00.000Z",
          settings: { model: "gpt-5.6-sol", reasoningEffort: "medium" },
        },
        jsonl: await fixture("codex-trace.jsonl"),
        creditRate: {
          confirmedAt: "2026-08-06",
          source: "https://learn.chatgpt.com/docs/pricing",
          model: "different-model",
          perMillionTokens: {
            uncachedInput: 125,
            cachedInput: 12.5,
            output: 750,
          },
        },
      }),
    ).rejects.toThrow("Credit rate model does not match run model");
  });
});
