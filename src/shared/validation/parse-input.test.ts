import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ValidationError } from "../errors/app-error";
import { parseInput } from "./parse-input";

const schema = z.object({
  email: z.email("メール形式が不正です"),
  profile: z.object({ name: z.string().trim().min(1, "名前は必須です") }),
});

describe("parseInput", () => {
  it("returns parsed and normalized input", () => {
    expect(
      parseInput(schema, {
        email: "member@example.test",
        profile: { name: "  Member  " },
      }),
    ).toEqual({ email: "member@example.test", profile: { name: "Member" } });
  });

  it("converts Zod issues into ValidationError details", () => {
    expect(() =>
      parseInput(schema, { email: "invalid", profile: { name: " " } }),
    ).toThrowError(
      new ValidationError({
        email: ["メール形式が不正です"],
        "profile.name": ["名前は必須です"],
      }),
    );
  });
});
