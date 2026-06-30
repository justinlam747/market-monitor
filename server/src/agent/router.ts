import type { RunStatus } from "@shared/types";
import type { AgentState } from "./state.js";
import { LIMITS } from "./limits.js";
import { isClaimGrounded } from "./tools/evaluator.js";

export type RouteTarget = "retry_search" | "retry_extraction" | "analyze_gaps";

// After validate_input: a blocked URL is a hard safety stop (overrides mode).
export function routeAfterValidate(
  state: Pick<AgentState, "safetyFlags">
): "scrape_company_site" | "finalize_state" {
  return state.safetyFlags.blockedUrl ? "finalize_state" : "scrape_company_site";
}

// Terminal status. A blocked URL is always a hard stop. In autonomous mode the
// run never asks for human approval — low-confidence results still finalize as
// complete. Only review mode surfaces needs_review for an operator to accept.
export function computeFinalStatus(
  state: Pick<AgentState, "safetyFlags" | "competitors" | "mode">
): RunStatus {
  if (state.safetyFlags.blockedUrl) return "error";
  if (state.mode === "autonomous") return "complete";
  if (state.competitors.length === 0) return "needs_review";
  if (state.safetyFlags.weakEvidence) return "needs_review";
  return "complete";
}

// Pure routing decision used by the conditional edge after maybe_review_claims.
// Deterministic — no I/O — so it can be unit-tested directly.
//
//   retry_search      -> re-enter collect_sources (need more / first sources)
//   retry_extraction  -> re-enter extract_signals (have sources, no grounded claims)
//   analyze_gaps      -> all competitors complete, or budget/cap exhausted
export function routeDecision(
  state: Pick<
    AgentState,
    "competitors" | "claims" | "sources" | "iterations" | "maxIterations"
  >
): RouteTarget {
  // Hard stop on iteration budget.
  if (state.iterations >= state.maxIterations) return "analyze_gaps";

  const incomplete = state.competitors.filter((c) => c.status !== "complete");
  if (incomplete.length === 0) return "analyze_gaps";

  const target = incomplete[0]!;
  const compSources = state.sources.filter(
    (s) => s.competitorId === target.id
  );
  const groundedClaims = state.claims.filter(
    (c) => c.competitorId === target.id && isClaimGrounded(c, state.sources)
  );

  // We have raw sources but extraction hasn't produced grounded claims yet.
  if (compSources.length > 0 && groundedClaims.length === 0) {
    return "retry_extraction";
  }

  // Room to gather more sources for this competitor.
  if (compSources.length < LIMITS.maxSourcesPerCompetitor) {
    return "retry_search";
  }

  // Hit the per-competitor source cap and still weak: give up on improving this
  // one to avoid looping; proceed with what we have.
  return "analyze_gaps";
}
