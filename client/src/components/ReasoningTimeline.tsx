import { useEffect, useRef, useState } from "react";
import type { TimelineItem } from "../useRunStream.js";
import { StepDetail, stepHasDetail } from "./StepDetail.js";

const NODE_INFO: Record<string, { title: string; desc: string }> = {
  validate_input: { title: "Validate input", desc: "Check the company URL is safe to fetch" },
  scrape_company_site: { title: "Scrape company site", desc: "Read and clean the company's landing page" },
  extract_identity: { title: "Extract identity", desc: "Infer the business idea and target customer" },
  maybe_confirm_identity: { title: "Confirm identity", desc: "Checkpoint: confirm the company identity" },
  discover_competitors: { title: "Discover competitors", desc: "Find likely competitors to research" },
  maybe_select_competitors: { title: "Select competitors", desc: "Checkpoint: choose competitors to analyze" },
  collect_sources: { title: "Collect sources", desc: "Search the web for competitor signals" },
  maybe_review_sources: { title: "Review sources", desc: "Checkpoint: review gathered sources" },
  extract_signals: { title: "Extract signals", desc: "Pull source-grounded claims from pages" },
  evaluate_evidence: { title: "Evaluate evidence", desc: "Score whether the evidence is strong enough" },
  maybe_review_claims: { title: "Review claims", desc: "Checkpoint: review extracted claims" },
  analyze_gaps: { title: "Analyze gaps", desc: "Compare competitors and find differentiation" },
  maybe_review_gaps: { title: "Review gaps", desc: "Checkpoint: approve the gap analysis" },
  finalize_state: { title: "Finalize", desc: "Wrap up and record the result" },
};

function messageText(item: TimelineItem): string {
  const m = /^\[[^\]]+\]\s*(.*)$/.exec(item.message);
  return (m ? m[1] : item.message).trim();
}

export function ReasoningTimeline({ timeline }: { timeline: TimelineItem[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const toggle = (seq: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });

  // Always snap to the newest tool call.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [timeline.length]);

  if (timeline.length === 0) {
    return (
      <p className="py-10 text-sm text-default-400">The agent is warming up…</p>
    );
  }

  return (
    <div className="flex flex-col">
      {timeline.map((item) => {
        const info = item.node ? NODE_INFO[item.node] : undefined;
        const title = info?.title ?? item.node ?? "Step";
        const oneLiner = messageText(item) || info?.desc || "";
        const detail = stepHasDetail(item);
        const isOpen = open.has(item.seq);

        return (
          <div key={item.seq} className="fade-up py-2.5">
            <button
              type="button"
              onClick={() => detail && toggle(item.seq)}
              className={`flex w-full items-start justify-between gap-3 text-left ${
                detail ? "" : "cursor-default"
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{title}</div>
                {oneLiner && (
                  <p className="mt-0.5 truncate text-[13px] text-default-500">
                    {oneLiner}
                  </p>
                )}
              </div>
              {detail && (
                <span
                  className={`mt-1 shrink-0 text-xs text-default-400 transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                >
                  ▸
                </span>
              )}
            </button>
            {detail && isOpen && (
              <div className="mt-2">
                <StepDetail item={item} />
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
