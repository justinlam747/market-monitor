// Shared contract between the LangGraph agent (server) and the React client.
// Keep this file dependency-free so both runtimes can import it directly.

// ----------------------------- Run modes ------------------------------------

export type RunMode = "autonomous" | "review";

export type RunStatus =
  | "running"
  | "waiting_for_user"
  | "needs_review"
  | "complete"
  | "cancelled"
  | "error";

// ----------------------------- Domain ---------------------------------------

export type CompetitorStatus = "pending" | "researching" | "complete";

export interface CompetitorState {
  id: string;
  name: string;
  urls?: string[];
  // X (Twitter) handle, when discovered — used to target X search.
  handle?: string;
  status: CompetitorStatus;
}

export interface ResearchPlanItem {
  competitorId: string;
  queries: string[];
  requiredSignals: string[];
}

export interface SourceState {
  id: string;
  competitorId: string;
  url: string;
  title?: string;
  snippet?: string;
  text?: string;
}

export type ClaimType =
  | "target_customer"
  | "positioning"
  | "feature"
  | "pricing"
  | "recent_signal" // newest releases / product updates / momentum
  | "funding"; // who is backing them (investors / rounds)

export interface ClaimState {
  id: string;
  competitorId: string;
  sourceId: string | null;
  type: ClaimType;
  value: string;
  evidence: string | null;
  confidence: number;
}

// A richer, grounded narrative about a competitor — what they do and how they
// are moving (recent releases, funding/backing, momentum) — not just "is a rival".
export interface CompetitorProfile {
  name: string;
  summary: string; // what they do / who they serve / how they position
  movement: string; // recent trajectory: releases, funding, momentum
}

export interface EvidenceScore {
  competitorId: string;
  hasPositioning: boolean;
  hasTargetCustomer: boolean;
  hasFeatures: boolean;
  sourceCount: number;
  groundedClaimCount: number;
}

// ----------------------------- Checkpoints ----------------------------------

export type CheckpointType =
  | "confirm_identity"
  | "select_competitors"
  | "review_sources"
  | "review_claims"
  | "review_gaps";

export type CheckpointStatus =
  | "not_required"
  | "waiting"
  | "approved"
  | "edited"
  | "rejected";

export interface CheckpointState {
  id: string;
  type: CheckpointType;
  status: CheckpointStatus;
  payload?: unknown;
}

export interface SafetyFlags {
  blockedUrl?: boolean;
  promptInjectionDetected?: boolean;
  weakEvidence?: boolean;
}

// ----------------------------- Agent state ----------------------------------

export interface AgentStateShape {
  runId: string;
  mode: RunMode;

  companyUrl: string;
  optionalDescription?: string;

  // Derived identity (filled by extract_identity)
  businessIdea?: string;
  targetCustomer?: string;

  competitors: CompetitorState[];
  currentCompetitorId?: string;

  researchPlan: ResearchPlanItem[];
  sources: SourceState[];
  claims: ClaimState[];
  evidenceScores: EvidenceScore[];

  sharedPatterns: string[];
  gaps: string[];
  recommendation?: string;

  checkpoints: CheckpointState[];
  safetyFlags: SafetyFlags;

  iterations: number;
  maxIterations: number;
}

// ----------------------------- API DTOs -------------------------------------

export interface CreateRunRequest {
  companyUrl: string;
  optionalDescription?: string;
  mode?: RunMode;
}

export interface CreateRunResponse {
  runId: string;
}

export interface RunSnapshot {
  id: string;
  mode: RunMode;
  status: RunStatus;
  companyUrl: string | null;
  optionalDescription: string | null;
  businessIdea: string | null;
  targetCustomer: string | null;
  recommendation: string | null;
  sharedPatterns: string[];
  competitorProfiles: CompetitorProfile[];
  startedAt: string;
  endedAt: string | null;
  competitors: SnapshotCompetitor[];
  gaps: string[];
  steps: SnapshotStep[];
  checkpoints: SnapshotCheckpoint[];
}

export interface SnapshotCompetitor {
  id: string;
  name: string;
  urls: string[];
  status: CompetitorStatus;
  sources: SourceState[];
  claims: ClaimState[];
}

export interface SnapshotStep {
  id: string;
  nodeName: string;
  reasoning: string | null;
  input: unknown;
  output: unknown;
  createdAt: string;
}

export interface SnapshotCheckpoint {
  id: string;
  type: CheckpointType;
  status: CheckpointStatus;
  payload: unknown;
  createdAt: string;
  resolvedAt: string | null;
}

export interface RunListItem {
  id: string;
  mode: RunMode;
  status: RunStatus;
  companyUrl: string | null;
  businessIdea: string | null;
  startedAt: string;
  endedAt: string | null;
  competitorCount: number;
}

// Checkpoint resolution actions (control endpoints)
export type CheckpointAction = "approve" | "edit" | "reject";

export interface CheckpointResolution {
  action: CheckpointAction;
  // For "edit": the replacement payload (e.g. edited competitor list).
  // For "reject": ids of sources/claims to drop.
  payload?: unknown;
  rejectedIds?: string[];
}

// ----------------------------- SSE events -----------------------------------

export type AgentEventType =
  | "step"
  | "competitor"
  | "source"
  | "claim"
  | "evidence"
  | "gap"
  | "identity"
  | "recommendation"
  | "checkpoint_waiting"
  | "checkpoint_resolved"
  | "needs_review"
  | "status"
  | "done"
  | "error";

export interface AgentEvent<T = unknown> {
  type: AgentEventType;
  runId: string;
  // Monotonic sequence number so the client can order/dedupe.
  seq: number;
  // Originating node, when applicable.
  node?: string;
  // Short human-readable line for the reasoning monitor, e.g. "[search_sources] Searching ...".
  message?: string;
  data?: T;
  ts: string;
}

// What a `checkpoint_waiting` event carries.
export interface CheckpointWaitingPayload {
  checkpointId: string;
  type: CheckpointType;
  payload: unknown;
}
