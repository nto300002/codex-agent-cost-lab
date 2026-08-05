import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { createPrismaClient } from "../src/infrastructure/database/client";

export async function collectSeedVerification() {
  const prisma = createPrismaClient();
  try {
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
      sessions: 0,
    };
    const actualCounts = {
      ...Object.fromEntries(
        Object.entries(snapshot).map(([name, records]) => [
          name,
          records.length,
        ]),
      ),
      sessions: await prisma.session.count(),
    };

    if (JSON.stringify(actualCounts) !== JSON.stringify(expectedCounts)) {
      throw new Error(
        `Unexpected seed counts: ${JSON.stringify(actualCounts)}; expected ${JSON.stringify(expectedCounts)}`,
      );
    }

    const checksum = createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");

    return { counts: actualCounts, checksum };
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  collectSeedVerification()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
