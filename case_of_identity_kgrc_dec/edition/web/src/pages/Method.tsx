// How it works: the edition's vocabulary next to DEC's terms, how verdicts are computed, DEC's known bugs,
// spoiler-free stages, provenance and numbers (folded), limits and credits.
import { Link } from "react-router";
import { useApi } from "../api";
import { Loading } from "../components/Bits";
import { DecBadge, DiagIcon, RealityDisc, VerbIcon, WorldIcon } from "../components/Glyphs";
import { stageOf, useApp, withMode } from "../state";
import { useTimeline } from "../components/DeductionBits";
import { DIAG, PAIR, STATUS, VERB, type DiagnosisKind, type Verb } from "../vocab";

function Row({ icon, term, children, dec }: { icon?: React.ReactNode; term: React.ReactNode; children: React.ReactNode; dec: React.ReactNode }) {
  return <div className="gloss-row"><div className="term">{icon}{term}</div><div>{children}</div><div className="dec">{dec}</div></div>;
}

export default function Method() {
  const { meta, mode } = useApp();
  const { data: runs } = useApi<any[]>("/api/runs");
  const { data: tl } = useTimeline();
  const fam = meta?.build?.families ?? {};
  const testRuns = (runs ?? []).filter((r) => r.kind === "test");
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <h1>How it works</h1>
        <p className="lede">The edition's words, what they mean, and the DEC term behind each.</p>
      </div>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>Points of view</h2>
        <p>The story is modelled as a set of <strong>points of view</strong> (DEC calls them <em>worlds</em>). The DEC reasoner fills each one with what follows from it, and lets facts pass from one to another only along fixed paths.</p>
        <div className="gloss">
          <Row icon={<RealityDisc size={20} />} term="Reality" dec="reality world">What is true in the story: narrated facts, plus Holmes's solution, which the story accepts.</Row>
          {(["says", "believes", "concludes", "supposes"] as Verb[]).map((v) => (
            <Row key={v} icon={<VerbIcon verb={v} size={20} />} term={<>{VERB[v].label} <span className="muted" style={{ fontWeight: 400 }}>({VERB[v].noun})</span></>} dec={VERB[v].dec}>{VERB[v].help}</Row>
          ))}
          <Row icon={<WorldIcon type="shared" size={20} />} term="Shared background" dec="shared world">Vocabulary and rules everyone takes for granted (e.g. a journey is not both actual and pretended).</Row>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>What passes where (DEC permeation): beliefs and conclusions take the shared background; guesses also take Reality; Reality takes the accepted conclusion; statements take nothing.</p>
      </section>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>How a point of view holds a fact</h2>
        <div className="gloss">
          {(["asserted", "received", "derived", "contradicted", "contradicted-assuming", "not-determined"] as const).map((s) => (
            <Row key={s} term={STATUS[s].label} dec={s}>{STATUS[s].help}{s === "derived" && <> <DecBadge /></>}</Row>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>A person's stance is what holds in the points of view they govern, including under another name once Reality knows who is who (Hosmer's words are Windibank's). What a guess merely inherits from Reality does not count as the person's own stance.</p>
      </section>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>Verdicts on people</h2>
        <div className="gloss">
          {(["lie", "delusion", "mistake"] as DiagnosisKind[]).map((k) => (
            <Row key={k} icon={<DiagIcon kind={k} size={20} />} term={DIAG[k].label} dec={DIAG[k].dec}>{DIAG[k].rule}</Row>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>“Rules out” means a declared rule makes the two incompatible (e.g. actual vs pretended journey). When the clash needs an assumption, such as one occupation at a time, the verdict says so (“if…”).</p>
      </section>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>DEC's conflict flags, and its bugs</h2>
        <p>DEC flags pairs of points of view that conflict (<span className="mono">dec:disagreesWith</span>) and beliefs that conflict with Reality (<span className="mono">dec:delusionalWorld</span>). The edition checks every flag:</p>
        <div className="gloss">
          {["conflict", "assumption", "artifact"].map((k) => <Row key={k} term={PAIR[k].label} dec={k}>{PAIR[k].help}</Row>)}
        </div>
        <p className="small" style={{ marginTop: 10 }}>The false alarms come from <span className="mono">DecStatementHandler.verifyClosedFor</span> in commit <span className="mono">{meta?.decCommit.slice(0, 8) ?? "…"}</span>: its test is always true, so identical values count as a conflict. A control run without the check removes them. Other limits of that version: untyped named graphs become statements; a second pass recomputes everything; after a restore, Reality is queryable only as the default graph.</p>
      </section>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>Reading without spoilers</h2>
        <p>The eye button in the header replays the story as a first-time reader meets it. Each stage has its own data (with neutral names, so nothing gives the solution away) and its own DEC results; the text after it is sealed.</p>
        <ul className="small">{(["C1", "C2", "C3", "C4"] as const).map((m) => <li key={m}><strong>Up to {stageOf(meta, m).label}</strong> (p. {stageOf(meta, m).page}): {stageOf(meta, m).desc}</li>)}</ul>
        <p className="small muted">Two helpers appear there: <strong>the reader</strong>, a simulated first-time reader with their guesses, and the <strong>editors' what-if</strong>, a test alternative not in the story (another clerk typed the letters).</p>
      </section>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>Deductions over time</h2>
        <p>The <Link to={withMode("/deductions", mode)}>Deductions</Link> page replays DEC on the story as it unfolds. A <strong>clue</strong> is a sentence that adds something to the model. For each clue DEC runs once on everything read so far, without the conflict check, so each run takes seconds.</p>
        <ul className="small">
          <li>A fact enters at the first sentence that supports it. A point of view (with whoever holds it) enters when its passage and its first content have been read.</li>
          <li>DEC's conclusions only grow from one clue to the next (checked at every run). So whatever holds at a clue still holds afterwards, and a clash appears as soon as both sides are in.</li>
          <li>Lies, delusions and honest mistakes are computed clue by clue from these views, with the same rules as everywhere else. The identity Hosmer = Windibank only counts once Reality has it.</li>
          <li>Each conclusion shows its <em>because</em>: the rule and the premises that make it possible, each with the page where it was read.</li>
        </ul>
        {tl && <p className="small muted" style={{ margin: 0 }}>{tl.steps.length} clues · {tl.totals.conclusions} story-level conclusions (+{tl.totals.minor} minor) · {tl.totals.verdicts} verdicts · DEC runs: average {Math.round(tl.metrics.averages.ms / 100) / 10} s, total {Math.round(tl.metrics.total_ms / 1000)} s · monotonic: {tl.metrics.monotonic ? "yes" : "NO"}.</p>}
      </section>

      <details className="more card pad" style={{ marginBottom: 18 }}>
        <summary>Provenance and numbers</summary>
        <div className="more-body">
          {!meta ? <Loading /> : (
            <ul className="small">
              <li>{meta.build.quads.toLocaleString("en")} quads in the store: {(fam.world ?? 0).toLocaleString("en")} in DEC's views of the whole story, {(fam.snapshot ?? 0).toLocaleString("en")} in the spoiler-free stages, {(fam.asserted ?? 0) + (fam["snapshot-asserted"] ?? 0)} of stated content, {fam.text} + {fam.annotation} of text and annotation, {fam.ACaseOfIdentity} of the original KGRC graph.</li>
              <li>{meta.build.propositions} propositions; {meta.build.runs} DEC runs ({testRuns.length} test slices{runs ? `; median ${Math.round(med(testRuns.map((r) => r.materialise_ms_median ?? 0)))} ms and ${med(testRuns.map((r) => r.materialised))} inferred triples per slice` : ""}).</li>
              <li>Six points of view no test needed were filled by one extra DEC run (no conflict check), and each stage likewise by one run: labelled “complement”.</li>
              <li>The data build is deterministic (SHA-256 of <span className="mono">edition.nq</span>: <span className="mono">{meta.build.sha256?.["edition.nq"]?.slice(0, 16)}…</span>).</li>
            </ul>
          )}
          {runs && (
            <div className="table-wrap" style={{ maxHeight: 380 }}>
              <table className="data">
                <thead><tr><th>Run</th><th>Kind</th><th>Data</th><th>Worlds</th><th>Stated</th><th>Inferred</th><th>ms</th><th>Question</th></tr></thead>
                <tbody>{runs.map((r) => (
                  <tr key={r.id}><td className="mono small">{r.id}</td><td className="small">{r.kind}</td><td>{r.dataset}</td><td>{r.n_worlds}</td><td>{r.asserted}</td><td>{r.materialised}</td><td>{r.materialise_ms_median ? Math.round(r.materialise_ms_median) : "—"}</td><td className="small">{r.question}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>Limits</h2>
        <ul className="small">
          <li>Speakers, anchors and propositions were annotated by one annotator. Windibank's beliefs rest on Holmes's solution and are marked as the editors' attribution.</li>
          <li>Two points of view that DEC never checked together have no DEC verdict between them.</li>
          <li>The explanations of DEC's inferences recognise patterns; they are not a second run of the reasoner.</li>
        </ul>
      </section>

      <section className="card pad">
        <h2>Licences and credits</h2>
        <ul className="small">
          <li>Text: Arthur Conan Doyle, <em>A Case of Identity</em> (The Strand Magazine, 1891), public domain.</li>
          <li>Reasoner: fvitali/dec-reasoner, MIT licence. Comparison graph: KGRC (SIG-SWO, JSAI), CC BY 4.0, kept unchanged in its own named graph.</li>
          <li>Fonts: Barlow, Barlow Condensed, Literata, Courier Prime, IBM Plex Mono (SIL Open Font License), self-hosted.</li>
          <li>Design: an original treatment inspired by 1930s Italian crime-paperback covers; no publisher's marks.</li>
        </ul>
        <p className="small" style={{ margin: 0 }}><Link to={withMode("/lab", mode)}>Query everything yourself in the SPARQL Lab →</Link></p>
      </section>
    </div>
  );
}
