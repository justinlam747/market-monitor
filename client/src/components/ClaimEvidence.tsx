import { Link } from "@heroui/react";
import type { ClaimState, SourceState } from "@shared/types";

const TYPE_LABEL: Record<string, string> = {
  target_customer: "Target customer",
  positioning: "Positioning",
  feature: "Product / capability",
  pricing: "Pricing",
  recent_signal: "Recent release",
  funding: "Backing / funding",
};

export function ClaimEvidence({
  claim,
  competitorName,
  source,
}: {
  claim: ClaimState;
  competitorName?: string;
  source?: SourceState;
}) {
  const grounded = !!claim.evidence && claim.value.toLowerCase() !== "unknown";
  return (
    <div className={`rounded-medium bg-content2 p-3 ${grounded ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-default-500">
        <span className="font-semibold text-foreground">
          {TYPE_LABEL[claim.type] ?? claim.type}
        </span>
        {competitorName && <span>· {competitorName}</span>}
        <span>· {Math.round(claim.confidence * 100)}%</span>
        <span className="ml-auto text-default-400">
          {grounded ? "grounded" : "unknown"}
        </span>
      </div>
      <div className="mt-1.5 text-sm font-medium">{claim.value}</div>
      {claim.evidence && (
        <blockquote className="mt-2 border-l-2 border-default-300 pl-3 text-xs italic text-default-500">
          “{claim.evidence}”
        </blockquote>
      )}
      {grounded && source && (
        <div className="mt-2 text-xs text-default-400">
          Source:{" "}
          {source.url ? (
            <Link href={source.url} isExternal size="sm" color="foreground" underline="hover">
              {source.title || source.url}
            </Link>
          ) : (
            <span>{source.title || "Model knowledge"}</span>
          )}
        </div>
      )}
    </div>
  );
}
