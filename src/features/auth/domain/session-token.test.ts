import { describe, expect, it } from "vitest";

import { generateSessionToken, hashSessionToken } from "./session-token";

describe("session tokens", () => {
  it("generates opaque 32-byte tokens and stores only their SHA-256 hash", () => {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);

    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toBe(token);
  });
});
