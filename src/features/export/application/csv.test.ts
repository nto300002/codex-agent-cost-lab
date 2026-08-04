import { describe, expect, it } from "vitest";

import { createCsv, neutralizeCsvFormula } from "./csv";

describe("CSV utility", () => {
  it("escapes commas, quotes and line breaks using RFC 4180 quoting", () => {
    expect(
      createCsv(["name", "notes"], [["ACME, Inc.", 'first "quote"\nsecond']]),
    ).toBe('"name","notes"\r\n"ACME, Inc.","first ""quote""\nsecond"');
  });

  it.each(["=1+1", "+SUM(A1:A2)", "-10+20", "@IMPORTDATA(A1)"])(
    "neutralizes a dangerous formula prefix: %s",
    (value) => {
      expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
      expect(createCsv(["value"], [[value]])).toContain(`"'${value}"`);
    },
  );

  it("does not alter ordinary text", () => {
    expect(neutralizeCsvFormula("safe@example.test")).toBe("safe@example.test");
  });
});
