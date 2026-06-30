import type { AgentState, AgentUpdate } from "../state.js";
import { getRunContext } from "../runContext.js";
import { analyzeGaps } from "../tools/gapAnalyzer.js";
import { isClaimGrounded } from "../tools/evaluator.js";
import { computeFinalStatus } from "../router.js";

// Node: analyze_gaps — compare competitors using only grounded claims.
export async function analyzeGapsNode(state: AgentState): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);
  const groundedClaims = state.claims.filter((c) =>
    isClaimGrounded(c, state.sources)
  );

  const result = await analyzeGaps({
    businessIdea: state.businessIdea,
    targetCustomer: state.targetCustomer,
    competitors: state.competitors,
    claims: groundedClaims,
  });

  await p.replaceGaps(result.gaps);
  await p.updateRun({
    recommendation: result.recommendation,
    sharedPatterns: result.sharedPatterns,
    competitorProfiles: result.competitorProfiles,
  });
  p.emit("recommendation", {
    node: "analyze_gaps",
    message: `[analyze_gaps] ${result.gaps.length} gaps, recommendation ready`,
    data: {
      competitorProfiles: result.competitorProfiles,
      sharedPatterns: result.sharedPatterns,
      gaps: result.gaps,
      recommendation: result.recommendation,
    },
  });
  await p.recordStep("analyze_gaps", {
    message: `[analyze_gaps] ${result.gaps.length} gaps identified`,
    output: result,
  });

  return {
    sharedPatterns: result.sharedPatterns,
    gaps: result.gaps,
    recommendation: result.recommendation,
  };
}

// Node: finalize_state — set terminal status and emit done.
export async function finalizeState(state: AgentState): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);
  const status = computeFinalStatus(state);

  await p.updateRun({ status, ended: true });
  p.emit("done", {
    node: "finalize_state",
    message: `[finalize_state] Run ${status}`,
    data: { status },
  });
  await p.recordStep("finalize_state", {
    message: `[finalize_state] Finalized with status: ${status}`,
  });

  return {};
}
