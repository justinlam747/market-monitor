import type {
  ClaimState,
  ClaimType,
  CompetitorProfile,
  CompetitorStatus,
  RunListItem,
  RunMode,
  RunSnapshot,
  RunStatus,
  SourceState,
} from "@shared/types";
import { getPrisma } from "../db.js";

function asStringArray(json: unknown): string[] {
  return Array.isArray(json) ? (json as string[]) : [];
}

function asProfiles(json: unknown): CompetitorProfile[] {
  return Array.isArray(json) ? (json as CompetitorProfile[]) : [];
}

export async function getRunSnapshot(runId: string): Promise<RunSnapshot | null> {
  const run = await getPrisma().agentRun.findUnique({
    where: { id: runId },
    include: {
      competitors: { include: { sources: true, claims: true } },
      gaps: true,
      steps: { orderBy: { seq: "asc" } },
      checkpoints: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) return null;

  return {
    id: run.id,
    mode: run.mode as RunMode,
    status: run.status as RunStatus,
    companyUrl: run.companyUrl,
    optionalDescription: run.optionalDescription,
    businessIdea: run.businessIdea,
    targetCustomer: run.targetCustomer,
    recommendation: run.recommendation,
    sharedPatterns: asStringArray(run.sharedPatterns),
    competitorProfiles: asProfiles(run.competitorProfiles),
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt ? run.endedAt.toISOString() : null,
    gaps: run.gaps.map((g) => g.value),
    competitors: run.competitors.map((c) => ({
      id: c.id,
      name: c.name,
      urls: c.urls,
      status: c.status as CompetitorStatus,
      sources: c.sources.map(
        (s): SourceState => ({
          id: s.id,
          competitorId: s.competitorId,
          url: s.url,
          title: s.title ?? undefined,
          snippet: s.snippet ?? undefined,
          text: s.text ?? undefined,
        })
      ),
      claims: c.claims.map(
        (cl): ClaimState => ({
          id: cl.id,
          competitorId: cl.competitorId,
          sourceId: cl.sourceId,
          type: cl.type as ClaimType,
          value: cl.value,
          evidence: cl.evidence,
          confidence: cl.confidence,
        })
      ),
    })),
    steps: run.steps.map((s) => ({
      id: s.id,
      nodeName: s.nodeName,
      reasoning: s.reasoning,
      input: s.input ?? null,
      output: s.output ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    checkpoints: run.checkpoints.map((cp) => ({
      id: cp.id,
      type: cp.type as RunSnapshot["checkpoints"][number]["type"],
      status: cp.status as RunSnapshot["checkpoints"][number]["status"],
      payload: cp.payload ?? null,
      createdAt: cp.createdAt.toISOString(),
      resolvedAt: cp.resolvedAt ? cp.resolvedAt.toISOString() : null,
    })),
  };
}

export async function listRuns(): Promise<RunListItem[]> {
  const runs = await getPrisma().agentRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 500,
    include: { _count: { select: { competitors: true } } },
  });
  return runs.map((r) => ({
    id: r.id,
    mode: r.mode as RunMode,
    status: r.status as RunStatus,
    companyUrl: r.companyUrl,
    businessIdea: r.businessIdea,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt ? r.endedAt.toISOString() : null,
    competitorCount: r._count.competitors,
  }));
}
