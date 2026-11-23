// Worker thread holding its own read-only copy of the store for the public SPARQL endpoint.
// Running user queries here keeps the API responsive and lets the parent terminate runaway queries.
import { parentPort, workerData } from "node:worker_threads";
import { readFileSync } from "node:fs";
import oxigraph from "oxigraph";

const store = new oxigraph.Store();
store.load(readFileSync(workerData.file, "utf8"), { format: "application/n-quads" });
parentPort!.postMessage({ ready: true, size: store.size });

parentPort!.on("message", (msg: { id: number; query: string; format: string; maxRows: number }) => {
  try {
    const res = store.query(msg.query, { results_format: msg.format });
    let body = typeof res === "string" ? res : String(res);
    let truncated = false;
    if (msg.format === "application/sparql-results+json" && body.length > 0) {
      const parsed = JSON.parse(body);
      if (parsed.results?.bindings?.length > msg.maxRows) {
        parsed.results.bindings = parsed.results.bindings.slice(0, msg.maxRows);
        truncated = true;
        body = JSON.stringify(parsed);
      }
    }
    parentPort!.postMessage({ id: msg.id, ok: true, body, truncated });
  } catch (e: any) {
    parentPort!.postMessage({ id: msg.id, ok: false, error: String(e?.message ?? e) });
  }
});
