// Regression: replay the audit's test queries (prototype/fixtures/*/*.rq) on the edition store and compare the answers
// with DEC's observations recorded in prototype/results/test_results.json.
// Gold queries run unchanged (default graph = DEC reality, named graphs = DEC world views only, as in a restored DEC dataset). Checkpoint queries run with
// the checkpoint's reality as default graph and their GRAPH w:x patterns redirected to the checkpoint's views.
// Run directly:  node src/regression.ts
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import oxigraph from "oxigraph";
import { DATA_DIR, NS } from "./config.ts";

export const PROJECT_ROOT = path.resolve(DATA_DIR, "..", "..");
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";

export type Outcome = {
  id: string; dataset: string; classification: string; expected: unknown; dec: unknown; edition: unknown;
  sameAsDec: boolean; matchesExpected: boolean; decMatchedExpected: boolean | null;
};

function fmt(b: any): string {
  if (b.type === "uri") return b.value;
  if (b.type === "bnode") return "_:" + b.value;
  if (b["xml:lang"]) return `${b.value}@${b["xml:lang"]}`;
  if (b.datatype && b.datatype !== XSD_STRING) return `${b.value}^^${b.datatype}`;
  return b.value;
}

let cached: { store: any; graphs: string[] } | null = null;
function store() {
  if (cached) return cached;
  const s = new oxigraph.Store();
  s.load(readFileSync(path.join(DATA_DIR, "edition.nq"), "utf8"), { format: "application/n-quads" });
  const g = JSON.parse(s.query("SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } }", { results_format: "json" }) as string);
  cached = { store: s, graphs: g.results.bindings.map((b: any) => b.g.value) };
  return cached;
}

export function runOne(query: string, dataset: string): unknown {
  const { store: s, graphs } = store();
  let q = query;
  let opts: any;
  if (dataset === "gold") {
    opts = { default_graph: oxigraph.defaultGraph(), named_graphs: graphs.filter((g) => g.startsWith(NS.w)).map((g) => oxigraph.namedNode(g)) };
  } else {
    const snap = NS.snapshot + dataset + "/";
    q = q.replace(/GRAPH\s+w:([A-Za-z0-9_]+)/g, (_m, w) => `GRAPH <${snap}${w}>`)
         .replace(/GRAPH\s+<http:\/\/example\.org\/dectective\/world\/([A-Za-z0-9_]+)>/g, (_m, w) => `GRAPH <${snap}${w}>`);
    opts = { default_graph: oxigraph.namedNode(snap + "reality"), named_graphs: graphs.filter((g) => g.startsWith(snap)).map((g) => oxigraph.namedNode(g)) };
  }
  const out = s.query(q, { ...opts, results_format: "json" }) as string;
  const j = JSON.parse(out);
  if (typeof j.boolean === "boolean") return j.boolean;
  const vars: string[] = j.head.vars;
  const back = (v: string) => (dataset === "gold" ? v : v.replace(NS.snapshot + dataset + "/", NS.w));
  return j.results.bindings.map((b: any) => vars.map((v) => `${v}=${b[v] ? back(fmt(b[v])) : "UNBOUND"}`).join(" ")).sort();
}

const same = (a: unknown, b: unknown) => JSON.stringify(Array.isArray(a) ? [...a].sort() : a) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b);

export function runAuditQueries(): Outcome[] {
  const results = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "prototype/results/test_results.json"), "utf8"));
  const fixtures = path.join(PROJECT_ROOT, "prototype/fixtures");
  const out: Outcome[] = [];
  for (const dir of readdirSync(fixtures).sort()) {
    const mf = path.join(fixtures, dir, "manifest.json");
    if (!existsSync(mf)) continue;
    const man = JSON.parse(readFileSync(mf, "utf8"));
    if (man.exclude_axioms?.length) continue;                  // ablation: its materialisation is not part of the edition
    for (const q of man.queries) {
      const rec = results[q.id];
      if (!rec) continue;
      const edition = runOne(readFileSync(path.join(fixtures, dir, q.file), "utf8"), man.dataset);
      out.push({
        id: q.id, dataset: man.dataset, classification: q.classification, expected: q.expected, dec: rec.observed.dec, edition,
        sameAsDec: same(edition, rec.observed.dec), matchesExpected: same(edition, q.expected), decMatchedExpected: rec.matches_expected.dec,
      });
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = runAuditQueries();
  for (const r of res) {
    console.log(`${r.sameAsDec ? "same " : "DIFF "} ${r.matchesExpected ? "exp✓" : "exp✗"} ${r.id.padEnd(36)} ${r.dataset.padEnd(5)} edition=${JSON.stringify(r.edition).slice(0, 110)}`);
    if (!r.sameAsDec) console.log(`        dec=${JSON.stringify(r.dec).slice(0, 160)}`);
  }
  console.log(`${res.filter((r) => r.sameAsDec).length}/${res.length} identical to DEC's recorded answer; ${res.filter((r) => r.matchesExpected).length}/${res.length} match the expected answer`);
}
