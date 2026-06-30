import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { config, isFixtureMode } from "./config.js";

// Durable LangGraph checkpointer backed by Postgres (same Neon DB as Prisma).
// In fixture/test mode — or when no DATABASE_URL is configured — we fall back to
// an in-memory MemorySaver so the graph still pauses/resumes without a database.

let _saver: BaseCheckpointSaver | null = null;
let _setupDone = false;

export async function getCheckpointer(): Promise<BaseCheckpointSaver> {
  if (_saver) return _saver;

  if (isFixtureMode() || !config.databaseUrl) {
    _saver = new MemorySaver();
    return _saver;
  }

  // Keep LangGraph's checkpoint tables in their own schema so they never
  // collide with — or cause migration drift against — Prisma's public schema.
  const saver = PostgresSaver.fromConnString(config.databaseUrl, {
    schema: "langgraph",
  });
  if (!_setupDone) {
    // Creates the checkpoint tables (and schema) if they don't exist.
    await saver.setup();
    _setupDone = true;
  }
  _saver = saver;
  return _saver;
}
