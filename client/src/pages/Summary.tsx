import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@heroui/react";
import type { ClaimState, SourceState } from "@shared/types";
import { useRunStream, type LiveCompetitor, type LiveState } from "../useRunStream.js";
import { LoadingState } from "../components/LoadingState.js";

export function Summary() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <div className="text-default-600">Missing run id.</div>;
  return <SummaryInner runId={id} />;
}

function majorUpdates(c: LiveCompetitor): ClaimState[] {
  return c.claims.filter(
    (cl) =>
      (cl.type === "recent_signal" || cl.type === "funding") && !!cl.evidence
  );
}

// ---- Structured, agent-consumable report ----------------------------------

interface ReportSignal {
  type: string;
  value: string;
  evidence: string | null;
  confidence: number;
  sourceUrl: string | null;
}
interface ReportCompetitor {
  name: string;
  status: string;
  summary: string | null;
  movement: string | null;
  signals: ReportSignal[];
  sources: { url: string; title: string | null }[];
}
export interface CompetitorReport {
  runId: string;
  status: string;
  company: {
    url: string | null;
    businessIdea: string | null;
    targetCustomer: string | null;
  };
  competitors: ReportCompetitor[];
  sharedPatterns: string[];
  gaps: string[];
  recommendation: string | null;
}

function buildReport(state: LiveState, runId: string): CompetitorReport {
  const profileFor = (name: string) =>
    state.competitorProfiles.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
  return {
    runId,
    status: state.status,
    company: {
      url: state.companyUrl ?? null,
      businessIdea: state.businessIdea ?? null,
      targetCustomer: state.targetCustomer ?? null,
    },
    competitors: state.competitors.map((c) => {
      const profile = profileFor(c.name);
      return {
        name: c.name,
        status: c.status,
        summary: profile?.summary ?? null,
        movement: profile?.movement ?? null,
        signals: c.claims.map((cl) => ({
          type: cl.type,
          value: cl.value,
          evidence: cl.evidence,
          confidence: cl.confidence,
          sourceUrl: c.sources.find((s) => s.id === cl.sourceId)?.url ?? null,
        })),
        sources: c.sources.map((s) => ({ url: s.url, title: s.title ?? null })),
      };
    }),
    sharedPatterns: state.sharedPatterns,
    gaps: state.gaps,
    recommendation: state.recommendation ?? null,
  };
}

// JSON Schema (draft-07) describing the report — so a downstream agent knows the shape.
const REPORT_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://market-monitor/competitor-report.schema.json",
  title: "CompetitorReport",
  type: "object",
  required: ["runId", "status", "company", "competitors", "gaps"],
  properties: {
    runId: { type: "string" },
    status: {
      type: "string",
      enum: ["running", "waiting_for_user", "needs_review", "complete", "cancelled", "error"],
    },
    company: {
      type: "object",
      properties: {
        url: { type: ["string", "null"] },
        businessIdea: { type: ["string", "null"] },
        targetCustomer: { type: ["string", "null"] },
      },
    },
    competitors: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "status", "signals", "sources"],
        properties: {
          name: { type: "string" },
          status: { type: "string", enum: ["pending", "researching", "complete"] },
          summary: { type: ["string", "null"] },
          movement: { type: ["string", "null"] },
          signals: {
            type: "array",
            items: {
              type: "object",
              required: ["type", "value", "confidence"],
              properties: {
                type: {
                  type: "string",
                  enum: ["target_customer", "positioning", "feature", "pricing", "recent_signal", "funding"],
                },
                value: { type: "string" },
                evidence: { type: ["string", "null"], description: "Verbatim quote from the source." },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                sourceUrl: { type: ["string", "null"] },
              },
            },
          },
          sources: {
            type: "array",
            items: {
              type: "object",
              required: ["url"],
              properties: { url: { type: "string" }, title: { type: ["string", "null"] } },
            },
          },
        },
      },
    },
    sharedPatterns: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    recommendation: { type: ["string", "null"] },
  },
} as const;

// ---- Page ------------------------------------------------------------------

function SummaryInner({ runId }: { runId: string }) {
  const state = useRunStream(runId);
  const [view, setView] = useState<"article" | "json">("article");
  const report = useMemo(() => buildReport(state, runId), [state, runId]);

  if (state.status === "loading") return <LoadingState label="Loading summary…" />;

  const profileFor = (name: string) =>
    state.competitorProfiles.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );

  return (
    <div className="w-full pb-20 text-default-700">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={`/run/${runId}`}
          className="text-sm text-default-600 no-underline hover:text-foreground"
        >
          ← Back to live reasoning
        </Link>
        <div className="flex rounded-full bg-content2 p-0.5 text-sm">
          {(["article", "json"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-3.5 py-1 font-medium capitalize transition-colors ${
                view === v ? "bg-content1 text-foreground shadow-sm" : "text-default-500"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <h1 className="mt-4 font-display text-[28px] font-medium uppercase tracking-wide text-foreground sm:text-[40px]">
        Major competitor updates
      </h1>
      <p className="mt-3 max-w-[760px] text-[15px] text-default-500">
        {view === "json"
          ? "Structured agent output — pass this to the next step in your pipeline. Schema below."
          : `What each competitor has shipped, raised, and moved on, for ${state.businessIdea ?? state.companyUrl}.`}
      </p>

      {view === "json" ? (
        <JsonView report={report} />
      ) : (
        <ArticleBody state={state} profileFor={profileFor} />
      )}
    </div>
  );
}

function JsonView({ report }: { report: CompetitorReport }) {
  const output = JSON.stringify(report, null, 2);
  const schema = JSON.stringify(REPORT_SCHEMA, null, 2);
  return (
    <div className="mt-6 space-y-8">
      <CodeBlock title="Report output (JSON)" code={output} />
      <CodeBlock title="Report schema (JSON Schema, draft-07)" code={schema} />
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-default-500">
          {title}
        </h2>
        <Button size="sm" variant="flat" color="default" onPress={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="no-scrollbar overflow-x-auto rounded-large bg-content1 p-4 text-xs leading-relaxed text-default-700">
        <code className="font-mono">{code}</code>
      </pre>
    </section>
  );
}

function ArticleBody({
  state,
  profileFor,
}: {
  state: LiveState;
  profileFor: (name: string) => { summary: string; movement: string } | undefined;
}) {
  function Ref({ n, source }: { n: number; source?: SourceState }) {
    if (!source) return null;
    return (
      <sup className="ml-0.5 text-[11px] text-default-400">
        <a href={source.url} target="_blank" rel="noreferrer" className="hover:text-foreground">
          [{n}]
        </a>
      </sup>
    );
  }

  return (
    <article className="leading-relaxed">
      {state.competitors.length === 0 && (
        <p className="mt-10 text-default-400">No competitors discovered.</p>
      )}

      {state.competitors.map((c) => {
        const profile = profileFor(c.name);
        const updates = majorUpdates(c);
        const refIndex = (sourceId: string | null) =>
          sourceId ? c.sources.findIndex((s) => s.id === sourceId) + 1 : 0;

        return (
          <section key={c.id} className="mt-12">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-medium text-foreground">{c.name}</h2>
              <span className="text-xs text-default-400">{c.status}</span>
            </div>

            {profile?.summary && (
              <p className="mt-3 text-[15px]">{profile.summary}</p>
            )}

            {profile?.movement && (
              <p className="mt-4 border-l-2 border-default-300 pl-4 text-[15px] font-medium text-foreground">
                {profile.movement}
              </p>
            )}

            {updates.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {updates.map((u) => {
                  const n = refIndex(u.sourceId);
                  const src = c.sources.find((s) => s.id === u.sourceId);
                  return (
                    <li key={u.id} className="flex items-start gap-2 text-[15px]">
                      <span className="shrink-0 font-semibold text-default-500">
                        {u.type === "funding" ? "Backing —" : "Release —"}
                      </span>
                      <span>
                        {u.value}
                        {n > 0 && <Ref n={n} source={src} />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {c.sources.length > 0 && (
              <ol className="mt-6 space-y-1 text-xs text-default-400">
                {c.sources.map((s, i) => (
                  <li key={s.id}>
                    [{i + 1}]{" "}
                    <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}

      {(state.gaps.length > 0 || state.recommendation) && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-medium text-foreground">Your opening</h2>
          {state.gaps.length > 0 && (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px]">
              {state.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
          {state.recommendation && (
            <p className="mt-4 text-[15px]">
              <span className="font-semibold text-foreground">Recommendation. </span>
              {state.recommendation}
            </p>
          )}
        </section>
      )}
    </article>
  );
}
