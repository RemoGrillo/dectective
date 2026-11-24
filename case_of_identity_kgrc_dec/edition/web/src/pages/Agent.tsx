// One person's file in the Identikit: a typed sheet in a folder. Photo and particulars (role, other names, points of
// view), their lies and delusions, what they say / believe / conclude / suppose (each checked against Reality), the
// names that pick them out, and (folded) what they are silent on. Changing person: the sheet stays until the next one
// is ready, then it is put away and the next one slides out of the folder.
import { Link } from "react-router";
import { useApi, type Agent, type Diagnosis, type DecType, type Part, type VStance } from "../api";
import { ErrorBox, Loading, Stamp } from "../components/Bits";
import { DiagIcon, RealityDisc, VerbIcon, WorldIcon } from "../components/Glyphs";
import { useSwap } from "../components/Motion";
import { TermBadge } from "../components/Term";
import { SpyPortrait } from "../components/SpyPortrait";
import { useApp, withMode } from "../state";
import { DIAG, KIND, PEOPLE_HELP, REALITY, VERB, type DiagnosisKind, type Verb } from "../vocab";
import { NamesLine } from "./Identikit";

type Row = { id: string; text: string; parts: Part[]; sentences: string[]; reality: keyof typeof REALITY; stances: VStance[]; diagnoses: Diagnosis[] };
type Payload = {
  agent: Agent; mode: string; mergedInto: string | null; alias: string[];
  worlds: { local: string; title: string; desc: string; decType: DecType; governedBy: { agent: string; predicate: string; viaIdentity: boolean }[] }[];
  stances: Row[]; names: any[];
};

/** The verdicts on a person, as a rubber stamp: the most serious kind with its count, the others below. */
function verdictStamp(kinds: DiagnosisKind[]) {
  const order: DiagnosisKind[] = ["lie", "delusion", "mistake"];
  const n = (k: DiagnosisKind) => kinds.filter((x) => x === k).length;
  const present = order.filter((k) => n(k) > 0);
  if (!present.length) return null;
  const label = (k: DiagnosisKind) => `${DIAG[k].label}${n(k) > 1 ? ` ×${n(k)}` : ""}`;
  return { word: label(present[0]), sub: present.length > 1 ? `and ${present.slice(1).map(label).join(", ").toLowerCase()}` : "on file" };
}

/** One person's file (the right-hand side of the Identikit page). `number`: the file's number in the Identikit. */
export function AgentView({ id, number }: { id: string; number: number }) {
  const { q } = useApp();
  const { data: fresh, error } = useApi<Payload>(q(`/api/agents/${id}`));
  const { shown, phase } = useSwap(fresh, (d) => `${d.mode}:${d.agent.id}`, 170);
  if (error) return <ErrorBox error={error} />;
  if (!shown) return <div className="id-folder"><div className="id-sheet"><Loading what="Taking a statement" /></div></div>;
  return (
    <div className="id-folder">
      <span className="folder-tab">Identikit · File {String(number).padStart(2, "0")}</span>
      <Sheet key={`${shown.mode}:${shown.agent.id}`} data={shown} phase={phase} />
    </div>
  );
}

function Sheet({ data, phase }: { data: Payload; phase: "in" | "out" }) {
  const { mode, meta } = useApp();
  const a = data.agent;
  const held = data.stances.filter((r) => r.stances.length);
  const silent = data.stances.filter((r) => !r.stances.length);
  const diags = data.stances.flatMap((r) => r.diagnoses.map((d) => ({ ...d, fact: r.text, sid: r.sentences[0] })));
  const owner = data.mergedInto ? meta?.agents.find((x) => x.id === data.mergedInto) : null;
  const byVerb = (v: Verb) => held.flatMap((r) => r.stances.filter((s) => s.verb === v).map((s) => ({ r, s })));
  const stamp = verdictStamp(diags.map((d) => d.kind));

  return (
    <article className={`id-sheet sheet-swap ${phase}`} aria-label={`Identikit of ${a.name}`}>
      <header className="id-head">
        <figure className="id-photo">
          <svg className="id-clip" width="22" height="58" viewBox="0 0 22 58" aria-hidden="true"><path d="M7 40V9a4 4 0 0 1 8 0v35a6.5 6.5 0 0 1-13 0V14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          <SpyPortrait id={a.id} size={150} name={a.name} />
        </figure>
        <div className="id-particulars">
          <h1 className="id-name">{a.name}</h1>
          <dl className="id-fields">
            <dt>Role</dt><dd>{PEOPLE_HELP[a.kind] ?? a.role}</dd>
            {data.alias.length > 0 && <><dt>Also known as</dt><dd>“{data.alias.join("”, “")}”: the same man, in Reality.</dd></>}
            {owner && <><dt>In truth</dt><dd>{owner.name} in disguise. What “{a.short}” says is filed here; see <Link to={withMode(`/identikit/${owner.id}`, mode)}>{owner.name}</Link> for the man behind the mask.</dd></>}
            {data.worlds.length > 0 && <><dt>Points of view</dt><dd className="worlds-of">
              {data.worlds.map((w) => (
                <span key={w.local} className="wpill" title={`${w.desc} (DEC: ${KIND[w.decType]?.dec ?? w.decType} “${w.local}”)`}>
                  <WorldIcon type={w.decType} size={16} /> {w.title}
                </span>
              ))}
            </dd></>}
          </dl>
        </div>
        <div className="id-stamp">{stamp ? <Stamp stamp={stamp} tone="red" /> : <Stamp stamp={{ word: "No verdict", sub: "nothing ruled out" }} tone="grey" />}</div>
      </header>

      {diags.length > 0 && (
        <section className="id-section">
          <h2>Lies, delusions, mistakes</h2>
          <ul className="stance-list">
            {diags.map((d, i) => (
              <li key={i}>
                <TermBadge kind={d.kind} text={d.text} assumption={d.assumption} />
                <span>{d.sid ? <Link to={withMode(`/read?s=${d.sid}`, mode)}>{d.fact}</Link> : d.fact}</span>
                <span />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="id-cols">
        {(["says", "believes", "concludes", "supposes"] as Verb[]).map((v) => {
          const items = byVerb(v);
          if (!items.length) return null;
          return (
            <section key={v} className="id-section">
              <h2><VerbIcon verb={v} size={20} /> {a.short} {VERB[v].label}… <span className="id-count">({items.length})</span></h2>
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
      {held.length === 0 && <p className="id-empty">No stance of their own on the propositions of the model{mode !== "gold" ? " at this point of the story" : ""}.</p>}

      {data.names.length > 0 && (
        <section className="id-section">
          <h2>Names</h2>
          <NamesLine names={data.names} />
        </section>
      )}

      {silent.length > 0 && (
        <details className="more" style={{ marginTop: 14 }}>
          <summary>Silent on {silent.length} other propositions</summary>
          <div className="more-body"><ul className="small" style={{ columns: 2, margin: 0 }}>{silent.map((r) => <li key={r.id}>{r.text}</li>)}</ul></div>
        </details>
      )}
    </article>
  );
}
