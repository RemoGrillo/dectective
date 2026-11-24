// Case files: the experiment. One research question, five questions put to DEC; for each, the answer, what it shows,
// how the audit answered it with and without DEC (a dot per query), and a pile of case files that test it on the story:
// the folders lie on top of each other, tab and title showing; the one under the pointer opens to show its contents.
import { Link } from "react-router";
import { useApi, type Casebook } from "../api";
import { ErrorBox, Loading, Stamp } from "../components/Bits";
import { AuditDots, RoleBadge } from "../components/Casebook";
import { useApp, withMode } from "../state";

export default function Dossiers() {
  const { data, error } = useApi<Casebook>("/api/casebook");
  const { mode } = useApp();
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <div className="page"><Loading what="Opening the filing cabinet" /></div>;
  return (
    <div className="page">
      <div className="page-head">
        <h1>Case files</h1>
        <p className="lede">{data.question} {data.lede}</p>
      </div>

      {data.questions.map((q) => (
        <section key={q.id} className="qcase" aria-labelledby={`q-${q.id}`}>
          <div className="q-side">
            <span className="kicker">Question {q.n} · {q.short}</span>
            <h2 id={`q-${q.id}`} className="q-title">{q.title}</h2>
            <div className="q-answer">
              <Stamp stamp={q.answer} tone="black" />
            </div>
            <p className="q-finding">{q.finding}</p>
            <div className="q-audit">
              <span className="label" title="The same question asked of the same data with DEC and three ways without it; each dot is a query, filled when answered as expected">
                In the audit · {q.nTests} {q.nTests === 1 ? "query" : "queries"} · <Link to={withMode("/method#audit", mode)}>how</Link>
              </span>
              <AuditDots configs={data.configs} rows={q.rows} score={q.score} />
            </div>
          </div>
          <div className="pile" aria-label={`Case files for question ${q.n}`} style={{ ["--n" as any]: q.cases.length }}>
            {q.cases.map((c, k) => (
              <Link key={c.id} to={withMode(`/dossiers/${c.id}`, mode)} className="pile-card" style={{ ["--k" as any]: k, zIndex: k + 1 }}>
                <span className="pc-face">
                  <span className="folder-tab">No. {String(c.number).padStart(2, "0")} · {c.typeLabel}</span>
                  <span className="pc-title">{c.title}</span>
                  <span className="pc-more">
                    <span className="pc-more-in">
                      <span className="pc-row">
                        <Stamp stamp={c.stamp} tone={c.verdict.tone} />
                        <RoleBadge role={c.role} size="small" />
                      </span>
                      <span className="pc-shows">{c.role.shows}</span>
                      <span className="pc-open">Open the file →</span>
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
