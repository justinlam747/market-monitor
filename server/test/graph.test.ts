import { describe, it, expect } from "vitest";
import {
  startRun,
  resolveCheckpointAndResume,
  getPendingCheckpoint,
} from "../src/agent/runner.js";
import { DEFAULT_COMPANY_URL } from "../src/fixtures/dataset.js";
import { collectEvents, stepNodeOrder } from "./helpers.js";

const EXPECTED_AUTONOMOUS_SEQUENCE = [
  "validate_input",
  "scrape_company_site",
  "extract_identity",
  "maybe_confirm_identity",
  "discover_competitors",
  "maybe_select_competitors",
  "collect_sources",
  "maybe_review_sources",
  "extract_signals",
  "evaluate_evidence",
  "maybe_review_claims",
  "analyze_gaps",
  "maybe_review_gaps",
  "finalize_state",
];

describe("autonomous run (fixture mode)", () => {
  it("emits the agent step stream in the correct sequence (PRD §13.7)", async () => {
    const runId = "auto-seq-1";
    const { events } = collectEvents(runId);

    await startRun({ runId, mode: "autonomous", companyUrl: DEFAULT_COMPANY_URL });

    expect(stepNodeOrder(events)).toEqual(EXPECTED_AUTONOMOUS_SEQUENCE);
    // No checkpoints pause an autonomous run.
    expect(events.some((e) => e.type === "checkpoint_waiting")).toBe(false);
    const done = events.find((e) => e.type === "done");
    expect((done?.data as { status?: string })?.status).toBe("complete");
  });

  it("records checkpoints as auto-approved (not_required) in autonomous mode", async () => {
    const runId = "auto-skip-1";
    const { events } = collectEvents(runId);
    await startRun({ runId, mode: "autonomous", companyUrl: DEFAULT_COMPANY_URL });

    const maybeSteps = events.filter(
      (e) => e.type === "step" && e.node?.startsWith("maybe_")
    );
    expect(maybeSteps.length).toBeGreaterThan(0);
    expect(maybeSteps.every((e) => e.message?.includes("auto-approved"))).toBe(
      true
    );
  });

  it("blocks an unsafe (private-IP) URL even in autonomous mode (add-on §11)", async () => {
    const runId = "auto-block-1";
    const { events } = collectEvents(runId);

    await startRun({
      runId,
      mode: "autonomous",
      companyUrl: "http://169.254.169.254/latest/meta-data",
    });

    const order = stepNodeOrder(events);
    expect(order).toContain("validate_input");
    expect(order).toContain("finalize_state");
    expect(order).not.toContain("scrape_company_site");
    const done = events.find((e) => e.type === "done");
    expect((done?.data as { status?: string })?.status).toBe("error");
  });
});

describe("review run (fixture mode)", () => {
  it("pauses at every checkpoint and resumes on approval (add-on §11)", async () => {
    const runId = "review-1";
    const { events } = collectEvents(runId);

    await startRun({ runId, mode: "review", companyUrl: DEFAULT_COMPANY_URL });

    // Review mode runs the same analysis as autonomous but pauses at every
    // checkpoint so the operator can shape what a downstream agent inherits.
    const expectedCheckpoints = [
      "confirm_identity",
      "select_competitors",
      "review_sources",
      "review_claims",
      "review_gaps",
    ];

    for (const expected of expectedCheckpoints) {
      const pend = getPendingCheckpoint(runId);
      expect(pend?.type).toBe(expected);
      await resolveCheckpointAndResume(runId, pend!.checkpointId, {
        action: "approve",
      });
    }

    // Fully resolved -> run completes.
    expect(getPendingCheckpoint(runId)).toBeUndefined();
    const done = events.find((e) => e.type === "done");
    expect((done?.data as { status?: string })?.status).toBe("complete");
  });
});
