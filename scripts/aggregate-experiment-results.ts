import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

const taskIds = ["GA-F1", "GA-I1", "GB-F1", "GB-I1", "GC-F1", "GC-I1"] as const;
const conditions = ["P0", "P1", "P2"] as const;

const evaluatedRunSchema = z
  .object({
    run_id: z.string().regex(/^(GA|GB|GC)-(F1|I1)-P[0-2]-run\d{2}$/),
    task_id: z.enum(taskIds),
    granularity: z.enum(["G-A", "G-B", "G-C"]),
    prompt_condition: z.enum(conditions),
    model: z.string().min(1),
    input_tokens: z.number().int().nonnegative(),
    cached_input_tokens: z.number().int().nonnegative(),
    uncached_input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    reasoning_output_tokens: z.number().int().nonnegative(),
    credits: z.number().nonnegative(),
    duration_seconds: z.number().nonnegative(),
    command_count: z.number().int().nonnegative(),
    explicit_file_references_unique: z.number().int().nonnegative(),
    repository_wide_searches: z.number().int().nonnegative(),
    test_runs_total: z.number().int().nonnegative(),
    changed_files: z.number().int().nonnegative(),
    lines_added: z.number().int().nonnegative(),
    lines_deleted: z.number().int().nonnegative(),
    success: z.boolean(),
    quality_score: z.number().min(0).max(100),
    forbidden_change: z.boolean(),
    human_fix_minutes: z.number().nonnegative(),
    included_in_cost_analysis: z.boolean(),
    evaluation_status: z.enum(["completed", "error"]),
    outcome: z.enum([
      "success",
      "implementation_failure",
      "execution_failure",
      "evaluator_failure",
    ]),
  })
  .passthrough()
  .superRefine((run, context) => {
    if (
      run.input_tokens !==
      run.cached_input_tokens + run.uncached_input_tokens
    ) {
      context.addIssue({
        code: "custom",
        message: "input_tokens must equal cached + uncached input tokens",
      });
    }
  });

const pricingSchema = z.object({
  schemaVersion: z.literal(1),
  confirmedAt: z.string().date(),
  source: z.string().min(1),
  apiCurrency: z.literal("USD"),
  ratesPerMillionTokens: z.record(
    z.string().min(1),
    z.object({
      uncachedInput: z.number().nonnegative(),
      cachedInput: z.number().nonnegative(),
      output: z.number().nonnegative(),
    }),
  ),
  exchangeRate: z.object({
    observedAt: z.string().date(),
    source: z.string().min(1),
    usdToJpy: z.number().positive(),
  }),
  humanCost: z.object({
    currency: z.literal("JPY"),
    hourlyRate: z.number().nonnegative(),
    source: z.string().min(1),
  }),
});

type EvaluatedRun = z.infer<typeof evaluatedRunSchema>;
type Pricing = z.infer<typeof pricingSchema>;

const metricKeys = [
  "input_tokens",
  "cached_input_tokens",
  "uncached_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
  "credits",
  "duration_seconds",
  "command_count",
  "explicit_file_references_unique",
  "repository_wide_searches",
  "test_runs_total",
  "changed_files",
  "lines_added",
  "lines_deleted",
  "quality_score",
  "human_fix_minutes",
  "api_equivalent_usd",
  "api_equivalent_jpy",
  "human_cost_jpy",
  "total_cost_jpy",
] as const;

type MetricKey = (typeof metricKeys)[number];
type CostedRun = EvaluatedRun & {
  api_equivalent_usd: number;
  api_equivalent_jpy: number;
  human_cost_jpy: number;
  total_cost_jpy: number;
};

function round(value: number, digits = 8) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function calculateRunCost(
  run: EvaluatedRun,
  pricing: Pricing,
): CostedRun {
  const rate = pricing.ratesPerMillionTokens[run.model];
  if (!rate)
    throw new Error(`No pricing rate configured for model: ${run.model}`);
  const apiEquivalentUsd =
    (run.uncached_input_tokens / 1_000_000) * rate.uncachedInput +
    (run.cached_input_tokens / 1_000_000) * rate.cachedInput +
    (run.output_tokens / 1_000_000) * rate.output;
  const apiEquivalentJpy = apiEquivalentUsd * pricing.exchangeRate.usdToJpy;
  const humanCostJpy =
    (run.human_fix_minutes / 60) * pricing.humanCost.hourlyRate;
  return {
    ...run,
    api_equivalent_usd: round(apiEquivalentUsd),
    api_equivalent_jpy: round(apiEquivalentJpy),
    human_cost_jpy: round(humanCostJpy),
    total_cost_jpy: round(apiEquivalentJpy + humanCostJpy),
  };
}

function quantile(sorted: number[], probability: number) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const remainder = position - lower;
  return sorted[lower] + (sorted[lower + 1] - sorted[lower]) * remainder;
}

export function summarizeNumbers(values: number[]) {
  if (values.length === 0) throw new Error("Cannot summarize an empty metric.");
  const sorted = [...values].sort((left, right) => left - right);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return {
    count: sorted.length,
    min: round(sorted[0]),
    q1: round(q1),
    median: round(quantile(sorted, 0.5)),
    q3: round(q3),
    max: round(sorted.at(-1)!),
    iqr: round(q3 - q1),
  };
}

function metricValue(run: CostedRun, key: MetricKey) {
  return run[key] as number;
}

function summarizeGroup(
  groupType: "task" | "granularity",
  key: string,
  runs: CostedRun[],
) {
  const successes = runs.filter(({ success }) => success);
  const successCount = successes.length;
  const metrics = Object.fromEntries(
    metricKeys.map((metric) => [
      metric,
      summarizeNumbers(runs.map((run) => metricValue(run, metric))),
    ]),
  );
  const perSuccess =
    successCount === 0
      ? {
          calculable: false as const,
          reason: "no_successful_runs" as const,
          metrics: Object.fromEntries(
            metricKeys.map((metric) => [metric, null]),
          ),
        }
      : {
          calculable: true as const,
          reason: null,
          metrics: Object.fromEntries(
            metricKeys.map((metric) => [
              metric,
              round(
                runs.reduce((sum, run) => sum + metricValue(run, metric), 0) /
                  successCount,
              ),
            ]),
          ),
        };
  const [granularity, condition] =
    groupType === "granularity"
      ? key.split("|")
      : [runs[0].granularity, runs[0].prompt_condition];
  return {
    group_type: groupType,
    granularity,
    task_id: groupType === "task" ? runs[0].task_id : null,
    prompt_condition: condition,
    run_count: runs.length,
    success_count: successCount,
    success_rate: round(successCount / runs.length),
    forbidden_change_count: runs.filter(
      ({ forbidden_change }) => forbidden_change,
    ).length,
    evaluator_error_count: runs.filter(
      ({ evaluation_status }) => evaluation_status === "error",
    ).length,
    outcome_counts: Object.fromEntries(
      [
        "success",
        "implementation_failure",
        "execution_failure",
        "evaluator_failure",
      ].map((outcome) => [
        outcome,
        runs.filter((run) => run.outcome === outcome).length,
      ]),
    ),
    metrics,
    per_success: perSuccess,
  };
}

function grouped(runs: CostedRun[], type: "task" | "granularity") {
  const groups = new Map<string, CostedRun[]>();
  for (const run of runs) {
    const key =
      type === "task"
        ? `${run.task_id}|${run.prompt_condition}`
        : `${run.granularity}|${run.prompt_condition}`;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, members]) => summarizeGroup(type, key, members));
}

export function aggregateExperimentResults(
  rawRuns: unknown[],
  rawPricing: unknown,
) {
  const pricing = pricingSchema.parse(rawPricing);
  const parsed = rawRuns.map((run) => evaluatedRunSchema.parse(run));
  const ids = parsed.map(({ run_id }) => run_id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate run IDs detected.");
  const included = parsed
    .filter(({ included_in_cost_analysis }) => included_in_cost_analysis)
    .map((run) => calculateRunCost(run, pricing))
    .sort((left, right) => left.run_id.localeCompare(right.run_id));
  if (included.length === 0)
    throw new Error("No runs are included in cost analysis.");
  const excludedRunIds = parsed
    .filter(({ included_in_cost_analysis }) => !included_in_cost_analysis)
    .map(({ run_id }) => run_id)
    .sort();
  return {
    schema_version: 1,
    comparison_policy: {
      scope: "within_granularity_only",
      prohibited_interpretation:
        "Do not rank G-A, G-B, and G-C by their absolute metric values.",
      overall_cross_granularity_summary_generated: false,
    },
    pricing: {
      confirmed_at: pricing.confirmedAt,
      source: pricing.source,
      api_currency: pricing.apiCurrency,
      rates_per_million_tokens: pricing.ratesPerMillionTokens,
      exchange_rate: {
        observed_at: pricing.exchangeRate.observedAt,
        source: pricing.exchangeRate.source,
        usd_to_jpy: pricing.exchangeRate.usdToJpy,
      },
      human_cost: pricing.humanCost,
    },
    formulas: {
      uncached_input_tokens: "input_tokens - cached_input_tokens",
      api_equivalent_usd:
        "uncached_input_tokens / 1,000,000 * uncached_input_rate + cached_input_tokens / 1,000,000 * cached_input_rate + output_tokens / 1,000,000 * output_rate",
      reasoning_output_tokens:
        "reported separately; not added again because output_tokens already contains billable output",
      api_equivalent_jpy: "api_equivalent_usd * usd_to_jpy",
      human_cost_jpy: "human_fix_minutes / 60 * human_hourly_rate_jpy",
      total_cost_jpy: "api_equivalent_jpy + human_cost_jpy",
      per_success: "sum of every included run / successful run count",
      quartiles: "R-7 linear interpolation at p=0.25 and p=0.75",
    },
    source_run_count: parsed.length,
    included_run_count: included.length,
    excluded_run_ids: excludedRunIds,
    runs: included,
    summary_by_task: grouped(included, "task"),
    summary_by_granularity: grouped(included, "granularity"),
  };
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function summaryCsv(
  summaries: ReturnType<typeof aggregateExperimentResults>["summary_by_task"],
) {
  const header = [
    "group_type",
    "granularity",
    "task_id",
    "prompt_condition",
    "run_count",
    "success_count",
    "success_rate",
    "metric",
    "min",
    "q1",
    "median",
    "q3",
    "max",
    "iqr",
    "per_success",
    "per_success_status",
  ];
  const rows = summaries.flatMap((summary) =>
    metricKeys.map((metric) => {
      const stats = summary.metrics[metric];
      return [
        summary.group_type,
        summary.granularity,
        summary.task_id,
        summary.prompt_condition,
        summary.run_count,
        summary.success_count,
        summary.success_rate,
        metric,
        stats.min,
        stats.q1,
        stats.median,
        stats.q3,
        stats.max,
        stats.iqr,
        summary.per_success.metrics[metric],
        summary.per_success.calculable ? "calculated" : "no_successful_runs",
      ];
    }),
  );
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function chartCsv(
  summaries: ReturnType<
    typeof aggregateExperimentResults
  >["summary_by_granularity"],
) {
  const chartMetrics: MetricKey[] = [
    "input_tokens",
    "uncached_input_tokens",
    "output_tokens",
    "credits",
    "duration_seconds",
    "api_equivalent_jpy",
    "total_cost_jpy",
  ];
  const rows = summaries.flatMap((summary) =>
    chartMetrics.map((metric) => {
      const stats = summary.metrics[metric];
      return [
        summary.granularity,
        summary.prompt_condition,
        metric,
        stats.min,
        stats.q1,
        stats.median,
        stats.q3,
        stats.max,
        summary.success_rate,
      ];
    }),
  );
  const header = [
    "granularity",
    "prompt_condition",
    "metric",
    "min",
    "q1",
    "median",
    "q3",
    "max",
    "success_rate",
  ];
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export async function writeAggregationArtifacts(options: {
  runsJsonlPath: string;
  pricingPath: string;
  outputDirectory: string;
}) {
  const rawLines = (await readFile(options.runsJsonlPath, "utf8"))
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const runs = rawLines.map((line, index) => {
    try {
      return JSON.parse(line) as unknown;
    } catch (error) {
      throw new Error(
        `Invalid run JSONL at line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
  const result = aggregateExperimentResults(
    runs,
    JSON.parse(await readFile(options.pricingPath, "utf8")),
  );
  await mkdir(options.outputDirectory, { recursive: false });
  await Promise.all([
    writeFile(
      path.join(options.outputDirectory, "summary.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      { flag: "wx" },
    ),
    writeFile(
      path.join(options.outputDirectory, "costed-runs.jsonl"),
      `${result.runs.map((run) => JSON.stringify(run)).join("\n")}\n`,
      { flag: "wx" },
    ),
    writeFile(
      path.join(options.outputDirectory, "summary-by-task.csv"),
      summaryCsv(result.summary_by_task),
      { flag: "wx" },
    ),
    writeFile(
      path.join(options.outputDirectory, "summary-by-granularity.csv"),
      summaryCsv(result.summary_by_granularity),
      { flag: "wx" },
    ),
    writeFile(
      path.join(options.outputDirectory, "chart-data.csv"),
      chartCsv(result.summary_by_granularity),
      { flag: "wx" },
    ),
  ]);
  return result;
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const runsJsonlPath = option("--runs");
  const pricingPath = option("--pricing");
  const outputDirectory = option("--output-dir");
  if (!runsJsonlPath || !pricingPath || !outputDirectory) {
    throw new Error(
      "usage: tsx scripts/aggregate-experiment-results.ts --runs <evaluated-runs.jsonl> --pricing <pricing.json> --output-dir <new-directory>",
    );
  }
  const result = await writeAggregationArtifacts({
    runsJsonlPath,
    pricingPath,
    outputDirectory,
  });
  console.log(
    JSON.stringify({
      runs: result.included_run_count,
      taskGroups: result.summary_by_task.length,
      granularityGroups: result.summary_by_granularity.length,
      outputDirectory: path.resolve(outputDirectory),
    }),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
