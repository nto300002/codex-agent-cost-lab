import { scryptSync } from "node:crypto";

import {
  ActivityType,
  AuditAction,
  CustomerStatus,
  DealStage,
  Prisma,
  UserRole,
} from "../generated/prisma/client";
import { createPrismaClient } from "../src/infrastructure/database/client";

const prisma = createPrismaClient();
const baseDate = new Date("2026-01-01T00:00:00.000Z");
const seedPassword = "TraceCRM!2026";

const userIds = {
  admin: "00000000-0000-4000-8000-000000000001",
  manager: "00000000-0000-4000-8000-000000000002",
  member1: "00000000-0000-4000-8000-000000000003",
  member2: "00000000-0000-4000-8000-000000000004",
} as const;

function fixedId(prefix: string, index: number) {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function daysAfter(days: number) {
  return new Date(baseDate.getTime() + days * 86_400_000);
}

function passwordHash(index: number) {
  const salt = Buffer.from(String(index).padStart(32, "0"), "hex");
  const hash = scryptSync(seedPassword, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });

  return `scrypt$v1$16384$8$1$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const seedUserSpecs: Array<{
  id: string;
  email: string;
  name: string;
  role: UserRole;
}> = [
  {
    id: userIds.admin,
    email: "admin@example.test",
    name: "管理者",
    role: UserRole.ADMIN,
  },
  {
    id: userIds.manager,
    email: "manager@example.test",
    name: "マネージャー",
    role: UserRole.MANAGER,
  },
  {
    id: userIds.member1,
    email: "member1@example.test",
    name: "担当者 一郎",
    role: UserRole.MEMBER,
  },
  {
    id: userIds.member2,
    email: "member2@example.test",
    name: "担当者 二郎",
    role: UserRole.MEMBER,
  },
];

const users: Prisma.UserCreateManyInput[] = seedUserSpecs.map(
  ({ id, email, name, role }, index) => ({
    id,
    email,
    name,
    role,
    passwordHash: passwordHash(index + 1),
    active: true,
    createdAt: daysAfter(index),
    updatedAt: daysAfter(index),
  }),
);

const customerStatuses = [
  CustomerStatus.LEAD,
  CustomerStatus.ACTIVE,
  CustomerStatus.INACTIVE,
];

const customers: Prisma.CustomerCreateManyInput[] = Array.from(
  { length: 40 },
  (_, offset) => {
    const index = offset + 1;
    const ownerId = index % 2 === 1 ? userIds.member1 : userIds.member2;
    const createdAt = daysAfter(index);

    return {
      id: fixedId("10000000", index),
      name:
        index === 40
          ? "境".repeat(200)
          : `サンプル顧客 ${String(index).padStart(2, "0")}`,
      email:
        index % 9 === 0
          ? null
          : `customer${String(index).padStart(2, "0")}@example.test`,
      phone:
        index % 7 === 0 ? null : `03-0000-${String(index).padStart(4, "0")}`,
      status: customerStatuses[offset % customerStatuses.length],
      ownerId,
      notes:
        index === 40
          ? "注".repeat(2000)
          : index % 5 === 0
            ? null
            : `固定Seed顧客 ${index} のメモ`,
      createdAt,
      updatedAt: daysAfter(index + 40),
    };
  },
);

const dealStages = [
  DealStage.NEW,
  DealStage.QUALIFIED,
  DealStage.PROPOSAL,
  DealStage.WON,
  DealStage.LOST,
];

const deals: Prisma.DealCreateManyInput[] = Array.from(
  { length: 80 },
  (_, offset) => {
    const index = offset + 1;
    const customerIndex = Math.floor(offset / 2) + 1;
    const ownerId = customerIndex % 2 === 1 ? userIds.member1 : userIds.member2;

    return {
      id: fixedId("20000000", index),
      customerId: fixedId("10000000", customerIndex),
      title:
        index === 80
          ? "商".repeat(200)
          : `商談 ${String(index).padStart(2, "0")}`,
      amountCents: index === 1 ? 0 : index * 125_000,
      stage: dealStages[offset % dealStages.length],
      ownerId,
      expectedCloseDate: index % 4 === 0 ? null : daysAfter(90 + index),
      createdAt: daysAfter(index),
      updatedAt: daysAfter(index + 80),
    };
  },
);

const activityTypes = [
  ActivityType.CALL,
  ActivityType.EMAIL,
  ActivityType.MEETING,
  ActivityType.NOTE,
];

const activities: Prisma.ActivityCreateManyInput[] = Array.from(
  { length: 160 },
  (_, offset) => {
    const index = offset + 1;
    const customerIndex = Math.floor(offset / 4) + 1;
    const dealIndex = (customerIndex - 1) * 2 + (offset % 2) + 1;
    const ownerId = customerIndex % 2 === 1 ? userIds.member1 : userIds.member2;

    return {
      id: fixedId("30000000", index),
      customerId: fixedId("10000000", customerIndex),
      dealId: offset % 4 === 3 ? null : fixedId("20000000", dealIndex),
      type: activityTypes[offset % activityTypes.length],
      summary: index === 160 ? "活".repeat(1000) : `固定Seed活動 ${index}`,
      occurredAt: daysAfter(index),
      createdById: ownerId,
      createdAt: daysAfter(index),
      updatedAt: daysAfter(index),
    };
  },
);

const tagNames = [
  "重要",
  "新規",
  "継続",
  "休眠",
  "紹介",
  "大口",
  "要対応",
  "イベント",
];
const tags: Prisma.TagCreateManyInput[] = tagNames.map((name, offset) => ({
  id: fixedId("40000000", offset + 1),
  name,
  createdAt: daysAfter(offset),
}));

const customerTags: Prisma.CustomerTagCreateManyInput[] = Array.from(
  { length: 40 },
  (_, offset) => [
    {
      customerId: fixedId("10000000", offset + 1),
      tagId: fixedId("40000000", (offset % 8) + 1),
    },
    {
      customerId: fixedId("10000000", offset + 1),
      tagId: fixedId("40000000", ((offset + 3) % 8) + 1),
    },
  ],
).flat();

const auditActions = [
  AuditAction.CREATE,
  AuditAction.UPDATE,
  AuditAction.DELETE,
  AuditAction.EXPORT,
  AuditAction.LOGIN,
  AuditAction.LOGOUT,
  AuditAction.DISABLE,
  AuditAction.ROLE_CHANGE,
];
const actorIds = Object.values(userIds);

const auditLogs: Prisma.AuditLogCreateManyInput[] = Array.from(
  { length: 50 },
  (_, offset) => {
    const index = offset + 1;
    const action = auditActions[offset % auditActions.length];
    const entityType =
      action === AuditAction.LOGIN || action === AuditAction.LOGOUT
        ? "USER"
        : ["CUSTOMER", "DEAL", "ACTIVITY", "USER"][offset % 4];
    const entityId =
      entityType === "CUSTOMER"
        ? fixedId("10000000", (offset % 40) + 1)
        : entityType === "DEAL"
          ? fixedId("20000000", (offset % 80) + 1)
          : entityType === "ACTIVITY"
            ? fixedId("30000000", (offset % 160) + 1)
            : actorIds[offset % actorIds.length];

    return {
      id: fixedId("50000000", index),
      actorUserId: actorIds[offset % actorIds.length],
      action,
      entityType,
      entityId,
      beforeJson:
        action === AuditAction.CREATE ||
        action === AuditAction.LOGIN ||
        action === AuditAction.LOGOUT
          ? null
          : JSON.stringify({ revision: index - 1 }),
      afterJson:
        action === AuditAction.DELETE ||
        action === AuditAction.LOGIN ||
        action === AuditAction.LOGOUT
          ? null
          : JSON.stringify({ revision: index }),
      createdAt: daysAfter(index),
    };
  },
);

async function seed() {
  await prisma.$transaction(async (transaction) => {
    await transaction.auditLog.deleteMany();
    await transaction.customerTag.deleteMany();
    await transaction.activity.deleteMany();
    await transaction.deal.deleteMany();
    await transaction.customer.deleteMany();
    await transaction.tag.deleteMany();
    await transaction.user.deleteMany();

    await transaction.user.createMany({ data: users });
    await transaction.customer.createMany({ data: customers });
    await transaction.deal.createMany({ data: deals });
    await transaction.activity.createMany({ data: activities });
    await transaction.tag.createMany({ data: tags });
    await transaction.customerTag.createMany({ data: customerTags });
    await transaction.auditLog.createMany({ data: auditLogs });
  });

  console.log(
    `Seeded ${users.length} users, ${customers.length} customers, ${deals.length} deals, ` +
      `${activities.length} activities, ${tags.length} tags, and ${auditLogs.length} audit logs.`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
