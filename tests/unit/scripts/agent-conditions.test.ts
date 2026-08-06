import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertIsolatedWorkspace,
  configureAgentCondition,
  findAgentContamination,
} from "../../../scripts/configure-agent-condition";
import { validateAgentConditions } from "../../../scripts/validate-agent-conditions";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "agent-condition-"));
  const workspace = path.join(root, "runs", "workspace");
  const codexHome = path.join(root, "codex-home");
  const results = path.join(root, "results");
  await Promise.all([
    mkdir(workspace, { recursive: true }),
    mkdir(codexHome, { recursive: true }),
    mkdir(results, { recursive: true }),
  ]);
  return { root, workspace, codexHome, results };
}

describe("AGENTS conditions", () => {
  it("refuses to mutate the source repository as an experiment workspace", () => {
    expect(() => assertIsolatedWorkspace(process.cwd(), process.cwd())).toThrow(
      "isolated workspace",
    );
  });

  it("validates minimal and verbose templates and their hashes", async () => {
    await expect(validateAgentConditions()).resolves.toMatchObject({
      conditions: 4,
    });
  });

  it("removes project instructions for P0 and records before/after hashes", async () => {
    const paths = await fixture();
    await writeFile(
      path.join(paths.workspace, "AGENTS.md"),
      "stale instructions\n",
    );
    const recordPath = path.join(paths.results, "P0.json");
    const record = await configureAgentCondition({
      root: process.cwd(),
      workspace: paths.workspace,
      codexHome: paths.codexHome,
      recordPath,
      condition: "P0",
      apply: true,
    });
    expect(record.beforeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.afterHash).toBeNull();
    expect(JSON.parse(await readFile(recordPath, "utf8"))).toMatchObject({
      condition: "P0",
      afterHash: null,
    });
  });

  it("keeps project instructions absent for P1", async () => {
    const paths = await fixture();
    const record = await configureAgentCondition({
      root: process.cwd(),
      workspace: paths.workspace,
      codexHome: paths.codexHome,
      recordPath: path.join(paths.results, "P1.json"),
      condition: "P1",
      apply: true,
    });
    expect(record).toMatchObject({
      condition: "P1",
      beforeHash: null,
      afterHash: null,
      expectedHash: null,
    });
  });

  it.each(["P2", "P3"] as const)(
    "places and verifies the %s template",
    async (condition) => {
      const paths = await fixture();
      const record = await configureAgentCondition({
        root: process.cwd(),
        workspace: paths.workspace,
        codexHome: paths.codexHome,
        recordPath: path.join(paths.results, `${condition}.json`),
        condition,
        apply: true,
      });
      expect(record.afterHash).toBe(record.expectedHash);
      await expect(
        configureAgentCondition({
          root: process.cwd(),
          workspace: paths.workspace,
          codexHome: paths.codexHome,
          recordPath: path.join(paths.results, `${condition}-check.json`),
          condition,
          apply: false,
        }),
      ).resolves.toMatchObject({
        applied: false,
        afterHash: record.expectedHash,
      });
    },
  );

  it("rejects parent and CODEX_HOME instruction contamination", async () => {
    const paths = await fixture();
    await Promise.all([
      writeFile(path.join(paths.root, "AGENTS.md"), "parent\n"),
      writeFile(path.join(paths.codexHome, "AGENTS.override.md"), "global\n"),
    ]);
    await expect(
      findAgentContamination(paths.workspace, paths.codexHome),
    ).resolves.toHaveLength(2);
    await expect(
      configureAgentCondition({
        root: process.cwd(),
        workspace: paths.workspace,
        codexHome: paths.codexHome,
        recordPath: path.join(paths.results, "P1.json"),
        condition: "P1",
        apply: true,
      }),
    ).rejects.toThrow("External AGENTS.md contamination");
  });
});
