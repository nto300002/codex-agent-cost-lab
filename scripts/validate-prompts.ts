import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readPromptFacts, renderPrompts } from "./render-prompts";

const taskIds = ["GA-F1", "GA-I1", "GB-F1", "GB-I1", "GC-F1", "GC-I1"] as const;
const conditions = ["P0", "P1", "P2"] as const;
const structuredHeadings = [
  "目的",
  "再現条件または要求仕様",
  "最初に調査する範囲",
  "変更してよい範囲",
  "変更してはいけない範囲",
  "テスト方針",
  "停止条件",
  "完了条件",
  "最終報告形式",
];
const leakedTerms = [
  "reference.patch",
  "hidden evaluation",
  "隠し評価",
  "正解ファイル",
  "starting commit",
  "Expected relevant files",
];

export async function validatePrompts(root = process.cwd()) {
  await renderPrompts(root, false);
  const promptRoot = path.join(root, "experiment/prompts");
  for (const condition of conditions) {
    const files = (await readdir(path.join(promptRoot, condition)))
      .filter((file) => file.endsWith(".md"))
      .sort();
    if (
      JSON.stringify(files) !== JSON.stringify(taskIds.map((id) => `${id}.md`))
    ) {
      throw new Error(`${condition}: prompt matrix is incomplete`);
    }
  }

  for (const taskId of taskIds) {
    const facts = await readPromptFacts(root, taskId);
    const prompts = Object.fromEntries(
      await Promise.all(
        conditions.map(async (condition) => [
          condition,
          await readFile(
            path.join(promptRoot, condition, `${taskId}.md`),
            "utf8",
          ),
        ]),
      ),
    ) as Record<(typeof conditions)[number], string>;
    if (prompts.P1 !== prompts.P2)
      throw new Error(`${taskId}: P1 and P2 must be identical`);
    if (/^## /m.test(prompts.P0))
      throw new Error(`${taskId}: P0 is unexpectedly structured`);
    if (prompts.P0.length < prompts.P1.length * 0.4) {
      throw new Error(`${taskId}: P0 is unnaturally sparse compared with P1`);
    }
    for (const heading of structuredHeadings) {
      if (!prompts.P1.includes(`## ${heading}`)) {
        throw new Error(`${taskId}: P1 is missing heading: ${heading}`);
      }
    }
    const taskFacts = [
      ...facts.request,
      ...facts.acceptance,
      ...facts.constraints,
      ...facts.validation,
    ];
    for (const condition of conditions) {
      const prompt = prompts[condition];
      for (const fact of taskFacts) {
        if (!prompt.includes(fact))
          throw new Error(`${taskId}/${condition}: missing task fact: ${fact}`);
      }
      if (/\{\{[^}]+\}\}/.test(prompt)) {
        throw new Error(`${taskId}/${condition}: unresolved template variable`);
      }
      const leaked = leakedTerms.find((term) =>
        prompt.toLowerCase().includes(term.toLowerCase()),
      );
      if (leaked)
        throw new Error(
          `${taskId}/${condition}: operator-only information leaked: ${leaked}`,
        );
    }
  }
  return { tasks: taskIds.length, conditions: conditions.length, prompts: 18 };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  validatePrompts()
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
