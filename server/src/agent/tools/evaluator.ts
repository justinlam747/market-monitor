import type {
  ClaimState,
  SourceState,
  CompetitorState,
  EvidenceScore,
} from "@shared/types";
import { EVIDENCE_THRESHOLDS } from "../limits.js";

// ---- Grounding -------------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// A claim is grounded iff it has non-empty evidence that points to a real source
// whose text actually contains that evidence. This is the heart of "source-
// grounded extraction": fabricated or unsupported claims fail here.
export function isClaimGrounded(
  claim: Pick<ClaimState, "evidence" | "sourceId">,
  sources: SourceState[]
): boolean {
  if (!claim.evidence || claim.evidence.trim() === "") return false;
  if (!claim.sourceId) return false;
  const source = sources.find((s) => s.id === claim.sourceId);
  if (!source || !source.text) return false;
  return normalize(source.text).includes(normalize(claim.evidence));
}

// ---- Scoring ---------------------------------------------------------------

export function scoreCompetitor(
  competitorId: string,
  claims: ClaimState[],
  sources: SourceState[]
): EvidenceScore {
  const compSources = sources.filter((s) => s.competitorId === competitorId);
  const compClaims = claims.filter((c) => c.competitorId === competitorId);
  const grounded = compClaims.filter((c) => isClaimGrounded(c, sources));

  const hasType = (t: ClaimState["type"]) =>
    grounded.some((c) => c.type === t);

  return {
    competitorId,
    hasPositioning: hasType("positioning"),
    hasTargetCustomer: hasType("target_customer"),
    hasFeatures: hasType("feature"),
    sourceCount: compSources.length,
    groundedClaimCount: grounded.length,
  };
}

export function isCompetitorComplete(score: EvidenceScore): boolean {
  const t = EVIDENCE_THRESHOLDS;
  if (score.sourceCount < t.minSourceCount) return false;
  if (score.groundedClaimCount < t.minGroundedClaims) return false;
  if (t.requirePositioning && !score.hasPositioning) return false;
  if (t.requireTargetCustomer && !score.hasTargetCustomer) return false;
  if (t.requireFeatures && !score.hasFeatures) return false;
  return true;
}

export interface EvaluationResult {
  evidenceScores: EvidenceScore[];
  competitors: CompetitorState[];
  weakEvidence: boolean;
}

// Pure evaluation: scores every competitor, marks complete ones, and reports
// whether any competitor still lacks sufficient grounded evidence.
export function evaluateEvidence(
  competitors: CompetitorState[],
  claims: ClaimState[],
  sources: SourceState[]
): EvaluationResult {
  const evidenceScores: EvidenceScore[] = [];
  let weakEvidence = false;

  const updated = competitors.map((c) => {
    const score = scoreCompetitor(c.id, claims, sources);
    evidenceScores.push(score);
    const complete = isCompetitorComplete(score);
    if (!complete) weakEvidence = true;
    return {
      ...c,
      status: complete ? ("complete" as const) : c.status,
    };
  });

  return { evidenceScores, competitors: updated, weakEvidence };
}
