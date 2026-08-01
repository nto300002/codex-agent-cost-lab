import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveDatabaseUrl } from "../src/infrastructure/database/database-url";

async function ensureDatabaseFile() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("db:ensure only supports a local SQLite file URL.");
  }

  const databasePath = fileURLToPath(databaseUrl);
  await mkdir(path.dirname(databasePath), { recursive: true });
  const databaseFile = await open(databasePath, "a");
  await databaseFile.close();
}

ensureDatabaseFile().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
