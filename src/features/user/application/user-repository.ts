import type { AuditAction } from "../../../../generated/prisma/client";
import type {
  ManagedUser,
  UserCreateData,
  UserUpdateData,
} from "../domain/managed-user";

export type UserAuditInput = {
  actorUserId: string;
  action: AuditAction;
  before?: ManagedUser;
  after?: ManagedUser;
};

export interface UserRepository<TTransaction> {
  list(): Promise<ManagedUser[]>;
  findById(id: string, transaction: TTransaction): Promise<ManagedUser | null>;
  emailExists(
    email: string,
    excludedUserId: string | undefined,
    transaction: TTransaction,
  ): Promise<boolean>;
  countActiveAdmins(transaction: TTransaction): Promise<number>;
  create(data: UserCreateData, transaction: TTransaction): Promise<ManagedUser>;
  update(
    id: string,
    data: UserUpdateData,
    transaction: TTransaction,
  ): Promise<ManagedUser>;
  deleteSessions(userId: string, transaction: TTransaction): Promise<void>;
  recordAudit(input: UserAuditInput, transaction: TTransaction): Promise<void>;
}
