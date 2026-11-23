// Case files index: automatically generated, step-by-step explanations of each lie, delusion, identity, guess…
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useApi, type Dossier } from "../api";
import { ErrorBox, Loading, Stamp } from "../components/Bits";
import { useApp, withMode } from "../state";

export default function Dossiers() {
  const { data, error } = useApi<Dossier[]>("/api/dossiers");
  const { mode } = useApp();
  const [type, setType] = useState<string>("all");
  const types = useMemo(() => [...new Set((data ?? []).map((d) => d.typeLabel))], [data]);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <div className="page"><Loading what="Opening the filing cabinet" /></div>;
  const list = data.filter((d) => type === "all" || d.typeLabel === type);
  return (
    <div className="page">
      <div className="page-head">
        <h1>Case files</h1>
        <p className="lede">Each verdict, explained step by step. Every step runs a query and shows it.</p>
      </div>
      <div className="row" style={{ margin: "0 0 8px" }} role="group" aria-label="Filter by kind">
        <button className="chip" aria-pressed={type === "all"} onClick={() => setType("all")}>All <span className="count">{data.length}</span></button>
        {types.map((t) => <button key={t} className="chip" aria-pressed={type === t || type === "all"} onClick={() => setType(type === t ? "all" : t)}>{t} <span className="count">{data.filter((d) => d.typeLabel === t).length}</span></button>)}
      </div>
      <div className="folder-grid">
        {list.map((d) => (
          <Link key={d.id} to={withMode(`/dossiers/${d.id}`, mode)} className="folder">
            <span className="folder-tab">No. {String(d.number).padStart(2, "0")} · {d.typeLabel}</span>
            <h3>{d.title}</h3>
            <Stamp stamp={d.stamp} tone={d.verdict.tone} />
            <p className="summary">{d.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
