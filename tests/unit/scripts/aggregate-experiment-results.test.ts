import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  aggregateExperimentResults,
  summarizeNumbers,
  writeAggregationArtifacts,
} from "../../../scripts/aggregate-experiment-results";

const fixturePath = (name: string) =>
  path.join(process.cwd(), "tests/fixtures", name);

async function fixtures() {
  const runs = (await readFile(fixturePath("aggregation-runs.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as unknown);
  const pricing = JSON.parse(
    await readFile(fixturePath("aggregation-pricing.json"), "utf8"),
  ) as unknown;
  return { runs, pricing };
}

describe("experiment aggregation", () => {
  it("uses deterministic R-7 median and quartile calculations", () => {
    expect(summarizeNumbers([100, 200])).toEqual({
      count: 2,
      min: 100,
      q1: 125,
      median: 150,
      q3: 175,
      max: 200,
      iqr: 50,
    });
  });

  it("matches hand-calculated API, human, and total costs", async () => {
    const { runs, pricing } = await fixtures();
    const result = aggregateExperimentResults(runs, pricing);
    const p0Runs = result.runs.filter(
      ({ prompt_condition }) => prompt_condition === "P0",
    );
    expect(p0Runs.map(({ api_equivalent_usd }) => api_equivalent_usd)).toEqual([
      2, 1,
    ]);
    expect(p0Runs.map(({ total_cost_jpy }) => total_cost_jpy)).toEqual([
      1200, 2100,
    ]);
    const p0 = result.summary_by_task.find(
      ({ prompt_condition }) => prompt_condition === "P0",
    )!;
    expect(p0).toMatchObject({
      run_count: 2,
      success_count: 1,
      success_rate: 0.5,
      metrics: {
        api_equivalent_jpy: {
          min: 100,
          q1: 125,
          median: 150,
          q3: 175,
          max: 200,
          iqr: 50,
        },
        total_cost_jpy: { median: 1650 },
      },
      per_success: {
        calculable: true,
        metrics: {
          credits: 30,
          api_equivalent_usd: 3,
          total_cost_jpy: 3300,
        },
      },
    });
  });

  it("does not double-add reasoning tokens to API-equivalent cost", async () => {
    const { runs, pricing } = await fixtures();
    const result = aggregateExperimentResults(runs, pricing);
    const p1 = result.runs.find(({ run_id }) => run_id === "GA-F1-P1-run01")!;
    expect(p1.reasoning_output_tokens).toBe(50_000);
    expect(p1.api_equivalent_usd).toBe(2);
  });

  it("marks per-success metrics uncalculable when success count is zero", async () => {
    const { runs, pricing } = await fixtures();
    const result = aggregateExperimentResults(runs, pricing);
    const p2 = result.summary_by_task.find(
      ({ prompt_condition }) => prompt_condition === "P2",
    )!;
    expect(p2).toMatchObject({
      success_count: 0,
      evaluator_error_count: 1,
      forbidden_change_count: 1,
      per_success: {
        calculable: false,
        reason: "no_successful_runs",
        metrics: { credits: null, total_cost_jpy: null },
      },
    });
  });

  it("generates only task and within-granularity comparisons", async () => {
    const { runs, pricing } = await fixtures();
    const result = aggregateExperimentResults(runs, pricing);
    expect(result.comparison_policy).toMatchObject({
      scope: "within_granularity_only",
      overall_cross_granularity_summary_generated: false,
    });
    expect(result.summary_by_granularity).toHaveLength(3);
    expect(
      result.summary_by_granularity.every(
        ({ granularity }) => granularity === "G-A",
      ),
    ).toBe(true);
  });

  it("records price sources, dates, exchange rate, and formulas", async () => {
    const { runs, pricing } = await fixtures();
    const result = aggregateExperimentResults(runs, pricing);
    expect(result).toMatchObject({
      pricing: {
        confirmed_at: "2026-08-06",
        source: "Synthetic fixture rates for unit tests",
        exchange_rate: {
          observed_at: "2026-08-06",
          usd_to_jpy: 100,
        },
      },
      formulas: {
        total_cost_jpy: "api_equivalent_jpy + human_cost_jpy",
        per_success: "sum of every included run / successful run count",
      },
    });
  });

  it("recreates byte-identical artifacts from the same raw input", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "aggregation-repro-"));
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    const options = {
      runsJsonlPath: fixturePath("aggregation-runs.jsonl"),
      pricingPath: fixturePath("aggregation-pricing.json"),
    };
    await writeAggregationArtifacts({ ...options, outputDirectory: first });
    await writeAggregationArtifacts({ ...options, outputDirectory: second });
    const files = (await readdir(first)).sort();
    expect(files).toEqual([
      "chart-data.csv",
      "costed-runs.jsonl",
      "summary-by-granularity.csv",
      "summary-by-task.csv",
      "summary.json",
    ]);
    for (const file of files) {
      expect(await readFile(path.join(first, file), "utf8")).toBe(
        await readFile(path.join(second, file), "utf8"),
      );
    }
  });
});
