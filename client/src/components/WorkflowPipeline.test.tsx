import { AutoAssignMode } from "@helpdesk/core";
import { afterEach, describe, expect, it } from "vitest";
import type { LifecycleDraft } from "@/lib/workflow-settings";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import WorkflowPipeline, { type PipelineCounts } from "./WorkflowPipeline";

const COUNTS: PipelineCounts = { triaging: 2, open: 5, resolved: 3, closed: 9 };

const BASE: LifecycleDraft = {
  autoAssignOn: false,
  autoAssignMode: AutoAssignMode.round_robin,
  autoResolveOn: true,
  autoResolveThreshold: 85,
  requireCategory: true,
  requireAssignee: false,
  autoCloseOn: true,
  autoCloseDays: 7,
  reopenOnReply: true,
  lockClosed: true,
  slaGreenMin: 90,
  slaYellowMin: 60,
};

afterEach(cleanup);

describe("WorkflowPipeline", () => {
  it("renders connector labels driven by the working rule state", () => {
    renderWithProviders(<WorkflowPipeline life={BASE} counts={COUNTS} />);
    // autoResolveOn + threshold 85
    expect(screen.getByText(/AI ≥ 85% resolves/)).toBeInTheDocument();
    // autoCloseOn + 7 days
    expect(screen.getByText(/auto-close · 7d/)).toBeInTheDocument();
    // autoAssignOff → the non-auto label
    expect(screen.getByText(/AI classifies & routes/)).toBeInTheDocument();
  });

  it("swaps labels when rules are off", () => {
    renderWithProviders(
      <WorkflowPipeline
        life={{ ...BASE, autoResolveOn: false, autoCloseOn: false, autoAssignOn: true }}
        counts={COUNTS}
      />,
    );
    expect(screen.getByText(/agent resolves/)).toBeInTheDocument();
    expect(screen.getByText(/closed manually/)).toBeInTheDocument();
    expect(screen.getByText(/classify · auto-assign/)).toBeInTheDocument();
  });

  it("shows the gate footnote pill only for enabled gates", () => {
    const { rerender } = renderWithProviders(
      <WorkflowPipeline
        life={{ ...BASE, requireCategory: true, requireAssignee: true }}
        counts={COUNTS}
      />,
    );
    expect(screen.getByText(/Resolve needs category \+ assignee/)).toBeInTheDocument();

    rerender(
      <WorkflowPipeline
        life={{ ...BASE, requireCategory: false, requireAssignee: false }}
        counts={COUNTS}
      />,
    );
    expect(screen.queryByText(/Resolve needs/)).not.toBeInTheDocument();
  });
});
