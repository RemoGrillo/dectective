// The kaleidoscope: one proposition, every point of view.
// Reality sits in the centre (yellow disc, with its value: true / false / not said). Around it, ONE slice per person, always in the
// same place: portrait, the icons of what they say / believe / conclude / suppose (✓ holds it, ✕ holds otherwise)
// and, in red, a diagnosis (lie, delusion, honest mistake). A slice is red when the person clashes with Reality,
// white when they agree, grey and dashed when they are silent.
import { useId, useMemo, useState } from "react";
import type { Viewpoint, VPerson } from "../api";
import { useApp } from "../state";
import { DIAG, REALITY, VERB } from "../vocab";
import { RealityDisc, VerbIcon } from "./Glyphs";
import { TermBadge } from "./Term";
import { Portrait, portraitUrl } from "./Portrait";

type State = "conflict" | "agree" | "silent";
export function personState(p: VPerson, vp: Viewpoint): State {
  if (!p.stances.length) return "silent";
  const r = vp.reality.value;
  const clash = p.diagnoses.length > 0 || p.stances.some((s) => (r === "true" && s.polarity === "no") || ((r === "false" || r === "false-if") && s.polarity === "yes"));
  return clash ? "conflict" : "agree";
}

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

const MONO: Record<string, string> = { mary: "MS", windibank: "JW", hosmer: "HA", holmes: "SH", watson: "DW", mother: "MM", reader: "?", whatif: "W?" };

export function Kaleidoscope({ vp, size = 360, compact = false }: { vp: Viewpoint; size?: number; compact?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const { meta } = useApp();
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const focus = hover ?? pinned;
  const people = vp.people;
  const n = Math.max(people.length, 1);
  const pad = compact ? 60 : 70, W = size + pad * 2, c = W / 2;
  const rC = size * 0.2, rIn = size * 0.255, rOut = size * 0.5;
  const span = (Math.PI * 2) / n, gap = n > 1 ? 0.035 : 0;
  const slices = useMemo(() => people.map((p, i) => {
    const mid = -Math.PI / 2 + i * span;
    return { p, a0: mid - span / 2 + gap, a1: mid + span / 2 - gap, mid, state: personState(p, vp) };
  }), [people, span, gap, vp]);
  const r = vp.reality;
  const shown = people.find((p) => p.id === focus);

  return (
    <div className="kal">
      <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} role="group" aria-label={`Kaleidoscope: what each person holds about “${vp.text}”, around Reality`}>
        <defs>
          {slices.map(({ p }) => <clipPath key={p.id} id={`${uid}-${p.id}`}><circle r="21" cx="0" cy="0" /></clipPath>)}
        </defs>
        {/* connectors: each point of view faces the same proposition */}
        {slices.map(({ p, mid, state }) => (
          <line key={"l" + p.id} x1={c + rC * Math.cos(mid)} y1={c + rC * Math.sin(mid)} x2={c + rIn * Math.cos(mid)} y2={c + rIn * Math.sin(mid)}
            stroke={state === "conflict" ? "var(--red)" : state === "silent" ? "var(--line)" : "var(--ink)"} strokeWidth={state === "conflict" ? 3 : 1.5} strokeDasharray={state === "silent" ? "3 3" : undefined} />
        ))}
        {slices.map(({ p, a0, a1, mid, state }, i) => {
          const rp = (rIn + rOut) / 2 + 4;
          const px = c + rp * Math.cos(mid), py = c + rp * Math.sin(mid) - 12;
          const face = portraitUrl(meta, p.id, "face");
          const icons = p.stances.slice(0, 3);
          const lx = c + (rOut + 12) * Math.cos(mid), ly = c + (rOut + 12) * Math.sin(mid);
          const anchor = Math.abs(Math.cos(mid)) < 0.25 ? "middle" : Math.cos(mid) > 0 ? "start" : "end";
          const label = `${p.name}${p.alias ? ` (alias “${p.alias}”)` : ""}: ${state === "silent" ? "silent" : p.stances.map((s) => VERB[s.verb][s.polarity]).join(", ")}${p.diagnoses.length ? " — " + p.diagnoses.map((d) => DIAG[d].label).join(", ") : ""}`;
          return (
            <g key={p.id} className="slice" style={{ ["--i" as any]: i }} tabIndex={0} role="button" aria-pressed={pinned === p.id} aria-label={label}
              onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}
              onClick={() => setPinned(pinned === p.id ? null : p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPinned(pinned === p.id ? null : p.id); } }}>
              <title>{label}</title>
              <path className="wedge" d={arc(c, c, rIn, rOut, a0, a1)}
                fill={state === "conflict" ? "var(--red-soft)" : state === "silent" ? "var(--bg)" : "var(--paper)"}
                stroke={state === "conflict" ? "var(--red)" : state === "silent" ? "var(--line)" : "var(--ink)"}
                strokeWidth={focus === p.id ? 3 : state === "conflict" ? 2 : 1.4} strokeDasharray={state === "silent" ? "4 3" : undefined} />
              <g transform={`translate(${px} ${py})`} opacity={state === "silent" ? 0.45 : 1}>
                <circle r="22" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
                {face ? <image href={face} x="-21" y="-21" width="42" height="42" clipPath={`url(#${uid}-${p.id})`} preserveAspectRatio="xMidYMid slice" />
                  : <text y="5" textAnchor="middle" fontFamily="var(--f-display)" fontWeight="800" fontSize="15" fill="var(--ink)">{MONO[p.id] ?? p.short.slice(0, 2)}</text>}
              </g>
              {icons.map((s, k) => (
                <svg key={k} x={px - (icons.length * 27) / 2 + k * 27 + 1} y={py + 25} width="26" height="26" overflow="visible">
                  <VerbIcon verb={s.verb} polarity={s.polarity} size={26} />
                </svg>
              ))}
              {state === "silent" && <text x={px} y={py + 40} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--f-ui)">silent</text>}
              {(() => {
                // label block: name, alias, diagnosis pills — stacked outwards from the ring
                const up = Math.sin(mid) < -0.25, side = Math.abs(Math.sin(mid)) <= 0.25;
                const rows: { kind: "name" | "alias" | "pill"; text: string }[] = [{ kind: "name", text: p.short }];
                if (p.alias) rows.push({ kind: "alias", text: `alias ${p.alias.split(" ")[0]}` });
                p.diagnoses.slice(0, 2).forEach((d) => rows.push({ kind: "pill", text: DIAG[d].label.toUpperCase() }));
                const h = (r: { kind: string }) => (r.kind === "pill" ? 20 : r.kind === "alias" ? 14 : 16);
                const total = rows.reduce((t, r) => t + h(r), 0);
                // the block reads top-down (name, alias, verdict) and sits outside the ring
                let y = side ? ly - total / 2 + 12 : up ? ly - total + 12 : ly + 14;
                const out: React.ReactNode[] = [];
                rows.forEach((row, k) => {
                  const fill = state === "conflict" ? "var(--red)" : state === "silent" ? "var(--muted)" : "var(--ink)";
                  if (row.kind === "pill") {
                    const w = row.text.length * 7 + 14, x0 = anchor === "middle" ? -w / 2 : anchor === "start" ? 0 : -w;
                    out.push(<g key={k} transform={`translate(${lx} ${y - 10})`}><rect x={x0} y="0" width={w} height="16" rx="3" fill="var(--red)" /><text x={x0 + w / 2} y="11.6" textAnchor="middle" fontFamily="var(--f-display)" fontWeight="700" fontSize="11" letterSpacing=".06em" fill="var(--on-red)">{row.text}</text></g>);
                  } else {
                    out.push(<text key={k} x={lx} y={y} textAnchor={anchor} fontFamily={row.kind === "name" ? "var(--f-display)" : "var(--f-ui)"} fontWeight={row.kind === "name" ? 700 : 400}
                      fontSize={row.kind === "name" ? 14 : 11} letterSpacing={row.kind === "name" ? ".05em" : 0} fill={row.kind === "alias" ? "var(--muted)" : fill}>{row.kind === "name" ? row.text.toUpperCase() : row.text}</text>);
                  }
                  y += h(row);
                });
                return out;
              })()}
            </g>
          );
        })}
        {/* Reality, in the centre */}
        <g role="img" aria-label={`Reality: ${REALITY[r.value].label}`} onMouseEnter={() => setHover(null)}>
          <circle cx={c} cy={c} r={rC} fill="var(--yellow)" stroke="#141414" strokeWidth="3" />
          <circle cx={c} cy={c} r={rC - 6} fill="none" stroke="#141414" strokeWidth="1" />
          <text x={c} y={c - rC * 0.5} textAnchor="middle" fontFamily="var(--f-display)" fontWeight="800" fontSize="11" letterSpacing=".14em" fill="#141414">REALITY</text>
          {/* Reality's value: the same medallion as everywhere (black ✓ true · red ✕ false · dashed ✕ false if… · ? not said) */}
          <svg x={c - rC * 0.4} y={c - rC * 0.4} width={rC * 0.8} height={rC * 0.8} overflow="visible"><RealityDisc value={r.value} size={rC * 0.8} /></svg>
          <text x={c} y={c + rC * 0.66} textAnchor="middle" fontFamily="var(--f-display)" fontWeight="700" fontSize="11.5" letterSpacing=".06em" fill="#141414">{REALITY[r.value].short.toUpperCase()}</text>
        </g>
      </svg>
      {!compact && <div className="kal-detail" aria-live="polite">
        {shown ? <PersonDetail p={shown} vp={vp} /> : (
          <div className="small">
            <strong>Reality: {REALITY[r.value].label.toLowerCase()}</strong>{r.value !== "unknown" && <> — {r.how}</>}.
            <span className="muted" title={r.dec}> Hover or tab to a person to see why.</span>
          </div>
        )}
      </div>}
      {!compact && <div className="kal-legend" aria-hidden="true">
        <span><svg width="14" height="14"><rect x="1" y="1" width="12" height="12" fill="var(--red-soft)" stroke="var(--red)" strokeWidth="2" /></svg> clashes with Reality</span>
        <span><svg width="14" height="14"><rect x="1" y="1" width="12" height="12" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" /></svg> agrees</span>
        <span><svg width="14" height="14"><rect x="1" y="1" width="12" height="12" fill="var(--bg)" stroke="var(--line)" strokeDasharray="3 2" strokeWidth="1.5" /></svg> silent</span>
      </div>}
    </div>
  );
}

export function PersonDetail({ p, vp }: { p: VPerson; vp: Viewpoint }) {
  return (
    <div className="holder">
      <Portrait id={p.id} size={40} name={p.name} />
      <div className="lines">
        <div className="line"><span className="name">{p.name}</span>{p.alias && <span className="small muted">also “{p.alias}”</span>}{p.diagnoses.map((d) => { const x = vp.diagnoses.find((y) => y.person === p.id && y.kind === d); return <TermBadge key={d} kind={d} text={x?.text} assumption={x?.assumption} size="small" />; })}</div>
        {p.stances.length === 0 && <div className="how">Says, believes and supposes nothing about this.</div>}
        {p.stances.map((s, i) => (
          <div key={i} className="line" title={`DEC: ${s.dec}`}>
            <VerbIcon verb={s.verb} polarity={s.polarity} size={18} />
            <span><strong>{VERB[s.verb][s.polarity]}</strong>{s.asName ? <> as “{s.asName}”</> : null}</span>
            <span className="how">— {s.how}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
