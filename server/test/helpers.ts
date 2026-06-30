import type {
  AgentEvent,
  ClaimState,
  ClaimType,
  CompetitorState,
  CompetitorStatus,
  SourceState,
} from "@shared/types";
import type { AgentState } from "../src/agent/state.js";
import { LIMITS } from "../src/agent/limits.js";
import { subscribe } from "../src/events.js";

export function makeCompetitor(
  id: string,
  name: string,
  status: CompetitorStatus = "researching"
): CompetitorState {
  return { id, name, urls: [], status };
}

export function makeSource(
  id: string,
  competitorId: string,
  text: string,
  url = `https://${id}.example.com`
): SourceState {
  return { id, competitorId, url, title: id, snippet: "", text };
}

export function makeClaim(
  id: string,
  competitorId: string,
  sourceId: string | null,
  type: ClaimType,
  value: string,
  evidence: string | null,
  confidence = 0.8
): ClaimState {
  return { id, competitorId, sourceId, type, value, evidence, confidence };
}

export function makeState(partial: Partial<AgentState> = {}): AgentState {
  return {
    runId: "test-run",
    mode: "autonomous",
    companyUrl: "https://acme-ai.example.com",
    optionalDescription: undefined,
    companyPageText: undefined,
    businessIdea: "Test idea",
    targetCustomer: "Test customer",
    competitors: [],
    currentCompetitorId: undefined,
    researchPlan: [],
    sources: [],
    claims: [],
    evidenceScores: [],
    sharedPatterns: [],
    gaps: [],
    recommendation: undefined,
    checkpoints: [],
    safetyFlags: {},
    iterations: 0,
    maxIterations: LIMITS.maxIterations,
    ...partial,
  };
}

// Collects all events emitted for a run into an array (subscribe before starting).
export function collectEvents(runId: string): {
  events: AgentEvent[];
  stop: () => void;
} {
  const events: AgentEvent[] = [];
  const stop = subscribe(runId, (e) => events.push(e));
  return { events, stop };
}

// Ordered list of unique node names from "step" events (first occurrence).
export function stepNodeOrder(events: AgentEvent[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const e of events) {
    if (e.type !== "step" || !e.node) continue;
    if (!seen.has(e.node)) {
      seen.add(e.node);
      order.push(e.node);
    }
  }
  return order;
}
