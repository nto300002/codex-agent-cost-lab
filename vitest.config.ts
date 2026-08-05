import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
    restoreMocks: true,
    slowTestThreshold: 1_000,
  },
});
