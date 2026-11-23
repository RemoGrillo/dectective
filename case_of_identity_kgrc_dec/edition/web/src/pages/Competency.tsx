// Competency questions: every question the edition's SPARQL endpoint answers (annotations/examples.yaml),
// grouped by the kind of gap between worlds it asks about, after M.-L. Ryan, Possible Worlds, Artificial Intelligence
// and Narrative Theory (Indiana UP, 1991), ch. 6 (pp. 118-122). Page numbers are the book's own.
import { Link } from "react-router";
import { useApi, type Example } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { useApp, withMode } from "../state";

type Section = { title: string; ryan: string; dec: string; ids: string[] };

const SECTIONS: Section[] = [
  { title: "Who pretends?", ryan: "Pretended worlds (p. 118): a character “may forge a private world in order to deceive another”.",
    dec: "A statement (verbatim world) that contradicts the speaker's own beliefs.", ids: ["dec-insincere", "said-false", "said-who-whom"] },
  { title: "Who is wrong about the facts?", ryan: "Error (p. 121): a contradiction between a K-world and its reference world.",
    dec: "A belief (doxastic world) that Reality rules out.", ids: ["dec-delusional", "dec-why-mary", "beliefs-mary", "beliefs-journey", "identity-hosmer", "identity-mary", "identity-name", "identity-dere"] },
  { title: "Who disagrees with whom?", ryan: "Conflict between the private worlds of different characters (p. 122): the most productive situation for plot.",
    dec: "Two points of view, each held by a different character, that DEC flags as conflicting.", ids: ["conflict-characters", "dec-disagreements", "worlds-governed"] },
  { title: "What is still unknown, and when is it settled?", ryan: "Enigma (p. 121): a K-world with “well-defined areas of indeterminacy”, the theme of investigation.",
    dec: "Facts that Reality only gets late, and what the reader can conclude at each stage.", ids: ["enigma-closed", "snap-identity-c3", "snap-machine-c3", "snap-hypotheses"] },
  { title: "How do the worlds move over the story?", ryan: "“The plot is the trace left by the movement of these worlds” (p. 119).",
    dec: "One DEC run per clue on the story read so far.", ids: ["deductions-per-clue", "deductions-unmasking", "derived-windibank"] },
  { title: "Questions about the edition, not the story", ryan: "No counterpart in Ryan: these ask about the text, the KGRC graph and DEC itself, not about the characters' worlds.",
    dec: "Annotation, alignment with KGRC, and DEC's own runs.", ids: ["text-mary-speaks", "text-support-reconstruction", "text-kgrc-distortions", "kgrc-solution", "kgrc-aligned", "kgrc-ending", "runs-sizes", "runs-amplification"] },
];

export default function Competency() {
  const { mode } = useApp();
  const { data, error } = useApi<Example[]>("/api/examples");
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <div className="page"><Loading what="Listing the questions" /></div>;
  const byId = new Map(data.map((e) => [e.id, e]));
  const placed = new Set(SECTIONS.flatMap((s) => s.ids));
  const stray = data.filter((e) => !placed.has(e.id));

  return (
    <div className="page">
      <div className="page-head">
        <h1>Competency questions</h1>
        <p className="lede">What can this edition be asked? Every question below has a SPARQL query behind it, and can be run on the endpoint. They are grouped by the gap between worlds each one asks about.</p>
      </div>
      <p className="small muted" style={{ maxWidth: 720 }}>
        The grouping follows the typology of narrative conflicts in M.-L. Ryan, <em>Possible Worlds, Artificial Intelligence, and Narrative Theory</em> (Indiana University Press, 1991), ch. 6. Ryan defines conflicts against the textual actual world (here, Reality) and between characters' private worlds. DEC's “permeation” is a different thing from her accessibility relations (ch. 2), which classify how a whole fictional world relates to our own; do not read one as the other. Ryan does not tell a lie from an illusion, and does not separate a sincere error: that finer split is this edition's.
      </p>
      <div className="stack" style={{ marginTop: 16 }}>
        {SECTIONS.map((s) => {
          const qs = s.ids.map((id) => byId.get(id)).filter((e): e is Example => !!e);
          return (
            <section key={s.title} className="card pad" aria-label={s.title}>
              <h2>{s.title}</h2>
              <p className="small" style={{ margin: "0 0 4px" }}><strong>Ryan.</strong> {s.ryan}</p>
              <p className="small muted" style={{ margin: "0 0 8px" }}><strong>Here.</strong> {s.dec}</p>
              <ol className="plain">
                {qs.map((e) => (
                  <li key={e.id} className="row spread" style={{ gap: 12, marginTop: 8 }}>
                    <span>{e.question}{e.note && <span className="small muted"> — {e.note}</span>}</span>
                    <Link className="btn small" to={withMode(`/lab?example=${e.id}`, mode)}>Run it →</Link>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
        {stray.length > 0 && (
          <section className="card pad" aria-label="Other">
            <h2>Other</h2>
            <ol className="plain">{stray.map((e) => <li key={e.id} className="row spread" style={{ marginTop: 8 }}><span>{e.question}</span><Link className="btn small" to={withMode(`/lab?example=${e.id}`, mode)}>Run it →</Link></li>)}</ol>
          </section>
        )}
        <p className="small">The answers to the first three groups, read as plain text: <Link to={withMode("/questions", mode)}>Who lies?</Link> · <Link to={withMode("/narrative", mode)}>Telling vs truth</Link>.</p>
      </div>
    </div>
  );
}
