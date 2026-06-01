import { defineConfig, devices } from "@playwright/test";

// Standalone Playwright config for the visual-fidelity harness. It compares the
// running dev server against a locally-served prototype and is deliberately NOT
// part of the E2E suite — no webServer, no globalSetup, no DB reset.
//
// Prereqs (two terminals): `bun run dev` and `bun run fidelity:serve`.
// Run: `bun run fidelity:shots`.
export default defineConfig({
  // testDir + outputDir resolve relative to THIS config file's directory.
  testDir: ".",
  testMatch: "capture.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: ".out/test-results",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
