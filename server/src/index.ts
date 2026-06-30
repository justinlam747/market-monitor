import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { config } from "./config.js";
import { router } from "./api/routes.js";
import { getCheckpointer } from "./checkpointer.js";
import { createLogger } from "./logger.js";
import { sendError } from "./errors.js";

const log = createLogger("server");

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, mode: config.agentMode })
  );
  app.use("/api", router);

  // Final safety net: anything that slips through is logged with full detail and
  // returned as an ambiguous code + reference. Never leak implementation detail.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) {
      log.error(`unhandled error after headers (${req.method} ${req.path})`, err);
      return res.end();
    }
    sendError(res, err, `${req.method} ${req.path}`);
  });

  // Last-resort guards so a stray rejection/exception never takes the process down.
  process.on("unhandledRejection", (reason) =>
    log.error("unhandledRejection", reason)
  );
  process.on("uncaughtException", (err) => log.error("uncaughtException", err));

  if (config.databaseUrl && config.agentMode === "live") {
    try {
      await getCheckpointer();
      log.info("checkpointer ready");
    } catch (err) {
      log.error("checkpointer setup failed", err);
    }
  }

  app.listen(config.port, () => {
    log.info(`listening on http://localhost:${config.port} (mode: ${config.agentMode})`);
  });
}

main().catch((err) => {
  log.error("fatal startup error", err);
  process.exit(1);
});
