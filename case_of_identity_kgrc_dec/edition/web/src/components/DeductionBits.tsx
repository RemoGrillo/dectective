// Shared pieces of the Deductions timeline: data hook, counts per clue, conclusion card, meter.
import { Link } from "react-router";
import { useApi, type DecType, type TConclusion, type Timeline } from "../api";
import { useApp, withMode } from "../state";
import { VERB } from "../vocab";
import { DecBadge, WorldIcon } from "./Glyphs";

export function useTimeline() {
  const { q } = useApp();
  return useApi<Timeline>(q("/api/timeline"));
}

/** Number of story-level conclusions available at each clue (index = clue number). */
export function countsByStep(tl: Timeline) {
  const out = new Array(tl.final + 1).fill(0);
  for (const c of tl.conclusions) if (c.cls === "story") for (let k = c.step; k <= tl.final; k++) out[k]++;
  return out;
}

export const stepOf = (tl: Timeline, n: number | null) => (n == null ? undefined : tl.steps.find((s) => s.n === n));

export function ConclusionCard({ c, tl, compact = false }: { c: TConclusion; tl: Timeline; compact?: boolean }) {
  const { mode } = useApp();
  return (
    <div className={`concl ${c.kind}`}>
      <div className="concl-head">
        <DecBadge title={c.kind === "accepted" ? "DEC copies Holmes's accepted solution into Reality (permeation)" : "Inferred by DEC's reasoner"} />
        <span className="pov">
          <WorldIcon type={(c.world === "reality" ? "reality" : c.verb === "says" ? "verbatim" : c.verb === "believes" ? "doxastic" : c.verb === "concludes" ? "epistemic" : "conjectural") as DecType} size={15} />
          {c.world === "reality" ? "In Reality" : `${c.personName ?? ""} ${c.verb ? VERB[c.verb].label : ""} · ${c.worldTitle}`}
        </span>
      </div>
      <p className="concl-text">{c.text}</p>
      {!compact && (
        <div className="because">
          <span className="label">Because</span> <span className="small">{c.ruleText}:</span>
          <ul>
            {c.premises.map((p, i) => {
              const s = stepOf(tl, p.step);
              return (
                <li key={i}>
                  {p.background ? <span className="muted">{p.text}</span> : <>“{p.text}”</>}
                  {s && <> <Link className="small" to={withMode(`/read?s=${s.sid}`, mode)}>p. {s.page}</Link></>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Meter({ label, now, total, red = false }: { label: string; now: number; total: number; red?: boolean }) {
  const pct = total ? Math.round((now / total) * 100) : 0;
  return (
    <div className="meter" role="img" aria-label={`${now} of ${total} ${label}`}>
      <div className="spread small"><span><strong>{now}</strong> of {total} {label}</span><span className="muted">{pct}%</span></div>
      <div className="meter-track"><div className={`meter-fill ${red ? "red" : ""}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
