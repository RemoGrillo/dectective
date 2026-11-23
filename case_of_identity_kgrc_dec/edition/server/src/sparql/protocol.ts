// SPARQL 1.1 Protocol (query operation only): GET ?query=, POST form-urlencoded, POST application/sparql-query.
// Read-only (updates are rejected), timeout + row cap, results in JSON / CSV / TSV / XML, graphs in Turtle / N-Triples.
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Request, Response } from "express";
import { DATA_DIR, SPARQL_MAX_ROWS, SPARQL_TIMEOUT_MS } from "../config.ts";

type Pending = { resolve: (v: any) => void; timer: NodeJS.Timeout };
let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function spawn() {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "worker.ts");
  worker = new Worker(file, { workerData: { file: path.join(DATA_DIR, "edition.nq") } });
  ready = new Promise((res) => {
    worker!.once("message", () => res());
  });
  worker.on("message", (m: any) => {
    if (m.ready) return;
    const p = pending.get(m.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(m.id);
    p.resolve(m);
  });
  worker.on("error", (e: Error) => {
    for (const [, p] of pending) { clearTimeout(p.timer); p.resolve({ ok: false, error: "worker error: " + e.message }); }
    pending.clear();
    worker = null;
  });
}

export async function runQuery(query: string, format: string): Promise<{ ok: boolean; body?: string; error?: string; truncated?: boolean; timeout?: boolean }> {
  if (!worker) spawn();
  await ready;
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      const w = worker;
      worker = null;
      w?.terminate();                      // runaway query: kill the worker, a fresh one is spawned on next request
      resolve({ ok: false, timeout: true, error: `Query exceeded ${SPARQL_TIMEOUT_MS} ms and was cancelled.` });
    }, SPARQL_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    worker!.postMessage({ id, query, format, maxRows: SPARQL_MAX_ROWS });
  });
}

export function warmUp() { if (!worker) spawn(); return ready; }

const UPDATE = /^\s*(?:(?:PREFIX|BASE)\s+[^\n]*\n\s*)*(INSERT|DELETE|LOAD|CLEAR|CREATE|DROP|COPY|MOVE|ADD|WITH)\b/i;
const FORMATS: Record<string, string> = {
  json: "application/sparql-results+json", csv: "text/csv", tsv: "text/tab-separated-values", xml: "application/sparql-results+xml",
  ttl: "text/turtle", turtle: "text/turtle", nt: "application/n-triples", ntriples: "application/n-triples",
};

function pickFormat(req: Request, isGraph: boolean): string {
  const explicit = String(req.query.format ?? "").toLowerCase();
  if (FORMATS[explicit]) return FORMATS[explicit];
  const accept = String(req.headers.accept ?? "");
  if (isGraph) return accept.includes("application/n-triples") ? "application/n-triples" : "text/turtle";
  for (const f of ["text/csv", "text/tab-separated-values", "application/sparql-results+xml", "application/sparql-results+json"]) if (accept.includes(f)) return f;
  return "application/sparql-results+json";
}

export async function sparqlHandler(req: Request, res: Response) {
  let query: string | undefined;
  if (req.is("application/sparql-update") || (req.body as any)?.update || req.query.update) {
    return res.status(403).type("text/plain").send("This endpoint is read-only: SPARQL Update is not allowed.");
  }
  if (req.method === "GET") query = req.query.query as string | undefined;
  else if (req.is("application/sparql-query")) query = typeof req.body === "string" ? req.body : undefined;
  else if (req.is("application/x-www-form-urlencoded")) query = (req.body as any)?.query;
  if (!query && req.method === "GET" && String(req.headers.accept ?? "").includes("text/html")) {
    return res.redirect(303, "/lab");          // a person opening the endpoint in a browser gets the SPARQL Lab
  }
  if (!query) {
    return res.status(400).type("text/plain").send("Missing 'query' parameter. Use GET /sparql?query=… or POST (application/x-www-form-urlencoded or application/sparql-query).");
  }
  if (UPDATE.test(query)) return res.status(403).type("text/plain").send("This endpoint is read-only: SPARQL Update is not allowed.");
  const isGraph = /\b(CONSTRUCT|DESCRIBE)\b/i.test(query.replace(/#[^\n]*/g, ""));
  const format = pickFormat(req, isGraph);
  const out = await runQuery(query, format);
  if (!out.ok) return res.status(out.timeout ? 503 : 400).type("text/plain").send(out.error);
  if (out.truncated) res.setHeader("X-Results-Truncated", String(SPARQL_MAX_ROWS));
  res.type(format.includes("json") ? "application/sparql-results+json" : format).send(out.body);
}
