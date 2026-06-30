import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { router } from "./api/routes.js";
import { getCheckpointer } from "./checkpointer.js";

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, mode: config.agentMode })
  );
  app.use("/api", router);

  // Warm the Postgres checkpointer (creates its tables) when a DB is configured.
  if (config.databaseUrl && config.agentMode === "live") {
    try {
      await getCheckpointer();
      console.log("[server] checkpointer ready");
    } catch (err) {
      console.error("[server] checkpointer setup failed:", err);
    }
  }

  app.listen(config.port, () => {
    console.log(
      `[server] listening on http://localhost:${config.port} (mode: ${config.agentMode})`
    );
  });
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
