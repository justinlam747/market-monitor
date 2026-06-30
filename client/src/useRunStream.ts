import { useEffect, useState } from "react";
import type {
  AgentEvent,
  AgentEventType,
  ClaimState,
  CompetitorProfile,
  EvidenceScore,
  RunMode,
  RunSnapshot,
  RunStatus,
  SourceState,
} from "@shared/types";
import { getRun, streamUrl } from "./api.js";

export interface TimelineItem {
  seq: number;
  type: AgentEventType;
  node?: string;
  message: string;
  reasoning?: string | null;
  output?: unknown;
}

export interface LiveCompetitor {
  id: string;
  name: string;
  status: string;
  sources: SourceState[];
  claims: ClaimState[];
}

export interface ActiveCheckpoint {
  checkpointId: string;
  type: string;
  payload: unknown;
}

export interface LiveState {
  status: RunStatus | "loading";
  mode?: RunMode;
  companyUrl?: string;
  businessIdea?: string;
  targetCustomer?: string;
  competitors: LiveCompetitor[];
  evidenceScores: EvidenceScore[];
  gaps: string[];
  sharedPatterns: string[];
  recommendation?: string;
  competitorProfiles: CompetitorProfile[];
  timeline: TimelineItem[];
  activeCheckpoint?: ActiveCheckpoint;
  needsReview: boolean;
  error?: string;
}

const TERMINAL: RunStatus[] = ["complete", "error", "cancelled"];

const initialState: LiveState = {
  status: "loading",
  competitors: [],
  evidenceScores: [],
  gaps: [],
  sharedPatterns: [],
  competitorProfiles: [],
  timeline: [],
  needsReview: false,
};

const EVENT_TYPES: AgentEventType[] = [
  "step",
  "competitor",
  "source",
  "claim",
  "evidence",
  "gap",
  "identity",
  "recommendation",
  "checkpoint_waiting",
  "checkpoint_resolved",
  "needs_review",
  "status",
  "done",
  "error",
];

function upsertCompetitor(
  comps: LiveCompetitor[],
  id: string,
  patch: Partial<LiveCompetitor>
): LiveCompetitor[] {
  const idx = comps.findIndex((c) => c.id === id);
  if (idx === -1) {
    return [
      ...comps,
      {
        id,
        name: patch.name ?? id,
        status: patch.status ?? "pending",
        sources: patch.sources ?? [],
        claims: patch.claims ?? [],
        ...patch,
      },
    ];
  }
  const next = [...comps];
  next[idx] = { ...next[idx], ...patch };
  return next;
}

function addTimeline(state: LiveState, ev: AgentEvent): TimelineItem[] {
  if (!ev.message) return state.timeline;
  if (state.timeline.some((t) => t.seq === ev.seq)) return state.timeline;
  const d = ev.data as { reasoning?: string | null; output?: unknown } | undefined;
  return [
    ...state.timeline,
    {
      seq: ev.seq,
      type: ev.type,
      node: ev.node,
      message: ev.message,
      reasoning: d?.reasoning ?? null,
      output: d?.output ?? null,
    },
  ];
}

function reduce(state: LiveState, ev: AgentEvent): LiveState {
  const timeline = addTimeline(state, ev);
  const base = { ...state, timeline };

  switch (ev.type) {
    case "identity": {
      const d = ev.data as { businessIdea?: string; targetCustomer?: string };
      return { ...base, businessIdea: d.businessIdea, targetCustomer: d.targetCustomer };
    }
    case "competitor": {
      const c = ev.data as LiveCompetitor;
      return {
        ...base,
        competitors: upsertCompetitor(state.competitors, c.id, {
          name: c.name,
          status: c.status,
        }),
      };
    }
    case "source": {
      const s = ev.data as SourceState;
      const comp = state.competitors.find((c) => c.id === s.competitorId);
      const sources = comp
        ? comp.sources.some((x) => x.id === s.id)
          ? comp.sources.map((x) => (x.id === s.id ? s : x))
          : [...comp.sources, s]
        : [s];
      return {
        ...base,
        competitors: upsertCompetitor(state.competitors, s.competitorId, {
          sources,
        }),
      };
    }
    case "claim": {
      const cl = ev.data as ClaimState;
      const comp = state.competitors.find((c) => c.id === cl.competitorId);
      const claims = comp
        ? comp.claims.some((x) => x.id === cl.id)
          ? comp.claims.map((x) => (x.id === cl.id ? cl : x))
          : [...comp.claims, cl]
        : [cl];
      return {
        ...base,
        competitors: upsertCompetitor(state.competitors, cl.competitorId, {
          claims,
        }),
      };
    }
    case "evidence":
      return { ...base, evidenceScores: ev.data as EvidenceScore[] };
    case "gap": {
      const v = (ev.data as { value: string }).value;
      return base.gaps.includes(v)
        ? base
        : { ...base, gaps: [...base.gaps, v] };
    }
    case "recommendation": {
      const d = ev.data as {
        sharedPatterns: string[];
        gaps: string[];
        recommendation: string;
        competitorProfiles?: CompetitorProfile[];
      };
      return {
        ...base,
        sharedPatterns: d.sharedPatterns,
        gaps: d.gaps,
        recommendation: d.recommendation,
        competitorProfiles: d.competitorProfiles ?? base.competitorProfiles,
      };
    }
    case "checkpoint_waiting": {
      const d = ev.data as ActiveCheckpoint;
      return { ...base, activeCheckpoint: d, status: "waiting_for_user" };
    }
    case "checkpoint_resolved":
      return { ...base, activeCheckpoint: undefined };
    case "needs_review":
      return { ...base, needsReview: true };
    case "status":
      return { ...base, status: (ev.data as { status: RunStatus }).status };
    case "done":
      return {
        ...base,
        status: (ev.data as { status: RunStatus }).status ?? "complete",
        activeCheckpoint: undefined,
      };
    case "error":
      return {
        ...base,
        status: "error",
        error: (ev.data as { message?: string })?.message,
      };
    default:
      return base;
  }
}

function seedFromSnapshot(snap: RunSnapshot): LiveState {
  const competitors: LiveCompetitor[] = snap.competitors.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    sources: c.sources,
    claims: c.claims,
  }));
  const timeline: TimelineItem[] = TERMINAL.includes(snap.status)
    ? snap.steps.map((s, i) => ({
        seq: i + 1,
        type: "step",
        node: s.nodeName,
        message: `[${s.nodeName}]${s.reasoning ? " " + s.reasoning : ""}`,
        reasoning: s.reasoning,
      }))
    : [];

  return {
    status: snap.status,
    mode: snap.mode,
    companyUrl: snap.companyUrl ?? undefined,
    businessIdea: snap.businessIdea ?? undefined,
    targetCustomer: snap.targetCustomer ?? undefined,
    competitors,
    evidenceScores: [],
    gaps: snap.gaps,
    sharedPatterns: snap.sharedPatterns,
    recommendation: snap.recommendation ?? undefined,
    competitorProfiles: snap.competitorProfiles,
    timeline,
    needsReview: snap.status === "needs_review",
  };
}

export function useRunStream(runId: string): LiveState {
  const [state, setState] = useState<LiveState>(initialState);

  useEffect(() => {
    let cancelled = false;
    setState(initialState);

    getRun(runId)
      .then((snap) => {
        if (!cancelled) setState(seedFromSnapshot(snap));
      })
      .catch(() => undefined);

    const es = new EventSource(streamUrl(runId));
    const handler = (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as AgentEvent;
        setState((s) => reduce(s, ev));
      } catch {
        /* ignore malformed */
      }
    };
    EVENT_TYPES.forEach((t) => es.addEventListener(t, handler as EventListener));

    return () => {
      cancelled = true;
      EVENT_TYPES.forEach((t) =>
        es.removeEventListener(t, handler as EventListener)
      );
      es.close();
    };
  }, [runId]);

  return state;
}
