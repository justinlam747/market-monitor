import { interrupt } from "@langchain/langgraph";
import type { CheckpointResolution, CheckpointType } from "@shared/types";
import type { AgentState, AgentUpdate } from "../state.js";
import { getRunContext } from "../runContext.js";
import {
  applyIdentityResolution,
  applyCompetitorResolution,
  applySourceResolution,
  applyClaimResolution,
  applyGapResolution,
} from "../checkpointLogic.js";

interface CheckpointConfig {
  type: CheckpointType;
  buildPayload: (state: AgentState) => unknown;
  apply: (state: AgentState, res: CheckpointResolution) => AgentUpdate;
}

// Shared maybe_* behavior. In autonomous mode the checkpoint is recorded as
// not_required and the graph continues. In review mode the node calls
// interrupt() to pause; the runner observes the interrupt and surfaces a
// checkpoint_waiting event. On resume (via Command({ resume })) the node
// re-executes, interrupt() returns the user's resolution, and we apply it.
async function runCheckpoint(
  state: AgentState,
  cfg: CheckpointConfig
): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);

  if (state.mode === "autonomous") {
    await p.createCheckpoint(cfg.type, "not_required", null);
    await p.recordStep(`maybe_${cfg.type}`, {
      message: `[maybe_${cfg.type}] autonomous → auto-approved`,
    });
    return {};
  }

  // Review mode: pause. Code above interrupt() must stay side-effect-free
  // because it re-runs on resume.
  const payload = cfg.buildPayload(state);
  const resolution = interrupt({ type: cfg.type, payload }) as CheckpointResolution;

  await p.recordStep(`maybe_${cfg.type}`, {
    message: `[maybe_${cfg.type}] review → ${resolution.action}`,
    output: resolution,
  });
  return cfg.apply(state, resolution);
}

export const maybeConfirmIdentity = (state: AgentState) =>
  runCheckpoint(state, {
    type: "confirm_identity",
    buildPayload: (s) => ({
      businessIdea: s.businessIdea,
      targetCustomer: s.targetCustomer,
    }),
    apply: applyIdentityResolution,
  });

export const maybeSelectCompetitors = (state: AgentState) =>
  runCheckpoint(state, {
    type: "select_competitors",
    buildPayload: (s) => s.competitors,
    apply: applyCompetitorResolution,
  });

export const maybeReviewSources = (state: AgentState) =>
  runCheckpoint(state, {
    type: "review_sources",
    buildPayload: (s) => s.sources,
    apply: applySourceResolution,
  });

export const maybeReviewClaims = (state: AgentState) =>
  runCheckpoint(state, {
    type: "review_claims",
    buildPayload: (s) => s.claims,
    apply: applyClaimResolution,
  });

export const maybeReviewGaps = (state: AgentState) =>
  runCheckpoint(state, {
    type: "review_gaps",
    buildPayload: (s) => ({
      gaps: s.gaps,
      sharedPatterns: s.sharedPatterns,
      recommendation: s.recommendation,
    }),
    apply: applyGapResolution,
  });
