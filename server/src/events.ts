import { EventEmitter } from "node:events";
import type { AgentEvent, AgentEventType } from "@shared/types";

// In-memory pub/sub bus for live agent events, keyed by runId.
// We also keep a per-run ring buffer so SSE subscribers that connect late can
// replay everything emitted so far (DB holds the durable record separately).

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const buffers = new Map<string, AgentEvent[]>();
const seqCounters = new Map<string, number>();

const MAX_BUFFER = 2000;

function nextSeq(runId: string): number {
  const n = (seqCounters.get(runId) ?? 0) + 1;
  seqCounters.set(runId, n);
  return n;
}

export interface EmitInput {
  type: AgentEventType;
  node?: string;
  message?: string;
  data?: unknown;
}

export function emitEvent(runId: string, input: EmitInput): AgentEvent {
  const event: AgentEvent = {
    type: input.type,
    runId,
    seq: nextSeq(runId),
    node: input.node,
    message: input.message,
    data: input.data,
    ts: new Date().toISOString(),
  };

  let buf = buffers.get(runId);
  if (!buf) {
    buf = [];
    buffers.set(runId, buf);
  }
  buf.push(event);
  if (buf.length > MAX_BUFFER) buf.splice(0, buf.length - MAX_BUFFER);

  emitter.emit(channel(runId), event);
  return event;
}

export function getBufferedEvents(runId: string, sinceSeq = 0): AgentEvent[] {
  const buf = buffers.get(runId) ?? [];
  return sinceSeq > 0 ? buf.filter((e) => e.seq > sinceSeq) : buf.slice();
}

export function subscribe(
  runId: string,
  listener: (event: AgentEvent) => void
): () => void {
  const ch = channel(runId);
  emitter.on(ch, listener);
  return () => emitter.off(ch, listener);
}

export function clearRunBuffer(runId: string): void {
  buffers.delete(runId);
  seqCounters.delete(runId);
}

function channel(runId: string): string {
  return `run:${runId}`;
}
