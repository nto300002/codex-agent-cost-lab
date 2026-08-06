import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const taskIds = ["GA-F1", "GA-I1", "GB-F1", "GB-I1", "GC-F1", "GC-I1"] as const;
const conditions = ["P0", "P1", "P2"] as const;

export type PromptFacts = {
  title: string;
  request: string[];
  acceptance: string[];
  constraints: string[];
  validation: string[];
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sectionBullets(markdown: string, heading: string) {
  const marker = `## ${heading}`;
  const markerIndex = markdown.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Missing section: ${heading}`);
  const remainder = markdown.slice(markerIndex + marker.length);
  const nextHeading = remainder.search(/^## /m);
  const section =
    nextHeading === -1 ? remainder : remainder.slice(0, nextHeading);
  return [...section.matchAll(/^- (.+)$/gm)].map((entry) => entry[1]);
}

export async function readPromptFacts(
  root: string,
  taskId: string,
): Promise<PromptFacts> {
  const markdown = await readFile(
    path.join(root, "experiment/tasks/public", `${taskId}.md`),
    "utf8",
  );
  const title = markdown.match(/^# (.+)$/m)?.[1];
  if (!title) throw new Error(`${taskId}: missing title`);
  return {
    title,
    request: sectionBullets(markdown, "Request"),
    acceptance: sectionBullets(markdown, "Acceptance criteria"),
    constraints: sectionBullets(markdown, "Constraints"),
    validation: sectionBullets(markdown, "Validation"),
  };
}

function bullets(values: string[]) {
  return values.map((value) => `- ${value}`).join("\n");
}

function inline(values: string[]) {
  return values.join(" / ");
}

function render(template: string, facts: PromptFacts) {
  const replacements: Record<string, string> = {
    TITLE: facts.title,
    REQUEST_INLINE: inline(facts.request),
    ACCEPTANCE_INLINE: inline(facts.acceptance),
    CONSTRAINTS_INLINE: inline(facts.constraints),
    VALIDATION_INLINE: inline(facts.validation),
    REQUEST_BULLETS: bullets(facts.request),
    ACCEPTANCE_BULLETS: bullets(facts.acceptance),
    CONSTRAINTS_BULLETS: bullets(facts.constraints),
    VALIDATION_BULLETS: bullets(facts.validation),
  };
  const rendered = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    const replacement = replacements[key];
    if (replacement === undefined)
      throw new Error(`Unknown prompt variable: ${key}`);
    return replacement;
  });
  if (/\{\{[^}]+\}\}/.test(rendered))
    throw new Error("Unresolved prompt variable");
  return `${rendered.trim()}\n`;
}

export async function expectedPrompts(root: string) {
  const promptRoot = path.join(root, "experiment/prompts");
  const [p0Template, p1Template] = await Promise.all([
    readFile(path.join(promptRoot, "templates/P0.md"), "utf8"),
    readFile(path.join(promptRoot, "templates/P1.md"), "utf8"),
  ]);
  const files = new Map<string, string>();
  const tasks: Record<
    string,
    { factHash: string; prompts: Record<string, string> }
  > = {};
  for (const taskId of taskIds) {
    const facts = await readPromptFacts(root, taskId);
    const p0 = render(p0Template, facts);
    const structured = render(p1Template, facts);
    const prompts = { P0: p0, P1: structured, P2: structured };
    tasks[taskId] = { factHash: sha256(JSON.stringify(facts)), prompts: {} };
    for (const condition of conditions) {
      const relativePath = `${condition}/${taskId}.md`;
      files.set(relativePath, prompts[condition]);
      tasks[taskId].prompts[condition] = sha256(prompts[condition]);
    }
  }
  const manifest = `${JSON.stringify({ schemaVersion: 1, tasks }, null, 2)}\n`;
  files.set("manifest.json", manifest);
  return files;
}

export async function renderPrompts(root: string, write: boolean) {
  const promptRoot = path.join(root, "experiment/prompts");
  const files = await expectedPrompts(root);
  for (const [relativePath, expected] of files) {
    const filePath = path.join(promptRoot, relativePath);
    if (write) {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, expected);
      continue;
    }
    const actual = await readFile(filePath, "utf8");
    if (actual !== expected)
      throw new Error(`Generated prompt is stale: ${relativePath}`);
  }
  return { promptCount: taskIds.length * conditions.length };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  renderPrompts(process.cwd(), process.argv.includes("--write"))
    .then((summary) => console.log(JSON.stringify(summary)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
