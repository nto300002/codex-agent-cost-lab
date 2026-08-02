import { NextRequest } from "next/server";
import { UserRole } from "../../../../generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AuthenticationError } from "../../../shared/errors/app-error";
import {
  createCurrentUserHandler,
  createLoginHandler,
  createLogoutHandler,
  sessionCookieName,
} from "./auth-handlers";

const authenticatedUser = {
  id: "user-1",
  email: "member@example.test",
  name: "Member",
  role: UserRole.MEMBER,
};

describe("auth handlers", () => {
  it("sets only the opaque token in a protected session cookie", async () => {
    const login = vi.fn().mockResolvedValue({
      user: authenticatedUser,
      sessionToken: "opaque-session-token",
      expiresAt: new Date("2026-01-01T08:00:00.000Z"),
    });
    const handler = createLoginHandler({ login }, false);
    const response = await handler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: " MEMBER@EXAMPLE.TEST ",
          password: "correct-password",
        }),
      }),
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(login).toHaveBeenCalledWith({
      email: "member@example.test",
      password: "correct-password",
    });
    expect(cookie).toContain(`${sessionCookieName}=opaque-session-token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("correct-password");
    expect(cookie).not.toContain(authenticatedUser.email);
  });

  it("returns 401 when the session cookie is missing", async () => {
    const getCurrentUser = vi.fn().mockRejectedValue(new AuthenticationError());
    const handler = createCurrentUserHandler({ getCurrentUser });
    const response = await handler(
      new NextRequest("http://localhost/api/auth/me"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "AUTHENTICATION_ERROR",
        message: "認証が必要です",
      },
    });
    expect(getCurrentUser).toHaveBeenCalledWith(undefined);
  });

  it("passes the cookie token to logout and expires the cookie", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const handler = createLogoutHandler({ logout });
    const response = await handler(
      new NextRequest("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie: `${sessionCookieName}=opaque-session-token` },
      }),
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(204);
    expect(logout).toHaveBeenCalledWith("opaque-session-token");
    expect(cookie).toContain(`${sessionCookieName}=`);
    expect(cookie).toContain("Max-Age=0");
  });

  it("rejects malformed JSON without exposing internal errors", async () => {
    const login = vi.fn();
    const handler = createLoginHandler({ login });
    const response = await handler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
    expect(login).not.toHaveBeenCalled();
  });
});
