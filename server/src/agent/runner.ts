import { Command } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import type {
  CheckpointResolution,
  CheckpointStatus,
  CheckpointType,
  RunMode,
} from "@shared/types";
import { buildGraph, type CompiledGraph } from "./graph.js";
import { AgentAnnotation } from "./state.js";
import { LIMITS } from "./limits.js";
import { registerRunContext, getRunContext, clearRunContext } from "./runContext.js";

let _graph: CompiledGraph | null = null;
async function getGraph(): Promise<CompiledGraph> {
  if (!_graph) _graph = await buildGraph();
  return _graph;
}

// The active checkpoint a paused run is waiting on (so control endpoints can
// resolve it even if the client doesn't echo the id back).
interface Pending {
  checkpointId: string;
  type: CheckpointType;
}
const pending = new Map<string, Pending>();

export function getPendingCheckpoint(runId: string): Pending | undefined {
  return pending.get(runId);
}

function threadConfig(runId: string): RunnableConfig {
  return { configurable: { thread_id: runId }, recursionLimit: 50 };
}

function statusFromAction(action: CheckpointResolution["action"]): CheckpointStatus {
  if (action === "edit") return "edited";
  if (action === "reject") return "rejected";
  return "approved";
}

export interface StartRunInput {
  runId: string;
  mode: RunMode;
  companyUrl: string;
  optionalDescription?: string;
}

// Kicks off a fresh run. Returns once the graph either finishes or pauses on the
// first review checkpoint. Intended to be called without awaiting from the route.
export async function startRun(input: StartRunInput): Promise<void> {
  registerRunContext(input.runId);
  const graph = await getGraph();
  const initial = {
    runId: input.runId,
    mode: input.mode,
    companyUrl: input.companyUrl,
    optionalDescription: input.optionalDescription,
    maxIterations: LIMITS.maxIterations,
  } satisfies Partial<typeof AgentAnnotation.State>;

  await drive(graph, initial, input.runId);
}

// Resolves a waiting checkpoint and resumes the graph from where it paused.
export async function resolveCheckpointAndResume(
  runId: string,
  checkpointId: string,
  resolution: CheckpointResolution
): Promise<void> {
  const p = getRunContext(runId);
  await p.resolveCheckpoint(checkpointId, statusFromAction(resolution.action), resolution.payload);
  pending.delete(runId);
  await p.updateRun({ status: "running" });

  const graph = await getGraph();
  await drive(graph, new Command({ resume: resolution }), runId);
}

// Resolves a run that finished in `needs_review`: the user either accepts the
// low-confidence results (→ complete) or rejects them (→ cancelled).
export async function resolveReview(
  runId: string,
  decision: "accept" | "reject"
): Promise<void> {
  const p = registerRunContext(runId);
  const status = decision === "accept" ? "complete" : "cancelled";
  await p.updateRun({ status, ended: true });
  p.emit("done", {
    message:
      decision === "accept"
        ? "Review accepted — results marked complete"
        : "Review rejected — run cancelled",
    data: { status },
  });
  clearRunContext(runId);
}

export async function cancelRun(runId: string): Promise<void> {
  const p = getRunContext(runId);
  pending.delete(runId);
  await p.updateRun({ status: "cancelled", ended: true });
  p.emit("done", { message: "Run cancelled", data: { status: "cancelled" } });
  clearRunContext(runId);
}

// Drives the graph stream to its next stopping point (completion or interrupt).
async function drive(
  graph: CompiledGraph,
  input: Parameters<CompiledGraph["stream"]>[0],
  runId: string
): Promise<void> {
  const p = registerRunContext(runId);
  try {
    const stream = await graph.stream(input, {
      ...threadConfig(runId),
      streamMode: "updates",
    });
    // Node side effects (events, DB writes) happen inside the nodes themselves.
    for await (const _chunk of stream) {
      void _chunk;
    }

    const snapshot = await graph.getState(threadConfig(runId));
    const interruptedTask = snapshot.tasks?.find(
      (t) => (t.interrupts?.length ?? 0) > 0
    );

    if (interruptedTask) {
      const value = interruptedTask.interrupts[0]!.value as {
        type: CheckpointType;
        payload: unknown;
      };
      const checkpointId = await p.createCheckpoint(value.type, "waiting", value.payload);
      pending.set(runId, { checkpointId, type: value.type });
      await p.updateRun({ status: "waiting_for_user" });
      p.emit("checkpoint_waiting", {
        node: `maybe_${value.type}`,
        message: `[${value.type}] Waiting for your review`,
        data: { checkpointId, type: value.type, payload: value.payload },
      });
      return; // paused — resumed later via resolveCheckpointAndResume
    }

    // Completed: finalize_state already set the terminal status + emitted done.
    clearRunContext(runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await p.updateRun({ status: "error", ended: true }).catch(() => undefined);
    p.emit("error", { message: `Run failed: ${message}`, data: { message } });
    clearRunContext(runId);
  }
}
