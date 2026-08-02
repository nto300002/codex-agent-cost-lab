import { createPrismaClient } from "./client";

const globalForPrisma = globalThis as typeof globalThis & {
  traceCrmPrisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.traceCrmPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.traceCrmPrisma = prisma;
}
