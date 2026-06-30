import { Router, type Request, type Response } from "express";
import type { CheckpointResolution, CreateRunRequest, RunMode } from "@shared/types";
import { config } from "../config.js";
import { getPrisma } from "../db.js";
import { getBufferedEvents, subscribe } from "../events.js";
import { createLogger } from "../logger.js";
import { badRequest, notFound, unavailable, conflict, sendError } from "../errors.js";
import { getRunSnapshot, listRuns } from "./snapshot.js";
import {
  startRun,
  resolveCheckpointAndResume,
  resolveReview,
  cancelRun,
  getPendingCheckpoint,
} from "../agent/runner.js";

export const router = Router();
const log = createLogger("http.routes");

// Wrap async handlers so any thrown value becomes a safe, ambiguous response.
type Handler = (req: Request, res: Response) => unknown | Promise<unknown>;
function wrap(context: string, fn: Handler) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (res.headersSent) {
        log.error(`${context} failed after headers sent`, err);
        try {
          res.end();
        } catch {
          /* ignore */
        }
        return;
      }
      sendError(res, err, context);
    }
  };
}

function requireDb(): void {
  if (!config.databaseUrl) throw unavailable();
}

// POST /api/run — create a run and start the agent.
router.post(
  "/run",
  wrap("POST /run", async (req, res) => {
    requireDb();
    const body = req.body as CreateRunRequest;
    const companyUrl = (body.companyUrl ?? "").trim();
    if (!companyUrl) throw badRequest("A company URL is required.");
    const mode: RunMode = body.mode === "review" ? "review" : "autonomous";

    const run = await getPrisma().agentRun.create({
      data: {
        mode,
        status: "running",
        companyUrl,
        optionalDescription: body.optionalDescription ?? null,
      },
    });

    // Fire-and-forget; progress is observed via SSE. Failures are logged, not surfaced.
    void startRun({
      runId: run.id,
      mode,
      companyUrl,
      optionalDescription: body.optionalDescription,
    }).catch((err) => log.error(`run ${run.id} failed to start`, err));

    res.json({ runId: run.id });
  })
);

// GET /api/runs — history.
router.get(
  "/runs",
  wrap("GET /runs", async (_req, res) => {
    requireDb();
    res.json(await listRuns());
  })
);

// GET /api/run/:id — full snapshot.
router.get(
  "/run/:id",
  wrap("GET /run/:id", async (req, res) => {
    requireDb();
    const snapshot = await getRunSnapshot(req.params.id);
    if (!snapshot) throw notFound("Run not found.");
    res.json(snapshot);
  })
);

// GET /api/run/:id/stream — live SSE of agent events.
router.get("/run/:id/stream", (req: Request, res: Response) => {
  const runId = req.params.id;
  try {
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
      try {
        res.write(`id: ${ev.seq}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      } catch {
        /* client gone */
      }
    };

    for (const ev of getBufferedEvents(runId, lastEventId)) send(ev);
    const unsubscribe = subscribe(runId, send);
    const heartbeat = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        /* ignore */
      }
    }, 15000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (err) {
    log.error("SSE stream failed", err);
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
});

// ---- Checkpoint controls (review mode / manual) ----------------------------

function resolveActive(req: Request, res: Response, resolution: CheckpointResolution) {
  const runId = req.params.id;
  const checkpointId = req.params.cid ?? getPendingCheckpoint(runId)?.checkpointId;
  if (!checkpointId) throw conflict("No active checkpoint to resolve.");
  void resolveCheckpointAndResume(runId, checkpointId, resolution).catch((err) =>
    log.error(`run ${runId} resume failed`, err)
  );
  res.json({ ok: true });
}

router.post(
  "/runs/:id/checkpoints/:cid/approve",
  wrap("approve", (req, res) => resolveActive(req, res, { action: "approve" }))
);
router.post(
  "/runs/:id/checkpoints/:cid/edit",
  wrap("edit", (req, res) =>
    resolveActive(req, res, { action: "edit", payload: req.body?.payload })
  )
);
router.post(
  "/runs/:id/checkpoints/:cid/reject",
  wrap("reject", (req, res) =>
    resolveActive(req, res, { action: "reject", rejectedIds: req.body?.rejectedIds ?? [] })
  )
);
router.post(
  "/runs/:id/resume",
  wrap("resume", (req, res) => resolveActive(req, res, { action: "approve" }))
);
router.post(
  "/runs/:id/retry",
  wrap("retry", (req, res) => resolveActive(req, res, { action: "approve" }))
);

router.post(
  "/runs/:id/cancel",
  wrap("cancel", async (req, res) => {
    await cancelRun(req.params.id).catch((err) =>
      log.error(`run ${req.params.id} cancel failed`, err)
    );
    res.json({ ok: true });
  })
);

router.post(
  "/runs/:id/review",
  wrap("review", async (req, res) => {
    const decision = req.body?.decision === "reject" ? "reject" : "accept";
    await resolveReview(req.params.id, decision).catch((err) =>
      log.error(`run ${req.params.id} review failed`, err)
    );
    res.json({ ok: true });
  })
);

router.post(
  "/runs/:id/pause",
  wrap("pause", (_req, res) => {
    res.json({
      ok: true,
      note: "Autonomous runs pause only at safety/checkpoint boundaries. Use review mode for step-by-step control.",
    });
  })
);
