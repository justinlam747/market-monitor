import { describe, it, expect } from "vitest";
import {
  routeDecision,
  routeAfterValidate,
  computeFinalStatus,
} from "../src/agent/router.js";
import {
  makeState,
  makeCompetitor,
  makeSource,
  makeClaim,
} from "./helpers.js";

describe("route_decision", () => {
  it("routes to retry_search when a competitor's evidence is weak (PRD §13.1)", () => {
    // Competitor has 1 source + grounded claims but is missing target_customer,
    // and is under the per-competitor source cap -> gather more sources.
    const text =
      "Acme is a positioning-focused product with great features for teams.";
    const state = makeState({
      competitors: [makeCompetitor("c1", "Acme", "researching")],
      sources: [makeSource("s1", "c1", text)],
      claims: [
        makeClaim("cl1", "c1", "s1", "positioning", "positioning-focused", "positioning-focused product"),
        makeClaim("cl2", "c1", "s1", "feature", "features for teams", "features for teams"),
      ],
    });
    expect(routeDecision(state)).toBe("retry_search");
  });

  it("routes to gather the next competitor when one is complete but another is not (PRD §13.2)", () => {
    const state = makeState({
      competitors: [
        makeCompetitor("c1", "Done", "complete"),
        makeCompetitor("c2", "Todo", "researching"),
      ],
      // c2 has no sources yet -> needs collection.
      sources: [],
      claims: [],
    });
    // retry_search re-enters collect_sources, which handles the next incomplete competitor.
    expect(routeDecision(state)).toBe("retry_search");
  });

  it("routes to analyze_gaps when all competitors are complete (PRD §13.3)", () => {
    const state = makeState({
      competitors: [
        makeCompetitor("c1", "A", "complete"),
        makeCompetitor("c2", "B", "complete"),
      ],
    });
    expect(routeDecision(state)).toBe("analyze_gaps");
  });

  it("routes to retry_extraction when sources exist but no grounded claims yet", () => {
    const state = makeState({
      competitors: [makeCompetitor("c1", "Acme", "researching")],
      sources: [makeSource("s1", "c1", "Some page text about acme.")],
      claims: [],
    });
    expect(routeDecision(state)).toBe("retry_extraction");
  });

  it("hard-stops to analyze_gaps when iterations are exhausted", () => {
    const state = makeState({
      competitors: [makeCompetitor("c1", "Acme", "researching")],
      iterations: 8,
      maxIterations: 8,
    });
    expect(routeDecision(state)).toBe("analyze_gaps");
  });
});

describe("routeAfterValidate", () => {
  it("stops at finalize_state when the URL is blocked", () => {
    const state = makeState({ safetyFlags: { blockedUrl: true } });
    expect(routeAfterValidate(state)).toBe("finalize_state");
  });
  it("continues to scrape_company_site when the URL is safe", () => {
    expect(routeAfterValidate(makeState())).toBe("scrape_company_site");
  });
});

describe("computeFinalStatus", () => {
  it("is error when the URL was blocked", () => {
    expect(
      computeFinalStatus(makeState({ safetyFlags: { blockedUrl: true } }))
    ).toBe("error");
  });

  it("is needs_review when evidence is too weak in REVIEW mode", () => {
    expect(
      computeFinalStatus(
        makeState({
          mode: "review",
          competitors: [makeCompetitor("c1", "A")],
          safetyFlags: { weakEvidence: true },
        })
      )
    ).toBe("needs_review");
  });

  it("is needs_review when no competitors were found in REVIEW mode", () => {
    expect(
      computeFinalStatus(makeState({ mode: "review", competitors: [] }))
    ).toBe("needs_review");
  });

  it("autonomous mode never asks for approval — weak evidence still completes", () => {
    expect(
      computeFinalStatus(
        makeState({
          mode: "autonomous",
          competitors: [makeCompetitor("c1", "A")],
          safetyFlags: { weakEvidence: true },
        })
      )
    ).toBe("complete");
    expect(
      computeFinalStatus(makeState({ mode: "autonomous", competitors: [] }))
    ).toBe("complete");
  });

  it("is complete on the happy path", () => {
    expect(
      computeFinalStatus(
        makeState({ competitors: [makeCompetitor("c1", "A", "complete")] })
      )
    ).toBe("complete");
  });
});
