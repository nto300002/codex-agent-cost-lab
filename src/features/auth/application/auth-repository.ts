import type { AuthUserRecord } from "../domain/auth-user";

export type StoredSession = {
  tokenHash: string;
  expiresAt: Date;
  user: AuthUserRecord;
};

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createSessionWithLoginAudit(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<StoredSession | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteSessionWithLogoutAudit(tokenHash: string): Promise<void>;
  deleteSessionsByUserId(userId: string): Promise<void>;
}
