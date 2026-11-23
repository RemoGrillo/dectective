// Tables for SPARQL results (endpoint JSON) and for dossier steps (pre-labelled cells).
import type { Cell, SparqlResult } from "../api";

const PREFIXES: [string, string][] = [
  ["http://example.org/dectective/story/", "st:"],
  ["http://example.org/dectective/world/", "w:"],
  ["http://example.org/dectective/profile#", "prof:"],
  ["http://example.org/dectective/edition#", "ed:"],
  ["http://example.org/dectective/edition/", "edb:"],
  ["http://example.org/dectective/asserted/", "asserted:"],
  ["http://example.org/dectective/snapshot/", "snapshot:"],
  ["http://w3id.org/conjectures/", "dec:"],
  ["http://www.cidoc-crm.org/cidoc-crm/", "crm:"],
  ["http://www.cidoc-crm.org/extensions/crminf/", "inf:"],
  ["http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf:"],
  ["http://www.w3.org/2000/01/rdf-schema#", "rdfs:"],
  ["http://www.w3.org/2002/07/owl#", "owl:"],
  ["http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/", "kgrc:"],
  ["http://kgc.knowledge-graph.jp/ontology/kgc.owl#", "kgc:"],
  ["http://kgc.knowledge-graph.jp/data/predicate/", "kgcpred:"],
];
export function compact(iri: string) {
  for (const [ns, p] of PREFIXES) if (iri.startsWith(ns)) return p + iri.slice(ns.length);
  return iri;
}

export function SparqlTable({ result }: { result: Extract<SparqlResult, { kind: "select" }> }) {
  return (
    <div className="table-wrap" style={{ maxHeight: 520 }}>
      <table className="data">
        <thead><tr><th>#</th>{result.vars.map((v) => <th key={v}>?{v}</th>)}</tr></thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i}>
              <td className="num muted">{i + 1}</td>
              {result.vars.map((v) => {
                const b = r[v];
                if (!b) return <td key={v} className="muted">—</td>;
                if (b.type === "uri") return <td key={v} className="mono" title={b.value}>{compact(b.value)}</td>;
                if (b.type === "bnode") return <td key={v} className="mono muted">_:{b.value}</td>;
                return <td key={v}>{b.value}{b["xml:lang"] ? <span className="muted small">@{b["xml:lang"]}</span> : null}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepTable({ columns, rows, max = 12 }: { columns: string[]; rows: Record<string, Cell>[]; max?: number }) {
  if (!rows.length) return <p className="ask-result">No rows — the pattern does not occur.</p>;
  return (
    <div className="table-wrap" style={{ maxHeight: 360 }}>
      <table className="data">
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, max).map((r, i) => (
            <tr key={i}>{columns.map((c) => <td key={c} title={r[c]?.isIri ? r[c].value : undefined}>{r[c]?.label ?? "—"}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {rows.length > max && <p className="small muted" style={{ margin: 0, padding: "6px 10px" }}>…and {rows.length - max} more rows (run the query in the SPARQL Lab to see all).</p>}
    </div>
  );
}
