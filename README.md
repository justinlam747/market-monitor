# ⚡ Competitor Signal Agent

A full-stack, **autonomous competitor-intelligence agent**. You give it a company
URL; a [LangGraph.js](https://langchain-ai.github.io/langgraphjs/) agent plans
research, searches the web, reads pages, extracts **source-grounded** claims,
evaluates whether the evidence is strong enough, retries when it isn't, and
analyzes differentiation gaps — **streaming every decision live** to a React UI.

It is not a static report generator. The reasoning *is* the product: you watch
the agent think, and (optionally) steer it at human-in-the-loop checkpoints.

```
React + TypeScript  ──SSE──  Node/Express  ──  LangGraph.js agent
       │                          │                  │
   live monitor              Prisma + Postgres   OpenAI + Tavily
```

---

## What makes this an "agent" (not a script)

The LangGraph graph maintains shared state and makes its own decisions:

- **plans** research per competitor,
- **decides** whether it has enough grounded evidence,
- **retries** with more sources or re-extraction when evidence is weak,
- **stops** when every competitor is sufficiently covered,
- **streams** its reasoning and routing decisions live.

### Graph

```
START → validate_input → scrape_company_site → extract_identity → maybe_confirm_identity
      → discover_competitors → maybe_select_competitors → collect_sources → maybe_review_sources
      → extract_signals → evaluate_evidence → maybe_review_claims → [route_decision]
            ├── retry_search      → collect_sources
            ├── retry_extraction  → extract_signals
            └── analyze_gaps      → maybe_review_gaps → finalize_state → END
```

The `route_decision` edge and the evidence evaluator are **pure functions**
(`server/src/agent/router.ts`, `server/src/agent/tools/evaluator.ts`) — which is
what makes routing and grounding deterministically testable.

### Source-grounded extraction

A claim is only counted if its `evidence` is a **verbatim substring of the source
text** (`isClaimGrounded`). Fabricated or unsupported claims fail evaluation and
never reach the gap analysis. Missing fields are marked `unknown`, never invented.

---

## Two run modes (human-in-the-loop)

| Mode | Behavior |
| --- | --- |
| **Autonomous** | Runs end-to-end, streaming progress. Pauses only for safety / low-confidence states. |
| **Review** | Pauses at checkpoints — confirm identity, select competitors, review sources, review claims, approve gaps — for **approve / edit / reject**. |

Review-mode pauses use LangGraph `interrupt()`; the graph is compiled with a
**Postgres-durable checkpointer** (`PostgresSaver`, keyed by `thread_id = runId`),
so paused runs survive a server restart. Resuming sends `new Command({ resume })`.

**Safety overrides mode.** Even in Autonomous mode the agent blocks unsafe URLs
(malformed, non-http(s), private/internal IPs incl. cloud metadata), flags
possible prompt injection in scraped text, and drops to `needs_review` when no
identity / no competitors / weak evidence is found.

---

## Tech stack

- **Frontend:** React + TypeScript + Vite, `EventSource` (SSE) live monitor.
- **Backend:** Node + Express + TypeScript.
- **Agent:** LangGraph.js, OpenAI (`gpt-4o`) for identity/discovery/extraction/gaps.
- **Search/Reader:** Tavily (live) with a bundled **fixture** mode for offline tests.
- **DB:** Postgres (Neon/Supabase) via Prisma; LangGraph `PostgresSaver` checkpoints.

---

## Project layout

```
shared/types.ts          # shared contract (AgentState, events, DTOs)
server/
  prisma/schema.prisma    # AgentRun, AgentStep, AgentCheckpoint, Competitor, Source, Claim, Gap
  src/
    index.ts              # express app
    events.ts             # in-memory SSE bus (+ replay buffer)
    checkpointer.ts       # PostgresSaver (MemorySaver in fixture mode)
    api/routes.ts         # REST + SSE + control endpoints
    agent/
      graph.ts            # StateGraph wiring + interrupts
      router.ts           # pure routing + final-status decisions
      runner.ts           # drives the graph, handles pause/resume
      nodes/              # intake, research, checkpoints, gaps
      tools/              # search, reader, identity, discovery, extractor, evaluator, gapAnalyzer
    fixtures/dataset.ts   # deterministic offline dataset
  test/                   # vitest deterministic tests
client/src/               # pages + components (live monitor, checkpoint controls)
```

---

## Setup

Requires Node ≥ 20.

```bash
npm install
cp .env.example .env        # then fill in the values below
```

`.env`:

```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require   # Neon/Supabase
PORT=4000
AGENT_MODE=live
```

Create the schema (Prisma) and the checkpoint tables (`PostgresSaver.setup()`
runs automatically on server boot):

```bash
npm run prisma:generate
npm run prisma:migrate      # creates the Prisma tables in your Postgres
```

---

## Run

```bash
npm run dev                 # starts server (:4000) + client (:5173) together
```

Open http://localhost:5173, enter a company URL, choose **Autonomous** or
**Review**, and watch the live reasoning monitor. Past runs are under **Runs**.

---

## Test (no API keys or database needed)

```bash
npm test                    # vitest, AGENT_MODE=fixture
```

The suite runs the agent fully offline against bundled fixtures and covers:

- routing: weak evidence → `retry_search`; one competitor complete / another not
  → keep gathering; all complete → `analyze_gaps`; iteration cap → stop;
- grounding: claims without evidence and with **invalid** (non-substring) evidence
  are rejected; missing fields are marked `unknown`;
- modes: autonomous **skips** checkpoints (records `not_required`) and still
  **blocks unsafe URLs**; review **pauses** at every checkpoint and **resumes** on
  approval; rejected sources/claims are removed from state and excluded from gaps;
- the agent **step stream** emits nodes in the correct sequence.

---

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/run` | `{ companyUrl, optionalDescription?, mode }` → `{ runId }` |
| GET | `/api/run/:id` | full snapshot (competitors, sources, claims, gaps, steps, checkpoints) |
| GET | `/api/run/:id/stream` | **SSE** live agent events (replays buffer, then streams) |
| GET | `/api/runs` | run history |
| POST | `/api/runs/:id/checkpoints/:cid/approve` \| `/edit` \| `/reject` | resolve a review checkpoint |
| POST | `/api/runs/:id/cancel` \| `/resume` \| `/retry` \| `/pause` | run controls |

---

## Guardrails

`server/src/agent/limits.ts`: max 8 iterations, 3 competitors, 3 sources/competitor,
5 results/query, 8,000 chars/source.
