// Central guardrails for the autonomous agent (PRD §8).
export const LIMITS = {
  maxIterations: 8,
  maxCompetitors: 3,
  maxSourcesPerCompetitor: 3,
  maxResultsPerQuery: 5,
  maxSourceChars: 8000,
  // Grok X (Twitter) search.
  maxXPostsPerCompetitor: 3,
  xSearchDays: 365,
} as const;

// Thresholds the evidence evaluator uses to decide a competitor is "complete".
export const EVIDENCE_THRESHOLDS = {
  minSourceCount: 1,
  minGroundedClaims: 3,
  // A competitor is well-covered when it has positioning + target customer + at
  // least one feature claim, all grounded.
  requirePositioning: true,
  requireTargetCustomer: true,
  requireFeatures: true,
} as const;
