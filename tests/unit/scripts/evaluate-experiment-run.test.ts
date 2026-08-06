import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateExperimentRun,
  humanReviewSchema,
  integrateEvaluation,
  type AutomaticEvaluation,
} from "../../../scripts/evaluate-experiment-run";

const fixture = async <T>(name: string) =>
  JSON.parse(
    await readFile(path.join(process.cwd(), "tests/fixtures", name), "utf8"),
  ) as T;

const run = {
  run_id: "GB-I1-P2-run03" as const,
  task_id: "GB-I1" as const,
  input_tokens: 300,
  credits: 0,
};

describe("experiment evaluation integration", () => {
  it("records a correct implementation and blinded human review", async () => {
    const automatic = await fixture<AutomaticEvaluation>(
      "evaluation-success.json",
    );
    const humanReview = humanReviewSchema.parse(
      await fixture("human-review.json"),
    );
    expect(
      integrateEvaluation({
        run,
        manifest: {
          runId: run.run_id,
          taskId: run.task_id,
          status: "completed",
        },
        automatic,
        humanReview,
      }),
    ).toMatchObject({
      execution_status: "completed",
      evaluation_status: "completed",
      outcome: "success",
      included_in_cost_analysis: true,
      success: true,
      quality_score: 100,
      forbidden_change: false,
      human_fix_minutes: 12.5,
      human_review: {
        review_id: "review-7f3a91bc",
        reviewer: "reviewer-01",
        recorded_at: "2026-08-06T02:00:00.000Z",
        condition_visible: false,
      },
    });
  });

  it("keeps a partial implementation as a valid evaluation and cost sample", async () => {
    const automatic = await fixture<AutomaticEvaluation>(
      "evaluation-partial.json",
    );
    expect(
      integrateEvaluation({
        run,
        manifest: {
          runId: run.run_id,
          taskId: run.task_id,
          status: "completed",
        },
        automatic,
      }),
    ).toMatchObject({
      evaluation_status: "completed",
      outcome: "implementation_failure",
      included_in_cost_analysis: true,
      success: false,
      quality_score: 40,
    });
  });

  it("records forbidden changes independently of quality", async () => {
    const automatic = await fixture<AutomaticEvaluation>(
      "evaluation-forbidden.json",
    );
    expect(
      integrateEvaluation({
        run,
        manifest: {
          runId: run.run_id,
          taskId: run.task_id,
          status: "completed",
        },
        automatic,
      }),
    ).toMatchObject({
      outcome: "implementation_failure",
      forbidden_change: true,
      quality_score: 90,
      automatic_evaluation: { forbidden_files: ["prisma/schema.prisma"] },
    });
  });

  it("distinguishes evaluator failure and still includes the failed run in cost analysis", () => {
    expect(
      integrateEvaluation({
        run,
        manifest: { runId: run.run_id, taskId: run.task_id, status: "failed" },
        evaluatorFailure: { message: "crashed", exitCode: 2, timedOut: false },
      }),
    ).toMatchObject({
      execution_status: "failed",
      evaluation_status: "error",
      outcome: "evaluator_failure",
      included_in_cost_analysis: true,
      evaluation_error: { message: "crashed", exitCode: 2 },
    });
  });

  it("rejects human input that exposes the prompt condition", async () => {
    const review = await fixture<Record<string, unknown>>("human-review.json");
    expect(() =>
      humanReviewSchema.parse({ ...review, conditionVisible: true }),
    ).toThrow();
    expect(() =>
      humanReviewSchema.parse({
        ...review,
        reviewId: "review-GB-I1-P2-run03",
      }),
    ).toThrow();
  });

  it.each([
    ["success", "completed", "success"],
    ["partial", "completed", "implementation_failure"],
    ["forbidden", "completed", "implementation_failure"],
    ["abnormal", "error", "evaluator_failure"],
  ] as const)(
    "executes the %s evaluator fixture and persists logs",
    async (mode, evaluationStatus, outcome) => {
      const root = await mkdtemp(path.join(tmpdir(), `evaluation-${mode}-`));
      const workspace = path.join(root, "workspace");
      const results = path.join(root, "results");
      await Promise.all([mkdir(workspace), mkdir(results)]);
      const runPath = path.join(root, "run.json");
      const manifestPath = path.join(root, "manifest.json");
      const diffPath = path.join(root, "diff.patch");
      await Promise.all([
        writeFile(runPath, JSON.stringify(run)),
        writeFile(
          manifestPath,
          JSON.stringify({
            runId: run.run_id,
            taskId: run.task_id,
            status: "completed",
          }),
        ),
        writeFile(diffPath, ""),
      ]);
      const previous = process.env.FAKE_EVALUATOR_MODE;
      process.env.FAKE_EVALUATOR_MODE = mode;
      try {
        const result = await evaluateExperimentRun({
          root: process.cwd(),
          assetRoot: process.cwd(),
          workspace,
          diffPath,
          runJsonPath: runPath,
          manifestPath,
          outputPath: path.join(results, "evaluated-run.json"),
          logPath: path.join(results, "evaluation-log.json"),
          evaluatorScript: path.join(
            process.cwd(),
            "tests/fixtures/fake-evaluator.mjs",
          ),
          skipAssetVerification: true,
        });
        expect(result).toMatchObject({
          evaluation_status: evaluationStatus,
          outcome,
          included_in_cost_analysis: true,
        });
        expect(
          JSON.parse(
            await readFile(path.join(results, "evaluation-log.json"), "utf8"),
          ),
        ).toMatchObject({ evaluationStatus, outcome });
      } finally {
        if (previous === undefined) delete process.env.FAKE_EVALUATOR_MODE;
        else process.env.FAKE_EVALUATOR_MODE = previous;
      }
    },
  );
});
