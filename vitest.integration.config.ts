import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts", "tests/integration/**/*.test.ts"],
    fileParallelism: true,
    restoreMocks: true,
    slowTestThreshold: 2_000,
  },
});
