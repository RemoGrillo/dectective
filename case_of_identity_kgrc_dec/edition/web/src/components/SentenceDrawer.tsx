// Panel for one sentence: the verdicts first (lie, delusion, honest mistake), then the claims the sentence makes,
// the kaleidoscope of the selected claim and who holds what. Diagram, case files and the KGRC comparison are folded.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useApi, type SentenceView } from "../api";
import { useApp, withMode } from "../state";
import { DIAG } from "../vocab";
import { ErrorBox, Loading, Stamp } from "./Bits";
import { DecBadge, DiagIcon } from "./Glyphs";
import { Holders } from "./Holders";
import { Kaleidoscope } from "./Kaleidoscope";
import { GraphView } from "./LazyGraph";
import { ConclusionCard, useTimeline } from "./DeductionBits";

export function SentenceDrawer({ sid, onClose }: { sid: string; onClose: () => void }) {
  const { q, mode } = useApp();
  const { data, error, loading } = useApi<SentenceView>(q(`/api/sentence/${sid}`));
  const { data: text } = useApi<{ speakerNames: Record<string, string> }>(q("/api/text"));
  const [pi, setPi] = useState(0);
  const navigate = useNavigate();
  const { data: tl } = useTimeline();
  useEffect(() => { setPi(0); }, [sid, mode]);

  const close = <button className="btn small ghost drawer-close" onClick={onClose} aria-label="Close the panel">Close ✕</button>;
  if (error) return <div className="card">{close}<ErrorBox error={error} /></div>;
  if (loading || !data) return <div className="card">{close}<Loading what="Turning the kaleidoscope" /></div>;
  if (data.hidden) return <div className="card">{close}<p className="kicker">Selected sentence</p><div className="sealed">{data.reason}</div></div>;

  const vps = data.viewpoints;
  const vp = vps[Math.min(pi, vps.length - 1)];
  const speaker = text?.speakerNames[data.paragraph.speaker] ?? data.paragraph.speaker;
  const kgrcScenes = [...new Set([...data.units.flatMap((u) => u.kgrcScenes), ...data.kgrcAuto])];

  return (
    <div className="card">
      {close}
      <p className="kicker">Selected sentence · {speaker} · p. {data.paragraph.page}</p>
      <blockquote className="quote">{data.text}</blockquote>

      {data.diagnoses.length > 0 && (
        <div className="verdicts">
          {data.diagnoses.map((d, i) => (
            <div className="verdict" key={i}>
              <DiagIcon kind={d.kind} size={30} />
              <div>
                <div className="w">{DIAG[d.kind].label}</div>
                <div className="t">{d.text}{d.assumption ? <span className="muted"> — {d.assumption}</span> : null}.</div>
                <div className="d" title={`DEC: ${DIAG[d.kind].dec}`}>{DIAG[d.kind].rule} <span className="dec-term">In DEC's terms</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {vps.length === 0 ? (
        <p className="empty">No claim of the model is tied to this sentence{mode !== "gold" ? " at this point of the story" : ""}.</p>
      ) : (
        <>
          {vps.length > 1 && (
            <div className="claims" role="group" aria-label="Claims made in this sentence">
              <span className="label">{vps.length} claims in this sentence</span>
              {vps.map((v, i) => (
                <button key={v.id} aria-pressed={i === pi} onClick={() => setPi(i)}>
                  <span className="n">{i + 1}</span>
                  <span style={{ flex: 1 }}>{v.text}</span>
                  {v.diagnoses.slice(0, 1).map((d) => <DiagIcon key={d.kind} kind={d.kind} size={16} />)}
                </button>
              ))}
            </div>
          )}
          <p className="claim-title">“{vp.text}”</p>
          <Kaleidoscope vp={vp} size={290} />
          <h4 style={{ marginTop: 16 }}>Who holds what</h4>
          <Holders vp={vp} />
        </>
      )}

      <div style={{ marginTop: 14 }}>
        {tl && (() => {
          const st = tl.steps.find((x) => x.sid === sid);
          if (!st) return null;
          const cons = tl.conclusions.filter((c) => c.step === st.n && c.cls === "story");
          const ev = tl.events.filter((e) => e.step === st.n && e.kind === "verdict");
          const sofar = tl.conclusions.filter((c) => c.step <= st.n && c.cls === "story").length;
          return (
            <details className="more" open={cons.length > 0 || ev.length > 0}>
              <summary>What DEC can now conclude <span className="muted">clue {st.n} · +{cons.length} · {sofar} of {tl.totals.conclusions} so far</span></summary>
              <div className="more-body stack">
                {ev.map((e, i) => <div key={i} className="small red">Now detectable: {DIAG[e.diagnosis!.kind].label} — {e.diagnosis!.text}.</div>)}
                {cons.length === 0 && <p className="small muted" style={{ margin: 0 }}>This sentence adds facts, but no new conclusion yet.</p>}
                {cons.slice(0, 4).map((c) => <ConclusionCard key={c.id} c={c} tl={tl} />)}
                {cons.length > 4 && <p className="small muted" style={{ margin: 0 }}>…and {cons.length - 4} more.</p>}
                <Link className="btn small" to={withMode(`/deductions?at=${sid}`, mode)}>Follow the deductions →</Link>
              </div>
            </details>
          );
        })()}
        {data.graph.length > 0 && (
          <details className="more">
            <summary>Diagram <span className="muted">people → points of view → statements</span></summary>
            <div className="more-body"><GraphView elements={data.graph} height="short" caption={`sentence ${sid}`} /></div>
          </details>
        )}
        {data.dossiers.length > 0 && (
          <details className="more" open>
            <summary>Case files <span className="muted">({data.dossiers.length})</span></summary>
            <div className="more-body stack">
              {data.dossiers.map((d) => (
                <Link key={d.id} to={withMode(`/dossiers/${d.id}`, mode)} className="card flat pad" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", textDecoration: "none" }}>
                  <span><span className="kicker">No. {String(d.number).padStart(2, "0")} · {d.typeLabel}</span><br /><span style={{ fontWeight: 600 }}>{d.title}</span></span>
                  <Stamp stamp={d.stamp} tone={d.verdict.tone} />
                </Link>
              ))}
            </div>
          </details>
        )}
        {kgrcScenes.length > 0 && (
          <details className="more">
            <summary>Compared with KGRC <span className="muted">the original knowledge graph</span></summary>
            <div className="more-body stack small">
              {data.units.map((u) => (
                <div key={u.id}>
                  <span className={`tag ${u.coverage === "present" ? "" : "red"}`}>{u.coverage === "present" ? "covered" : u.coverage}</span> {u.content}
                  {u.issue && <div className="muted">KGRC: {u.issue}</div>}
                </div>
              ))}
              <button className="btn small" onClick={() => navigate(withMode("/lab", mode), { state: { query: kgrcSparql(kgrcScenes) } })}>See the KGRC scenes in the SPARQL Lab →</button>
            </div>
          </details>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <Link className="btn small" to={withMode(`/kaleidoscope/${sid}`, mode)}>Open in the Kaleidoscope →</Link>
          <span className="small muted"><DecBadge /> computed from DEC's views</span>
        </div>
      </div>
    </div>
  );
}

function kgrcSparql(scenes: string[]) {
  return `PREFIX kgc:  <http://kgc.knowledge-graph.jp/ontology/kgc.owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
# What the original KGRC graph says in the scenes aligned with this sentence
SELECT ?scene ?p ?o WHERE {
  GRAPH <http://kgc.knowledge-graph.jp/data/ACaseOfIdentity> {
    VALUES ?scene { ${scenes.map((s) => `<http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/${s}>`).join(" ")} }
    ?scene ?p ?o .
  }
} ORDER BY ?scene ?p
`;
}
