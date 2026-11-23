// Questions: competency questions about the story's narrative, answered from DEC's points of view.
// Each answer is a comparison of what people say / believe against Reality (data: /api/knowledge, spoiler-aware).
import { Link } from "react-router";
import { useApi, type Diagnosis, type Viewpoint } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { DiagBadge, RealityDisc } from "../components/Glyphs";
import { Portrait } from "../components/Portrait";
import { useApp, withMode } from "../state";
import { DIAG } from "../vocab";

type Km = { rows: Viewpoint[] };
type Hit = { row: Viewpoint; d: Diagnosis };

const group = (hits: Hit[]) => {
  const m = new Map<string, { name: string; hits: Hit[] }>();
  for (const h of hits) m.set(h.d.person, { name: h.d.personName, hits: [...(m.get(h.d.person)?.hits ?? []), h] });
  return [...m.entries()].map(([id, v]) => ({ id, ...v }));
};

export default function Questions() {
  const { q, mode } = useApp();
  const { data, error } = useApi<Km>(q("/api/knowledge"));
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <div className="page"><Loading what="Asking DEC" /></div>;

  const hitsOf = (kind: Diagnosis["kind"]): Hit[] => data.rows.flatMap((row) => row.diagnoses.filter((d) => d.kind === kind).map((d) => ({ row, d })));
  const link = (r: Viewpoint) => r.sentences[0] && <Link className="small" to={withMode(`/read?s=${r.sentences[0]}`, mode)}>read it →</Link>;

  const ask = (kind: Diagnosis["kind"], title: string, because: string) => {
    const groups = group(hitsOf(kind));
    return (
      <section className="card pad" aria-labelledby={`q-${kind}`}>
        <h2 id={`q-${kind}`}>{title}</h2>
        <p className="small muted"><DiagBadge kind={kind} /> {because}</p>
        {groups.length === 0 && <p className="empty">No one, as far as the story has told us so far.</p>}
        {groups.map((g) => (
          <div key={g.id} style={{ marginTop: 14 }}>
            <div className="row"><Portrait id={g.id} size={34} name={g.name} /><strong>{g.name}</strong></div>
            <ul className="plain">
              {g.hits.map(({ row, d }) => (
                <li key={row.id + d.world} className="small" style={{ marginTop: 8 }}>
                  <span className="row" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }}>
                    <RealityDisc value={row.reality.value} size={16} />
                    <span>“{row.text}” <span className="muted">— {d.text}{d.assumption ? `, ${d.assumption}` : ""}.</span> {link(row)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    );
  };

  // who is deceived: someone who believes what a liar said, so it is not the liar who is fooled
  const lies = hitsOf("lie");
  const fooled = lies.flatMap(({ row, d }) => row.people.filter((p) => p.id !== d.person && p.stances.some((s) => s.verb === "believes" && s.polarity === "yes")).map((p) => ({ liar: d.personName, victim: p.name, text: row.text, row })));

  return (
    <div className="page">
      <div className="page-head">
        <h1>Questions about the story</h1>
        <p className="lede">The story tells us what people say and what they believe, while Reality holds what is true in it. DEC keeps these apart as points of view, so the gaps between them can be asked about. Each answer below is a gap.</p>
      </div>
      <p className="small muted" style={{ maxWidth: 720 }}>
        This is the idea of a <em>textual actual world</em> surrounded by the <em>private worlds</em> of its characters (their knowledge and beliefs), from possible-worlds narratology (M.-L. Ryan, <em>Possible Worlds, Artificial Intelligence and Narrative Theory</em>, 1991). A lie, an illusion and a sincere error are the three ways a character's private world can part from what they say or from what is true.
      </p>
      <div className="stack" style={{ marginTop: 16 }}>
        {ask("lie", "Who lies, and why?", `${DIAG.lie.rule} (${DIAG.lie.short})`)}
        {ask("delusion", "Who is under an illusion, and why?", `${DIAG.delusion.rule} (${DIAG.delusion.short})`)}
        {ask("mistake", "Who is sincerely mistaken, and why?", `${DIAG.mistake.rule} (${DIAG.mistake.short})`)}
        <section className="card pad" aria-labelledby="q-fooled">
          <h2 id="q-fooled">Who is deceived, and by whom?</h2>
          <p className="small muted">Someone who believes what a liar said.</p>
          {fooled.length === 0 && <p className="empty">No one, as far as the story has told us so far.</p>}
          <ul className="plain">
            {fooled.map((f, i) => <li key={i} className="small" style={{ marginTop: 8 }}><strong>{f.liar}</strong> deceives <strong>{f.victim}</strong>: “{f.text}” {link(f.row)}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
