// Kaleidoscope: one fact, every point of view.
//  /kaleidoscope        "Who knows what": every fact of the model × Reality × every person.
//  /kaleidoscope/:sid   one sentence, its claims, the kaleidoscope and who holds what.
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useApi, type SentenceView, type Viewpoint } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { DiagBadge, DiagIcon, IconLegend, RealityDisc, VerbIcon } from "../components/Glyphs";
import { Holders } from "../components/Holders";
import { Kaleidoscope as Wheel, personState } from "../components/Kaleidoscope";
import { Portrait } from "../components/Portrait";
import { useApp, withMode } from "../state";
import { DIAG, PEOPLE_HELP, REALITY, VERB } from "../vocab";

type Knowledge = { mode: string; people: { id: string; short: string; name: string; kind: string; alias?: string }[]; rows: Viewpoint[] };

export default function KaleidoscopePage() {
  const { sid } = useParams();
  const { mode } = useApp();
  const navigate = useNavigate();
  return (
    <div className="page wide">
      <div className="page-head spread" style={{ alignItems: "flex-end" }}>
        <div>
          <h1>Kaleidoscope</h1>
          <p className="lede">One fact, every point of view, with Reality in the middle.</p>
        </div>
        <div className="seg" role="tablist" aria-label="Views">
          <button role="tab" aria-selected={!sid} onClick={() => navigate(withMode("/kaleidoscope", mode))}>Who knows what</button>
          <button role="tab" aria-selected={!!sid} onClick={() => navigate(withMode("/kaleidoscope/P031.S10", mode))}>One sentence</button>
        </div>
      </div>
      {sid ? <SentenceView sid={sid} /> : <Matrix />}
    </div>
  );
}

function SentenceView({ sid }: { sid: string }) {
  const { q, mode } = useApp();
  const { data, error } = useApi<SentenceView>(q(`/api/sentence/${sid}`));
  const [pi, setPi] = useState(0);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading what="Turning the kaleidoscope" />;
  if (data.hidden) return <div className="sealed">{data.reason}</div>;
  const vp = data.viewpoints[Math.min(pi, data.viewpoints.length - 1)];
  return (
    <div className="card pad">
      <div className="spread">
        <span className="kicker">Sentence · p. {data.paragraph.page}</span>
        <Link className="btn small" to={withMode(`/read?s=${sid}`, mode)}>Read it in context →</Link>
      </div>
      <blockquote className="quote" style={{ fontSize: "1.2rem" }}>{data.text}</blockquote>
      {data.diagnoses.length > 0 && <div className="row" style={{ margin: "8px 0" }}>{data.diagnoses.map((d, i) => <span key={i} className="row" style={{ gap: 6 }}><DiagBadge kind={d.kind} /><span className="small">{d.text}</span></span>)}</div>}
      {!vp ? <p className="empty">No claim of the model is tied to this sentence.</p> : (
        <>
          {data.viewpoints.length > 1 && (
            <div className="claims" role="group" aria-label="Claims in this sentence" style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {data.viewpoints.map((v, i) => (
                <button key={v.id} aria-pressed={i === pi} onClick={() => setPi(i)}><span className="n">{i + 1}</span>{v.text}{v.diagnoses[0] && <DiagIcon kind={v.diagnoses[0].kind} size={16} />}</button>
              ))}
            </div>
          )}
          <p className="claim-title" style={{ fontSize: "1.35rem" }}>“{vp.text}”</p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", alignItems: "start" }}>
            <Wheel vp={vp} size={420} />
            <div><h4>Who holds what</h4><Holders vp={vp} /></div>
          </div>
        </>
      )}
    </div>
  );
}

type Filter = "clashes" | "diagnosed" | "all";

function Matrix() {
  const { q, mode } = useApp();
  const { data, error } = useApi<Knowledge>(q("/api/knowledge"));
  const [filter, setFilter] = useState<Filter>("clashes");
  const [text, setText] = useState("");
  const rows = useMemo(() => (data?.rows ?? []).filter((r) =>
    (filter === "all" || (filter === "diagnosed" ? r.diagnoses.length > 0 : r.divergent || r.diagnoses.length > 0)) &&
    (!text || r.text.toLowerCase().includes(text.toLowerCase()))), [data, filter, text]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading what="Asking everyone" />;
  const n = (f: Filter) => data.rows.filter((r) => f === "all" || (f === "diagnosed" ? r.diagnoses.length > 0 : r.divergent || r.diagnoses.length > 0)).length;
  return (
    <>
      <div className="matrix-tools">
        <div className="seg" role="group" aria-label="Which facts">
          <button aria-pressed={filter === "clashes"} onClick={() => setFilter("clashes")}>Where views clash ({n("clashes")})</button>
          <button aria-pressed={filter === "diagnosed"} onClick={() => setFilter("diagnosed")}>Deceptions &amp; illusions ({n("diagnosed")})</button>
          <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All facts ({n("all")})</button>
        </div>
        <input type="search" placeholder="Find a fact…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Find a fact" />
        <IconLegend compact />
      </div>
      <div className="table-wrap" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <table className="matrix">
          <thead>
            <tr>
              <th className="fact">Fact</th>
              <th title="What is true in the story (DEC: reality)"><div className="col-head"><RealityDisc size={30} />Reality</div></th>
              {data.people.map((p) => (
                <th key={p.id} title={PEOPLE_HELP[p.id] ?? (p.alias ? `${p.name}, also “${p.alias}”` : p.name)}>
                  <div className="col-head"><Portrait id={p.id} size={32} name={p.name} />{p.short}{p.alias && <span className="tiny muted" style={{ textTransform: "none" }}>alias {p.alias.split(" ")[0]}</span>}</div>
                </th>
              ))}
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="fact">
                  {r.sentences[0] ? <Link to={withMode(`/kaleidoscope/${r.sentences[0]}`, mode)} title="Open this fact in the kaleidoscope">{r.text}</Link> : r.text}
                </td>
                <td className="reality" title={`${REALITY[r.reality.value].label}: ${r.reality.how}`}>
                  <span className="row" style={{ gap: 4, justifyContent: "center", flexWrap: "nowrap" }}><RealityDisc value={r.reality.value} size={20} /><span className="tiny">{REALITY[r.reality.value].short}</span></span>
                </td>
                {r.people.map((p) => {
                  const st = personState(p, r);
                  return (
                    <td key={p.id} className={st === "conflict" ? "conflict" : ""} title={p.stances.map((s) => `${p.short} ${VERB[s.verb][s.polarity]}${s.asName ? ` (as ${s.asName})` : ""} — ${s.how}`).join("\n") || `${p.short}: silent`}>
                      {p.stances.length ? <span className="cell-marks">{p.stances.map((s, k) => <VerbIcon key={k} verb={s.verb} polarity={s.polarity} size={24} title={`${p.short} ${VERB[s.verb][s.polarity]}${s.asName ? ` as ${s.asName}` : ""}`} />)}</span> : <span className="muted" aria-label="silent">·</span>}
                    </td>
                  );
                })}
                <td>{[...new Set(r.diagnoses.map((d) => d.kind))].map((k) => <span key={k} title={r.diagnoses.filter((d) => d.kind === k).map((d) => d.text).join("; ")} style={{ display: "inline-flex", marginRight: 4 }}><DiagIcon kind={k} size={18} /><span className="tiny" style={{ marginLeft: 3 }}>{DIAG[k].label}</span></span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty" style={{ padding: 16 }}>No fact matches.</p>}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>Red cell: the person clashes with Reality. “·”: silent. Hover a cell for the reason; click a fact to open it.</p>
    </>
  );
}
