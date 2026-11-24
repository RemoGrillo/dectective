// Identikit: the people on the left, in pairs (the detectives on top, then the engaged couple, then the household),
// and the selected person's file on the right, typed on a sheet in a folder. Hovering Hosmer Angel's portrait with the
// lens shows, under the disguise, James Windibank (whole story only).
import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router";
import { useApi } from "../api";
import { Loading } from "../components/Bits";
import { Portrait } from "../components/Portrait";
import { SpyPortrait, hasReveal } from "../components/SpyPortrait";
import { useApp, withMode } from "../state";
import { PEOPLE_HELP } from "../vocab";
import { AgentView } from "./Agent";

type NameRow = { appellation: string; label: string; persons: { iri: string; id: string | null; name: string; inferred: boolean }[]; believers: string[] };

export function NamesLine({ names }: { names: NameRow[] }) {
  if (!names.length) return null;
  return (
    <div className="stack">
      {names.map((n) => (
        <div key={n.appellation} className="name-map">
          <span className="name-tag">“{n.label}”</span>
          <span aria-hidden="true">→</span>
          {n.persons.map((p, i) => (
            <span key={p.iri} className="who">
              {p.id && <Portrait id={p.id} size={26} name={p.name} />}
              <span>{p.name}{p.inferred && <span className="small muted" title="DEC infers it from the identity in Holmes's solution"> (inferred by DEC)</span>}{i < n.persons.length - 1 ? " and" : ""}</span>
            </span>
          ))}
          <span className="small muted">— in Reality{n.believers.length ? `; also in ${n.believers.join(", ")}` : "; nobody's beliefs make the link"}.</span>
        </div>
      ))}
    </div>
  );
}

/** The people in pairs, in the order a reader meets the case: who investigates, who is engaged, who is at home. */
const PAIRS: { label: string; ids: string[] }[] = [
  { label: "The detectives", ids: ["holmes", "watson"] },
  { label: "The engagement", ids: ["mary", "hosmer"] },
  { label: "The household", ids: ["windibank", "mother"] },
];

export default function Identikit() {
  const { id } = useParams();
  const { meta, mode, q } = useApp();
  const { data: names } = useApi<NameRow[]>(q("/api/names"));
  const detail = useRef<HTMLElement>(null);
  useEffect(() => {
    // on narrow screens the file sits under the list: bring it into view when someone is picked
    if (id && detail.current && window.matchMedia("(max-width: 1000px)").matches) detail.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [id]);
  if (!meta) return <div className="page"><Loading /></div>;
  const present = meta.agents.filter((a) => (mode === "gold" ? a.gold : a.sim) && a.kind !== "reality");
  const byId = (x: string) => present.find((a) => a.id === x);
  const paired = new Set(PAIRS.flatMap((p) => p.ids));
  const rows = [
    ...PAIRS.map((p) => ({ label: p.label, people: p.ids.map(byId).filter(Boolean) as typeof present })),
    { label: "Others", people: present.filter((a) => (a.kind === "character" || a.kind === "persona") && !paired.has(a.id)) },
  ].filter((r) => r.people.length);
  const helpers = present.filter((a) => a.kind === "reader" || a.kind === "whatif");
  const order = [...rows.flatMap((r) => r.people), ...helpers].map((a) => a.id);
  let k = 0;

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Identikit</h1>
        <p className="lede">One file per person: what they say, believe, conclude or suppose, and how it fares against Reality.</p>
      </div>
      <div className="cast-layout">
        <aside className="cast-list" aria-label="People">
          {rows.map((r) => (
            <div key={r.label} className="cast-pair">
              <span className="label">{r.label}</span>
              <div className="cast-grid2">
                {r.people.map((a) => (
                  <Link key={a.id} to={withMode(`/identikit/${a.id}`, mode)} className="card cast-tile" style={{ ["--k" as any]: k++ }} aria-current={id === a.id ? "page" : undefined}>
                    {hasReveal(a.id) ? <SpyPortrait id={a.id} size={104} name={a.name} /> : <Portrait id={a.id} size={104} name={a.name} oval />}
                    <strong>{a.name}</strong>
                    <span className="tiny muted">{a.role}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {helpers.length > 0 && (
            <div className="cast-pair">
              <span className="label">Also in the edition</span>
              <div className="cast-grid2">
                {helpers.map((a) => (
                  <Link key={a.id} to={withMode(`/identikit/${a.id}`, mode)} className="card cast-tile small" style={{ ["--k" as any]: k++ }} aria-current={id === a.id ? "page" : undefined}>
                    <Portrait id={a.id} size={64} name={a.name} oval />
                    <strong>{a.name}</strong>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
        <section className="cast-detail" ref={detail} aria-live="polite">
          {id ? <AgentView id={id} number={order.indexOf(id) + 1} /> : (
            <div className="id-folder">
              <span className="folder-tab">Identikit</span>
              <div className="id-sheet sheet-swap">
                <h2 className="id-name" style={{ fontSize: "1.6rem" }}>Pick someone</h2>
                <p>Each portrait opens one person's file: what they say, believe, conclude or suppose, and how it fares against Reality.</p>
                {mode === "gold" && <p className="small muted">Try the lens on Hosmer Angel's portrait.</p>}
                {helpers.map((a) => <p key={a.id} className="small"><strong>{a.name}:</strong> {PEOPLE_HELP[a.kind] ?? a.role}</p>)}
                {names && names.length > 0 && (<section className="id-section"><h2>Two names, one man</h2><NamesLine names={names} /></section>)}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
