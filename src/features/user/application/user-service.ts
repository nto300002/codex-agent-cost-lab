import type { TransactionManager } from "../../../shared/database/transaction-manager";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import { authorize } from "../../auth/domain/authorization-policy";
import type { AuditRecorder } from "../../audit/application/audit-log-repository";
import { hashPassword } from "../../auth/domain/password";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserUpdateData,
} from "../domain/managed-user";
import type { UserRepository } from "./user-repository";

const userNotFoundMessage = "ユーザーが見つかりません";
const duplicateEmailMessage = "このメールアドレスは既に使用されています";
const lastAdminMessage = "最後の有効なADMINは無効化または降格できません";

export class UserService<TTransaction> {
  constructor(
    private readonly repository: UserRepository<TTransaction>,
    private readonly transactionManager: TransactionManager<TTransaction>,
    private readonly audit: AuditRecorder<TTransaction>,
  ) {}

  list(actor: AuthenticatedUser) {
    authorize(actor, "user:read");
    return this.repository.list();
  }

  async create(actor: AuthenticatedUser, input: CreateUserInput) {
    authorize(actor, "user:create");
    const passwordHash = await hashPassword(input.password);
    const { password: _password, ...profile } = input;
    void _password;

    return this.transactionManager.run(async (transaction) => {
      await this.assertUniqueEmail(input.email, undefined, transaction);
      const user = await this.repository.create(
        { ...profile, passwordHash, active: true },
        transaction,
      );
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: "CREATE",
          entityType: "User",
          entityId: user.id,
          after: this.auditSnapshot(user),
        },
        transaction,
      );
      return user;
    });
  }

  async update(actor: AuthenticatedUser, id: string, input: UpdateUserInput) {
    this.authorizeUpdate(actor, input);
    const passwordHash =
      input.password === undefined
        ? undefined
        : await hashPassword(input.password);

    return this.transactionManager.run(async (transaction) => {
      const current = await this.repository.findById(id, transaction);
      if (current === null) {
        throw new NotFoundError(userNotFoundMessage);
      }

      if (input.active === false && actor.id === current.id) {
        throw new ConflictError("自分自身を無効化できません");
      }

      const removesActiveAdmin =
        current.active &&
        current.role === "ADMIN" &&
        (input.active === false ||
          (input.role !== undefined && input.role !== "ADMIN"));
      if (
        removesActiveAdmin &&
        (await this.repository.countActiveAdmins(transaction)) <= 1
      ) {
        throw new ConflictError(lastAdminMessage);
      }

      if (input.email !== undefined) {
        await this.assertUniqueEmail(input.email, id, transaction);
      }

      const { password: _password, ...profile } = input;
      void _password;
      const data: UserUpdateData = {
        ...profile,
        ...(passwordHash === undefined ? {} : { passwordHash }),
      };
      const updated = await this.repository.update(id, data, transaction);

      if (input.active === false || passwordHash !== undefined) {
        await this.repository.deleteSessions(id, transaction);
      }

      const action =
        input.active === false && current.active
          ? "DISABLE"
          : input.role !== undefined && input.role !== current.role
            ? "ROLE_CHANGE"
            : "UPDATE";
      await this.audit.record(
        {
          actorUserId: actor.id,
          action,
          entityType: "User",
          entityId: updated.id,
          before: this.auditSnapshot(current),
          after: this.auditSnapshot(updated),
        },
        transaction,
      );
      return updated;
    });
  }

  private authorizeUpdate(actor: AuthenticatedUser, input: UpdateUserInput) {
    authorize(actor, "user:update");
    if (input.active !== undefined) authorize(actor, "user:disable");
    if (input.role !== undefined) authorize(actor, "user:changeRole");
  }

  private async assertUniqueEmail(
    email: string,
    excludedUserId: string | undefined,
    transaction: TTransaction,
  ) {
    if (await this.repository.emailExists(email, excludedUserId, transaction)) {
      throw new ConflictError(duplicateEmailMessage);
    }
  }

  private auditSnapshot(user: { id: string; role: string; active: boolean }) {
    return { id: user.id, role: user.role, active: user.active };
  }
}
