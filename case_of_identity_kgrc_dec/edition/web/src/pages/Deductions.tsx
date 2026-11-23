// Deductions: what DEC can conclude at each clue of the story, and how far that is from its final conclusions.
// One DEC run per clue on the growing prefix of the story (data/timeline.json). Clue = a sentence that adds something.
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useApi, type TConclusion, type TEvent, type TextPayload, type Timeline, type TStep } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { ConclusionCard, Meter, stepOf, useTimeline } from "../components/DeductionBits";
import { DiagBadge, RealityDisc } from "../components/Glyphs";
import { stageOf, useApp, withMode } from "../state";
import { DIAG, REALITY, VERB, type RealityValue } from "../vocab";

export default function Deductions() {
  const { mode, meta, q } = useApp();
  const { data: tl, error } = useTimeline();
  const { data: text } = useApi<TextPayload>(q("/api/text"));
  const [params, setParams] = useSearchParams();
  const order = useMemo(() => new Map((text?.paragraphs ?? []).flatMap((p) => p.sentences.map((s) => s.id)).map((id, i) => [id, i])), [text]);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!tl || !text) return <div className="page"><Loading what="Replaying the investigation" /></div>;

  const last = tl.cap ?? tl.final;
  const at = params.get("at");
  const byAt = at ? [...tl.steps].reverse().find((s) => (order.get(s.sid) ?? -1) <= (order.get(at) ?? -1)) : null;
  const current = Math.min(byAt?.n ?? 1, last);
  const go = (n: number) => setParams((p) => { const x = new URLSearchParams(p); const s = tl.steps.find((y) => y.n === n); if (s) x.set("at", s.sid); return x; }, { replace: true });
  const step = tl.steps.find((s) => s.n === current)!;
  const firstDeduction = tl.conclusions.find((c) => c.cls === "story")?.step;
  const verdictSteps = [...new Set(tl.events.filter((e) => e.kind === "verdict").map((e) => e.step))];
  const jumps: [string, number | undefined][] = [
    ["The beginning", 1], ["First deduction", firstDeduction], ["The typewriter", tl.conclusions.find((c) => c.world === "holmes_same_machine" && c.cls === "story")?.step],
    ["The unmasking", tl.identityStep], ["First deception detected", verdictSteps[0]], ["The end", tl.final],
  ];

  return (
    <div className="page wide" style={{ maxWidth: 1400 }}>
      <div className="page-head">
        <h1>Solve the case</h1>
        <p className="lede">Follow the investigation clue by clue: what can be worked out at each point, and when a deception, an illusion or a sincere error becomes visible.</p>
      </div>

      <section className="card pad" aria-label="The story, clue by clue">
        <div className="row" role="group" aria-label="Jump to">
          <span className="label">Jump to</span>
          {jumps.filter(([, n]) => n && n <= last).map(([l, n]) => <button key={l} className="chip" aria-pressed={current === n} onClick={() => go(n!)}>{l}</button>)}
        </div>
        {tl.cap && <p className="small muted" style={{ margin: "8px 0 0" }}>Reading without spoilers: the bar stops at “{stageOf(meta, mode).label}”.</p>}
      </section>

      <ClueHeader tl={tl} step={step} last={last} go={go} />

      <NewHere tl={tl} step={step} />
      <details className="more" style={{ marginTop: 16 }}>
        <summary>Show the full picture <span className="muted">(everything so far, and what is still to come)</span></summary>
        <div className="dd-grid more-body">
          <SoFar tl={tl} n={current} />
          <VersusEnd tl={tl} n={current} />
        </div>
      </details>
    </div>
  );
}

function ClueHeader({ tl, step, last, go }: { tl: Timeline; step: TStep; last: number; go: (n: number) => void }) {
  const { mode, q } = useApp();
  const { data: text } = useApi<TextPayload>(q("/api/text"));
  return (
    <section className="clue-head card pad" aria-live="polite">
      <div className="spread">
        <span className="kicker" style={{ margin: 0 }}>Clue {step.n} of {tl.steps.length} · p. {step.page} · {text?.speakerNames[step.speaker] ?? step.speaker}</span>
        <span className="row">
          <button className="btn small" disabled={step.n <= 1} onClick={() => go(step.n - 1)}>← Previous clue</button>
          <button className="btn small" disabled={step.n >= last} onClick={() => go(step.n + 1)}>Next clue →</button>
          <Link className="btn small ghost" to={withMode(`/read?s=${step.sid}`, mode)}>Read in context</Link>
        </span>
      </div>
      <blockquote className="quote" style={{ fontSize: "1.15rem", margin: "10px 0 0" }}>{step.text}</blockquote>
    </section>
  );
}

function verdictLine(e: TEvent) {
  return <li key={e.pid + e.diagnosis!.kind + e.diagnosis!.person} className="row" style={{ gap: 6, alignItems: "flex-start", flexWrap: "nowrap" }}><DiagBadge kind={e.diagnosis!.kind} /><span className="small">{e.diagnosis!.text}{e.diagnosis!.assumption ? `, ${e.diagnosis!.assumption}` : ""}: “{e.text}”</span></li>;
}
function realityLine(e: TEvent) {
  return <li key={e.pid + e.step} className="row small" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }}><RealityDisc value={e.to as RealityValue} size={16} /><span><strong>{REALITY[e.to as RealityValue].short}</strong> in Reality: {e.text}</span></li>;
}

function NewHere({ tl, step }: { tl: Timeline; step: TStep }) {
  const [more, setMore] = useState(false);
  const claims = tl.claims.filter((c) => c.step === step.n);
  const cons = tl.conclusions.filter((c) => c.step === step.n && c.cls === "story");
  const minor = tl.conclusions.filter((c) => c.step === step.n && c.cls === "minor").length;
  const ev = tl.events.filter((e) => e.step === step.n);
  const verdicts = ev.filter((e) => e.kind === "verdict"), settled = ev.filter((e) => e.kind === "reality");
  return (
    <section className="card pad" aria-labelledby="new-h">
      <h2 id="new-h">What this clue tells us</h2>
      {verdicts.length > 0 && <><h4>Now we can tell</h4><ul className="plain">{verdicts.map(verdictLine)}</ul></>}
      <h4>We can conclude{cons.length > 0 && <span className="muted" style={{ fontWeight: 400 }}>({cons.length})</span>}</h4>
      {cons.length === 0 ? <p className="small muted">No new conclusion at this clue{minor ? ` (only ${minor} minor class inferences)` : ""}.</p> : (
        <div className="stack">{(more ? cons : cons.slice(0, 6)).map((c) => <ConclusionCard key={c.id} c={c} tl={tl} />)}</div>
      )}
      {cons.length > 6 && <button className="btn small" style={{ marginTop: 8 }} onClick={() => setMore(!more)}>{more ? "Show fewer" : `Show all ${cons.length}`}</button>}
      {cons.length > 0 && minor > 0 && <p className="small muted">+ {minor} minor inferences (class hierarchy, CIDOC CRM bookkeeping).</p>}
      {claims.length > 0 && (
        <details className="more" open={cons.length === 0}>
          <summary>The text adds <span className="muted">({claims.length})</span></summary>
          <ul className="plain more-body">
            {claims.map((c, i) => <li key={i} className="small">{c.world === "reality" ? "Reality: " : `${c.personName ?? ""} ${c.verb ? VERB[c.verb].label : ""}: `}{c.text}</li>)}
          </ul>
        </details>
      )}
      {settled.length > 0 && (
        <details className="more">
          <summary>Reality settles <span className="muted">({settled.length})</span></summary>
          <ul className="plain more-body">{settled.map(realityLine)}</ul>
        </details>
      )}
    </section>
  );
}

function SoFar({ tl, n }: { tl: Timeline; n: number }) {
  const cons = tl.conclusions.filter((c) => c.step <= n && c.cls === "story");
  const verdicts = tl.events.filter((e) => e.kind === "verdict" && e.step <= n);
  const groups = useMemo(() => {
    const m = new Map<string, TConclusion[]>();
    for (const c of cons) m.set(c.world, [...(m.get(c.world) ?? []), c]);
    return [...m.entries()].sort((a, b) => (a[0] === "reality" ? -1 : b[0] === "reality" ? 1 : 0));
  }, [cons]);
  return (
    <section className="card pad" aria-labelledby="sofar-h">
      <h2 id="sofar-h">So far</h2>
      <div className="stat-tiles">
        <div><strong>{cons.length}</strong><span>conclusions</span></div>
        <div className={verdicts.length ? "red" : ""}><strong>{verdicts.length}</strong><span>verdicts</span></div>
      </div>
      {verdicts.length > 0 && <><h4>Detectable</h4><ul className="plain">{verdicts.map(verdictLine)}</ul></>}
      {groups.length === 0 && <p className="small muted">DEC has not concluded anything beyond what the text says yet.</p>}
      {groups.map(([w, list]) => (
        <details key={w} className="more" open={w === "reality" && list.length <= 12}>
          <summary>{w === "reality" ? "In Reality" : list[0].worldTitle} <span className="muted">({list.length})</span></summary>
          <ul className="plain more-body">
            {list.map((c) => <li key={c.id} className="small">{c.text} <span className="muted">· clue {c.step}</span></li>)}
          </ul>
        </details>
      ))}
    </section>
  );
}

function VersusEnd({ tl, n }: { tl: Timeline; n: number }) {
  const { setMode } = useApp();
  const now = tl.conclusions.filter((c) => c.step <= n && c.cls === "story").length;
  const vNow = tl.events.filter((e) => e.kind === "verdict" && e.step <= n).length;
  const later = tl.conclusions.filter((c) => c.step > n && c.cls === "story");
  const byClue = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of later) m.set(c.step, (m.get(c.step) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [later]);
  // facts whose standing in Reality, or whose verdicts, will change after this clue
  const changes = useMemo(() => {
    const m = new Map<string, { text: string; now: string; end: string; verdicts: TEvent[] }>();
    for (const e of tl.events) {
      if (!m.has(e.pid)) m.set(e.pid, { text: e.text, now: "unknown", end: "unknown", verdicts: [] });
      const x = m.get(e.pid)!;
      if (e.kind === "reality") { if (e.step <= n) x.now = e.to!; x.end = e.to!; }
      if (e.kind === "verdict" && e.step > n) x.verdicts.push(e);
    }
    return [...m.values()].filter((x) => x.now !== x.end || x.verdicts.length);
  }, [tl, n]);
  const hiddenC = tl.hidden.conclusions + later.length, hiddenV = tl.hidden.verdicts + tl.events.filter((e) => e.kind === "verdict" && e.step > n).length;
  return (
    <section className="card pad" aria-labelledby="end-h">
      <h2 id="end-h">Compared with the end</h2>
      <Meter label="conclusions" now={now} total={tl.totals.conclusions} />
      <Meter label="verdicts" now={vNow} total={tl.totals.verdicts} red />
      {tl.cap ? (
        <div className="sealed" style={{ marginTop: 12 }}>
          <p className="small" style={{ margin: "0 0 8px" }}>Still to come: {hiddenC} conclusions and {hiddenV} verdicts. You are reading without spoilers, so what they are stays sealed.</p>
          <button className="btn small" onClick={() => setMode("gold")}>Show the whole story</button>
        </div>
      ) : (
        <>
          <h4>Still to come</h4>
          {later.length === 0 ? <p className="small muted">Nothing: DEC has drawn all its conclusions.</p> : (
            <ul className="plain">
              {byClue.map(([k, cnt]) => { const s = stepOf(tl, k)!; return <li key={k} className="small"><strong>+{cnt}</strong> at clue {k} (p. {s.page}){k === tl.identityStep ? " — the unmasking" : ""}</li>; })}
            </ul>
          )}
          <h4>Will change</h4>
          {changes.length === 0 ? <p className="small muted">Nothing: every fact already has its final standing.</p> : (
            <ul className="plain">
              {changes.map((x, i) => (
                <li key={i} className="small" style={{ marginBottom: 6 }}>
                  “{x.text}”<br />
                  <span className="muted">now:</span> <RealityDisc value={x.now as RealityValue} size={14} /> {REALITY[x.now as RealityValue].short}
                  {" → "}<span className="muted">in the end:</span> <RealityDisc value={x.end as RealityValue} size={14} /> {REALITY[x.end as RealityValue].short}
                  {x.verdicts.length > 0 && <> · {x.verdicts.map((v) => `${DIAG[v.diagnosis!.kind].label} (${v.diagnosis!.personName})`).join(", ")}</>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

