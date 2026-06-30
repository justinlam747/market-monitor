import { Persister } from "./persist.js";

// Nodes only receive graph state, so the per-run Persister is looked up from a
// module-level registry keyed by runId. The runner registers it before invoking
// the graph and clears it when the run ends.
const registry = new Map<string, Persister>();

export function registerRunContext(runId: string): Persister {
  let p = registry.get(runId);
  if (!p) {
    p = new Persister(runId);
    registry.set(runId, p);
  }
  return p;
}

export function getRunContext(runId: string): Persister {
  const p = registry.get(runId);
  if (!p) {
    // Defensive: create a transient persister so nodes never crash.
    return new Persister(runId);
  }
  return p;
}

export function clearRunContext(runId: string): void {
  registry.delete(runId);
}
