import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// The server may be launched with its cwd at server/ (e.g. `npm run dev -w server`),
// so resolve .env relative to this file instead of process.cwd(). We load the
// repo-root .env first (primary), then a server-local .env if present. dotenv
// never overrides an already-set process.env var, so real env vars still win.
const here = dirname(fileURLToPath(import.meta.url)); // server/src
dotenv.config({ path: resolve(here, "../../.env") }); // <repo>/.env
dotenv.config({ path: resolve(here, "../.env") }); // server/.env (optional)
dotenv.config(); // process.cwd()/.env (optional)

export type AgentMode = "live" | "fixture";

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const config = {
  port: Number(process.env.PORT ?? 4000),

  // "fixture" forces the agent fully offline (no OpenAI/Tavily). Tests set this.
  agentMode: (process.env.AGENT_MODE === "fixture" ? "fixture" : "live") as AgentMode,

  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o",

  tavilyApiKey: process.env.TAVILY_API_KEY ?? "",

  // xAI Grok — used for X (Twitter) competitor discovery + recent signals.
  xaiApiKey: process.env.XAI_API_KEY ?? "",
  xaiModel: process.env.XAI_MODEL ?? "grok-4.3",

  databaseUrl: process.env.DATABASE_URL ?? "",

  // When true, the run path skips Prisma/PostgresSaver writes (used by unit tests
  // that exercise pure graph logic without a database).
  disablePersistence: bool(process.env.DISABLE_PERSISTENCE, false),
};

export function isFixtureMode(): boolean {
  return config.agentMode === "fixture";
}

// Grok/X search is only available live and only when an xAI key is configured.
export function hasXai(): boolean {
  return !isFixtureMode() && config.xaiApiKey.length > 0;
}
