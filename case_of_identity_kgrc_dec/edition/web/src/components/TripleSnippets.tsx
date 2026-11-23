// Live snippets of how the data is modelled: the triples DECLARED in a point of view, next to the triples DEC INFERS there.
// Both come from the SPARQL endpoint (graphs asserted/<world> and world/<world>), so they are the real data.
import { useEffect, useState } from "react";
import { runSparql } from "../api";

const NS: [string, string][] = [
  ["http://example.org/dectective/story/", "st:"], ["http://example.org/dectective/profile#", "prof:"],
  ["http://www.w3.org/2002/07/owl#", "owl:"], ["http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf:"], ["http://www.w3.org/2000/01/rdf-schema#", "rdfs:"],
];
const short = (iri: string) => { for (const [u, p] of NS) if (iri.startsWith(u)) return p + iri.slice(u.length); return iri; };
const D = "http://example.org/dectective/";

const declared = (w: string) => `SELECT ?s ?p ?o WHERE { GRAPH <${D}asserted/${w}> { ?s ?p ?o } } ORDER BY ?s ?p ?o`;
// inferred = in DEC's view but not declared; only story things, no reflexive identity and no top classes (noise)
const inferred = (w: string) => `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?s ?p ?o WHERE {
  GRAPH <${D}world/${w}> { ?s ?p ?o }
  FILTER NOT EXISTS { GRAPH <${D}asserted/${w}> { ?s ?p ?o } }
  FILTER(STRSTARTS(STR(?s), "${D}story/")) FILTER(?s != ?o) FILTER(?o NOT IN (rdfs:Resource, owl:Thing))
} ORDER BY ?s ?p ?o`;

type Row = [string, string, string];

function useTriples(query: string) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    runSparql(query).then((r) => { if (live && r.kind === "select") setRows(r.rows.map((b) => [short(b.s.value), short(b.p.value), short(b.o.value)])); }).catch((e) => live && setErr(String(e.message ?? e)));
    return () => { live = false; };
  }, [query]);
  return { rows, err };
}

function Triples({ query, tone }: { query: string; tone: "declared" | "inferred" }) {
  const { rows, err } = useTriples(query);
  if (err) return <p className="small red">Could not load: {err}</p>;
  if (!rows) return <p className="small muted">Loading…</p>;
  return (
    <pre className={`triples ${tone}`}>{rows.length === 0 ? "(none)" : rows.map((r) => `${r[0]}  ${r[1]}  ${r[2]} .`).join("\n")}</pre>
  );
}

/** The declared disjointness rules of the shared background (the rest of that graph is CIDOC CRM schema). */
export function DisjointRules({ title, note }: { title: string; note: string }) {
  const q = `PREFIX owl: <http://www.w3.org/2002/07/owl#> SELECT ?s ?p ?o WHERE { GRAPH <${D}asserted/shared> { ?s owl:disjointWith ?o . BIND(owl:disjointWith AS ?p) } FILTER(STRSTARTS(STR(?s), "${D}profile#")) } ORDER BY ?s ?o`;
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ marginBottom: 2 }}>{title} <span className="mono small muted">w:shared</span></h3>
      <p className="small muted" style={{ margin: "0 0 8px" }}>{note}</p>
      <p className="nb-lane" style={{ marginTop: 0 }}>Declared in the graph</p>
      <Triples query={q} tone="declared" />
    </div>
  );
}

/** Declared next to inferred, for one point of view (world). */
export function TriplePair({ world, title, note }: { world: string; title: string; note: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ marginBottom: 2 }}>{title} <span className="mono small muted">w:{world}</span></h3>
      <p className="small muted" style={{ margin: "0 0 8px" }}>{note}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        <div><p className="nb-lane" style={{ marginTop: 0 }}>Declared in the graph</p><Triples query={declared(world)} tone="declared" /></div>
        <div><p className="nb-lane" style={{ marginTop: 0 }}>Added by DEC</p><Triples query={inferred(world)} tone="inferred" /></div>
      </div>
    </div>
  );
}
