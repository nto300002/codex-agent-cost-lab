import { UserRole } from "../../../../generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../../shared/errors/app-error";
import { AuditLogService, safeAuditJson } from "./audit-log-service";
import type { AuditLogRepository } from "./audit-log-repository";

const admin = {
  id: "admin-1",
  email: "admin@example.test",
  name: "Admin",
  role: UserRole.ADMIN,
};
const member = { ...admin, id: "member-1", role: UserRole.MEMBER };

function setup() {
  const repository = {
    list: vi.fn().mockResolvedValue({ logs: [], total: 0 }),
    findById: vi.fn().mockResolvedValue(null),
    record: vi.fn().mockResolvedValue(undefined),
  } satisfies AuditLogRepository<string>;
  return { repository, service: new AuditLogService(repository) };
}

describe("AuditLogService", () => {
  it("allows only ADMIN to list logs", async () => {
    const { service } = setup();
    await expect(
      service.list(member, { page: 1, pageSize: 20 }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      service.list(admin, { page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ pagination: { total: 0 } });
  });

  it("removes secrets recursively and bounds large JSON", () => {
    const json = safeAuditJson({
      id: "user-1",
      password: "secret",
      nested: { sessionToken: "raw", cookie: "private", role: "ADMIN" },
      large: "x".repeat(20_000),
    });
    expect(json?.length).toBeLessThanOrEqual(16_000);
    expect(json).not.toContain("secret");
    expect(json).not.toContain("raw");
    expect(json).not.toContain("private");
    expect(json).toContain("truncated");
  });

  it("passes a sanitized record through the shared recorder", async () => {
    const { repository, service } = setup();
    await service.record(
      {
        actorUserId: admin.id,
        action: "UPDATE",
        entityType: "User",
        entityId: "user-1",
        after: { role: "MANAGER", passwordHash: "secret" },
      },
      "transaction",
    );
    expect(repository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: admin.id,
        afterJson: '{"role":"MANAGER"}',
      }),
      "transaction",
    );
  });
});
