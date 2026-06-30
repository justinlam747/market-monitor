import type {
  AgentEventType,
  CheckpointType,
  CheckpointStatus,
  ClaimState,
  CompetitorState,
  RunStatus,
  SourceState,
} from "@shared/types";
import { emitEvent } from "../events.js";
import { getPrisma } from "../db.js";
import { config, isFixtureMode } from "../config.js";

// Bundles all side effects for a single run: durable Prisma writes + live SSE
// emission. In fixture/test mode (or with no DB) it still emits events but skips
// the database so the graph logic can be exercised offline.
export class Persister {
  readonly runId: string;
  private readonly dbEnabled: boolean;

  constructor(runId: string) {
    this.runId = runId;
    this.dbEnabled =
      !isFixtureMode() && !config.disablePersistence && !!config.databaseUrl;
  }

  emit(
    type: AgentEventType,
    opts: { node?: string; message?: string; data?: unknown } = {}
  ) {
    emitEvent(this.runId, { type, ...opts });
  }

  async recordStep(
    nodeName: string,
    opts: {
      reasoning?: string;
      message?: string;
      input?: unknown;
      output?: unknown;
    } = {}
  ) {
    const event = emitEvent(this.runId, {
      type: "step",
      node: nodeName,
      message: opts.message ?? `[${nodeName}]`,
      data: { reasoning: opts.reasoning ?? null, output: opts.output ?? null },
    });

    if (this.dbEnabled) {
      await getPrisma().agentStep.create({
        data: {
          agentRunId: this.runId,
          nodeName,
          reasoning: opts.reasoning ?? null,
          seq: event.seq,
          input: (opts.input ?? undefined) as object | undefined,
          output: (opts.output ?? undefined) as object | undefined,
        },
      });
    }
  }

  async upsertCompetitor(c: CompetitorState) {
    if (this.dbEnabled) {
      await getPrisma().competitor.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          agentRunId: this.runId,
          name: c.name,
          urls: c.urls ?? [],
          status: c.status,
        },
        update: { name: c.name, urls: c.urls ?? [], status: c.status },
      });
    }
    this.emit("competitor", { data: c });
  }

  async upsertSource(s: SourceState) {
    if (this.dbEnabled) {
      await getPrisma().source.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          competitorId: s.competitorId,
          url: s.url,
          title: s.title,
          snippet: s.snippet,
          text: s.text,
        },
        update: { title: s.title, snippet: s.snippet, text: s.text },
      });
    }
    this.emit("source", { data: s });
  }

  async upsertClaim(c: ClaimState) {
    if (this.dbEnabled) {
      await getPrisma().claim.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          competitorId: c.competitorId,
          sourceId: c.sourceId ?? undefined,
          type: c.type,
          value: c.value,
          evidence: c.evidence,
          confidence: c.confidence,
        },
        update: {
          sourceId: c.sourceId ?? undefined,
          type: c.type,
          value: c.value,
          evidence: c.evidence,
          confidence: c.confidence,
        },
      });
    }
    this.emit("claim", { data: c });
  }

  async replaceGaps(gaps: string[]) {
    if (this.dbEnabled) {
      await getPrisma().gap.deleteMany({ where: { agentRunId: this.runId } });
      if (gaps.length > 0) {
        await getPrisma().gap.createMany({
          data: gaps.map((value) => ({ agentRunId: this.runId, value })),
        });
      }
    }
    for (const g of gaps) this.emit("gap", { data: { value: g } });
  }

  async updateRun(fields: {
    status?: RunStatus;
    businessIdea?: string;
    targetCustomer?: string;
    recommendation?: string;
    sharedPatterns?: string[];
    competitorProfiles?: unknown[];
    ended?: boolean;
  }) {
    if (this.dbEnabled) {
      await getPrisma().agentRun.update({
        where: { id: this.runId },
        data: {
          status: fields.status,
          businessIdea: fields.businessIdea,
          targetCustomer: fields.targetCustomer,
          recommendation: fields.recommendation,
          sharedPatterns: fields.sharedPatterns as object | undefined,
          competitorProfiles: fields.competitorProfiles as object | undefined,
          endedAt: fields.ended ? new Date() : undefined,
        },
      });
    }
    if (fields.status) {
      this.emit("status", { data: { status: fields.status } });
    }
  }

  // Creates a checkpoint row and returns its id (used by the runner when an
  // interrupt is observed, and by maybe_* nodes in autonomous mode).
  async createCheckpoint(
    type: CheckpointType,
    status: CheckpointStatus,
    payload: unknown
  ): Promise<string> {
    if (this.dbEnabled) {
      const row = await getPrisma().agentCheckpoint.create({
        data: {
          agentRunId: this.runId,
          type,
          status,
          payload: (payload ?? undefined) as object | undefined,
        },
      });
      return row.id;
    }
    // Offline id so the flow still works without a DB.
    return `cp_${type}_${Date.now()}`;
  }

  async resolveCheckpoint(
    checkpointId: string,
    status: CheckpointStatus,
    payload?: unknown
  ) {
    if (this.dbEnabled) {
      await getPrisma()
        .agentCheckpoint.update({
          where: { id: checkpointId },
          data: {
            status,
            payload: (payload ?? undefined) as object | undefined,
            resolvedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
    this.emit("checkpoint_resolved", { data: { checkpointId, status } });
  }
}
