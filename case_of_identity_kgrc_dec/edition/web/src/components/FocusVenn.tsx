// A Venn focused on a few facts (one sentence, one case file): the same diagram as Worlds, with the facts listed below.
import { useMemo, useState } from "react";
import { useApi } from "../api";
import { REALITY } from "../vocab";
import { ErrorBox, Loading } from "./Bits";
import { TermBadge } from "./Term";
import { VennMap, type VennData, type VItem } from "./VennMap";

export function Dot({ it }: { it: Pick<VItem, "n" | "reality"> }) {
  const fill = it.reality === "true" ? "var(--ink)" : it.reality === "false" ? "var(--red)" : "var(--paper)";
  const stroke = it.reality === "true" ? "var(--ink)" : it.reality === "unknown" ? "var(--muted)" : "var(--red)";
  const txt = it.reality === "true" ? "var(--paper)" : it.reality === "false" ? "var(--on-red)" : it.reality === "false-if" ? "var(--red)" : "var(--ink)";
  return (
    <svg className="ico" width="20" height="20" viewBox="0 0 20 20" role="img" aria-label={`${it.n}, ${REALITY[it.reality].label}`}>
      <circle cx="10" cy="10" r="8.5" fill={fill} stroke={stroke} strokeWidth="1.5" strokeDasharray={it.reality === "false-if" ? "3 2" : undefined} />
      <text x="10" y="13.6" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="var(--f-ui)" fill={txt}>{it.n}</text>
    </svg>
  );
}

export function FocusVenn({ url, height = 380, minWidth = 380 }: { url: string; height?: number; minWidth?: number }) {
  const { data, error } = useApi<VennData>(url);
  const [sel, setSel] = useState<string | null>(null);
  const none = useMemo(() => new Set<string>(), []);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading what="Drawing" />;
  if (!data.items.length) return <p className="empty">Nothing to draw: nobody holds these propositions.</p>;
  return (
    <div className="focus-venn">
      <VennMap data={data} hidden={none} selected={sel} onSelect={setSel} minWidth={minWidth} height={height} />
      <ul className="plain venn-key">
        {data.items.map((it) => (
          <li key={it.id} className={sel === it.id ? "picked" : ""}>
            <button className="linklike row" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }} onClick={() => setSel(sel === it.id ? null : it.id)}>
              <Dot it={it} /><span>{it.text}</span>
            </button>
            {it.diagnoses.length > 0 && <span className="row" style={{ gap: 4, marginLeft: 26 }}>{it.diagnoses.map((d, i) => <TermBadge key={i} kind={d.kind} text={d.text} assumption={d.assumption} size="small" />)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
