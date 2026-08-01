import {
  AppError,
  InfrastructureError,
  ValidationError,
} from "../errors/app-error";

export type ErrorResponseBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
};

export type HttpErrorResponse = {
  status: 400 | 401 | 403 | 404 | 409 | 500;
  body: ErrorResponseBody;
};

const statusByCode = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INFRASTRUCTURE_ERROR: 500,
} as const satisfies Record<AppError["code"], HttpErrorResponse["status"]>;

export function toHttpErrorResponse(error: unknown): HttpErrorResponse {
  const appError =
    error instanceof AppError ? error : new InfrastructureError(error);
  const details =
    appError instanceof ValidationError ? appError.details : undefined;

  return {
    status: statusByCode[appError.code],
    body: {
      error: {
        code: appError.code,
        message: appError.message,
        ...(details === undefined ? {} : { details }),
      },
    },
  };
}
