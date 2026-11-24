// Worlds as a Venn (Euler) diagram. Reality is the yellow circle; every person has SEPARATE sets for what they say,
// believe, conclude and suppose. Every fact held by someone is a numbered dot placed in the zone of exactly the sets
// that hold it: inside Reality = true; outside, red = Reality rules it out; outside, grey = the story does not settle it.
// When what X says falls inside what Y believes, outside Reality, the overlap turns red: X deceives (or misleads) Y.
// Layout: area-proportional circles (venn.js, deterministic seed); dots placed by point-in-circle constraints.
import { useEffect, useMemo, useRef, useState } from "react";
import { computeTextCentres, intersectionAreaPath, normalizeSolution, scaleSolution, venn, type ICircle } from "@upsetjs/venn.js";
import { useApp } from "../state";
import { REALITY, VERB, type RealityValue, type Verb } from "../vocab";
import { TermBadge } from "./Term";
import { portraitUrl } from "./Portrait";

export type VSet = { id: string; kind: "reality" | Verb; person?: string; personName?: string; alias?: string; label: string; size: number; worlds: string[] };
export type VItem = { id: string; n: number; text: string; sid: string | null; reality: RealityValue; realityHow: string; sets: string[];
  diagnoses: { kind: "lie" | "delusion" | "mistake"; person: string; personName: string; text: string; assumption?: string }[] };
export type VLink = { from: string; to: string; kind: "deceives" | "misleads" | "tells"; items: string[]; byItem: Record<string, string> };
export type VClash = { item: string; other: string | null; text: string; assumption: boolean };
export type VennData = { mode: string; sets: VSet[]; items: VItem[]; links: VLink[]; clashes: VClash[] };

function seeded(seed = 11) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Area-proportional layout of the visible sets; Reality in the middle, Mary's beliefs to its left. */
function layout(sets: VSet[], items: VItem[], W: number, H: number): Record<string, ICircle> {
  const areas: { sets: string[]; size: number }[] = sets.map((s) => ({ sets: [s.id], size: Math.max(s.size, 0.6) }));
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
    const a = sets[i].id, b = sets[j].id;
    const n = items.filter((it) => it.sets.includes(a) && it.sets.includes(b)).length;
    if (n) areas.push({ sets: [a, b], size: n });
  }
  const rnd = Math.random;
  Math.random = seeded();
  let sol;
  try { sol = venn(areas); } finally { Math.random = rnd; }
  sol = normalizeSolution(sol, Math.PI / 2);
  // rotate around Reality so that Mary's beliefs (or the first person set) sit to its left
  const R = sol.reality;
  const ref = sol["mary:believes"] ?? Object.values(sol).find((c) => c.setid !== "reality");
  if (R && ref && dist(R, ref) > 1e-6) {
    const rot = Math.PI - Math.atan2(ref.y - R.y, ref.x - R.x);
    for (const c of Object.values(sol)) {
      const dx = c.x - R.x, dy = c.y - R.y;
      c.x = R.x + dx * Math.cos(rot) - dy * Math.sin(rot);
      c.y = R.y + dx * Math.sin(rot) + dy * Math.cos(rot);
    }
  }
  return scaleSolution(sol, W, H, 70) as Record<string, ICircle>;
}

/** Sets with exactly the same facts would be drawn as one circle: draw them as concentric rings (Reality outermost). */
const NEST_ORDER = ["reality", "believes", "concludes", "says", "supposes"];
function nestIdentical(circles: Record<string, ICircle>, sets: VSet[], items: VItem[]) {
  const sig = (id: string) => items.filter((i) => i.sets.includes(id)).map((i) => i.id).sort().join("|");
  const groups = new Map<string, VSet[]>();
  for (const s of sets) if (circles[s.id]) { const k = sig(s.id); if (k) groups.set(k, [...(groups.get(k) ?? []), s]); }
  const out = { ...circles };
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => NEST_ORDER.indexOf(a.kind) - NEST_ORDER.indexOf(b.kind));
    const c0 = circles[g[0].id];
    g.forEach((s, i) => { out[s.id] = { ...circles[s.id], x: c0.x, y: c0.y, radius: c0.radius * (1 - 0.13 * i) }; });
  }
  return out;
}

/** A position for each item inside exactly the circles of its signature (and apart from the other dots). */
function placeItems(items: VItem[], circles: Record<string, ICircle>, visible: Set<string>, obstacles: { x: number; y: number }[] = []) {
  const groups = new Map<string, VItem[]>();
  for (const it of items) {
    const sig = it.sets.filter((s) => visible.has(s));
    if (!sig.length) continue;
    const k = sig.join("|");
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  const centres = computeTextCentres(circles as any, [...groups.keys()].map((k) => ({ sets: k.split("|"), size: 1 })));
  const pos = new Map<string, { x: number; y: number }>();
  const placed: { x: number; y: number }[] = [];
  const all = Object.values(circles);
  for (const [k, list] of groups) {
    const sig = new Set(k.split("|"));
    const c0 = (centres as any)[k] ?? centres[k.split("|") as any] ?? { x: circles[[...sig][0]].x, y: circles[[...sig][0]].y };
    for (const it of list) {
      let best: { x: number; y: number } | null = null;
      for (const margin of [12, 6, 0]) {
        for (let i = 0; i < 900 && !best; i++) {
          const r = 11 * Math.sqrt(i), a = i * 2.39996;
          const p = { x: c0.x + r * Math.cos(a), y: c0.y + r * Math.sin(a) };
          const ok = all.every((c) => (sig.has(c.setid) ? dist(p, c) <= c.radius - margin : dist(p, c) >= c.radius + margin))
            && placed.every((q) => dist(p, q) >= 25) && obstacles.every((q) => dist(p, q) >= 15);
          if (ok) best = p;
        }
        if (best) break;
      }
      const p = best ?? { x: c0.x + (placed.length % 5) * 4, y: c0.y };
      pos.set(it.id, p);
      placed.push(p);
    }
  }
  return pos;
}

const STROKE: Record<string, { w: number; dash?: string; color: string }> = {
  reality: { w: 3, color: "#141414" },
  believes: { w: 2, color: "var(--ink)" },
  says: { w: 2, dash: "7 5", color: "var(--ink)" },
  concludes: { w: 3, color: "var(--ink)" },
  supposes: { w: 1.5, dash: "2 4", color: "var(--muted)" },
};

export function VennMap({ data, hidden, onSelect, selected, minWidth = 760, height, tipAction, hoverId, onHover, autoHeight }: {
  data: VennData; hidden: Set<string>; onSelect: (id: string | null) => void; selected: string | null; minWidth?: number; height?: number;
  /** extra content for the pinned tooltip of the selected point (e.g. a link to the same proposition elsewhere) */
  tipAction?: (id: string) => React.ReactNode;
  /** a point lit from outside (e.g. the table row under the pointer), and a callback when the pointer is on a point */
  hoverId?: string | null; onHover?: (id: string | null) => void;
  /** fit the height to the drawing (for a narrow column, where a fixed height leaves empty bands) */
  autoHeight?: boolean;
}) {
  const { meta } = useApp();
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  const [hover, setHover] = useState<string | null>(null);
  const [hoverSet, setHoverSet] = useState<string | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // below ~760 px the diagram keeps a readable size and scrolls sideways (the zone list repeats it in words)
    const ro = new ResizeObserver(() => setW(Math.max(minWidth, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [minWidth]);
  const sets = useMemo(() => data.sets.filter((s) => s.kind === "reality" || !hidden.has(s.id)), [data, hidden]);
  const visible = useMemo(() => new Set(sets.map((s) => s.id)), [sets]);
  // facts held by a visible set; facts true in Reality that nobody holds only appear when they come that way (focused maps)
  const items = useMemo(() => data.items.filter((it) => it.sets.some((s) => visible.has(s) && s !== "reality") || (it.sets.length === 1 && it.sets[0] === "reality")), [data, visible]);
  const H = useMemo(() => {
    if (height) return height;
    if (!autoHeight) return Math.round(Math.min(820, Math.max(620, W * 0.52)));
    // lay the circles out by width alone, then take the height they need (plus room for the labels)
    const c = Object.values(layout(sets, items, W, 4000));
    if (!c.length) return 420;
    const top = Math.min(...c.map((k) => k.y - k.radius)), bottom = Math.max(...c.map((k) => k.y + k.radius));
    return Math.round(Math.min(760, Math.max(380, bottom - top + 150)));
  }, [height, autoHeight, W, sets, items]);
  const circles = useMemo(() => nestIdentical(layout(sets, items, W, H), sets, items), [sets, items, W, H]);
  const R = circles.reality;
  const focusItem = hover ?? hoverId ?? selected;
  const focus = focusItem ? data.items.find((i) => i.id === focusItem) : null;
  const litSets = new Set(focus ? focus.sets : hoverSet ? [hoverSet] : []);
  const links = data.links.filter((l) => visible.has(l.from) && visible.has(l.to));

  // set labels written along each circle's own edge (Euler-diagram style): outside, on the side away from Reality;
  // circles that lie inside Reality carry their label inside, along the top of the circle
  const labels = useMemo(() => {
    const out: { s: VSet; d: string; px: number; py: number; flat?: { x: number; y: number }; pts: { x: number; y: number }[] }[] = [];
    const taken: { x: number; y: number }[] = [];       // points along the labels already placed (Reality's title first)
    if (R) for (let a = W < 560 ? -0.4 : -0.95; a <= (W < 560 ? 0.4 : 0.95); a += 0.05) taken.push({ x: R.x + (R.radius + 13) * Math.sin(a), y: R.y - (R.radius + 13) * Math.cos(a) });
    const all = Object.values(circles);
    const hit = (pts: { x: number; y: number }[]) => pts.some((p) => taken.some((q) => Math.abs(p.x - q.x) < 11 && Math.abs(p.y - q.y) < 13));
    // biggest first: they have the most room on their edge
    for (const s of [...sets].sort((x, y) => (circles[y.id]?.radius ?? 0) - (circles[x.id]?.radius ?? 0))) {
      const c = circles[s.id];
      if (!c || s.id === "reality") continue;
      const text = `${s.personName} ${VERB[s.kind as Verb]?.label ?? s.kind}`;
      const len = text.length * 6.9 + 6;
      // inside another circle (Reality or a person's set): label inside its own top edge
      const inside = all.some((o) => o.setid !== s.id && o.radius > c.radius && dist(c, o) + c.radius <= o.radius + 2);
      const above = !R || c.y <= R.y + R.radius * 0.35;   // roughly level with Reality or above it: label on top
      const cands = inside ? [-90, 90, -60, -120, 60, 120] : above ? [-90, -60, -120, 90, 60, 120] : [90, 60, 120, -90, -60, -120];
      let placed = false;
      for (const deg of cands) {
        const th = (deg * Math.PI) / 180;
        const bottom = Math.sin(th) > 0.15;
        // baseline radius: glyphs stand outward on top arcs, inward on bottom arcs
        const rr = inside ? (bottom ? c.radius - 6 : c.radius - 15) : bottom ? c.radius + 17 : c.radius + 6;
        const span = len / Math.max(rr, 1);
        if (span > Math.PI * 1.2) break;               // too small for an arc
        const gr = bottom ? rr - 5 : rr + 5;            // radius of the glyphs' middle
        const n = Math.ceil(len / 9) + 3;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < n; i++) {
          const q = th - span / 2 - 18 / rr + ((span + 18 / rr) * i) / (n - 1);
          pts.push({ x: c.x + gr * Math.cos(q), y: c.y + gr * Math.sin(q) });
        }
        if (hit(pts)) continue;
        const P = (q: number) => [c.x + rr * Math.cos(q), c.y + rr * Math.sin(q)];
        const [a0, a1] = bottom ? [th + span / 2, th - span / 2] : [th - span / 2, th + span / 2];
        const [x0, y0] = P(a0), [x1, y1] = P(a1);
        const d = `M${x0},${y0} A${rr},${rr} 0 0 ${bottom ? 0 : 1} ${x1},${y1}`;
        const pa = bottom ? a0 + 13 / rr : a0 - 13 / rr;
        const pr = bottom ? rr - 5 : rr + 4;
        out.push({ s, d, px: c.x + pr * Math.cos(pa) - 9, py: c.y + pr * Math.sin(pa) - 9, pts: [...pts, { x: c.x + pr * Math.cos(pa), y: c.y + pr * Math.sin(pa) }] });
        taken.push(...pts);
        placed = true;
        break;
      }
      if (!placed) {                                    // a flat label under (or, if taken, over) the circle
        let fy = c.y + c.radius + 20;
        const flatPts = (y: number) => Array.from({ length: Math.ceil(len / 9) + 3 }, (_, i) => ({ x: c.x - len / 2 - 14 + i * 9, y: y - 4 }));
        if (hit(flatPts(fy))) fy = c.y - c.radius - 10;
        out.push({ s, d: "", px: c.x - len / 2 - 12, py: fy - 13, flat: { x: c.x - len / 2 + 10, y: fy }, pts: flatPts(fy) });
        taken.push(...flatPts(fy));
      }
    }
    return out;
  }, [sets, circles, R]);

  // dots avoid the labels (and the Reality title); then the zone captions avoid dots and labels
  const labelPts = useMemo(() => {
    const out = labels.flatMap((l) => l.pts);
    if (R) for (let a = -0.9; a <= 0.9; a += 0.1) out.push({ x: R.x + (R.radius + 10) * Math.sin(a), y: R.y - (R.radius + 10) * Math.cos(a) });
    return out;
  }, [labels, R]);
  const pos = useMemo(() => placeItems(items, circles, visible, labelPts), [items, circles, visible, labelPts]);
  const zoneLabel = (l: VLink, w: number) => {
    const pts = l.items.map((id) => pos.get(id)).filter(Boolean) as { x: number; y: number }[];
    if (!pts.length) return null;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const top = Math.min(...pts.map((p) => p.y)), bot = Math.max(...pts.map((p) => p.y)), left = Math.min(...pts.map((p) => p.x)), right = Math.max(...pts.map((p) => p.x));
    const dots = [...pos.values()];
    const cands = [{ x: cx, y: top - 24 }, { x: cx, y: bot + 26 }, { x: left - w / 2 - 16, y: cy }, { x: right + w / 2 + 16, y: cy }, { x: cx, y: top - 48 }, { x: cx, y: bot + 50 }];
    const free = (c: { x: number; y: number }) => c.x - w / 2 > 4 && c.x + w / 2 < W - 4 && c.y > 14 && c.y < H - 14
      && dots.every((d) => Math.abs(d.x - c.x) > w / 2 + 11 || Math.abs(d.y - c.y) > 21)
      && labelPts.every((d) => Math.abs(d.x - c.x) > w / 2 + 4 || Math.abs(d.y - c.y) > 16);
    return cands.find(free) ?? cands[0];
  };
  // a red line with a zigzag in the middle between two facts that cannot both be true
  const clashPath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const L = dist(a, b) || 1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, nx = -uy, ny = ux;
    const P = (t: number, o = 0) => `${a.x + ux * t + nx * o},${a.y + uy * t + ny * o}`;
    const m = L / 2, z = Math.min(9, L / 6);
    return `M${P(12)} L${P(m - 2 * z)} L${P(m - z, 7)} L${P(m, -7)} L${P(m + z, 7)} L${P(m + 2 * z)} L${P(L - 12)}`;
  };
  const name = (id: string) => data.sets.find((s) => s.id === id)?.personName ?? id;

  return (
    <div ref={box} className="venn" onMouseLeave={() => { setHover(null); setHoverSet(null); }}>
      <svg width={W} height={H} role="img" aria-label="Venn diagram of what each person says, believes, concludes and supposes, against Reality. The same information is listed next to the diagram.">
        <defs>
          <mask id="outsideReality">
            <rect x="0" y="0" width={W} height={H} fill="white" />
            {R && <circle cx={R.x} cy={R.y} r={R.radius} fill="black" />}
          </mask>
          <pattern id="deceit" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="var(--red-soft)" /><line x1="0" y1="0" x2="0" y2="7" stroke="var(--red)" strokeWidth="1.4" opacity=".45" />
          </pattern>
          <clipPath id="vennface"><circle r="9" cx="9" cy="9" /></clipPath>
        </defs>
        {/* Reality */}
        {R && <circle cx={R.x} cy={R.y} r={R.radius} fill="var(--yellow)" fillOpacity={0.3} stroke="#141414" strokeWidth={3} />}
        {/* the person sets */}
        {sets.filter((s) => s.id !== "reality").sort((a, b) => b.size - a.size).map((s) => {
          const c = circles[s.id];
          if (!c) return null;
          const st = STROKE[s.kind];
          const dim = litSets.size > 0 && !litSets.has(s.id);
          return (
            <circle key={s.id} cx={c.x} cy={c.y} r={c.radius} fill={s.kind === "believes" ? "var(--paper)" : "none"} fillOpacity={s.kind === "believes" ? 0.35 : 0}
              stroke={st.color} strokeWidth={litSets.has(s.id) ? st.w + 2 : st.w} strokeDasharray={st.dash} opacity={dim ? 0.35 : 1}
              onMouseEnter={() => setHoverSet(s.id)} onMouseLeave={() => setHoverSet(null)} />
          );
        })}
        {/* what X says that Y believes, outside Reality */}
        {links.filter((l) => l.kind !== "tells").map((l) => (
          <path key={l.from + l.to} d={intersectionAreaPath([circles[l.from], circles[l.to]])} fill="url(#deceit)" stroke="var(--red)" strokeWidth="2" mask="url(#outsideReality)" pointerEvents="none" />
        ))}
        {links.filter((l) => l.kind === "tells").map((l) => (
          <path key={l.from + l.to} d={intersectionAreaPath([circles[l.from], circles[l.to]])} fill="var(--bg)" fillOpacity=".7" stroke="var(--muted)" strokeWidth="1" mask="url(#outsideReality)" pointerEvents="none" />
        ))}
        {/* clashes: facts that cannot both be true (always shown, emphasised for the focused fact) */}
        {data.clashes.filter((c) => c.other && pos.has(c.item) && pos.has(c.other)).map((c, i) => {
          const on = focus && (c.item === focus.id || c.other === focus.id);
          return (
            <path key={i} d={clashPath(pos.get(c.item)!, pos.get(c.other!)!)} fill="none" stroke="var(--red)" strokeWidth={on ? 2.6 : 1.4}
              strokeLinejoin="round" opacity={focus && !on ? 0.2 : on ? 1 : 0.65} strokeDasharray={c.assumption ? "6 4" : undefined} pointerEvents="none">
              <title>Cannot both be true</title>
            </path>
          );
        })}
        {/* the facts */}
        {items.map((it) => {
          const p = pos.get(it.id);
          if (!p) return null;
          const fill = it.reality === "true" ? "var(--ink)" : it.reality === "false" ? "var(--red)" : "var(--paper)";
          const stroke = it.reality === "true" ? "var(--ink)" : it.reality === "unknown" ? "var(--muted)" : "var(--red)";
          const txt = it.reality === "true" ? "var(--paper)" : it.reality === "false" ? "var(--on-red)" : it.reality === "false-if" ? "var(--red)" : "var(--ink)";
          const on = focusItem === it.id;
          return (
            <g key={it.id} transform={`translate(${p.x} ${p.y})`} className="vdot" tabIndex={0} role="button"
              aria-label={`${it.n}. ${it.text}. ${REALITY[it.reality].label}.`}
              onMouseEnter={() => { setHover(it.id); onHover?.(it.id); }} onMouseLeave={() => { setHover(null); onHover?.(null); }}
              onFocus={() => { setHover(it.id); onHover?.(it.id); }} onBlur={() => { setHover(null); onHover?.(null); }}
              onClick={() => onSelect(selected === it.id ? null : it.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(selected === it.id ? null : it.id); } }}>
              <circle r="14" fill="transparent" />
              <circle r={on ? 11 : 9.5} fill={fill} stroke={on ? "var(--yellow)" : stroke} strokeWidth={on ? 3 : 1.6} strokeDasharray={it.reality === "false-if" ? "3 2" : undefined} />
              <text y="3.6" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="var(--f-ui)" fill={txt}>{it.n}</text>
            </g>
          );
        })}
        {/* labels of the manipulation zones */}
        {links.filter((l) => l.kind !== "tells").map((l) => {
          const t = `${name(l.from)} ${l.kind} ${name(l.to)}`;
          const w = t.length * 7 + 16;
          const z = zoneLabel(l, w);
          if (!z) return null;
          return (
            <g key={"zl" + l.from + l.to} transform={`translate(${Math.min(Math.max(z.x - w / 2, 4), W - w - 4)} ${z.y - 10})`} pointerEvents="none">
              <rect width={w} height="20" rx="3" fill="var(--red)" />
              <text x={w / 2} y="14" textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="var(--f-display)" letterSpacing=".05em" fill="var(--on-red)">{t.toUpperCase()}</text>
            </g>
          );
        })}
        {/* set labels along the circles */}
        {R && <path id="arc-reality" d={`M${R.x - (R.radius + 8) * Math.sin(0.9)},${R.y - (R.radius + 8) * Math.cos(0.9)} A${R.radius + 8},${R.radius + 8} 0 0 1 ${R.x + (R.radius + 8) * Math.sin(0.9)},${R.y - (R.radius + 8) * Math.cos(0.9)}`} fill="none" />}
        {R && <text fontFamily="var(--f-display)" fontWeight="800" fontSize="14" letterSpacing=".14em" fill="var(--ink)"><textPath href="#arc-reality" startOffset="50%" textAnchor="middle">{W < 560 ? "REALITY" : "REALITY · TRUE IN THE STORY"}</textPath></text>}
        {labels.map(({ s, d, px, py, flat }) => {
          const face = s.person ? portraitUrl(meta, s.person, "face") : undefined;
          const text = `${s.personName} ${VERB[s.kind as Verb]?.label ?? s.kind}`;
          const id = `arc-${s.id.replace(":", "-")}`;
          const dim = litSets.size > 0 && !litSets.has(s.id);
          return (
            <g key={"l" + s.id} onMouseEnter={() => setHoverSet(s.id)} onMouseLeave={() => setHoverSet(null)} opacity={dim ? 0.4 : 1}>
              {d && <path id={id} d={d} fill="none" />}
              {d ? (
                <text fontSize="12.5" fontWeight="700" fontFamily="var(--f-ui)" fill={s.kind === "supposes" ? "var(--muted)" : "var(--ink)"} paintOrder="stroke" stroke="var(--paper)" strokeWidth="3.5" strokeLinejoin="round">
                  <textPath href={`#${id}`}>{text}</textPath>
                </text>
              ) : (
                <text x={flat!.x} y={flat!.y} fontSize="12.5" fontWeight="700" fontFamily="var(--f-ui)" fill="var(--ink)" paintOrder="stroke" stroke="var(--paper)" strokeWidth="3.5">{text}</text>
              )}
              {face ? <g transform={`translate(${px} ${py})`}><circle cx="9" cy="9" r="10" fill="var(--paper)" /><image href={face} width="18" height="18" clipPath="url(#vennface)" /></g> : null}
            </g>
          );
        })}
      </svg>
      {focus && (
        <div className={`venn-tip ${selected === focus.id ? "pinned" : ""}`} style={{ left: Math.min(Math.max((pos.get(focus.id)?.x ?? 0) - 140, 0), W - 290), top: (pos.get(focus.id)?.y ?? 0) + 16 }}>
          <strong>{focus.n}. {focus.text}</strong>
          <div className="small">{focus.sets.filter((s) => s !== "reality").map((s) => data.sets.find((x) => x.id === s)?.label).join(" · ")}</div>
          <div className={`small ${focus.reality === "true" ? "" : focus.reality === "unknown" ? "muted" : "red"}`}>Reality: {REALITY[focus.reality].short}</div>
          {focus.diagnoses.length > 0 && <div className="row" style={{ gap: 4, marginTop: 4 }}>{focus.diagnoses.map((d, i) => <TermBadge key={i} kind={d.kind} text={d.text} assumption={d.assumption} size="small" />)}</div>}
          {selected !== focus.id && focus.diagnoses.length > 0 && <div className="tiny muted" style={{ marginTop: 2 }}>Click the dot, then a badge, for an explanation.</div>}
          {selected === focus.id && tipAction && <div style={{ marginTop: 6 }}>{tipAction(focus.id)}</div>}
        </div>
      )}
    </div>
  );
}
