// Cast: the people of the story (with portraits), the two helpers of the edition, and the one name that hides a man.
import { Link } from "react-router";
import { useApi } from "../api";
import { Loading } from "../components/Bits";
import { Portrait } from "../components/Portrait";
import { useApp, withMode } from "../state";
import { PEOPLE_HELP } from "../vocab";

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

export default function Cast() {
  const { meta, mode, q } = useApp();
  const { data: names } = useApi<NameRow[]>(q("/api/names"));
  if (!meta) return <div className="page"><Loading /></div>;
  const present = meta.agents.filter((a) => (mode === "gold" ? a.gold : a.sim) && a.kind !== "reality");
  const people = present.filter((a) => a.kind === "character" || a.kind === "persona");
  const helpers = present.filter((a) => a.kind === "reader" || a.kind === "whatif");
  return (
    <div className="page">
      <div className="page-head">
        <h1>Cast</h1>
        <p className="lede">Who says, believes, concludes or supposes what. Open a card to see one person's view of the case.</p>
      </div>
      <div className="cast-grid">
        {people.map((a) => (
          <Link key={a.id} to={withMode(`/cast/${a.id}`, mode)} className="card cast-card">
            <Portrait id={a.id} size={120} name={a.name} oval />
            <h3>{a.name}</h3>
            <span className="role">{a.kind === "persona" && mode === "gold" ? "A false identity: James Windibank in disguise" : a.role}</span>
          </Link>
        ))}
      </div>
      {helpers.length > 0 && (
        <>
          <h2 style={{ marginTop: 34 }}>Also in the edition</h2>
          <div className="cast-grid">
            {helpers.map((a) => (
              <Link key={a.id} to={withMode(`/cast/${a.id}`, mode)} className="card cast-card">
                <Portrait id={a.id} size={80} name={a.name} oval />
                <h3>{a.name}</h3>
                <span className="role">{PEOPLE_HELP[a.kind] ?? a.role}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      {names && names.length > 0 && (
        <section className="card pad" style={{ marginTop: 30 }}>
          <h2>Two names, one man</h2>
          <NamesLine names={names} />
        </section>
      )}
    </div>
  );
}
