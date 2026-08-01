import { createHash } from "node:crypto";

import { createPrismaClient } from "../src/infrastructure/database/client";

const prisma = createPrismaClient();

async function verifySeed() {
  const snapshot = {
    users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
    customers: await prisma.customer.findMany({ orderBy: { id: "asc" } }),
    deals: await prisma.deal.findMany({ orderBy: { id: "asc" } }),
    activities: await prisma.activity.findMany({ orderBy: { id: "asc" } }),
    tags: await prisma.tag.findMany({ orderBy: { id: "asc" } }),
    customerTags: await prisma.customerTag.findMany({
      orderBy: [{ customerId: "asc" }, { tagId: "asc" }],
    }),
    auditLogs: await prisma.auditLog.findMany({ orderBy: { id: "asc" } }),
  };
  const expectedCounts = {
    users: 4,
    customers: 40,
    deals: 80,
    activities: 160,
    tags: 8,
    customerTags: 80,
    auditLogs: 50,
  };
  const actualCounts = Object.fromEntries(
    Object.entries(snapshot).map(([name, records]) => [name, records.length]),
  );

  if (JSON.stringify(actualCounts) !== JSON.stringify(expectedCounts)) {
    throw new Error(
      `Unexpected seed counts: ${JSON.stringify(actualCounts)}; expected ${JSON.stringify(expectedCounts)}`,
    );
  }

  const checksum = createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");

  console.log(JSON.stringify({ counts: actualCounts, checksum }, null, 2));
}

verifySeed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
