import { UserRole } from "../../../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import { toHttpErrorResponse } from "../../../shared/http/error-response";
import {
  authorize,
  can,
  permissions,
  type AuthorizationActor,
  type Permission,
} from "./authorization-policy";

const member: AuthorizationActor = { id: "member-1", role: UserRole.MEMBER };
const manager: AuthorizationActor = { id: "manager-1", role: UserRole.MANAGER };
const admin: AuthorizationActor = { id: "admin-1", role: UserRole.ADMIN };
const ownResource = { ownerId: member.id };
const otherResource = { ownerId: "member-2" };

type MatrixCase = {
  permission: Permission;
  memberOwn: boolean;
  memberOther: boolean;
  manager: boolean;
  admin: boolean;
};

const matrixCases: MatrixCase[] = [
  {
    permission: "customer:read",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "customer:create",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "customer:update",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "customer:delete",
    memberOwn: false,
    memberOther: false,
    manager: false,
    admin: true,
  },
  {
    permission: "customer:export",
    memberOwn: false,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "deal:read",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "deal:create",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "deal:update",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "deal:delete",
    memberOwn: false,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "deal:export",
    memberOwn: false,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "activity:read",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "activity:create",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "activity:update",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "activity:delete",
    memberOwn: true,
    memberOther: false,
    manager: true,
    admin: true,
  },
  {
    permission: "user:read",
    memberOwn: false,
    memberOther: false,
    manager: false,
    admin: true,
  },
  {
    permission: "user:create",
    memberOwn: false,
    memberOther: false,
    manager: false,
    admin: true,
  },
  {
    permission: "user:update",
    memberOwn: false,
    memberOther: false,
    manager: false,
    admin: true,
  },
  {
    permission: "user:disable",
    memberOwn: false,
    memberOther: false,
    manager: false,
    admin: true,
  },
  {
    permission: "user:changeRole",
    memberOwn: false,
    memberOther: false,
    manager: false,
    admin: true,
  },
  {
    permission: "auditLog:read",
    memberOwn: false,
    memberOther: false,
    manager: false,
    admin: true,
  },
];

describe("authorization policy", () => {
  it("covers every declared permission in the table", () => {
    expect(matrixCases.map(({ permission }) => permission)).toEqual(
      permissions,
    );
  });

  it.each(matrixCases)("evaluates $permission", (testCase) => {
    expect(can(member, testCase.permission, ownResource)).toBe(
      testCase.memberOwn,
    );
    expect(can(member, testCase.permission, otherResource)).toBe(
      testCase.memberOther,
    );
    expect(can(manager, testCase.permission, otherResource)).toBe(
      testCase.manager,
    );
    expect(can(admin, testCase.permission, otherResource)).toBe(testCase.admin);
  });

  it("rejects a member updating another owner's deal with HTTP 403", () => {
    let thrown: unknown;

    try {
      authorize(member, "deal:update", otherResource);
    } catch (error) {
      thrown = error;
    }

    expect(toHttpErrorResponse(thrown)).toMatchObject({
      status: 403,
      body: { error: { code: "AUTHORIZATION_ERROR" } },
    });
  });

  it("allows a member to update their own deal", () => {
    expect(() => authorize(member, "deal:update", ownResource)).not.toThrow();
  });
});
