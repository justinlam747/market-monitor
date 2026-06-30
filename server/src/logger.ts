import { randomUUID } from "node:crypto";
import { config, isFixtureMode } from "./config.js";
import { getPrisma } from "./db.js";

// A small logging framework:
// - per-module loggers (createLogger("agent.runner"))
// - levels (error < warn < info < debug < trace), filtered per sink via env
// - pluggable outputs (console + database); add more sinks without touching call sites
// - NEVER throws: a failing sink can never crash or block the app

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

const ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

function parseLevel(v: string | undefined, fallback: LogLevel): LogLevel {
  return v && v in ORDER ? (v as LogLevel) : fallback;
}

// Configure outputs purely from env — no code changes needed to retune.
const CONSOLE_LEVEL = parseLevel(
  process.env.LOG_LEVEL,
  isFixtureMode() ? "warn" : "info"
);
const DB_LEVEL = parseLevel(process.env.LOG_DB_LEVEL, "warn");

interface LogRecord {
  level: LogLevel;
  module: string;
  message: string;
  code?: string;
  reference?: string;
  detail?: unknown;
}

function serializeDetail(detail: unknown): unknown {
  if (detail === undefined) return undefined;
  if (detail instanceof Error) {
    return { name: detail.name, message: detail.message, stack: detail.stack };
  }
  return detail;
}

// --- sinks: each is fully self-contained and swallows its own errors ---------

function consoleSink(r: LogRecord): void {
  try {
    const ref = r.reference ? ` (ref ${r.reference})` : "";
    const head = `[${r.level}] ${r.module}: ${r.message}${ref}`;
    const fn =
      r.level === "error"
        ? console.error
        : r.level === "warn"
          ? console.warn
          : console.log;
    if (r.detail !== undefined) fn(head, r.detail);
    else fn(head);
  } catch {
    /* logging must never throw */
  }
}

const dbEnabled =
  !isFixtureMode() && !config.disablePersistence && !!config.databaseUrl;

function dbSink(r: LogRecord): void {
  if (!dbEnabled) return;
  try {
    // fire-and-forget; a DB outage must not affect the request
    void getPrisma()
      .logEntry.create({
        data: {
          level: r.level,
          module: r.module,
          message: r.message.slice(0, 4000),
          code: r.code ?? null,
          reference: r.reference ?? null,
          detail: (serializeDetail(r.detail) ?? undefined) as object | undefined,
        },
      })
      .catch(() => undefined);
  } catch {
    /* never throw */
  }
}

function dispatch(r: LogRecord): void {
  try {
    if (ORDER[r.level] <= ORDER[CONSOLE_LEVEL]) consoleSink(r);
    if (ORDER[r.level] <= ORDER[DB_LEVEL]) dbSink(r);
  } catch {
    /* never throw */
  }
}

export interface Logger {
  // error() returns a short reference id to surface to the client for support.
  error(message: string, detail?: unknown, code?: string): string;
  warn(message: string, detail?: unknown): void;
  info(message: string, detail?: unknown): void;
  debug(message: string, detail?: unknown): void;
  trace(message: string, detail?: unknown): void;
}

export function createLogger(module: string): Logger {
  return {
    error(message, detail, code) {
      const reference = randomUUID().slice(0, 8);
      dispatch({ level: "error", module, message, detail, code, reference });
      return reference;
    },
    warn(message, detail) {
      dispatch({ level: "warn", module, message, detail });
    },
    info(message, detail) {
      dispatch({ level: "info", module, message, detail });
    },
    debug(message, detail) {
      dispatch({ level: "debug", module, message, detail });
    },
    trace(message, detail) {
      dispatch({ level: "trace", module, message, detail });
    },
  };
}
