import { describe, expect, it } from "vitest";

import { toHttpErrorResponse } from "../http/error-response";
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InfrastructureError,
  NotFoundError,
  ValidationError,
} from "./app-error";

describe("toHttpErrorResponse", () => {
  it.each([
    [
      new ValidationError({ email: ["Invalid email"] }),
      400,
      "VALIDATION_ERROR",
    ],
    [new AuthenticationError(), 401, "AUTHENTICATION_ERROR"],
    [new AuthorizationError(), 403, "AUTHORIZATION_ERROR"],
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new ConflictError(), 409, "CONFLICT"],
    [
      new InfrastructureError(new Error("database secret")),
      500,
      "INFRASTRUCTURE_ERROR",
    ],
  ])("maps %s to HTTP %i", (error, status, code) => {
    expect(toHttpErrorResponse(error)).toMatchObject({
      status,
      body: { error: { code } },
    });
  });

  it("does not expose unknown error details", () => {
    const response = toHttpErrorResponse(new Error("database password leaked"));

    expect(response).toEqual({
      status: 500,
      body: {
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: "処理中に問題が発生しました",
        },
      },
    });
  });

  it("includes safe validation details", () => {
    expect(
      toHttpErrorResponse(new ValidationError({ email: ["Invalid email"] })),
    ).toEqual({
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "入力内容を確認してください",
          details: { email: ["Invalid email"] },
        },
      },
    });
  });
});
