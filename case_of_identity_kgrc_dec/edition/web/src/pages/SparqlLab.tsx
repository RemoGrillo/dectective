// Interrogation (the SPARQL Lab): example gallery (natural language ↔ SPARQL), editor, results, downloads, curl snippet, graph guide.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { runSparql, useApi, type Example, type SparqlResult } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { SparqlEditor } from "../components/SparqlEditor";
import { SparqlTable } from "../components/ResultTable";
import { useApp } from "../state";

const DEFAULT = `PREFIX dec: <http://w3id.org/conjectures/>
PREFIX prof: <http://example.org/dectective/profile#>
# Which worlds does each agent govern, and how? (DEC reality = default graph)
SELECT ?agent ?how ?world WHERE {
  VALUES ?how { prof:believes prof:establishes prof:conjectures prof:uttered }
  ?agent ?how ?world .
} ORDER BY ?agent ?how
`;

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SparqlLab() {
  const { data: examples, error: exErr } = useApi<Example[]>("/api/examples");
  const { meta } = useApp();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState<string>(() => (loc.state as any)?.query ?? DEFAULT);
  const [current, setCurrent] = useState<string | null>(null);
  const [result, setResult] = useState<SparqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const byCat = useMemo(() => {
    const m = new Map<string, Example[]>();
    for (const e of examples ?? []) m.set(e.category, [...(m.get(e.category) ?? []), e]);
    return [...m.entries()];
  }, [examples]);

  // deep link: ?example=<id>
  useEffect(() => {
    const id = params.get("example");
    if (id && examples) {
      const e = examples.find((x) => x.id === id);
      if (e) { setQuery(e.sparql); setCurrent(e.id); }
    }
  }, [examples, params]);
  useEffect(() => { if ((loc.state as any)?.query) { setQuery((loc.state as any).query); setCurrent(null); } }, [loc.state]);

  const run = async () => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setBusy(true); setError(null);
    try { setResult(await runSparql(query, ac.signal)); }
    catch (e: any) { if (e.name !== "AbortError") { setError(String(e.message ?? e)); setResult(null); } }
    finally { setBusy(false); }
  };
  const pick = (e: Example) => {
    setQuery(e.sparql); setCurrent(e.id); setResult(null); setError(null);
    setParams((p) => { const n = new URLSearchParams(p); n.set("example", e.id); return n; }, { replace: true });
  };
  const exportAs = async (fmt: "csv" | "json") => {
    const r = await fetch(`/sparql?format=${fmt}`, { method: "POST", headers: { "Content-Type": "application/sparql-query" }, body: query });
    const body = await r.text();
    if (!r.ok) { setError(body); return; }
    download(`dectective-query.${fmt}`, body, fmt === "csv" ? "text/csv" : "application/sparql-results+json");
  };
  const ex = examples?.find((e) => e.id === current);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:4410";
  const curl = `curl -s ${origin}/sparql \\\n  -H 'Accept: application/sparql-results+json' \\\n  --data-urlencode 'query@query.rq'`;

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Interrogation</h1>
        <p className="lede">Question the graph yourself, in SPARQL: pick one of the questions, or write your own.</p>
      </div>
      <div className="lab">
        <aside className="examples card" aria-label="Example questions">
          <h3 style={{ marginBottom: 2 }}>Questions</h3>
          <p className="small muted" style={{ margin: 0 }}>Each one comes with the query that answers it.</p>
          {exErr && <ErrorBox error={exErr} />}
          {!examples && !exErr && <Loading />}
          {byCat.map(([cat, list]) => (
            <div key={cat}>
              <h4>{cat}</h4>
              {list.map((e) => <button key={e.id} aria-current={current === e.id} onClick={() => pick(e)}>{e.question}</button>)}
            </div>
          ))}
        </aside>
        <div className="stack">
          <section className="card pad" aria-label="Query editor">
            {ex ? (
              <div style={{ marginBottom: 10 }}>
                <span className="label">{ex.category}</span>
                <p style={{ fontFamily: "var(--f-text)", fontSize: "1.15rem", fontWeight: 600, margin: "4px 0 0" }}>{ex.question}</p>
                {ex.note && <p className="small muted" style={{ margin: "4px 0 0" }}>{ex.note}</p>}
              </div>
            ) : <p className="small muted" style={{ marginTop: 0 }}>Write a query, or pick a question on the left. <span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> runs it.</p>}
            <SparqlEditor value={query} onChange={setQuery} onRun={run} />
            <div className="spread" style={{ marginTop: 10 }}>
              <div className="row">
                <button className="btn primary" onClick={run} disabled={busy}>{busy ? "Running…" : "Run query"} ▶</button>
                <button className="btn small" onClick={() => exportAs("csv")}>Download CSV</button>
                <button className="btn small" onClick={() => exportAs("json")}>Download JSON</button>
              </div>
              <div className="status-line" aria-live="polite">
                {result && <span>{result.kind === "select" ? `${result.rows.length} row(s)${result.truncated ? " (truncated)" : ""}` : result.kind === "ask" ? "boolean" : "graph"} · {result.ms} ms</span>}
              </div>
            </div>
          </section>
          {error && <ErrorBox error={error} />}
          {result?.kind === "select" && (result.rows.length ? <SparqlTable result={result} /> : <p className="empty">No results.</p>)}
          {result?.kind === "ask" && <div className="card pad"><p className="ask-result" style={{ margin: 0 }}>ASK → <strong>{String(result.boolean).toUpperCase()}</strong></p></div>}
          {result?.kind === "graph" && <pre className="code" style={{ maxHeight: 480 }}>{result.text}</pre>}

          <details className="more">
            <summary>Use the endpoint from your own tools <span className="muted">{origin}/sparql · read-only · 10 s timeout</span></summary>
            <div className="more-body grid cols-2">
              <div>
                <h4>From the command line</h4>
                <pre className="code">{curl}</pre>
                <p className="small" style={{ margin: 0 }}>Also <span className="mono">GET /sparql?query=…</span> and <span className="mono">POST application/sparql-query</span>; choose the format with <span className="mono">?format=csv|tsv|json|xml</span> or the Accept header. CONSTRUCT/DESCRIBE return Turtle.</p>
              </div>
              <div>
                <h4>Graphs in the store</h4>
                <div className="table-wrap">
                  <table className="data">
                    <tbody>{(meta?.graphs ?? []).map((g) => <tr key={g.iri}><td className="mono small">{g.iri}</td><td className="small">{g.role}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
