// Panel for one sentence. Fixed at the top: the proposition (in plain English), the sentence under it,
// the verdict badges and the kaleidoscope. Below, scrolling, an accordion: Diagram (open), Who holds what,
// What DEC can now conclude, Case files, KGRC.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useApi, type SentenceView } from "../api";
import { useApp, withMode } from "../state";
import { DIAG } from "../vocab";
import { ErrorBox, Loading, Stamp } from "./Bits";
import { ConclusionCard, useTimeline } from "./DeductionBits";
import { FocusVenn } from "./FocusVenn";
import { Holders } from "./Holders";
import { Kaleidoscope } from "./Kaleidoscope";
import { TermBadge } from "./Term";
import { useSwap } from "./Motion";

/** `focus`: a proposition (or a conclusion of DEC) picked in the timeline: the panel opens on it. */
export function SentenceDrawer({ sid, onClose, focus }: { sid: string; onClose: () => void; focus?: { text: string; kind: string; conclusion?: { text: string; world?: string } } | null }) {
  const { q, mode } = useApp();
  const { data: fresh, error } = useApi<SentenceView>(q(`/api/sentence/${sid}`));
  // the previous sentence stays on screen until the next one has arrived, then they swap with a short fade
  const { shown: data, phase } = useSwap(fresh, (d) => `${d.mode}:${d.id}`);
  const { data: text } = useApi<{ speakerNames: Record<string, string> }>(q("/api/text"));
  const [pi, setPi] = useState(0);
  const navigate = useNavigate();
  const { data: tl } = useTimeline();
  useEffect(() => {
    const i = focus ? (data?.viewpoints ?? []).findIndex((v) => v.text === focus.text) : -1;
    setPi(i >= 0 ? i : 0);
  }, [data?.id, mode, focus?.text]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = <button className="btn small ghost drawer-close" onClick={onClose} aria-label="Close the panel">Close ✕</button>;
  if (error) return <div className="card">{close}<ErrorBox error={error} /></div>;
  if (!data) return <div className="card">{close}<Loading what="Turning the kaleidoscope" /></div>;
  if (data.hidden) return <div className="card">{close}<p className="kicker">Selected sentence</p><div className="sealed">{data.reason}</div></div>;

  const vps = data.viewpoints;
  const vp = vps[Math.min(pi, vps.length - 1)];
  const speaker = text?.speakerNames[data.paragraph.speaker] ?? data.paragraph.speaker;
  const kgrcScenes = [...new Set([...data.units.flatMap((u) => u.kgrcScenes), ...data.kgrcAuto])];
  const clue = tl?.steps.find((x) => x.sid === data.id);
  const diags = vp ? vp.diagnoses : [];

  return (
    <div className="card drawer-card">
      <div className={`drawer-fixed swap ${phase}`} key={`f-${data.id}-${pi}`}>
        {close}
        <div className="row" style={{ gap: 6, paddingRight: 70 }}>
          <span className="kicker" style={{ margin: 0 }}>{vps.length > 1 ? `Proposition ${pi + 1} of ${vps.length}` : vps.length ? "Proposition" : "Sentence"}</span>
          {vps.length > 1 && (
            <span className="seg" role="group" aria-label="Propositions in this sentence">
              {vps.map((v, i) => <button key={v.id} aria-pressed={i === pi} onClick={() => setPi(i)} title={v.text}>{i + 1}</button>)}
            </span>
          )}
        </div>
        {vp && <p className="claim-title">{vp.text}</p>}
        <blockquote className="quote quote-small">{data.text}<span className="muted"> — {speaker}, p. {data.paragraph.page}</span></blockquote>
        {diags.length > 0 && <div className="row" style={{ gap: 6, margin: "6px 0 2px" }}>{diags.map((d, i) => <TermBadge key={i} kind={d.kind} text={d.text} assumption={d.assumption} />)}</div>}
        {vp ? <Kaleidoscope vp={vp} size={215} compact /> : <p className="empty">No proposition of the model is tied to this sentence{mode !== "gold" ? " at this point of the story" : ""}.</p>}
      </div>

      <div className={`drawer-scroll swap ${phase}`} key={`s-${data.id}`}>
        {vps.length > 0 && (
          <details className="more" open>
            <summary>Diagram <span className="muted">who holds these propositions, against Reality</span></summary>
            <div className="more-body"><FocusVenn url={q(`/api/venn/sentence/${data.id}`)} height={360} minWidth={380} /></div>
          </details>
        )}
        {vp && (
          <details className="more">
            <summary>Who holds what <span className="muted">proposition {pi + 1}</span></summary>
            <div className="more-body"><Holders vp={vp} /></div>
          </details>
        )}
        {tl && clue && (() => {
          // a conclusion picked in the timeline that is not one of the sentence's propositions: open this section on it
          const pick = focus?.conclusion && (focus.kind !== "conclusion" || !vps.some((v) => v.text === focus.text)) ? focus.conclusion : null;
          const isPicked = (c: { text: string; world: string }) => !!pick && c.text === pick.text && (!pick.world || c.world === pick.world);
          const all = tl.conclusions.filter((c) => c.step === clue.n && c.cls === "story");
          const cons = pick ? [...all.filter(isPicked), ...all.filter((c) => !isPicked(c))] : all;
          const picked = pick ? `${pick.world}|${pick.text}` : null;
          const ev = tl.events.filter((e) => e.step === clue.n && e.kind === "verdict");
          const sofar = tl.conclusions.filter((c) => c.step <= clue.n && c.cls === "story").length;
          return (
            <details className="more" key={picked ?? "conclusions"} open={picked ? true : undefined}>
              <summary>What DEC can now conclude <span className="muted">+{cons.length} · {sofar} of {tl.totals.conclusions} so far</span></summary>
              <div className="more-body stack">
                {ev.length > 0 && <div className="row" style={{ gap: 6 }}><span className="small">Now detectable:</span>{ev.map((e, i) => <TermBadge key={i} kind={e.diagnosis!.kind} text={e.diagnosis!.text} assumption={e.diagnosis!.assumption} size="small" />)}</div>}
                {cons.length === 0 && <p className="small muted" style={{ margin: 0 }}>This sentence adds propositions, but no new conclusion yet.</p>}
                {cons.slice(0, 4).map((c) => <div key={c.id} className={isPicked(c) ? "concl-picked" : undefined}><ConclusionCard c={c} tl={tl} /></div>)}
                {cons.length > 4 && <p className="small muted" style={{ margin: 0 }}>…and {cons.length - 4} more.</p>}
                <Link className="btn small" to={withMode(`/deductions?at=${data.id}`, mode)}>Follow the deductions →</Link>
              </div>
            </details>
          );
        })()}
        {data.dossiers.length > 0 && (
          <details className="more">
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
              <button className="btn small" onClick={() => navigate(withMode("/interrogation", mode), { state: { query: kgrcSparql(kgrcScenes) } })}>See the KGRC scenes in Interrogation →</button>
            </div>
          </details>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          {vp && <Link className="btn small" to={withMode(`/perspectives?p=${vp.id}`, mode)}>Open in Perspectives →</Link>}
          {diags.length === 0 && data.diagnoses.length > 0 && <span className="small muted">Other propositions here: {[...new Set(data.diagnoses.map((d) => DIAG[d.kind].label))].join(", ")}</span>}
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
