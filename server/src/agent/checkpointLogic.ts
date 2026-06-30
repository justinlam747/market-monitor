import type { CheckpointResolution, CompetitorState } from "@shared/types";
import type { AgentState, AgentUpdate } from "./state.js";
import { newId } from "./tools/ids.js";

// Pure transforms applied when a review-mode checkpoint resolves. Kept separate
// from the graph so they can be unit-tested without LangGraph or a database.

export function applyIdentityResolution(
  state: Pick<AgentState, "businessIdea" | "targetCustomer">,
  res: CheckpointResolution
): AgentUpdate {
  if (res.action === "edit" && res.payload && typeof res.payload === "object") {
    const p = res.payload as { businessIdea?: string; targetCustomer?: string };
    return {
      businessIdea: p.businessIdea ?? state.businessIdea,
      targetCustomer: p.targetCustomer ?? state.targetCustomer,
    };
  }
  // approve / reject -> keep as-is (identity can't be meaningfully rejected)
  return {};
}

export function applyCompetitorResolution(
  state: Pick<AgentState, "competitors">,
  res: CheckpointResolution
): AgentUpdate {
  if (res.action === "edit" && Array.isArray(res.payload)) {
    const edited = (res.payload as Array<Partial<CompetitorState>>).map((c) => ({
      id: c.id ?? newId("cmp"),
      name: (c.name ?? "").trim(),
      urls: c.urls ?? [],
      status: c.status ?? ("pending" as const),
    }));
    return { competitors: edited.filter((c) => c.name.length > 0) };
  }
  if (res.action === "reject" && res.rejectedIds?.length) {
    const drop = new Set(res.rejectedIds);
    return { competitors: state.competitors.filter((c) => !drop.has(c.id)) };
  }
  return {};
}

export function applySourceResolution(
  state: Pick<AgentState, "sources" | "claims">,
  res: CheckpointResolution
): AgentUpdate {
  if (res.action === "reject" && res.rejectedIds?.length) {
    const drop = new Set(res.rejectedIds);
    return {
      sources: state.sources.filter((s) => !drop.has(s.id)),
      // Drop any claims that were grounded in a rejected source.
      claims: state.claims.filter(
        (c) => !c.sourceId || !drop.has(c.sourceId)
      ),
    };
  }
  return {};
}

export function applyClaimResolution(
  state: Pick<AgentState, "claims">,
  res: CheckpointResolution
): AgentUpdate {
  if (res.action === "reject" && res.rejectedIds?.length) {
    const drop = new Set(res.rejectedIds);
    return { claims: state.claims.filter((c) => !drop.has(c.id)) };
  }
  return {};
}

export function applyGapResolution(
  state: Pick<AgentState, "gaps" | "sharedPatterns" | "recommendation">,
  res: CheckpointResolution
): AgentUpdate {
  if (res.action === "edit" && res.payload && typeof res.payload === "object") {
    const p = res.payload as {
      gaps?: string[];
      sharedPatterns?: string[];
      recommendation?: string;
    };
    return {
      gaps: p.gaps ?? state.gaps,
      sharedPatterns: p.sharedPatterns ?? state.sharedPatterns,
      recommendation: p.recommendation ?? state.recommendation,
    };
  }
  return {};
}
