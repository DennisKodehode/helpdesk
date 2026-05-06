import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["node", "import", "require"],
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});
