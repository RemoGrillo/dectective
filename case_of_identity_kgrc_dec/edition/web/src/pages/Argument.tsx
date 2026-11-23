// The argument: the research question and its four demonstrations, each one a small view of live data.
// 1 narrative as worlds · 2 narrative vs Reality · 3 transparent reasoning over the story · 4 explanation of one verdict.
import { useState } from "react";
import { Link } from "react-router";
import { useApi, type Dossier, type Viewpoint, type DecType } from "../api";
import { useTimeline } from "../components/DeductionBits";
import { ErrorBox, Loading } from "../components/Bits";
import { DiagBadge, RealityDisc } from "../components/Glyphs";
import { useApp, withMode } from "../state";
import { VERB } from "../vocab";

export default function Argument() {
  return (
    <div className="page wide" style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <h1>The argument</h1>
        <p className="lede">How can a narrative be made machine-readable in a digital edition, by expressing formally the relation between what the narration says and what is true in the story, so that every conclusion of the reasoning can be explained step by step?</p>
      </div>
      <blockquote className="small" style={{ maxWidth: 760, margin: "0 0 20px" }}>
        <p style={{ margin: 0 }}>“<strong>Textual universe.</strong> The image of a system of reality projected by a text. The textual universe is a modal system if one of its worlds is designated as actual and opposed to the other worlds of the system.”</p>
        <p style={{ margin: "6px 0 0" }}>Narrative “represents a chronologically ordered sequence of states and events, which captures a segment of history—the history of the textual universe.”</p>
        <p className="muted" style={{ margin: "6px 0 0" }}>M.-L. Ryan, <em>Possible Worlds, Artificial Intelligence, and Narrative Theory</em>, Indiana University Press, 1991: Glossary; p. 124. The edition takes this view literally: a story is a set of worlds, one of them actual (Reality), plus the order in which they are told.</p>
      </blockquote>
      <div className="stack">
        <Worlds />
        <NarrativeVsReality />
        <Reasoning />
        <Explanation />
      </div>
    </div>
  );
}

const Head = ({ n, title, ask, to, label }: { n: number; title: string; ask: string; to: string; label: string }) => {
  const { mode } = useApp();
  return (
    <>
      <div className="spread"><h2 style={{ margin: 0 }}>{n}. {title}</h2><Link className="btn small" to={withMode(to, mode)}>{label} →</Link></div>
      <p className="small muted" style={{ margin: "4px 0 10px" }}>{ask}</p>
    </>
  );
};

// ---------------------------------------------------------------- 1. the narrative as worlds
const NODES: Record<string, { x: number; y: number; type: DecType | "reality"; text: string; sub: string }> = {
  shared: { x: 360, y: 40, type: "shared", text: "Shared background", sub: "rules everyone takes for granted" },
  reality: { x: 360, y: 150, type: "reality", text: "Reality", sub: "what is true in the story" },
  says: { x: 70, y: 150, type: "verbatim", text: "says", sub: "takes nothing" },
  believes: { x: 150, y: 260, type: "doxastic", text: "believes", sub: "" },
  concludes: { x: 360, y: 260, type: "epistemic", text: "concludes", sub: "" },
  supposes: { x: 570, y: 260, type: "conjectural", text: "supposes", sub: "" },
};
const ARROWS: [string, string][] = [["shared", "believes"], ["shared", "concludes"], ["shared", "supposes"], ["reality", "supposes"], ["concludes", "reality"]];

function Worlds() {
  const { q } = useApp();
  const { data } = useApi<{ worlds: { decType: DecType }[] }>(q("/api/worlds"));
  const count = (t: DecType | "reality") => data?.worlds.filter((w) => w.decType === t).length;
  return (
    <section className="card pad" aria-labelledby="a1">
      <Head n={1} title="The narrative is a set of worlds" ask="What does the story say, believe, conclude and guess, and what may pass from one point of view to another?" to="/worlds" label="Worlds" />
      <svg viewBox="0 0 720 320" role="img" aria-label="Worlds and what passes between them" style={{ width: "100%", maxWidth: 720 }}>
        <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink)" /></marker></defs>
        {ARROWS.map(([a, b]) => {
          const A = NODES[a], B = NODES[b], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
          const k = 34 / L; // stop short of the node boxes
          return <line key={a + b} x1={A.x + dx * k} y1={A.y + dy * k} x2={B.x - dx * k} y2={B.y - dy * k} stroke="var(--ink)" strokeWidth="2" markerEnd="url(#ar)" />;
        })}
        {Object.entries(NODES).map(([id, n]) => {
          const c = count(n.type);
          return (
            <g key={id}>
              <rect x={n.x - 62} y={n.y - 28} width="124" height="56" rx={id === "reality" ? 28 : 4} fill="var(--bg, #fff)" stroke="var(--ink)" strokeWidth={id === "reality" ? 3 : 2} strokeDasharray={id === "says" ? "5 4" : undefined} />
              <text x={n.x} y={n.y - 4} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)">{n.text}</text>
              <text x={n.x} y={n.y + 14} textAnchor="middle" fontSize="11" fill="var(--muted)">{c !== undefined ? `${c} world${c === 1 ? "" : "s"}` : ""}{n.sub && c !== undefined ? " · " : ""}{n.sub}</text>
            </g>
          );
        })}
      </svg>
      <p className="small muted" style={{ margin: "6px 0 0" }}>Arrows are DEC's permeation: beliefs and conclusions take the shared background; guesses also take Reality; Reality takes the accepted conclusion; statements take nothing, so what someone said is kept apart from what is true.</p>
    </section>
  );
}

// ---------------------------------------------------------------- 2. narrative vs Reality
function NarrativeVsReality() {
  const { q, mode } = useApp();
  const { data, error } = useApi<{ rows: Viewpoint[] }>(q("/api/knowledge"));
  if (error) return <section className="card pad"><ErrorBox error={error} /></section>;
  const rows = (data?.rows ?? []).filter((r) => r.diagnoses.length > 0);
  const who = (r: Viewpoint, verb: string) => r.people.flatMap((p) => p.stances.filter((s) => s.verb === verb).map((s) => `${p.short} ${s.polarity === "yes" ? "✓" : "✕"}`)).join(", ") || "—";
  return (
    <section className="card pad" aria-labelledby="a2">
      <Head n={2} title="Narrative against Reality" ask="Where does what is told part from what is true, and of which kind is the gap?" to="/narrative" label="Telling vs truth" />
      {!data ? <Loading what="Comparing" /> : rows.length === 0 ? <p className="empty">No gap yet at this stage of the story.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table className="small" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", borderBottom: "2px solid var(--ink)" }}><th>Claim</th><th>{VERB.says.label}</th><th>{VERB.believes.label}</th><th>Reality</th><th>Gap</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--muted)" }}>
                  <td style={{ padding: "6px 8px 6px 0" }}>{r.sentences[0] ? <Link to={withMode(`/read?s=${r.sentences[0]}`, mode)}>{r.text}</Link> : r.text}</td>
                  <td>{who(r, "says")}</td><td>{who(r, "believes")}</td>
                  <td><span className="row" style={{ gap: 4, flexWrap: "nowrap" }}><RealityDisc value={r.reality.value} size={16} />{r.reality.value === "true" ? "True" : r.reality.value === "unknown" ? "Not said" : "False"}</span></td>
                  <td>{[...new Set(r.diagnoses.map((d) => d.kind))].map((k) => <DiagBadge key={k} kind={k} />)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ margin: "8px 0 0" }}>✓ holds it, ✕ holds the opposite. Same claim, three points of view: said, believed, true. The pattern of the three names the gap (a lie, an illusion, a sincere error).</p>
    </section>
  );
}

// ---------------------------------------------------------------- 3. transparent reasoning over the story
function Reasoning() {
  const { mode } = useApp();
  const { data: tl, error } = useTimeline();
  if (error) return <section className="card pad"><ErrorBox error={error} /></section>;
  const last = tl ? (tl.cap ?? tl.final) : 1;
  const W = 700, H = 170, pad = 24;
  const x = (n: number) => pad + ((n - 1) / Math.max(last - 1, 1)) * (W - 2 * pad);
  const per = new Map<number, number>();
  for (const c of tl?.conclusions ?? []) if (c.cls === "story" && c.step <= last) per.set(c.step, (per.get(c.step) ?? 0) + 1);
  let cum = 0;
  const pts = Array.from({ length: last }, (_, i) => { cum += per.get(i + 1) ?? 0; return [i + 1, cum] as const; });
  const max = Math.max(cum, 1), y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const verdicts = [...new Map((tl?.events ?? []).filter((e) => e.kind === "verdict" && e.step <= last).map((e) => [e.step, e])).values()];
  const sid = (n: number) => tl?.steps.find((s) => s.n === n)?.sid;
  return (
    <section className="card pad" aria-labelledby="a3">
      <Head n={3} title="The reasoning, clue by clue" ask="What can be concluded at each point of the story, and when does a gap become visible?" to="/deductions" label="Solve the case" />
      {!tl ? <Loading what="Replaying" /> : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Conclusions drawn as the story is read" style={{ width: "100%" }}>
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--muted)" />
          {tl.identityStep <= last && <g><line x1={x(tl.identityStep)} y1={pad} x2={x(tl.identityStep)} y2={H - pad} stroke="var(--muted)" strokeDasharray="4 4" /><text x={x(tl.identityStep) + 4} y={pad + 4} fontSize="11" fill="var(--muted)">the unmasking</text></g>}
          <polyline fill="none" stroke="var(--ink)" strokeWidth="2.5" points={pts.map(([n, v]) => `${x(n)},${y(v)}`).join(" ")} />
          {verdicts.map((e) => (
            <Link key={e.step} to={withMode(`/deductions?at=${sid(e.step)}`, mode)}>
              <circle cx={x(e.step)} cy={y(pts[e.step - 1]?.[1] ?? 0)} r="7" fill="var(--red)" stroke="var(--ink)" strokeWidth="1.5"><title>{`Clue ${e.step}: ${e.diagnosis?.text ?? ""}`}</title></circle>
            </Link>
          ))}
          <text x={pad} y={H - 6} fontSize="11" fill="var(--muted)">clue 1</text>
          <text x={W - pad} y={H - 6} textAnchor="end" fontSize="11" fill="var(--muted)">clue {last}</text>
          <text x={pad} y={14} fontSize="11" fill="var(--muted)">{cum} conclusions</text>
        </svg>
      )}
      <p className="small muted" style={{ margin: "6px 0 0" }}>The line is what DEC has concluded after each clue; one run per clue on the story read so far. Red dots are the moments a lie, an illusion or an error becomes detectable; click to read that clue.</p>
    </section>
  );
}

// ---------------------------------------------------------------- 4. explanation of one verdict
function Explanation() {
  const { q, mode } = useApp();
  const { data: list } = useApi<Dossier[]>("/api/dossiers");
  const [pick, setPick] = useState<string | null>(null);
  const id = pick ?? list?.[0]?.id ?? null;
  const { data: d } = useApi<Dossier>(id ? q(`/api/dossiers/${id}`) : null);
  return (
    <section className="card pad" aria-labelledby="a4">
      <Head n={4} title="Every verdict can be explained" ask="Why does the system say so? Each step is a query that anyone can run again." to={id ? `/dossiers/${id}` : "/dossiers"} label="Open the case file" />
      <div className="row" role="group" aria-label="Pick a verdict" style={{ marginBottom: 10 }}>
        {(list ?? []).slice(0, 8).map((x) => <button key={x.id} className="chip" aria-pressed={x.id === id} onClick={() => setPick(x.id)}>{x.title}</button>)}
      </div>
      {!d ? <Loading what="Opening the file" /> : (
        <>
          <p className="small" style={{ margin: "0 0 8px" }}><strong>{d.verdict.label}.</strong> {d.summary}</p>
          <ol className="plain" style={{ display: "grid", gap: 8 }}>
            {d.steps.map((s) => (
              <li key={s.n} className="card flat" style={{ padding: "8px 12px", display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 10, alignItems: "start" }}>
                <strong>{s.n}</strong>
                <span className="small"><strong>{s.title}</strong><br />{s.text}</span>
                <span className="tiny muted">{s.by === "dec" ? "DEC" : s.by === "kgrc" ? "KGRC" : "edition"}</span>
              </li>
            ))}
          </ol>
          <p className="small muted" style={{ margin: "8px 0 0" }}>Each step has its SPARQL query in the <Link to={withMode(`/dossiers/${d.id}`, mode)}>case file</Link>, and the DEC run it relies on.</p>
        </>
      )}
    </section>
  );
}
