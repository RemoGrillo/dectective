// Narrative vs Reality: only what the people who tell the story say (their "says" worlds), set against what is true in it.
// Each claim is compared with Reality; the share that departs from it is the speaker's reliability profile.
import { Link } from "react-router";
import { useApi, type Viewpoint } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { DiagBadge, RealityDisc } from "../components/Glyphs";
import { Portrait } from "../components/Portrait";
import { useApp, withMode } from "../state";
import { REALITY } from "../vocab";

type Fit = "agrees" | "departs" | "open";
const FIT: Record<Fit, { label: string; color: string }> = {
  agrees: { label: "matches Reality", color: "var(--ink)" },
  departs: { label: "departs from Reality", color: "var(--red)" },
  open: { label: "Reality does not say", color: "var(--muted)" },
};

/** A claim ("yes") holds when Reality has it true; "says otherwise" ("no") holds when Reality has it false. */
const fitOf = (polarity: "yes" | "no", reality: Viewpoint["reality"]["value"]): Fit => {
  if (reality === "unknown") return "open";
  const real = reality === "true";
  return (polarity === "yes") === real ? "agrees" : "departs";
};

export default function Narrative() {
  const { q, mode } = useApp();
  const { data, error } = useApi<{ rows: Viewpoint[] }>(q("/api/knowledge"));
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <div className="page"><Loading what="Comparing telling and truth" /></div>;

  const bySpeaker = new Map<string, { name: string; claims: { row: Viewpoint; polarity: "yes" | "no"; fit: Fit }[] }>();
  for (const row of data.rows) for (const p of row.people) {
    const s = p.stances.find((x) => x.verb === "says");
    if (!s) continue;
    const e = bySpeaker.get(p.id) ?? { name: p.name, claims: [] };
    e.claims.push({ row, polarity: s.polarity, fit: fitOf(s.polarity, row.reality.value) });
    bySpeaker.set(p.id, e);
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Narrative vs Reality</h1>
        <p className="lede">The story is built from what its people say. Here is only that: each claim, set beside what is true in the story. The bar shows how much of a speaker's account departs from Reality.</p>
      </div>
      <p className="small muted" style={{ maxWidth: 720 }}>
        Narration itself (Watson as narrator) is not listed as a claim: the edition takes it as Reality. That is a modelling choice. Watson speaks in the first person, and for such a “personal” narrator Ryan notes that his declarations “stand in a variable relation to the facts” of the story, unlike an impersonal narrator's (<em>Possible Worlds, Artificial Intelligence, and Narrative Theory</em>, 1991, p. 68). Here we only compare what the characters tell inside the story with what is true in it.
      </p>
      <div className="row small" style={{ margin: "12px 0" }} aria-label="Legend">
        {(Object.keys(FIT) as Fit[]).map((f) => <span key={f} className="row" style={{ gap: 4 }}><svg width="14" height="14"><rect width="14" height="14" fill={FIT[f].color} /></svg>{FIT[f].label}</span>)}
      </div>
      <div className="stack">
        {[...bySpeaker.entries()].map(([id, { name, claims }]) => {
          const n = (f: Fit) => claims.filter((c) => c.fit === f).length;
          return (
            <section key={id} className="card pad" aria-label={name}>
              <div className="row"><Portrait id={id} size={40} name={name} /><h2 style={{ margin: 0 }}>{name}</h2><span className="small muted">{claims.length} claim{claims.length > 1 ? "s" : ""}</span></div>
              <div role="img" aria-label={`${n("agrees")} match, ${n("departs")} depart, ${n("open")} open`} style={{ display: "flex", height: 12, margin: "10px 0", border: "1px solid var(--ink)" }}>
                {(Object.keys(FIT) as Fit[]).map((f) => n(f) > 0 && <div key={f} style={{ flex: n(f), background: FIT[f].color }} title={`${n(f)} ${FIT[f].label}`} />)}
              </div>
              <ul className="plain">
                {[...claims].sort((a, b) => Number(b.fit === "departs") - Number(a.fit === "departs")).map(({ row, polarity, fit }) => {
                  const diag = row.diagnoses.filter((d) => d.person === id && (d.kind === "lie" || d.kind === "mistake"));
                  return (
                    <li key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: "8px 0 8px 10px", borderLeft: `4px solid ${FIT[fit].color}`, marginTop: 6 }}>
                      <div className="small">
                        <span className="muted">{polarity === "yes" ? "says" : "says it is not so"}:</span> “{row.text}”
                        {diag.map((d) => <span key={d.kind} style={{ marginLeft: 6 }}><DiagBadge kind={d.kind} outline /></span>)}
                        {row.sentences[0] && <> <Link to={withMode(`/read?s=${row.sentences[0]}`, mode)}>read it →</Link></>}
                      </div>
                      <div className="small row" style={{ gap: 6, flexWrap: "nowrap" }}><RealityDisc value={row.reality.value} size={16} />{REALITY[row.reality.value].short}</div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
