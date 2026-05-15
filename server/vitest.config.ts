import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["node", "import", "require"],
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
    // Run integration test files sequentially. They share helpdesk_test and
    // create/delete tickets and users in their lifecycle hooks; running in
    // parallel produced races in stats.test.ts (counts shifting between the
    // two GETs that bracket a ticket creation).
    fileParallelism: false,
  },
});
