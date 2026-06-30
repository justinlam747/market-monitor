import { useMemo } from "react";
import { renderSvg } from "nomnoml";

const THEME = `
#fill: #fbf8ef; #f3ece0
#stroke: #6f5e53
#font: Satoshi
#fontSize: 12
#lineWidth: 1.2
#arrowSize: 0.9
#spacing: 18
#padding: 10
#edges: rounded
#.tool: fill=#f1ebdf stroke=#8a7968
#.store: fill=#efeae0 stroke=#8a7968 visual=database
#.out: fill=#f1ebdf stroke=#8a7968
#.sys: fill=#efeae0 stroke=#8a7968
`;

// Architecture — the LangGraph agent container flows left-to-right (flat).
const DIAGRAM_ARCH = `
${THEME}
#direction: right
[<actor>Founder] -> [Company URL]
[Company URL] -> [LangGraph Agent]

[<frame>LangGraph Agent|
  [validate input] -> [scrape site] -> [extract identity] -> [discover competitors]
  [discover competitors] -> [collect sources] -> [extract signals] -> [evaluate evidence] -> [route]
  [route] --> [collect sources]
  [route] -> [analyze gaps] -> [finalize]
]

[LangGraph Agent] -> [<tool>Tools|Grok X; Tavily; OpenAI]
[LangGraph Agent] --> [<store>Postgres]
[LangGraph Agent] --> [SSE] -> [React UI]
`.trim();

const DIAGRAM_INTEGRATION = `
${THEME}
[Market Monitor agent] -> [<out>Report (JSON + schema)]
[<out>Report (JSON + schema)] -> [<sys>Strategy agent]
[<out>Report (JSON + schema)] -> [<sys>Product / roadmap]
[<out>Report (JSON + schema)] -> [<sys>GTM / positioning]
[<sys>Strategy agent] -> [Business direction]
[<sys>Product / roadmap] -> [Business direction]
[<sys>GTM / positioning] -> [Business direction]
[Business direction] -> [<actor>Human review]
[<actor>Human review] --> [Market Monitor agent]
`.trim();

const TOOL_CALLS: Array<[string, string]> = [
  ["validate input", "Check the company URL is safe to fetch."],
  ["scrape site", "Read and clean the landing page."],
  ["extract identity", "Infer the business idea and target customer."],
  ["discover competitors", "Search X for companies in the same scope."],
  ["collect sources", "Web, X, and OpenAI knowledge per competitor."],
  ["extract signals", "Pull source-grounded claims from the sources."],
  ["evaluate evidence", "Keep claims whose evidence sits in the source."],
  ["route", "Loop back for more sources, or move on."],
  ["analyze gaps", "Compare competitors and find openings."],
  ["finalize", "Record the result and stream it out."],
];

function useDiagram(src: string): string {
  return useMemo(() => {
    try {
      return renderSvg(src);
    } catch {
      return "";
    }
  }, [src]);
}

export function About() {
  const archSvg = useDiagram(DIAGRAM_ARCH);
  const integrationSvg = useDiagram(DIAGRAM_INTEGRATION);

  return (
    <div className="page-enter w-full pb-20 text-default-700">
      <h1 className="font-display text-3xl font-medium uppercase tracking-wide text-foreground">
        How it works
      </h1>
      <p className="mt-3 w-full text-[15px] text-default-500">
        Market Monitor is an autonomous competitor-intelligence agent. Give it a company
        URL and it finds competitors, pulls source-grounded signals, and surfaces your
        gaps. It runs as a node in an agentic pipeline: it produces a structured JSON
        report that directs a downstream agent.
      </p>

      <div className="mt-6 rounded-large bg-content1 p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-default-400">
          Example integration
        </div>
        <div className="mt-4 flex justify-center [&_svg]:h-auto [&_svg]:max-w-full">
          {integrationSvg ? (
            <div dangerouslySetInnerHTML={{ __html: integrationSvg }} />
          ) : (
            <p className="text-default-400">Diagram failed to render.</p>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-medium text-foreground">Architecture</h2>
        <div className="mt-4 rounded-large bg-content1 p-6">
          <div className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full">
            {archSvg ? (
              <div dangerouslySetInnerHTML={{ __html: archSvg }} />
            ) : (
              <p className="text-default-400">Diagram failed to render.</p>
            )}
          </div>

          <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-default-400">
            Tool calls
          </h3>
          <ul className="mt-3 grid gap-x-12 gap-y-2.5 sm:grid-cols-2">
            {TOOL_CALLS.map(([name, desc]) => (
              <li key={name} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-default-400" />
                <p className="text-[15px]">
                  <span className="font-medium text-foreground">{name}. </span>
                  <span className="text-default-500">{desc}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
