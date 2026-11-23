// One case file, laid out as a dossier sheet: verdict stamp, the case in one paragraph, the evidence step by step
// (who produces each step: DEC, the edition or KGRC; the query folded under each step), notes and assumptions,
// the passages in the text, the diagram and DEC's own records.
import { Link, useNavigate, useParams } from "react-router";
import { useApi, type Dossier, type Step } from "../api";
import { ErrorBox, Loading, SentenceLink, Stamp } from "../components/Bits";
import { DecBadge } from "../components/Glyphs";
import { GraphView } from "../components/LazyGraph";
import { StepTable } from "../components/ResultTable";
import { useApp, withMode } from "../state";

const NOTE: Record<string, { label: string; tone: string }> = {
  assumption: { label: "Assumption", tone: "red" }, semantics: { label: "Meaning", tone: "" }, defect: { label: "DEC bug", tone: "redfill" },
  attribution: { label: "Who says so", tone: "" }, reported: { label: "Reported speech", tone: "" }, scope: { label: "Scope", tone: "" },
};

function By({ by }: { by: Step["by"] }) {
  if (by === "dec") return <DecBadge title="DEC produces this answer: its inferences or its verdicts" />;
  if (by === "kgrc") return <span className="by-badge" title="Comparison with the original KGRC graph">KGRC</span>;
  return <span className="by-badge" title="A check made by the edition over DEC's results">✎ Edition</span>;
}

export default function DossierPage() {
  const { id } = useParams();
  const { data: d, error } = useApi<Dossier>(`/api/dossiers/${id}`);
  const { data: index } = useApi<Dossier[]>("/api/dossiers");
  const { mode } = useApp();
  const navigate = useNavigate();
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!d) return <div className="page"><Loading what="Unsealing the case file" /></div>;
  const i = index?.findIndex((x) => x.id === d.id) ?? -1;
  const prev = i > 0 ? index![i - 1] : null, next = index && i >= 0 && i < index.length - 1 ? index[i + 1] : null;
  const decRuns = groupDec(d.dec);
  const openLab = (q: string) => navigate(withMode("/lab", mode), { state: { query: q } });

  return (
    <div className="page">
      <nav className="spread small" aria-label="Case file navigation" style={{ marginBottom: 6 }}>
        <Link to={withMode("/dossiers", mode)}>← All case files</Link>
        <span className="row">
          {prev && <Link to={withMode(`/dossiers/${prev.id}`, mode)}>← No. {prev.number}</Link>}
          {next && <Link to={withMode(`/dossiers/${next.id}`, mode)}>No. {next.number} →</Link>}
        </span>
      </nav>
      <article className="sheet">
        <span className="folder-tab">Case file No. {String(d.number).padStart(2, "0")} · {d.typeLabel}</span>
        <header className="sheet-head">
          <div>
            <h1>{d.title}</h1>
            <p className="muted" style={{ margin: "0 0 12px" }}>{d.subtitle}</p>
            <p className="summary">{d.summary}</p>
            {d.id === "consequences-identity" && <p style={{ marginTop: 10 }}><Link className="btn small" to={withMode("/deductions?at=P126.S11", mode)}>See when each of these becomes available →</Link></p>}
          </div>
          <Stamp stamp={d.stamp} tone={d.verdict.tone} big />
        </header>
        <div className="sheet-body">
          <section aria-labelledby="steps-h">
            <h2 id="steps-h">The evidence, step by step</h2>
            {d.steps.map((s) => (
              <div className="step" key={s.n}>
                <div className="step-n" aria-hidden="true">{s.n}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="spread" style={{ alignItems: "flex-start" }}>
                    <h3><span className="sr-only">Step {s.n}: </span>{s.title}</h3>
                    <By by={s.by} />
                  </div>
                  <p className="step-text">{s.text}</p>
                  <details className="more">
                    <summary>Show the query and its result</summary>
                    <div className="more-body">
                      <pre className="code">{s.sparql}</pre>
                      {s.kind === "ask" ? <p className="ask-result">ASK → <strong>{String(s.result).toUpperCase()}</strong></p> : <StepTable columns={s.columns ?? []} rows={s.rows ?? []} />}
                      <button className="btn small" style={{ marginTop: 8 }} onClick={() => openLab(s.sparql)}>Open in the SPARQL Lab →</button>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </section>
          <section aria-labelledby="notes-h">
            <h2 id="notes-h">Notes &amp; assumptions</h2>
            {d.caveats.length === 0 ? <p className="small muted">None.</p> : d.caveats.map((c, k) => (
              <div className="note" key={k}><span className={`tag ${NOTE[c.kind]?.tone ?? ""}`}>{NOTE[c.kind]?.label ?? c.kind}</span><span>{c.text}</span></div>
            ))}
            <h2 style={{ marginTop: 26 }}>In the text</h2>
            <div className="stack">
              {d.anchorTexts.map((a) => (
                <div key={a.id}>
                  <blockquote className="quote" style={{ marginBottom: 2 }}>{a.text}</blockquote>
                  <SentenceLink id={a.id}><span className="small">Read in context →</span></SentenceLink>
                </div>
              ))}
            </div>
            <details className="more" style={{ marginTop: 18 }}>
              <summary>DEC's own records <span className="muted">({decRuns.length})</span></summary>
              <div className="more-body">
                {decRuns.length === 0 ? <p className="small">DEC recorded no verdict here (these points of view were never checked together).</p> : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Point of view</th><th>DEC says</th><th>Runs</th></tr></thead>
                      <tbody>
                        {decRuns.map((r) => (
                          <tr key={r.key}><td className="mono">{r.world}</td><td>{r.relation === "delusionalWorld" ? "delusional" : <>conflicts with <span className="mono">{r.other}</span></>}</td><td className="small">{r.runs.length}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </details>
          </section>
        </div>
      </article>

      <section className="card pad" style={{ marginTop: 24 }} aria-labelledby="graph-h">
        <h2 id="graph-h">Who holds what</h2>
        {d.graph?.length ? <GraphView elements={d.graph} height="tall" caption={d.title} /> : <p className="empty">No diagram for this case.</p>}
      </section>
    </div>
  );
}

function groupDec(dec: Dossier["dec"]) {
  const m = new Map<string, { key: string; world: string; relation: string; other: string; runs: string[] }>();
  for (const x of dec) {
    const other = x.other ? x.other.split("/").pop()! : "";
    const key = `${x.world}|${x.relation}|${other}`;
    if (!m.has(key)) m.set(key, { key, world: x.world, relation: x.relation, other, runs: [] });
    m.get(key)!.runs.push(x.run);
  }
  return [...m.values()];
}
