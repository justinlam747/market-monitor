import { Annotation } from "@langchain/langgraph";
import type {
  CompetitorState,
  ResearchPlanItem,
  SourceState,
  ClaimState,
  EvidenceScore,
  CheckpointState,
  SafetyFlags,
  RunMode,
} from "@shared/types";
import { LIMITS } from "./limits.js";

// Last-write-wins reducer for arrays/objects. Nodes return the full updated
// collection, which keeps node logic explicit and deterministic.
function replace<T>() {
  return {
    reducer: (_prev: T, next: T) => next,
  };
}

export const AgentAnnotation = Annotation.Root({
  runId: Annotation<string>,
  mode: Annotation<RunMode>,

  companyUrl: Annotation<string>,
  optionalDescription: Annotation<string | undefined>,

  // Internal: raw cleaned text of the company's own landing page.
  companyPageText: Annotation<string | undefined>,

  businessIdea: Annotation<string | undefined>,
  targetCustomer: Annotation<string | undefined>,

  competitors: Annotation<CompetitorState[]>({
    ...replace<CompetitorState[]>(),
    default: () => [],
  }),
  currentCompetitorId: Annotation<string | undefined>,

  researchPlan: Annotation<ResearchPlanItem[]>({
    ...replace<ResearchPlanItem[]>(),
    default: () => [],
  }),
  sources: Annotation<SourceState[]>({
    ...replace<SourceState[]>(),
    default: () => [],
  }),
  claims: Annotation<ClaimState[]>({
    ...replace<ClaimState[]>(),
    default: () => [],
  }),
  evidenceScores: Annotation<EvidenceScore[]>({
    ...replace<EvidenceScore[]>(),
    default: () => [],
  }),

  sharedPatterns: Annotation<string[]>({
    ...replace<string[]>(),
    default: () => [],
  }),
  gaps: Annotation<string[]>({
    ...replace<string[]>(),
    default: () => [],
  }),
  recommendation: Annotation<string | undefined>,

  checkpoints: Annotation<CheckpointState[]>({
    ...replace<CheckpointState[]>(),
    default: () => [],
  }),
  safetyFlags: Annotation<SafetyFlags>({
    ...replace<SafetyFlags>(),
    default: () => ({}),
  }),

  iterations: Annotation<number>({
    reducer: (_prev: number, next: number) => next,
    default: () => 0,
  }),
  maxIterations: Annotation<number>({
    reducer: (_prev: number, next: number) => next,
    default: () => LIMITS.maxIterations,
  }),
});

export type AgentState = typeof AgentAnnotation.State;
export type AgentUpdate = typeof AgentAnnotation.Update;
