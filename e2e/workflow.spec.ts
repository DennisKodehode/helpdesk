import { expect, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
  loginAs,
} from "./helpers/auth";

// ===========================================================================
// Workflow page — admin-only lifecycle settings
//
// The /workflow screen (Administration > Workflow) lets admins view the
// ticket-lifecycle pipeline and toggle/save lifecycle rules that are persisted
// server-side in the singleton `workflow_settings` row.
//
// Critical journeys covered:
//   1. Admin reaches /workflow via the sidebar and sees the page landmarks.
//   2. Admin toggles a lifecycle switch, sees the unsaved-changes hint and
//      save bar, saves, and sees the "Saved" confirmation chip.
//   3. After a page reload the toggled value is persisted (aria-checked).
//   4. The tested toggle is restored to its seeded default (cleanup).
//   5. An agent visiting /workflow is redirected to the dashboard.
//
// Mutation strategy: we toggle "Auto-assign new tickets", whose seeded default
// is OFF (autoAssignOn: false). This gives a known starting state after every
// globalSetup DB reset. We restore it at the end of the serial block so it
// does not bleed into any run that follows.
// ===========================================================================

// Steps 1–4 are serial because each depends on the server state left by the
// previous step (the persisted toggle value).
test.describe.serial("Workflow page — admin lifecycle rules", () => {
  // The switch we'll toggle throughout this block. Its accessible name matches
  // the `title` prop passed to WorkflowRule → Switch aria-label.
  const SWITCH_NAME = "Auto-assign new tickets";

  test("admin navigates via sidebar to /workflow and sees the page title and pipeline", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Navigate via the sidebar link rather than a direct goto so we verify the
    // nav item exists with the correct label.
    await page.getByRole("link", { name: "Workflow" }).click();
    await page.waitForURL("/workflow");

    // PageHeader renders the eyebrow and title as visible text.
    await expect(page.getByText("Administration")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();

    // The pipeline diagram has four stage nodes labelled by a <span> with the
    // serif font inside each StageNode. The original assertions used
    // getByText("Open") / getByText("Resolved") without exact matching, which
    // triggered strict-mode violations because those words also appear as
    // substrings in rule-copy text nodes (e.g. "move it back to Open").
    //
    // With { exact: true }, Playwright matches only elements whose *entire*
    // text content equals the string — so only the <span>Open</span> leaf node
    // matches, not its parent divs whose text includes other words. This avoids
    // the strict-mode violation without needing a CSS-class-based scope.
    const pipelineEyebrow = page.getByText(
      "The lifecycle · every ticket moves left to right",
      { exact: true },
    );
    await expect(pipelineEyebrow).toBeVisible();
    await expect(page.getByText("Triaging", { exact: true })).toBeVisible();
    await expect(page.getByText("Open", { exact: true })).toBeVisible();
    await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  });

  test("admin toggles a lifecycle switch, sees the unsaved-changes hint, saves, and sees the Saved chip", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/workflow");
    await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();

    // The "Lifecycle rules" tab is selected by default (first tab).
    const lifecycleTab = page.getByRole("tab", { name: "Lifecycle rules" });
    await expect(lifecycleTab).toHaveAttribute("aria-selected", "true");

    // Locate the target switch. Seeded default is OFF (aria-checked="false").
    const toggle = page.getByRole("switch", { name: SWITCH_NAME });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    // Toggle ON.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    // The unsaved-changes hint appears next to the segmented control.
    await expect(page.getByText("Lifecycle has unsaved changes")).toBeVisible();

    // The save bar appears in the page header — a "Revert" and a "Save changes"
    // button become visible.
    await expect(page.getByRole("button", { name: "Revert" })).toBeVisible();
    const saveButton = page.getByRole("button", { name: "Save changes" });
    await expect(saveButton).toBeVisible();

    // Save — wait for the PATCH to complete; Playwright auto-waits on click.
    await saveButton.click();

    // The "Saved" confirmation chip appears briefly after a successful save.
    // We don't assert it is gone (timing is fragile); asserting it appeared is
    // sufficient to confirm the server round-trip succeeded.
    await expect(page.getByText("Saved")).toBeVisible();
  });

  test("the toggled value persists after a page reload", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/workflow");
    await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();

    // After save in the previous test the server row has autoAssignOn = true.
    // A fresh page load fetches that value; the switch should be ON.
    const toggle = page.getByRole("switch", { name: SWITCH_NAME });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  test("restore: toggle the switch back to its seeded default (OFF) and save", async ({
    page,
  }) => {
    // This test exists purely to clean up the mutation made in the save test so
    // subsequent E2E runs (which do NOT reset the DB mid-run) start from the
    // known seeded state. globalSetup resets the DB before the full suite, but
    // within a single run the singleton row persists across spec files.
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/workflow");
    await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();

    const toggle = page.getByRole("switch", { name: SWITCH_NAME });
    await expect(toggle).toBeVisible();

    // Only toggle back if the previous test actually left it ON.
    const isChecked = await toggle.getAttribute("aria-checked");
    if (isChecked === "true") {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "false");

      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved")).toBeVisible();
    }
  });
});

// ===========================================================================
// SLA targets tab — smoke-check only (full SLA edit coverage is in
// admin-features.spec.ts). We only verify the tab switch works and the
// "Targets by priority" heading appears so we know the SLA panel mounts.
// ===========================================================================

test.describe("Workflow page — SLA targets tab", () => {
  test("admin can switch to the SLA targets tab and sees the Targets by priority heading", async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/workflow");
    await expect(page.getByRole("heading", { name: "Workflow" })).toBeVisible();

    const slaTab = page.getByRole("tab", { name: "SLA targets" });
    await expect(slaTab).toBeVisible();
    await slaTab.click();
    await expect(slaTab).toHaveAttribute("aria-selected", "true");

    // SlaTargetsPanel renders an h2 "Targets by priority" once policies load.
    await expect(page.getByText("Targets by priority")).toBeVisible();
  });
});

// ===========================================================================
// RBAC guard — agent is redirected to the dashboard
// ===========================================================================

test.describe("Workflow page — RBAC guard", () => {
  test("agent visiting /workflow is redirected to the dashboard", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    await page.goto("/workflow");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
  });
});
