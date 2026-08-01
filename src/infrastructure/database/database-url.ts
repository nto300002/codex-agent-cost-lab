import path from "node:path";

const defaultDatabaseUrl = "file:./prisma/dev.db";

export function resolveDatabaseUrl(
  databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl,
) {
  if (!databaseUrl.startsWith("file:./")) {
    return databaseUrl;
  }

  return `file:${path.resolve(databaseUrl.slice("file:".length))}`;
}
