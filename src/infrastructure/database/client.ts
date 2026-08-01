import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../../../generated/prisma/client";

import { resolveDatabaseUrl } from "./database-url";

export function createPrismaClient(databaseUrl = resolveDatabaseUrl()) {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

  return new PrismaClient({ adapter });
}
