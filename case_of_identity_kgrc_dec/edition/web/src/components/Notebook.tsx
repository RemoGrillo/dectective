// Narrative feed for the reader: one card per clue the reader has passed. Each card shows what the story RECORDS
// and what DEC INFERS. The inference that matters is the clash: one claim, held by some points of view and ruled out by
// others (and by what really happened). The current clue shows it as a clash card; older ones stay one line.
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { useApi, type Diagnosis, type SentenceView, type TConclusion, type TEvent, type Timeline, type Viewpoint } from "../api";
import { useApp, withMode } from "../state";
import { DIAG, REALITY, VERB } from "../vocab";
import { ConclusionCard } from "./DeductionBits";
import { DiagIcon } from "./Glyphs";
import { TriplePair } from "./TripleSnippets";

export function Notebook({ tl, n, onGo }: { tl: Timeline; n: number; onGo?: (n: number) => void }) {
  const { mode } = useApp();
  const feed = useRef<HTMLDivElement>(null);
  const cards = tl.steps.filter((st) => st.n <= n).map((st) => ({
    st,
    rec: tl.claims.filter((c) => c.step === st.n),
    inf: tl.conclusions.filter((c) => c.step === st.n && c.cls === "story"),
    ver: tl.events.filter((e) => e.kind === "verdict" && e.step === st.n),
  })).filter((c) => c.rec.length || c.inf.length || c.ver.length);
  const lastN = cards.at(-1)?.st.n;
  useEffect(() => { const el = feed.current; if (el) el.scrollTop = el.scrollHeight; }, [lastN]);
  const cur = tl.steps.find((x) => x.n === n) ?? tl.steps[0];
  return (
    <div className="notebook" aria-live="polite">
      <span className="label">The investigation so far</span>
      <p className="small muted" style={{ margin: "2px 0 8px" }}>What the story <strong>records</strong>, then what DEC <strong>infers</strong>: above all, where points of view clash.</p>
      {cards.length === 0 ? <p className="small muted">Nothing recorded yet. Keep reading.</p> : (
        <div className="nb-feed" ref={feed}>
          {cards.map(({ st, rec, inf, ver }) => (
            <details key={st.n} className={`nb-card ${st.n === lastN ? "now" : ""}`} open={st.n === lastN}>
              <summary><span className="muted">p. {st.page} · </span>{onGo ? <button className="clue-pin" title="Find this clue in the text" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGo(st.n); }}>clue {st.n}</button> : <span className="muted">clue {st.n}</span>} · {rec.length} recorded → {inf.length + ver.length} inferred</summary>
              <div className="nb-body">
                <p className="nb-lane">Recorded in the story</p>
                {rec.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing new.</p>}
                {rec.slice(0, 3).map((c, i) => (
                  <p key={i} className="nb-rec"><strong>{c.world === "reality" ? "Story" : c.personName} {c.verb ? VERB[c.verb].label : "states"}:</strong> {c.text}</p>
                ))}
                {rec.length > 3 && <p className="small muted" style={{ margin: 0 }}>…and {rec.length - 3} more.</p>}
                <p className="nb-arrow" aria-hidden="true">↓</p>
                <p className="nb-lane">DEC infers</p>
                {st.n === lastN ? <Infers sid={st.sid} inf={inf} ver={ver} tl={tl} /> : (
                  <>
                    {ver.map((e) => <p key={e.pid + e.diagnosis!.kind} className="nb-inf red">{DIAG[e.diagnosis!.kind].label}: {e.diagnosis!.text}</p>)}
                    {ver.length === 0 && <p className="small muted" style={{ margin: 0 }}>{inf.length ? `${inf.length} conclusion(s).` : "Nothing yet."}</p>}
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
      <p style={{ margin: "10px 0 0" }}><Link to={withMode(`/deductions?at=${cur.sid}`, mode)}>Follow the investigation →</Link></p>
    </div>
  );
}

/** The inference of the current clue: the verdicts that become detectable here, then other clashes of this sentence; any other conclusion folded. */
function Infers({ sid, inf, ver, tl }: { sid: string; inf: TConclusion[]; ver: TEvent[]; tl: Timeline }) {
  const { q } = useApp();
  const { data } = useApi<SentenceView>(q(`/api/sentence/${sid}`));
  const pids = [...new Set(ver.map((e) => e.pid))];
  const vps = data && !data.hidden ? data.viewpoints : [];
  const others = vps.filter((v) => !pids.includes(v.id) && (v.diagnoses.length > 0 || clashes(v)));
  return (
    <>
      {pids.map((pid) => <ClashById key={pid} pid={pid} fresh />)}
      {others.map((v) => <ClashCard key={v.id} vp={v} />)}
      {pids.length === 0 && others.length === 0 && <p className="small muted" style={{ margin: 0 }}>No new clash here.</p>}
      {inf.length > 0 && (
        <details className="more">
          <summary>Other conclusions ({inf.length})</summary>
          <div className="more-body">{inf.slice(0, 6).map((c) => <ConclusionCard key={c.id} c={c} tl={tl} />)}</div>
        </details>
      )}
    </>
  );
}

function ClashById({ pid, fresh }: { pid: string; fresh?: boolean }) {
  const { q } = useApp();
  const { data } = useApi<Viewpoint>(q(`/api/viewpoint/${pid}`));
  return data ? <ClashCard vp={data} fresh={fresh} /> : <p className="small muted">Loading…</p>;
}

const clashes = (vp: Viewpoint) => vp.people.some((p) => p.stances.some((s) => s.polarity === "yes")) && vp.people.some((p) => p.stances.some((s) => s.polarity === "no"));

/** One claim, who holds it and who rules it out, what really happened, and the verdict. */
function ClashCard({ vp, fresh }: { vp: Viewpoint; fresh?: boolean }) {
  const { mode } = useApp();
  const rows = vp.people.flatMap((p) => p.stances.map((s) => ({ key: `${p.id}-${s.verb}-${s.world}`, who: p.name, verb: VERB[s.verb].label, ok: s.polarity === "yes" })));
  const real = REALITY[vp.reality.value];
  const worlds = [...new Set(vp.diagnoses.flatMap((d: Diagnosis) => vp.people.find((p) => p.id === d.person)?.stances.map((s) => s.world) ?? []))].slice(0, 3);
  return (
    <div className="clash">
      {fresh && <p className="small red" style={{ margin: "0 0 4px", fontWeight: 700 }}>Detectable from this clue</p>}
      <p className="clash-claim">“{vp.text}”</p>
      <ul className="clash-rows">
        {rows.map((r) => <li key={r.key}><span>{r.who} <span className="muted">{r.verb}</span></span><span className={r.ok ? "yes" : "no"} aria-label={r.ok ? "holds it" : "rules it out"}>{r.ok ? "✓" : "✕"}</span></li>)}
        <li className="real"><span>What really happened</span><span className={vp.reality.value === "true" ? "yes" : vp.reality.value === "unknown" ? "" : "no"}>{vp.reality.value === "unknown" ? "?" : real.glyph}</span></li>
      </ul>
      {vp.diagnoses.map((d) => (
        <p key={d.kind + d.person} className="clash-verdict"><DiagIcon kind={d.kind} size={18} /> <strong>{DIAG[d.kind].label}</strong> · {d.personName}: {DIAG[d.kind].rule}</p>
      ))}
      {mode === "gold" && worlds.length > 0 && (
        <details className="more"><summary>Show the data</summary><div className="more-body">{worlds.map((w) => <TriplePair key={w} world={w} title="" note="" />)}</div></details>
      )}
    </div>
  );
}
