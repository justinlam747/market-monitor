import type {
  CreateRunRequest,
  CreateRunResponse,
  RunListItem,
  RunSnapshot,
} from "@shared/types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

const GENERIC_ERROR = "Something went wrong. Please try again.";

// Parse a response body safely — an empty or non-JSON body must never throw
// (e.g. "Unexpected end of JSON input"); it just yields {}.
async function safeBody(res: Response): Promise<Record<string, unknown>> {
  try {
    const text = await res.text();
    if (!text) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = await safeBody(res);
  if (!res.ok) {
    const msg = typeof body.error === "string" ? body.error : GENERIC_ERROR;
    const ref = typeof body.reference === "string" ? ` (ref ${body.reference})` : "";
    throw new Error(`${msg}${ref}`);
  }
  return body as T;
}

export function createRun(body: CreateRunRequest): Promise<CreateRunResponse> {
  return fetch(`${BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json<CreateRunResponse>(r));
}

export function getRun(id: string): Promise<RunSnapshot> {
  return fetch(`${BASE}/api/run/${id}`).then((r) => json<RunSnapshot>(r));
}

export function listRuns(): Promise<RunListItem[]> {
  return fetch(`${BASE}/api/runs`).then((r) => json<RunListItem[]>(r));
}

export function streamUrl(id: string): string {
  return `${BASE}/api/run/${id}/stream`;
}

function post(path: string, body?: unknown) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => json<{ ok: boolean }>(r));
}

export const approveCheckpoint = (runId: string, cid: string) =>
  post(`/api/runs/${runId}/checkpoints/${cid}/approve`);

export const editCheckpoint = (runId: string, cid: string, payload: unknown) =>
  post(`/api/runs/${runId}/checkpoints/${cid}/edit`, { payload });

export const rejectCheckpoint = (
  runId: string,
  cid: string,
  rejectedIds: string[]
) => post(`/api/runs/${runId}/checkpoints/${cid}/reject`, { rejectedIds });

export const cancelRun = (runId: string) => post(`/api/runs/${runId}/cancel`);
export const pauseRun = (runId: string) => post(`/api/runs/${runId}/pause`);
export const resumeRun = (runId: string) => post(`/api/runs/${runId}/resume`);

export const reviewRun = (runId: string, decision: "accept" | "reject") =>
  post(`/api/runs/${runId}/review`, { decision });
