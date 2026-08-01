export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INFRASTRUCTURE_ERROR";

export type ValidationDetails = Record<string, string[]>;

export abstract class AppError extends Error {
  abstract readonly code: AppErrorCode;

  protected constructor(
    message: string,
    options?: {
      cause?: unknown;
    },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";

  constructor(
    readonly details: ValidationDetails,
    message = "入力内容を確認してください",
  ) {
    super(message);
  }
}

export class AuthenticationError extends AppError {
  readonly code = "AUTHENTICATION_ERROR";

  constructor(message = "認証が必要です") {
    super(message);
  }
}

export class AuthorizationError extends AppError {
  readonly code = "AUTHORIZATION_ERROR";

  constructor(message = "この操作を実行する権限がありません") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";

  constructor(message = "対象が見つかりません") {
    super(message);
  }
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT";

  constructor(message = "現在の状態では操作を完了できません") {
    super(message);
  }
}

export class InfrastructureError extends AppError {
  readonly code = "INFRASTRUCTURE_ERROR";

  constructor(cause?: unknown) {
    super("処理中に問題が発生しました", { cause });
  }
}
