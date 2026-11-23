// One person's view of the case: their points of view, their lies and delusions, what they say / believe /
// conclude / suppose (each checked against Reality), the names that pick them out, and (folded) what they are silent on.
import { Link, useParams } from "react-router";
import { useApi, type Agent, type Diagnosis, type DecType, type Part, type VStance } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { DiagBadge, DiagIcon, RealityDisc, VerbIcon, WorldIcon } from "../components/Glyphs";
import { Portrait } from "../components/Portrait";
import { useApp, withMode } from "../state";
import { DIAG, KIND, PEOPLE_HELP, REALITY, VERB, type Verb } from "../vocab";
import { NamesLine } from "./Cast";

type Row = { id: string; text: string; parts: Part[]; sentences: string[]; reality: keyof typeof REALITY; stances: VStance[]; diagnoses: Diagnosis[] };
type Payload = {
  agent: Agent; mode: string; mergedInto: string | null; alias: string[];
  worlds: { local: string; title: string; desc: string; decType: DecType; governedBy: { agent: string; predicate: string; viaIdentity: boolean }[] }[];
  stances: Row[]; names: any[];
};

export default function AgentPage() {
  const { id } = useParams();
  const { q, mode, meta } = useApp();
  const { data, error } = useApi<Payload>(id ? q(`/api/agents/${id}`) : null);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <div className="page"><Loading what="Taking a statement" /></div>;
  const a = data.agent;
  const held = data.stances.filter((r) => r.stances.length);
  const silent = data.stances.filter((r) => !r.stances.length);
  const diags = data.stances.flatMap((r) => r.diagnoses.map((d) => ({ ...d, fact: r.text, sid: r.sentences[0] })));
  const owner = data.mergedInto ? meta?.agents.find((x) => x.id === data.mergedInto) : null;
  const byVerb = (v: Verb) => held.flatMap((r) => r.stances.filter((s) => s.verb === v).map((s) => ({ r, s })));

  return (
    <div className="page">
      <Link to={withMode("/cast", mode)} className="small">← Cast</Link>
      <header className="agent-head" style={{ marginTop: 10 }}>
        <Portrait id={a.id} size={130} name={a.name} oval />
        <div>
          <h1 style={{ marginBottom: 6 }}>{a.name}</h1>
          <p className="lede">{PEOPLE_HELP[a.kind] ?? a.role}</p>
          {owner && <p style={{ marginTop: 8 }}><strong>In the whole story, {a.name} is {owner.name} in disguise.</strong> What “{a.short}” says is shown here; see <Link to={withMode(`/cast/${owner.id}`, mode)}>{owner.name}</Link> for the man behind the mask.</p>}
          {data.alias.length > 0 && <p style={{ marginTop: 8 }}>Also appears as <strong>“{data.alias.join("”, “")}”</strong>: the same man, in Reality.</p>}
        </div>
      </header>

      {data.worlds.length > 0 && (
        <section className="card pad" style={{ marginBottom: 18 }}>
          <h2>Points of view</h2>
          <div className="worlds-of">
            {data.worlds.map((w) => (
              <span key={w.local} className="wpill" title={`${w.desc} (DEC: ${KIND[w.decType]?.dec ?? w.decType} “${w.local}”)`}>
                <WorldIcon type={w.decType} size={18} /> {w.title}
              </span>
            ))}
          </div>
        </section>
      )}

      {diags.length > 0 && (
        <section className="card pad" style={{ marginBottom: 18, borderColor: "var(--red)" }}>
          <h2>Lies, delusions, mistakes</h2>
          <ul className="stance-list">
            {diags.map((d, i) => (
              <li key={i}>
                <DiagBadge kind={d.kind} />
                <span>{d.sid ? <Link to={withMode(`/read?s=${d.sid}`, mode)}>{d.fact}</Link> : d.fact} <span className="small muted">— {DIAG[d.kind].short}{d.assumption ? `, ${d.assumption}` : ""}</span></span>
                <span />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid cols-2">
        {(["says", "believes", "concludes", "supposes"] as Verb[]).map((v) => {
          const items = byVerb(v);
          if (!items.length) return null;
          return (
            <section key={v} className="card pad stance-group">
              <h3><VerbIcon verb={v} size={24} /> {a.short} {VERB[v].label}… <span className="small muted" style={{ fontWeight: 400 }}>({items.length})</span></h3>
              <ul className="stance-list">
                {items.map(({ r, s }, i) => {
                  const clash = (r.reality === "true" && s.polarity === "no") || ((r.reality === "false" || r.reality === "false-if") && s.polarity === "yes");
                  return (
                    <li key={i} title={`${s.how} · DEC: ${s.dec}`}>
                      <VerbIcon verb={s.verb} polarity={s.polarity} size={20} />
                      <span>
                        {s.polarity === "no" && <span className="small red">otherwise: </span>}
                        {r.sentences[0] ? <Link to={withMode(`/read?s=${r.sentences[0]}`, mode)}>{r.text}</Link> : r.text}
                        {s.asName && <span className="small muted"> (as “{s.asName}”)</span>}
                        {r.diagnoses.filter((d) => d.world === s.world).map((d) => <span key={d.kind} style={{ marginLeft: 6 }}><DiagIcon kind={d.kind} size={15} /></span>)}
                      </span>
                      <span title={`Reality: ${REALITY[r.reality].label}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }} className={clash ? "red small" : "small muted"}>
                        <RealityDisc value={r.reality} size={16} />{clash ? "clashes" : r.reality === "unknown" ? "" : "agrees"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {held.length === 0 && <p className="empty">No stance of their own on the facts of the model{mode !== "gold" ? " at this point of the story" : ""}.</p>}

      {data.names.length > 0 && (
        <section className="card pad" style={{ marginTop: 18 }}>
          <h2>Names</h2>
          <NamesLine names={data.names} />
        </section>
      )}

      {silent.length > 0 && (
        <details className="more" style={{ marginTop: 18 }}>
          <summary>Silent on {silent.length} other facts</summary>
          <div className="more-body"><ul className="small" style={{ columns: 2, margin: 0 }}>{silent.map((r) => <li key={r.id}>{r.text}</li>)}</ul></div>
        </details>
      )}
    </div>
  );
}
