import {
  AuthenticationError,
  AuthorizationError,
} from "../../../shared/errors/app-error";
import type { Clock } from "../../../shared/time/clock";
import {
  toAuthenticatedUser,
  type AuthenticatedUser,
} from "../domain/auth-user";
import { verifyPassword } from "../domain/password";
import {
  generateSessionToken,
  hashSessionToken,
} from "../domain/session-token";
import type { AuthRepository } from "./auth-repository";

const sessionDurationMilliseconds = 8 * 60 * 60 * 1000;
const invalidCredentialsMessage =
  "メールアドレスまたはパスワードが正しくありません";
const dummyPasswordHash =
  "scrypt$v1$16384$8$1$00000000000000000000000000000001$aa91af95d328345382fc835efc86be8a49b2cf2f719f2bb239a91c44022fb1642799fabd0cf8bbe01105dda833bebf3f15d228795ce6f0e8bf6020ea97622d6c";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  user: AuthenticatedUser;
  sessionToken: string;
  expiresAt: Date;
};

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly clock: Clock,
    private readonly tokenGenerator: () => string = generateSessionToken,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.repository.findUserByEmail(input.email);
    const passwordMatches = await verifyPassword(
      input.password,
      user?.passwordHash ?? dummyPasswordHash,
    );

    if (user === null || !passwordMatches) {
      throw new AuthenticationError(invalidCredentialsMessage);
    }

    if (!user.active) {
      await this.repository.deleteSessionsByUserId(user.id);
      throw new AuthorizationError("このユーザーは無効です");
    }

    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + sessionDurationMilliseconds);
    const sessionToken = this.tokenGenerator();

    await this.repository.createSessionWithLoginAudit({
      tokenHash: hashSessionToken(sessionToken),
      userId: user.id,
      expiresAt,
      createdAt: now,
    });

    return {
      user: toAuthenticatedUser(user),
      sessionToken,
      expiresAt,
    };
  }

  async getCurrentUser(sessionToken: string | undefined) {
    if (!sessionToken) {
      throw new AuthenticationError();
    }

    const tokenHash = hashSessionToken(sessionToken);
    const session = await this.repository.findSessionByTokenHash(tokenHash);
    const now = this.clock.now();

    if (session === null) {
      throw new AuthenticationError();
    }

    if (session.expiresAt.getTime() <= now.getTime() || !session.user.active) {
      await this.repository.deleteSessionByTokenHash(tokenHash);
      throw new AuthenticationError();
    }

    return toAuthenticatedUser(session.user);
  }

  async logout(sessionToken: string | undefined) {
    if (!sessionToken) {
      return;
    }

    await this.repository.deleteSessionWithLogoutAudit(
      hashSessionToken(sessionToken),
    );
  }
}
