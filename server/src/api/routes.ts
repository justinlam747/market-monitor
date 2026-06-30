import { Router, type Request, type Response } from "express";
import type { CheckpointResolution, CreateRunRequest, RunMode } from "@shared/types";
import { config } from "../config.js";
import { getPrisma } from "../db.js";
import { getBufferedEvents, subscribe } from "../events.js";
import { getRunSnapshot, listRuns } from "./snapshot.js";
import {
  startRun,
  resolveCheckpointAndResume,
  resolveReview,
  cancelRun,
  getPendingCheckpoint,
} from "../agent/runner.js";

export const router = Router();

function requireDb(res: Response): boolean {
  if (!config.databaseUrl) {
    res
      .status(503)
      .json({ error: "DATABASE_URL is not configured. Set it in .env to run live." });
    return false;
  }
  return true;
}

// POST /api/run — create a run and start the agent.
router.post("/run", async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const body = req.body as CreateRunRequest;
  const companyUrl = (body.companyUrl ?? "").trim();
  if (!companyUrl) {
    return res.status(400).json({ error: "companyUrl is required" });
  }
  const mode: RunMode = body.mode === "review" ? "review" : "autonomous";

  const run = await getPrisma().agentRun.create({
    data: {
      mode,
      status: "running",
      companyUrl,
      optionalDescription: body.optionalDescription ?? null,
    },
  });

  // Fire-and-forget; progress is observed via SSE.
  void startRun({
    runId: run.id,
    mode,
    companyUrl,
    optionalDescription: body.optionalDescription,
  }).catch((err) => {
    console.error(`[run ${run.id}] failed to start:`, err);
  });

  res.json({ runId: run.id });
});

// GET /api/runs — history.
router.get("/runs", async (_req: Request, res: Response) => {
  if (!requireDb(res)) return;
  res.json(await listRuns());
});

// GET /api/run/:id — full snapshot.
router.get("/run/:id", async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const snapshot = await getRunSnapshot(req.params.id);
  if (!snapshot) return res.status(404).json({ error: "Run not found" });
  res.json(snapshot);
});

// GET /api/run/:id/stream — live SSE of agent events.
router.get("/run/:id/stream", (req: Request, res: Response) => {
  const runId = req.params.id;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");

  const lastEventId = Number(
    req.headers["last-event-id"] ?? req.query.since ?? 0
  );

  const send = (ev: { seq: number; type: string }) => {
    res.write(`id: ${ev.seq}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
  };

  // Replay everything so far, then stream live.
  for (const ev of getBufferedEvents(runId, lastEventId)) send(ev);
  const unsubscribe = subscribe(runId, send);

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ---- Checkpoint controls (review mode / manual) ----------------------------

async function resolveActive(
  req: Request,
  res: Response,
  resolution: CheckpointResolution
) {
  const runId = req.params.id;
  const checkpointId = req.params.cid ?? getPendingCheckpoint(runId)?.checkpointId;
  if (!checkpointId) {
    return res.status(409).json({ error: "No active checkpoint to resolve" });
  }
  void resolveCheckpointAndResume(runId, checkpointId, resolution).catch((err) =>
    console.error(`[run ${runId}] resume failed:`, err)
  );
  res.json({ ok: true });
}

router.post("/runs/:id/checkpoints/:cid/approve", (req, res) =>
  resolveActive(req, res, { action: "approve" })
);
router.post("/runs/:id/checkpoints/:cid/edit", (req, res) =>
  resolveActive(req, res, { action: "edit", payload: req.body?.payload })
);
router.post("/runs/:id/checkpoints/:cid/reject", (req, res) =>
  resolveActive(req, res, {
    action: "reject",
    rejectedIds: req.body?.rejectedIds ?? [],
  })
);

// Approve the currently-waiting checkpoint (no id needed).
router.post("/runs/:id/resume", (req, res) =>
  resolveActive(req, res, { action: "approve" })
);
router.post("/runs/:id/retry", (req, res) =>
  resolveActive(req, res, { action: "approve" })
);

router.post("/runs/:id/cancel", async (req, res) => {
  await cancelRun(req.params.id).catch(() => undefined);
  res.json({ ok: true });
});

// Accept or reject a run that finished in needs_review.
router.post("/runs/:id/review", async (req, res) => {
  const decision = req.body?.decision === "reject" ? "reject" : "accept";
  await resolveReview(req.params.id, decision).catch(() => undefined);
  res.json({ ok: true });
});

// Autonomous runs only pause at checkpoints; full mid-node pause requires
// review mode. This endpoint acknowledges the request.
router.post("/runs/:id/pause", (_req, res) => {
  res.json({
    ok: true,
    note: "Autonomous runs pause only at safety/checkpoint boundaries. Use review mode for step-by-step control.",
  });
});
