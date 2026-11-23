// Entry point: one Express process serves the SPA, the JSON API and the public SPARQL endpoint.
import express from "express";
import compression from "compression";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PORT, PORTRAITS_DIR, WEB_DIST } from "./config.ts";
import { loadStore } from "./store.ts";
import { api } from "./api.ts";
import { sparqlHandler, warmUp } from "./sparql/protocol.ts";

export function createApp() {
  loadStore();
  const app = express();
  app.disable("x-powered-by");
  app.use(compression());
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  // public SPARQL endpoint (CORS open, read-only)
  app.use("/sparql", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use("/sparql", express.urlencoded({ extended: false, limit: "200kb" }), express.text({ type: ["application/sparql-query", "application/sparql-update"], limit: "200kb" }));
  app.all("/sparql", sparqlHandler);
  app.use("/api", api());
  app.use("/portraits", express.static(PORTRAITS_DIR, { maxAge: "10m", index: false }));
  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST, { maxAge: "1h", index: false }));
    app.get(/^\/(?!api|sparql|portraits).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, "index.html")));
  }
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp();
  warmUp();
  app.listen(PORT, () => console.log(`Edition on http://localhost:${PORT}  (SPARQL endpoint: http://localhost:${PORT}/sparql)`));
}
