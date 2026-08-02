import { UserRole } from "../../../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  AuthorizationError,
} from "../../../shared/errors/app-error";
import { FixedClock } from "../../../shared/time/clock";
import type { AuthUserRecord } from "../domain/auth-user";
import { hashPassword } from "../domain/password";
import { hashSessionToken } from "../domain/session-token";
import type { AuthRepository, StoredSession } from "./auth-repository";
import { AuthService } from "./auth-service";

class InMemoryAuthRepository implements AuthRepository {
  readonly sessions = new Map<string, StoredSession>();

  constructor(readonly user: AuthUserRecord | null) {}

  async findUserByEmail(email: string) {
    return this.user?.email === email ? this.user : null;
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }) {
    if (this.user === null || this.user.id !== input.userId) {
      throw new Error("Unknown user");
    }

    this.sessions.set(input.tokenHash, {
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      user: this.user,
    });
  }

  async findSessionByTokenHash(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async deleteSessionsByUserId(userId: string) {
    for (const [tokenHash, session] of this.sessions) {
      if (session.user.id === userId) {
        this.sessions.delete(tokenHash);
      }
    }
  }
}

async function buildAuthUser(overrides: Partial<AuthUserRecord> = {}) {
  return {
    id: "user-1",
    email: "member@example.test",
    name: "Member",
    passwordHash: await hashPassword("correct-password", Buffer.alloc(16, 3)),
    role: UserRole.MEMBER,
    active: true,
    ...overrides,
  };
}

describe("AuthService", () => {
  it("creates an eight-hour session without returning a password hash", async () => {
    const repository = new InMemoryAuthRepository(await buildAuthUser());
    const service = new AuthService(
      repository,
      new FixedClock("2026-01-01T00:00:00.000Z"),
      () => "raw-session-token",
    );

    const result = await service.login({
      email: "member@example.test",
      password: "correct-password",
    });

    expect(result).toEqual({
      user: {
        id: "user-1",
        email: "member@example.test",
        name: "Member",
        role: UserRole.MEMBER,
      },
      sessionToken: "raw-session-token",
      expiresAt: new Date("2026-01-01T08:00:00.000Z"),
    });
    expect(repository.sessions.has(hashSessionToken("raw-session-token"))).toBe(
      true,
    );
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });

  it("uses the same response for an unknown user and a wrong password", async () => {
    const user = await buildAuthUser();
    const knownUserService = new AuthService(
      new InMemoryAuthRepository(user),
      new FixedClock("2026-01-01T00:00:00.000Z"),
    );
    const unknownUserService = new AuthService(
      new InMemoryAuthRepository(null),
      new FixedClock("2026-01-01T00:00:00.000Z"),
    );

    await Promise.all([
      expect(
        knownUserService.login({
          email: user.email,
          password: "wrong-password",
        }),
      ).rejects.toMatchObject({
        code: "AUTHENTICATION_ERROR",
        message: "メールアドレスまたはパスワードが正しくありません",
      }),
      expect(
        unknownUserService.login({
          email: "unknown@example.test",
          password: "wrong-password",
        }),
      ).rejects.toMatchObject({
        code: "AUTHENTICATION_ERROR",
        message: "メールアドレスまたはパスワードが正しくありません",
      }),
    ]);
  });

  it("rejects inactive users after valid password verification", async () => {
    const service = new AuthService(
      new InMemoryAuthRepository(await buildAuthUser({ active: false })),
      new FixedClock("2026-01-01T00:00:00.000Z"),
    );

    await expect(
      service.login({
        email: "member@example.test",
        password: "correct-password",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("invalidates expired and logged-out sessions", async () => {
    const repository = new InMemoryAuthRepository(await buildAuthUser());
    const loginService = new AuthService(
      repository,
      new FixedClock("2026-01-01T00:00:00.000Z"),
      () => "raw-session-token",
    );
    await loginService.login({
      email: "member@example.test",
      password: "correct-password",
    });

    const expiredService = new AuthService(
      repository,
      new FixedClock("2026-01-01T08:00:00.000Z"),
    );
    await expect(
      expiredService.getCurrentUser("raw-session-token"),
    ).rejects.toBeInstanceOf(AuthenticationError);

    await loginService.login({
      email: "member@example.test",
      password: "correct-password",
    });
    await loginService.logout("raw-session-token");
    await expect(
      loginService.getCurrentUser("raw-session-token"),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
