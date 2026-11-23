// The story bar: the whole text from p. 1 to the end on the x axis; a step line with the number of DEC's
// conclusions so far; red markers where a lie / delusion / honest mistake first becomes detectable; the stages of
// the story as dashed rules. Click, drag or use ←/→ to move from clue to clue. One series (no legend box: the
// title names it); hover crosshair + tooltip; the same values are listed in text on the page.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Checkpoint, TEvent, TStep } from "../api";
import { DIAG } from "../vocab";

type Props = {
  steps: TStep[]; order: Map<string, number>; nSentences: number; counts: number[]; total: number; events: TEvent[];
  current: number; onChange: (n: number) => void; cap: number | null; stages: Checkpoint[];
};

export function StoryBar({ steps, order, nSentences, counts, total, events, current, onChange, cap, stages }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(320, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 210, L = 36, R = 14, T = 56, B = 30, LANE = 26;   // stage labels at the top, verdict lane below them
  const x = (sid: string) => L + ((order.get(sid) ?? 0) / Math.max(1, nSentences - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / Math.max(1, total)) * (H - T - B);
  const lastN = cap ?? steps.at(-1)?.n ?? 1;
  const visible = steps.filter((s) => s.n <= lastN);
  const verdicts = useMemo(() => {
    const m = new Map<number, TEvent[]>();
    for (const e of events) if (e.kind === "verdict") m.set(e.step, [...(m.get(e.step) ?? []), e]);
    return m;
  }, [events]);
  const nearest = (px: number) => {
    let best = visible[0]?.n ?? 1, d = Infinity;
    for (const s of visible) { const dd = Math.abs(x(s.sid) - px); if (dd < d) { d = dd; best = s.n; } }
    return best;
  };
  const px = (e: React.PointerEvent) => e.clientX - (e.currentTarget as SVGElement).getBoundingClientRect().left;
  // step path
  let path = `M${L},${y(0)}`;
  visible.forEach((s, i) => { const xs = x(s.sid); path += ` L${xs},${y(i ? counts[visible[i - 1].n] : 0)} L${xs},${y(counts[s.n])}`; });
  const endX = cap ? x(visible.at(-1)!.sid) : W - R;
  path += ` L${endX},${y(counts[lastN] ?? 0)}`;
  const area = path + ` L${endX},${y(0)} Z`;
  const cur = steps.find((s) => s.n === current);
  const hv = hover != null ? steps.find((s) => s.n === hover) : null;
  const pages = useMemo(() => {
    const out: { page: number; sid: string }[] = [];
    for (const s of steps) if (!out.some((p) => p.page === s.page)) out.push({ page: s.page, sid: s.sid });
    return out;
  }, [steps]);

  return (
    <div ref={box} className="storybar">
      <svg width={W} height={H} role="slider" tabIndex={0} aria-label="Position in the story: clue"
        aria-valuemin={1} aria-valuemax={lastN} aria-valuenow={current}
        aria-valuetext={cur ? `Clue ${current}, page ${cur.page}: ${counts[current]} conclusions so far` : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(lastN, current + 1)); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(1, current - 1)); }
          if (e.key === "Home") { e.preventDefault(); onChange(1); }
          if (e.key === "End") { e.preventDefault(); onChange(lastN); }
        }}
        onPointerDown={(e) => { drag.current = true; (e.currentTarget as SVGElement).setPointerCapture(e.pointerId); onChange(nearest(px(e))); }}
        onPointerMove={(e) => { const n = nearest(px(e)); setHover(n); if (drag.current) onChange(n); }}
        onPointerUp={() => { drag.current = false; }} onPointerLeave={() => setHover(null)}>
        {/* stages of the story (a label only where there is room for it) */}
        {(() => {
          let lastLabel = -Infinity;
          return stages.filter((c) => c.id !== "G").map((c) => {
            const lastOfStage = [...order.keys()].filter((k) => Number(k.slice(1, 4)) <= Number(c.after.slice(1))).at(-1);
            if (!lastOfStage) return null;
            const xs = x(lastOfStage);
            const room = xs - lastLabel > c.label.length * 6.2 + 10 && xs - c.label.length * 6.2 > L;
            if (room) lastLabel = xs;
            return (
              <g key={c.id}>
                <line x1={xs} x2={xs} y1={8} y2={H - B} stroke="var(--line)" strokeDasharray="3 3" />
                {room && <text x={xs - 4} y={14} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--f-ui)">{c.label}</text>}
              </g>
            );
          });
        })()}
        {/* sealed region (reading without spoilers) */}
        {cap && <rect x={endX} y={8} width={W - R - endX} height={H - B - 8} fill="url(#sealed)" opacity=".6" />}
        <defs>
          <pattern id="sealed" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="var(--line)" strokeWidth="2" /></pattern>
        </defs>
        {/* recessive grid: 0 and the final total */}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--ink)" strokeWidth="1" />
        <line x1={L} x2={W - R} y1={y(total)} y2={y(total)} stroke="var(--line)" strokeDasharray="2 4" />
        <text x={L - 6} y={y(total) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--f-ui)">{total}</text>
        <text x={L - 6} y={y(0) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--f-ui)">0</text>
        {/* conclusions so far */}
        <path d={area} fill="var(--yellow-soft)" />
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
        {/* page ticks */}
        {pages.map((p) => (
          <g key={p.page}><line x1={x(p.sid)} x2={x(p.sid)} y1={y(0)} y2={y(0) + 5} stroke="var(--ink)" />
            <text x={x(p.sid)} y={y(0) + 18} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--f-ui)">p. {p.page}</text></g>
        ))}
        {/* verdicts that become detectable: one badge per clue (count), in their own lane, nudged apart */}
        {(() => {
          const items = [...verdicts.entries()].filter(([n]) => n <= lastN).sort((a, b) => a[0] - b[0]).map(([n, es]) => ({ n, es, s: steps.find((q) => q.n === n)!, cx: 0 }));
          let lastX = -Infinity;
          for (const it of items) { it.cx = Math.max(x(it.s.sid), lastX + 20); lastX = it.cx; }
          let maxX = W - R - 10;                       // keep the badges inside the chart: push back from the right edge
          for (let i = items.length - 1; i >= 0; i--) { items[i].cx = Math.min(items[i].cx, maxX); maxX = items[i].cx - 20; }
          return items.map(({ n, es, s, cx }) => {
            return (
              <g key={n} transform={`translate(${cx - 9} ${LANE})`} onPointerDown={(e) => { e.stopPropagation(); onChange(n); }} style={{ cursor: "pointer" }}>
                <title>{es.map((e) => `${DIAG[e.diagnosis!.kind].label}: ${e.diagnosis!.text} — “${e.text}”`).join("\n")}</title>
                <line x1="9" x2={x(s.sid) - cx + 9} y1="18" y2={T - LANE} stroke="var(--red)" strokeWidth="1" />
                <rect width="18" height="18" rx="4" fill="var(--red)" stroke="var(--paper)" strokeWidth="2" />
                <text x="9" y="13" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--on-red)" fontFamily="var(--f-display)">{es.length}</text>
              </g>
            );
          });
        })()}
        {/* hover crosshair */}
        {hv && hv.n !== current && <line x1={x(hv.sid)} x2={x(hv.sid)} y1={T - 4} y2={H - B} stroke="var(--muted)" strokeWidth="1" />}
        {/* current clue */}
        {cur && (
          <g>
            <line x1={x(cur.sid)} x2={x(cur.sid)} y1={T - 4} y2={H - B} stroke="var(--ink)" strokeWidth="2" />
            <circle cx={x(cur.sid)} cy={y(counts[current])} r="7" fill="var(--yellow)" stroke="#141414" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hv && (
        <div className="storybar-tip" style={{ left: Math.min(Math.max(x(hv.sid) - 90, 0), W - 190) }}>
          <strong>{counts[hv.n]} conclusions</strong>{(counts[hv.n] - (counts[hv.n - 1] ?? 0)) > 0 && <> (+{counts[hv.n] - (counts[hv.n - 1] ?? 0)})</>}
          <span className="muted"> · clue {hv.n} · p. {hv.page}</span>
          {(verdicts.get(hv.n) ?? []).map((e, i) => <div key={i} className="red">{DIAG[e.diagnosis!.kind].label}: {e.diagnosis!.personName}</div>)}
        </div>
      )}
    </div>
  );
}
