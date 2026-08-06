import { copyFile, writeFile } from "node:fs/promises";

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const output = option("--output");
if (!output) throw new Error("--output is required");
const mode = process.env.FAKE_EVALUATOR_MODE ?? "success";
if (mode === "abnormal") {
  process.stderr.write("synthetic evaluator crash\n");
  process.exitCode = 2;
} else if (mode === "invalid") {
  await writeFile(output, "not json\n");
  process.exitCode = 2;
} else {
  await copyFile(new URL(`./evaluation-${mode}.json`, import.meta.url), output);
  if (mode !== "success") process.exitCode = 1;
}
