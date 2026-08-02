import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { createPrismaClient } from "../../src/infrastructure/database/client";

const migrationsDirectory = path.resolve("prisma/migrations");
const migrationDirectoryPattern = /^\d{14}_[a-z0-9_]+$/;

async function applyMigrations(databasePath: string) {
  const migrationDirectories = (
    await readdir(migrationsDirectory, {
      withFileTypes: true,
    })
  )
    .filter(
      (entry) =>
        entry.isDirectory() && migrationDirectoryPattern.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
  const database = new DatabaseSync(databasePath);

  try {
    database.exec("PRAGMA foreign_keys = ON;");

    for (const migrationDirectory of migrationDirectories) {
      const migration = await readFile(
        path.join(migrationsDirectory, migrationDirectory, "migration.sql"),
        "utf8",
      );
      database.exec(migration);
    }
  } finally {
    database.close();
  }
}

export async function createTestDatabase() {
  const directory = await mkdtemp(path.join(tmpdir(), "trace-crm-test-"));
  const databasePath = path.join(directory, "test.db");

  try {
    await applyMigrations(databasePath);
    const prisma = createPrismaClient(`file:${databasePath}`);
    await prisma.$connect();
    let cleanedUp = false;

    return {
      prisma,
      databasePath,
      async cleanup() {
        if (cleanedUp) {
          return;
        }

        cleanedUp = true;
        await prisma.$disconnect();
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
