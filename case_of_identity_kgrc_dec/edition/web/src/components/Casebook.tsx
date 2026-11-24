// Pieces of the casebook (the case files as an experiment): what DEC contributes to a case (role badge), and how the
// audit answered the same question with and without DEC (a dot per query and configuration, or the full table).
import type { AuditConfig, AuditRow, CaseRole, Score } from "../api";

export function RoleBadge({ role, size }: { role: Pick<CaseRole, "kind" | "label" | "desc">; size?: "small" }) {
  return (
    <span className={`drole drole-${role.kind} ${size === "small" ? "small" : ""}`} title={role.desc}>
      {role.kind === "dec-rule" ? <><span className="drole-dec">DEC</span><span>+ a rule</span></> : role.label}
    </span>
  );
}

function Mark({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="am am-na" aria-label="not applicable">·</span>;
  return ok ? <span className="am am-ok" aria-label="as expected">✓</span> : <span className="am am-no" aria-label="no answer, or a wrong one">✕</span>;
}

/** One row per configuration, one dot per audit query (same order in every row): filled = answered as expected. */
export function AuditDots({ configs, rows, score }: { configs: AuditConfig[]; rows: AuditRow[]; score: Score }) {
  return (
    <div className="adots" role="table" aria-label="Audit queries answered as expected, per set-up">
      {configs.map((c) => (
        <div key={c.id} className={`adots-row ${c.id === "dec" ? "is-dec" : ""}`} role="row">
          <span className="adots-l" role="rowheader" title={c.desc}>{c.label}</span>
          <span className="adots-d" role="cell">
            {rows.map((r) => <span key={r.id} className={`ad ${r.matches[c.id] ? "on" : ""}`} title={`${r.label} · ${r.ask} → ${r.matches[c.id] ? "as expected" : "no answer, or a wrong one"}`} />)}
          </span>
          <span className="adots-n" role="cell"><strong>{score[c.id].ok}</strong>/{score[c.id].of}</span>
        </div>
      ))}
    </div>
  );
}

/** The audit table of a case file's question: each query, what is expected, and whether each set-up answers it. */
export function AuditTable({ configs, rows }: { configs: AuditConfig[]; rows: AuditRow[] }) {
  return (
    <div className="table-wrap">
      <table className="data audit">
        <thead>
          <tr>
            <th>Query</th><th>Expected</th>
            {configs.map((c) => <th key={c.id} className={`ac ${c.id === "dec" ? "is-dec" : ""}`} title={c.desc}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><span className="mono tiny muted">{r.label}</span> {r.ask}</td>
              <td className="small">{r.expect}</td>
              {configs.map((c) => <td key={c.id} className={`ac ${c.id === "dec" ? "is-dec" : ""}`} title={r.note}><Mark ok={r.matches[c.id]} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConfigLegend({ configs }: { configs: AuditConfig[] }) {
  return (
    <dl className="config-legend">
      {configs.map((c) => <div key={c.id}><dt>{c.label}</dt><dd>{c.desc}</dd></div>)}
    </dl>
  );
}
