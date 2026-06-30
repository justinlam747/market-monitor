import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentAnnotation } from "./state.js";
import { getCheckpointer } from "../checkpointer.js";
import { routeAfterValidate, routeDecision } from "./router.js";
import {
  validateInput,
  scrapeCompanySite,
  extractIdentityNode,
} from "./nodes/intake.js";
import {
  discoverCompetitorsNode,
  collectSources,
  extractSignals,
  evaluateEvidenceNode,
} from "./nodes/research.js";
import {
  maybeConfirmIdentity,
  maybeSelectCompetitors,
  maybeReviewSources,
  maybeReviewClaims,
  maybeReviewGaps,
} from "./nodes/checkpoints.js";
import { analyzeGapsNode, finalizeState } from "./nodes/gaps.js";

// Builds and compiles the LangGraph agent. Both run modes share one analysis
// pipeline; the maybe_* checkpoints pause for the operator in review mode and
// pass straight through (recorded as not_required) in autonomous mode. So a
// review run exposes every decision a downstream agent would inherit.
export async function buildGraph() {
  const workflow = new StateGraph(AgentAnnotation)
    .addNode("validate_input", validateInput)
    .addNode("scrape_company_site", scrapeCompanySite)
    .addNode("extract_identity", extractIdentityNode)
    .addNode("maybe_confirm_identity", maybeConfirmIdentity)
    .addNode("discover_competitors", discoverCompetitorsNode)
    .addNode("maybe_select_competitors", maybeSelectCompetitors)
    .addNode("collect_sources", collectSources)
    .addNode("maybe_review_sources", maybeReviewSources)
    .addNode("extract_signals", extractSignals)
    .addNode("evaluate_evidence", evaluateEvidenceNode)
    .addNode("maybe_review_claims", maybeReviewClaims)
    .addNode("analyze_gaps", analyzeGapsNode)
    .addNode("maybe_review_gaps", maybeReviewGaps)
    .addNode("finalize_state", finalizeState)

    .addEdge(START, "validate_input")
    .addConditionalEdges("validate_input", routeAfterValidate, {
      scrape_company_site: "scrape_company_site",
      finalize_state: "finalize_state",
    })
    .addEdge("scrape_company_site", "extract_identity")
    .addEdge("extract_identity", "maybe_confirm_identity")
    .addEdge("maybe_confirm_identity", "discover_competitors")
    .addEdge("discover_competitors", "maybe_select_competitors")
    .addEdge("maybe_select_competitors", "collect_sources")
    .addEdge("collect_sources", "maybe_review_sources")
    .addEdge("maybe_review_sources", "extract_signals")
    .addEdge("extract_signals", "evaluate_evidence")
    .addEdge("evaluate_evidence", "maybe_review_claims")
    .addConditionalEdges("maybe_review_claims", routeDecision, {
      retry_search: "collect_sources",
      retry_extraction: "extract_signals",
      analyze_gaps: "analyze_gaps",
    })
    .addEdge("analyze_gaps", "maybe_review_gaps")
    .addEdge("maybe_review_gaps", "finalize_state")
    .addEdge("finalize_state", END);

  const checkpointer = await getCheckpointer();
  return workflow.compile({ checkpointer });
}

export type CompiledGraph = Awaited<ReturnType<typeof buildGraph>>;
