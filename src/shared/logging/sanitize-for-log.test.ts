import { describe, expect, it } from "vitest";

import { sanitizeForLog } from "./sanitize-for-log";

describe("sanitizeForLog", () => {
  it("redacts secrets recursively", () => {
    expect(
      sanitizeForLog({
        email: "member@example.test",
        password: "secret",
        nested: {
          api_key: "api-key",
          tokenHash: "hash",
          headers: { authorization: "Bearer token", cookie: "session=value" },
        },
      }),
    ).toEqual({
      email: "member@example.test",
      password: "[REDACTED]",
      nested: {
        api_key: "[REDACTED]",
        tokenHash: "[REDACTED]",
        headers: {
          authorization: "[REDACTED]",
          cookie: "[REDACTED]",
        },
      },
    });
  });

  it("handles circular structures", () => {
    const value: { child?: unknown } = {};
    value.child = value;

    expect(sanitizeForLog(value)).toEqual({ child: "[CIRCULAR]" });
  });

  it("redacts error messages that may contain secrets", () => {
    const error = new Error(
      "Database connection failed: postgres://user:password@localhost/db?token=secret",
    );

    expect(sanitizeForLog({ error })).toEqual({
      error: { name: "Error", message: "[REDACTED]" },
    });
  });
});
