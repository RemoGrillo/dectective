// Guide: what the knowledge graph records, what DEC infers from it, and the verdict layers the edition adds on top.
import { Link } from "react-router";
import { DiagIcon } from "../components/Glyphs";
import { DisjointRules, TriplePair } from "../components/TripleSnippets";
import { useTimeline } from "../components/DeductionBits";
import { useApp, withMode } from "../state";
import { DIAG, VERB, type DiagnosisKind, type Verb } from "../vocab";

const STEPS = [
  { n: "1", title: "The graph records", who: "Knowledge graph", body: "The text, cut into sentences, and for each sentence the claims it makes: who says, believes, concludes or supposes what, and the plain facts of the story. Nothing is worked out here." },
  { n: "2", title: "DEC infers", who: "Reasoner", body: "DEC keeps each point of view apart and fills it with what follows: same person under two names, symmetric and inverse relations, class hierarchies. It lets facts pass between points of view only along fixed paths, and flags what cannot hold together." },
  { n: "3", title: "The edition reads the result", who: "Verdict layer", body: "Compare what a person says, what they believe and what is true in the story. The gaps get a name: a deception, an illusion, a sincere error. This layer is the edition's own rule, applied to DEC's output." },
];

const GAPS: { kind: DiagnosisKind; says: string; believes: string; story: string; example: string }[] = [
  { kind: "lie", says: "p", believes: "not p", story: "—", example: "Windibank says the disappearance was involuntary, but believes it was planned." },
  { kind: "delusion", says: "—", believes: "p", story: "not p", example: "Mary believes Hosmer Angel will come back, but the story says he never will." },
  { kind: "mistake", says: "p", believes: "p", story: "not p", example: "Mary says her father went to France, and believes it; the story says he did not." },
];

export default function Guide() {
  const { meta, mode } = useApp();
  const { data: tl } = useTimeline();
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <h1>What the graph holds, what DEC infers</h1>
        <p className="lede">Three layers, from the record of the story to the verdict on a person.</p>
      </div>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>A proof of concept</h2>
        <p className="small">This edition is a proof of concept, not a finished tool. It asks whether a machine can <em>reconstruct and explain</em> a mystery: not feel it, but follow who knows, says and believes what at each point, and show why. It tests this on one story, with one annotator.</p>
        <h3>Research questions</h3>
        <ol className="small">
          <li><strong>Detection and explanation.</strong> Can a modal-world representation (says, believes, concludes, supposes, plus what really happened) recognise at the right clue that a character's words, beliefs and the facts of the story have become incompatible, and explain why?</li>
          <li><strong>Evolving, contradicting theories.</strong> How can rival hypotheses (Watson's, Holmes's, the reader's) grow clue by clue and contradict each other without breaking the knowledge base, while each clue says which theory it supports or refutes?</li>
        </ol>
        {tl && (() => {
          const vs = tl.events.filter((e) => e.kind === "verdict");
          const first = vs.length ? Math.min(...vs.map((e) => e.step)) : null, last = vs.length ? Math.max(...vs.map((e) => e.step)) : null;
          const pg = (n: number | null) => tl.steps.find((s) => s.n === n)?.page;
          return (
            <>
              <h3>What it shows so far</h3>
              <ul className="small">
                <li>Over {tl.steps.length} clues, DEC's conclusions only grow ({tl.metrics.monotonic ? "checked at every run" : "not confirmed"}): rival theories live in separate points of view, so a new clue never erases an old one.</li>
                {first != null && last != null && <li>{tl.totals.verdicts} verdicts (deceptions, illusions, sincere errors) become detectable between clue {first} (p. {pg(first)}) and clue {last} (p. {pg(last)}), mostly after the unmasking. Each comes with its reasons.</li>}
              </ul>
              <h3>What it does not show</h3>
              <ul className="small">
                <li>Generality: one story, annotated by one person.</li>
                <li>That a machine “understands” more than the model it is given: the claims were curated by hand.</li>
                <li>Theory change as revision: here theories are kept apart, not revised.</li>
              </ul>
            </>
          );
        })()}
      </section>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>Literary frame</h2>
        <p className="small">The edition borrows three ideas from narrative theory. Each one has a counterpart in the model.</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Theory</th><th>Idea</th><th>In the edition</th></tr></thead>
            <tbody>
              <tr><td><strong>Possible worlds</strong><br /><span className="small muted">M.-L. Ryan</span></td><td className="small">A story is an actual world surrounded by worlds of what each character knows, believes, wishes and plans.</td><td className="small">Reality at the centre; one point of view per person and kind (says, believes, concludes, supposes). The kaleidoscope draws exactly this.</td></tr>
              <tr><td><strong>Two stories</strong><br /><span className="small muted">T. Todorov</span></td><td className="small">A detective story tells the crime and the investigation, and the second uncovers the first.</td><td className="small">“Recorded in the story” against “DEC infers”: what happened, and what the investigation lets us conclude.</td></tr>
              <tr><td><strong>Curiosity, suspense, surprise</strong><br /><span className="small muted">M. Sternberg</span></td><td className="small">Effects depend on what the reader knows against what the characters know, and on information that is withheld.</td><td className="small">Reading without spoilers, and the clue where a lie becomes detectable.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Sources: <a href="https://www-archiv.fdm.uni-hamburg.de/lhn/node/54.html">Possible worlds (Living Handbook of Narratology)</a> · <a href="https://genreacrossborders.uwaterloo.ca/biblio/typology-detective-fiction">Todorov, The Typology of Detective Fiction</a> · <a href="https://muse.jhu.edu/article/51535/pdf">Sternberg, Poetics Today</a>. Summaries from secondary sources; check the originals before citing.
        </p>
      </section>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>From record to verdict</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {STEPS.map((s) => (
            <div key={s.n} className="card flat pad">
              <p className="kicker" style={{ margin: 0 }}>{s.n} · {s.who}</p>
              <h3 style={{ margin: "2px 0 6px" }}>{s.title}</h3>
              <p className="small" style={{ margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
        {meta && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            In numbers: {meta.build.propositions} recorded claims, {meta.build.quads.toLocaleString("en")} quads in the store{tl ? `, ${tl.totals.conclusions} story-level conclusions inferred by DEC (+${tl.totals.minor} minor), ${tl.totals.verdicts} verdicts` : ""}.
          </p>
        )}
      </section>

      <section className="card pad" style={{ marginBottom: 18 }}>
        <h2>The data, as modelled</h2>
        <p className="small">Each point of view is a named graph. What is <strong>declared</strong> there is written by hand; what DEC <strong>adds</strong> is computed. These are the real triples, read live from the endpoint.</p>
        {mode !== "gold" ? (
          <p className="small muted">These examples use the whole story. Choose “The whole story” in the eye menu to see them.</p>
        ) : (
          <>
            <TriplePair world="v_windibank_reassure" title="What Windibank says" note="A statement: two triples. DEC adds nothing, because statements take nothing from other points of view." />
            <TriplePair world="windibank_beliefs" title="What Windibank believes" note="Four declared triples. DEC adds the symmetric identity, what Hosmer inherits from Windibank, and the broader classes." />
            <DisjointRules title="Rules everyone shares" note="Declared once (the graph also holds the CIDOC CRM schema, not shown). These disjointness rules are what makes “voluntary” and “involuntary” collide." />
            <p className="small" style={{ marginBottom: 0 }}>The deception follows: the statement says <span className="mono">InvoluntaryDisappearance</span>, the beliefs say <span className="mono">VoluntaryDisappearance</span>, and the shared rules declare the two disjoint. Query any graph yourself in the <Link to={withMode("/lab", mode)}>SPARQL Lab</Link>.</p>
          </>
        )}
      </section>

      <section className="card pad">
        <h2>The verdict layer: three kinds of gap</h2>
        <p className="small">A verdict compares three things for the same claim <em>p</em>: what a person says, what they believe, and what is true in the story.</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Verdict</th><th>Says</th><th>Believes</th><th>In the story</th><th>Example</th></tr></thead>
            <tbody>
              {GAPS.map((g) => (
                <tr key={g.kind}>
                  <td><span className="row" style={{ gap: 6, flexWrap: "nowrap" }}><DiagIcon kind={g.kind} size={18} /><strong>{DIAG[g.kind].label}</strong></span></td>
                  <td className="mono">{g.says}</td><td className="mono">{g.believes}</td><td className="mono">{g.story}</td>
                  <td className="small">{g.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>A verdict appears only where a declared rule makes the two sides incompatible. If it needs an extra assumption (such as one occupation at a time), it says so.</p>
      </section>

    </div>
  );
}
