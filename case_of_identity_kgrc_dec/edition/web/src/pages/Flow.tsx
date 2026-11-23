// Worlds over the clues, as a page of its own (the same chart also docks under the text in the reader).
import { useState } from "react";
import { Link } from "react-router";
import { ErrorBox, Loading } from "../components/Bits";
import { useTimeline } from "../components/DeductionBits";
import { BLUE, FlowChart, FlowLegend, RED, diagnosesOf } from "../components/FlowChart";
import { useApp, withMode } from "../state";
import { DIAG, VERB } from "../vocab";

export default function Flow() {
  const { mode } = useApp();
  const { data: tl, error } = useTimeline();
  const [sel, setSel] = useState(1);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!tl) return <div className="page"><Loading what="Laying out the worlds" /></div>;
  const cur = tl.steps.find((s) => s.n === sel);
  const claimsAt = tl.claims.filter((c) => c.step === sel && c.world !== "reality");
  const dec = tl.conclusions.filter((c) => c.cls === "story" && c.step === sel);
  const dAt = diagnosesOf(tl).filter((d) => d.e.step === sel);
  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Worlds over the clues</h1>
        <p className="lede">Each row is someone's point of view. <strong>Black</strong> is what the text says. <span style={{ color: BLUE, fontWeight: 700 }}>Blue</span> is what DEC concludes, <span style={{ color: RED, fontWeight: 700 }}>red</span> where something is false. The same chart follows you while you read.</p>
      </div>
      <div style={{ margin: "0 0 10px" }}><FlowLegend /></div>
      <div className="card"><FlowChart tl={tl} n={tl.final} onPick={setSel} /></div>
      <div className="card pad" style={{ marginTop: 14 }} aria-live="polite">
        <div className="row" style={{ gap: 8 }}>
          <button className="btn small" disabled={sel <= 1} onClick={() => setSel(sel - 1)} aria-label="Previous clue">←</button>
          <strong>Clue {sel} of {tl.final}</strong>
          <button className="btn small" disabled={sel >= tl.final} onClick={() => setSel(sel + 1)} aria-label="Next clue">→</button>
          {cur && <Link className="small" to={withMode(`/read?s=${cur.sid}`, mode)}>read it, p. {cur.page} →</Link>}
        </div>
        {cur && <p style={{ margin: "8px 0", fontFamily: "var(--f-text)" }}>“{cur.text}”</p>}
        <div className="small" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
          <div>
            <div className="label">In the text (graph)</div>
            {claimsAt.length === 0 && <p className="muted">No new view enters here.</p>}
            <ul className="plain">{claimsAt.map((c, i) => <li key={i}>● <strong>{c.personName}</strong> {c.verb ? VERB[c.verb].label : ""}: {c.text}</li>)}</ul>
          </div>
          <div>
            <div className="label" style={{ color: BLUE }}>DEC adds</div>
            {dec.length === 0 && dAt.length === 0 && <p className="muted">Nothing new is concluded here.</p>}
            <ul className="plain">
              {dAt.map((d, i) => <li key={"g" + i} style={{ color: RED }}>◆ <strong>{DIAG[d.d.kind].label}</strong>, {d.d.personName}: {d.d.text}</li>)}
              {dec.slice(0, 8).map((c) => <li key={c.id}>{c.kind === "accepted" ? "↓ into Reality" : "○ " + c.worldTitle}: {c.text}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
