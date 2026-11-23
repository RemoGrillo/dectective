// Small shared pieces: rendered propositions, loading/error states, case-file stamps, sentence links.
import { Link } from "react-router";
import type { Part, Stamp as StampT } from "../api";
import { useApp, withMode } from "../state";

export function Parts({ parts }: { parts: Part[] }) {
  const { meta, mode } = useApp();
  return (
    <span className="prop-text">
      {parts.map((p, i) => {
        if (!p.iri) return <span key={i}>{p.text}</span>;
        const ag = meta?.agents.find((a) => a.gold === p.iri || a.sim === p.iri);
        if (ag && ag.kind !== "reality" && ag.kind !== "whatif" && ag.kind !== "reader") {
          return <Link key={i} to={withMode(`/cast/${ag.id}`, mode)} title={`${ag.name}: what they hold`}>{p.text}</Link>;
        }
        return <span key={i}>{p.text}</span>;
      })}
    </span>
  );
}

export function Loading({ what = "Consulting the case files" }: { what?: string }) {
  return <div className="loading" role="status">{what}</div>;
}
export function ErrorBox({ error }: { error: string }) {
  return <div className="error-box" role="alert"><strong>Error.</strong> {error}</div>;
}

/** A rubber stamp: one or two big words and a short subtitle. */
export function Stamp({ stamp, tone, big }: { stamp: StampT; tone: string; big?: boolean }) {
  return (
    <span className={`stamp ${tone === "red" ? "red" : tone === "grey" ? "grey" : ""} ${big ? "big" : ""}`} role="img" aria-label={`Verdict: ${stamp.word} — ${stamp.sub}`}>
      <span className="w">{stamp.word}</span>
      <span className="s">{stamp.sub}</span>
    </span>
  );
}

export function SentenceLink({ id, children }: { id: string; children?: React.ReactNode }) {
  const { mode } = useApp();
  return <Link to={withMode(`/read?s=${id}`, mode)}>{children ?? id}</Link>;
}
