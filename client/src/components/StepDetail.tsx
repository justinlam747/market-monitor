import type { ReactNode } from "react";
import type {
  ClaimState,
  CompetitorProfile,
  EvidenceScore,
  SourceState,
} from "@shared/types";
import type { TimelineItem } from "../useRunStream.js";
import { ClaimEvidence } from "./ClaimEvidence.js";
import { SourceList } from "./SourceList.js";

export function stepHasDetail(item: TimelineItem): boolean {
  if (item.reasoning) return true;
  const o = item.output;
  if (o == null) return false;
  if (Array.isArray(o)) return o.length > 0;
  return true;
}

export function StepDetail({ item }: { item: TimelineItem }) {
  const o = item.output;
  return (
    <div className="flex flex-col gap-3 pb-1 pl-6 text-sm">
      {item.reasoning && (
        <p className="text-default-500">{item.reasoning}</p>
      )}
      {renderOutput(item.node, o)}
    </div>
  );
}

function renderOutput(node: string | undefined, o: unknown): ReactNode {
  if (o == null) return null;

  switch (node) {
    case "collect_sources": {
      const sources = o as SourceState[];
      if (!sources.length) return null;
      return (
        <div>
          <h5 className="mb-1 text-xs font-semibold text-default-400">
            Sources loaded
          </h5>
          <SourceList sources={sources} />
        </div>
      );
    }
    case "extract_signals": {
      const claims = o as ClaimState[];
      if (!claims.length) return null;
      return (
        <div className="flex flex-col gap-2">
          {claims.map((c) => (
            <ClaimEvidence key={c.id} claim={c} />
          ))}
        </div>
      );
    }
    case "evaluate_evidence": {
      const scores = o as EvidenceScore[];
      const mark = (ok: boolean) => (ok ? "✓" : "✗");
      return (
        <div className="flex flex-col gap-1 text-xs text-default-500">
          {scores.map((s) => (
            <div key={s.competitorId}>
              positioning {mark(s.hasPositioning)} · target{" "}
              {mark(s.hasTargetCustomer)} · features {mark(s.hasFeatures)} ·{" "}
              {s.groundedClaimCount} grounded · {s.sourceCount} sources
            </div>
          ))}
        </div>
      );
    }
    case "discover_competitors": {
      const names = o as string[];
      return (
        <p className="text-sm text-default-600">{names.join(", ")}</p>
      );
    }
    case "extract_identity": {
      const id = o as { businessIdea?: string; targetCustomer?: string };
      return (
        <div className="text-sm">
          <p><span className="text-default-400">Business idea: </span>{id.businessIdea}</p>
          <p><span className="text-default-400">Target customer: </span>{id.targetCustomer}</p>
        </div>
      );
    }
    case "analyze_gaps": {
      const r = o as {
        competitorProfiles?: CompetitorProfile[];
        sharedPatterns?: string[];
        gaps?: string[];
        recommendation?: string;
      };
      return (
        <div className="flex flex-col gap-2.5">
          {!!r.gaps?.length && (
            <div>
              <h5 className="mb-1 text-xs font-semibold text-default-400">Gaps</h5>
              <ul className="list-disc pl-5">
                {r.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {r.recommendation && (
            <div className="rounded-medium bg-content2 p-2.5">
              <span className="font-semibold text-foreground">Recommendation: </span>
              {r.recommendation}
            </div>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}
