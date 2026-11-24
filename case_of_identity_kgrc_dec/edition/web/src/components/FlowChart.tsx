// The modal plot, "worlds over the clues" (from Valentina Pasqual's branch feature/reader-worlds-flow): one lane per person and kind of
// world (what Mary says, what Mary believes, what Holmes concludes...), one column per clue, in reading order.
// Black dots = what the knowledge graph holds (the text says it). Blue rings = what DEC infers; blue arrows = what flows
// into Reality (permeation of Holmes's accepted conclusion). Red = what is false: the verdict icon (lie, delusion, honest
// mistake, the same icons as everywhere in the edition) and a dashed line from Reality, which rules it out.
// A lane appears when its world first appears in the story; clues after `n` are faded, so the picture grows as the
// reader goes on. Each person is named once (with a small portrait), with one row per way of holding (says, believes…);
// people are told apart by alternating bands. Clicking a mark calls onPickItem with what is there (a proposition, a
// conclusion of DEC, a verdict); clicking elsewhere in a column calls onPick(n): the reader jumps to that clue.
import { useEffect, useId, useRef, useState } from "react";
import { useApi, type Timeline, type Viewpoint } from "../api";
import { DiagIcon, RealityDisc, VerbIcon } from "./Glyphs";
import { useApp } from "../state";
import { Portrait, portraitUrl } from "./Portrait";
import { DIAG, REALITY, VERB, type Verb } from "../vocab";

// Hosmer has a lane of his own, as in the Kaleidoscope table: what is said under the mask is filed under the mask
const PEOPLE = ["mary", "hosmer", "windibank", "watson", "holmes", "whatif"];
const VERBS = ["says", "believes", "concludes", "supposes"];
const LEFT = 172, GAP = 4;
export const RED = "var(--red)"; // falsehood: deception, illusion, sincere error
export const BLUE = "var(--dec-blue)"; // what DEC concludes

const person = (p?: string) => p ?? "";
export const laneOf = (c: { world: string; person?: string; verb?: string }) => (c.world === "reality" ? "reality" : `${person(c.person)}|${c.verb}`);

/** The verdict marker: the edition's own verdict icon (red bubble ✕ = lie, red cloud ✕ = delusion, red bubble ! =
 *  honest mistake) on a paper halo, centred on (x, y). */
function Shape({ kind, x, y, r = 6 }: { kind: "lie" | "delusion" | "mistake"; x: number; y: number; r?: number }) {
  const s = Math.round(r * 2.6);
  return (
    <g transform={`translate(${x - s / 2} ${y - s / 2})`}>
      <circle cx={s / 2} cy={s / 2} r={s / 2 + 1} fill="var(--paper)" />
      <DiagIcon kind={kind} size={s} />
    </g>
  );
}

/** `verdicts`: false where the verdict icons already appear elsewhere (the marks of the Reader, in the plot's head). */
export function FlowLegend({ verdicts = true }: { verdicts?: boolean }) {
  return (
    <div className="row small" style={{ gap: 16, flexWrap: "wrap" }} aria-label="Legend">
      <span className="row" style={{ gap: 5 }}><svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="var(--ink)" /></svg>in the text (graph)</span>
      <span className="row" style={{ gap: 5 }}><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke={BLUE} strokeWidth="2" /></svg>inferred by DEC</span>
      {verdicts && <>
        <span className="row" style={{ gap: 5 }}><DiagIcon kind="lie" size={15} />{DIAG.lie.label}</span>
        <span className="row" style={{ gap: 5 }}><DiagIcon kind="delusion" size={15} />{DIAG.delusion.label}</span>
        <span className="row" style={{ gap: 5 }}><DiagIcon kind="mistake" size={15} />{DIAG.mistake.label}</span>
      </>}
      <span className="row" style={{ gap: 5 }}><svg width="26" height="14"><line x1="13" y1="1" x2="13" y2="13" stroke={BLUE} strokeWidth="2" /><polygon points="9,9 13,14 17,9" fill={BLUE} /></svg>flows into Reality</span>
      <span className="row" style={{ gap: 5 }}><svg width="26" height="14"><line x1="13" y1="1" x2="13" y2="13" stroke={RED} strokeWidth="1.6" strokeDasharray="2 3" /></svg>Reality rules it out</span>
    </div>
  );
}

/** Where each diagnosed claim lives: lie/mistake in a "says" world, delusion in a "believes" world. */
export function diagnosesOf(tl: Timeline) {
  return tl.events.filter((e) => e.kind === "verdict" && e.diagnosis).map((e) => {
    const d = e.diagnosis!;
    const verb = d.kind === "delusion" ? "believes" : "says";
    const fits = (c: Timeline["claims"][number]) => c.verb === verb && (d.kind !== "lie" || c.person !== "mary") && (d.kind === "lie" || c.person === d.person);
    // the claim the verdict is about: the same proposition (a prefix match would confuse "the first journey… was an
    // actual journey" with "the first journey… was undertaken by James Windibank")
    const home = tl.claims.find((c) => fits(c) && c.text === e.text)
      ?? tl.claims.find((c) => fits(c) && (c.text.startsWith(e.text) || e.text.startsWith(c.text)));
    return { e, d, home };
  }).filter((x) => !!x.home) as { e: Timeline["events"][number]; d: NonNullable<Timeline["events"][number]["diagnosis"]>; home: Timeline["claims"][number] }[];
}

/** What a mark in the chart stands for: the reader opens it (a proposition of the clue's sentence, a conclusion of DEC,
 *  the proposition a verdict is about, or just the sentence for a line someone speaks). */
export type FlowItem = {
  step: number; text?: string; world?: string; kind: "verdict" | "claim" | "conclusion" | "speech"; label: string;
  /** for the hover card: a conclusion's rule, a verdict's kind and wording, the clue where a verdict becomes visible */
  rule?: string; accepted?: boolean; diag?: { kind: "lie" | "delusion" | "mistake"; text: string; person: string }; at?: number;
  /** a line spoken: the propositions of its sentence */
  texts?: string[];
};

export function FlowChart({ tl, n, row = 34, onPick, onPickItem, follow = false, fit = false }: {
  tl: Timeline; n: number; row?: number; onPick?: (n: number) => void; onPickItem?: (items: FlowItem[]) => void; follow?: boolean;
  /** stretch the columns to the width available (the docked timeline uses the whole width of the screen) */
  fit?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    if (!fit || !box.current) return;
    const el = box.current, ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  const cols = tl.cap ?? tl.final;
  const COL = Math.max(row < 24 ? 22 : 30, fit && avail ? Math.min(48, Math.floor((avail - LEFT - 12) / cols)) : 0);
  const dot = row < 24 ? 3 : 4, ring = row < 24 ? 5 : 6.5, TOP = row < 24 ? 28 : 36, pr = row < 20 ? 8 : 9;
  const uid = useId().replace(/:/g, "");
  const { meta, q } = useApp();
  // Reality's value and the verdicts of each proposition, for the hover card (same reading stage as the rest)
  const { data: km } = useApi<{ rows: Viewpoint[] }>(q("/api/knowledge"));
  const byText = new Map((km?.rows ?? []).map((r) => [r.text, r]));
  const [tip, setTip] = useState<string | null>(null);
  // What a character says is in the text itself: every clue sentence spoken by someone is a black dot in that person's "says"
  // lane; narration inside a paragraph credited to someone is not (st.spoken)
  const names = new Map(tl.claims.filter((c) => c.person).map((c) => [person(c.person), c.personName]));
  // Such a dot stands for the propositions of that sentence, not for its words (the words appear on the clue's number).
  const speech = tl.steps.filter((st) => PEOPLE.includes(st.speaker) && st.spoken !== false && (st.props?.length ?? 0) > 0)
    .map((st) => ({ step: st.n, world: "speech", worldTitle: "Speech", person: st.speaker, personName: names.get(st.speaker), verb: "says" as const, text: st.props![0], props: st.props! }));
  // the Reality lane holds what is true in the story, not the acts of saying or supposing (the people's lanes show those)
  const claims = [...tl.claims.filter((c) => c.world !== "reality" || c.content !== false), ...speech], story = tl.conclusions.filter((c) => c.cls === "story");
  const everyLane = [...new Set([...claims, ...story].map(laneOf))].sort((a, b) => {
    if (a === "reality" || b === "reality") return a === "reality" ? -1 : 1;
    const [pa, va] = a.split("|"), [pb, vb] = b.split("|");
    return (PEOPLE.indexOf(pa) - PEOPLE.indexOf(pb)) || (VERBS.indexOf(va) - VERBS.indexOf(vb));
  });
  // a lane appears when its world first appears in the story: before that the row is not there
  const startOf = (k: string) => (k === "reality" ? 1 : Math.min(...[...claims, ...story].filter((c) => laneOf(c) === k).map((c) => c.step)));
  const lanes = everyLane.filter((k) => startOf(k) <= n);
  const has = (k: string) => lanes.includes(k);
  // people as groups: the name once, then one row per way of holding; a small gap and a band tell people apart
  const who = (k: string) => k.split("|")[0];
  const groups: { id: string; lanes: string[] }[] = [];
  for (const k of lanes) { const g = groups.at(-1); if (g && g.id === who(k)) g.lanes.push(k); else groups.push({ id: who(k), lanes: [k] }); }
  const gi = (k: string) => groups.findIndex((g) => g.id === who(k));
  const y = (k: string) => TOP + lanes.indexOf(k) * row + Math.max(0, gi(k)) * GAP + row / 2;
  const x = (s: number) => LEFT + (s - 0.5) * COL;
  const nameOfPerson = (id: string) => (id === "reality" ? "Reality"
    : meta?.agents.find((a) => a.id === id)?.short ?? [...claims, ...story].find((c) => person(c.person) === id)?.personName ?? id);
  const verbOf = (k: string) => (k === "reality" ? "true in the story" : VERB[k.split("|")[1] as keyof typeof VERB]?.label ?? "");
  const laneLabel = (k: string) => (k === "reality" ? "Reality" : `${nameOfPerson(who(k))} ${verbOf(k)}`);
  // reading without spoilers, the chart stops at the last clue of the stage
  const H = TOP + lanes.length * row + Math.max(0, groups.length - 1) * GAP + 6, W = LEFT + cols * COL + 10;
  const diags = diagnosesOf(tl);
  // a verdict sits on its column. Verdicts of the same kind on the same lane and clue share one icon, with their number;
  // only different kinds on the same spot would spread sideways around the column.
  const spotKey = (i: number) => `${laneOf(diags[i].home)}@${diags[i].e.step}`;
  const kindsAt = new Map<string, string[]>();
  diags.forEach((d, i) => { const k = spotKey(i), ks = kindsAt.get(k) ?? []; if (!ks.includes(d.d.kind)) ks.push(d.d.kind); kindsAt.set(k, ks); });
  const dxOf = diags.map((d, i) => { const ks = kindsAt.get(spotKey(i))!; return ks.length < 2 ? 0 : (ks.indexOf(d.d.kind) - (ks.length - 1) / 2) * 11; });
  const countOf = diags.map((d, i) => diags.filter((x, j) => spotKey(j) === spotKey(i) && x.d.kind === d.d.kind).length);
  const firstOf = diags.map((d, i) => diags.findIndex((x, j) => spotKey(j) === spotKey(i) && x.d.kind === d.d.kind) === i);
  const o = (step: number) => (step > n ? 0.13 : 1);

  // what each mark stands for, gathered by place (lane × clue): one click target per place
  const spots = new Map<string, { lane: string; x: number; y: number; items: FlowItem[] }>();
  const add = (k: string, xs: number, ys: number, it: FlowItem) => {
    const key = `${k}@${Math.round(xs)}`;
    if (!spots.has(key)) spots.set(key, { lane: k, x: xs, y: ys, items: [] });
    spots.get(key)!.items.push(it);
  };
  for (const c of claims) if (has(laneOf(c))) add(laneOf(c), x(c.step), y(laneOf(c)), "props" in c
    ? { step: c.step, kind: "speech", text: c.props[0], texts: c.props, label: `${laneLabel(laneOf(c))}: ${c.props.join("; ")}` }
    : { step: c.step, kind: "claim", text: c.text, label: `${laneLabel(laneOf(c))}: ${c.text}` });
  for (const c of story) if (has(laneOf(c))) add(laneOf(c), x(c.step), y(laneOf(c)), { step: c.step, kind: "conclusion", text: c.text, world: c.world,
    rule: c.ruleText, accepted: c.kind === "accepted" && c.world === "reality",
    label: `DEC ${c.kind === "accepted" && c.world === "reality" ? "carries into Reality" : `infers (${laneLabel(laneOf(c))})`}: ${c.text}` });
  diags.forEach(({ e, d, home }, i) => { if (has(laneOf(home))) add(laneOf(home), x(e.step) + dxOf[i], y(laneOf(home)),
    { step: home.step, kind: "verdict", text: home.text, label: `${DIAG[d.kind].label} (${d.personName}): ${home.text}`,
      diag: { kind: d.kind, text: d.text, person: d.person }, at: e.step }); });

  // keep the clue the reader has reached in view
  useEffect(() => {
    if (!follow || !box.current) return;
    box.current.scrollTo({ left: Math.max(0, x(n) - box.current.clientWidth * 0.55), behavior: "smooth" });
  }, [n, follow]); // eslint-disable-line react-hooks/exhaustive-deps

  const tipSpot = tip ? spots.get(tip) : undefined;
  const tipClue = tip?.startsWith("clue@") ? tl.steps.find((s) => s.n === Number(tip.slice(5))) : undefined;
  const boxW = box.current?.clientWidth ?? W, scrollL = box.current?.scrollLeft ?? 0;
  return (
    <div className="flow-wrap">
    <div ref={box} style={{ overflowX: "auto" }} onScroll={() => tip && setTip(null)}>
      <svg width={W} height={H} role="img" aria-label="Points of view against the clues" style={{ display: "block", minWidth: W }}>
        <defs>
          {groups.map((g) => <clipPath key={g.id} id={`${uid}-${g.id}`}><circle r={pr - 1} cx="0" cy="0" /></clipPath>)}
        </defs>
        {/* a band per person: Reality in yellow, the others alternating with the paper */}
        {groups.map((g, i) => {
          const top = y(g.lanes[0]) - row / 2, h = g.lanes.length * row;
          return <rect key={"band" + g.id} x={0} y={top} width={W} height={h} fill={g.id === "reality" ? "var(--yellow-soft)" : i % 2 ? "var(--bg)" : "transparent"} />;
        })}
        {tl.steps.map((s) => (
          <g key={s.n}>
            <rect x={x(s.n) - COL / 2} y={0} width={COL} height={H} fill={s.n === n ? "var(--yellow)" : "transparent"} opacity={s.n === n ? 0.4 : 1} />
            <text x={x(s.n)} y={TOP - 16} textAnchor="middle" fontSize="11" fontWeight={s.n === n ? 800 : 500} fill="var(--ink)" fontFamily="var(--f-display)" opacity={s.n > n ? 0.4 : 1}>{s.n}</text>
            <text x={x(s.n)} y={TOP - 5} textAnchor="middle" fontSize="8" fill="var(--muted)" opacity={s.n > n ? 0.4 : 1}>p{s.page}</text>
          </g>
        ))}
        {/* a column = a clue = a sentence in the text (under the marks, which have click targets of their own) */}
        {tl.steps.map((s) => (
          <rect key={"hit" + s.n} x={x(s.n) - COL / 2} y={0} width={COL} height={H} fill="transparent" onClick={() => onPick?.(s.n)} style={{ cursor: onPick ? "pointer" : "default" }} />
        ))}
        {/* the clue's number: hovering it shows the words of the text */}
        {tl.steps.map((s) => (
          <rect key={"head" + s.n} x={x(s.n) - COL / 2} y={0} width={COL} height={TOP - 1} fill="transparent" className="flow-head"
            onMouseEnter={() => setTip(`clue@${s.n}`)} onMouseLeave={() => setTip((t) => (t === `clue@${s.n}` ? null : t))}
            onClick={() => onPick?.(s.n)} style={{ cursor: onPick ? "pointer" : "default" }} />
        ))}
        <g pointerEvents="none">
          {/* names: once per person, with a small portrait; then one row per way of holding */}
          {groups.map((g) => {
            const mid = (y(g.lanes[0]) + y(g.lanes.at(-1)!)) / 2;
            const face = g.id !== "reality" ? portraitUrl(meta, g.id, "face") : undefined;
            return (
              <g key={"name" + g.id}>
                {g.id === "reality"
                  ? <circle cx={14} cy={mid} r={7} fill="var(--yellow)" stroke="#141414" strokeWidth="1.5" />
                  : face
                    ? <g transform={`translate(14 ${mid})`}><circle r={pr} fill="var(--paper)" stroke="var(--ink)" strokeWidth="1" /><image href={face} x={1 - pr} y={1 - pr} width={2 * pr - 2} height={2 * pr - 2} clipPath={`url(#${uid}-${g.id})`} /></g>
                    : <circle cx={14} cy={mid} r={8} fill="var(--paper)" stroke="var(--ink)" strokeWidth="1" />}
                <text x={28} y={mid + 4} fontSize="11.5" fontWeight="700" fill="var(--ink)" fontFamily="var(--f-ui)">{nameOfPerson(g.id)}</text>
              </g>
            );
          })}
          {lanes.map((k) => {
            const from = startOf(k);
            return (
              <g key={k}>
                <text x={LEFT - 10} y={y(k) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--muted)" fontFamily="var(--f-ui)">{verbOf(k)}</text>
                <line x1={LEFT} x2={W - 6} y1={y(k)} y2={y(k)} stroke="var(--line)" />
                {k !== "reality" && <line x1={x(from)} x2={x(Math.max(from, n))} y1={y(k)} y2={y(k)} stroke="var(--ink)" strokeWidth="1.5" opacity=".4" />}
              </g>
            );
          })}
          {diags.filter(({ home }) => has(laneOf(home))).map(({ e, home }, i) => (
            <g key={"d" + i} opacity={o(e.step)}>
              <line x1={x(home.step)} x2={x(e.step)} y1={y(laneOf(home))} y2={y(laneOf(home))} stroke={RED} strokeWidth="3" opacity=".55" />
              <line x1={x(e.step)} x2={x(e.step)} y1={y("reality") + 8} y2={y(laneOf(home))} stroke={RED} strokeWidth="1.6" strokeDasharray="2 3" />
            </g>
          ))}
          {story.filter((c) => c.kind === "accepted" && has("holmes|concludes")).map((c) => (
            <g key={c.id} opacity={o(c.step)}>
              <line x1={x(c.step)} x2={x(c.step)} y1={y("holmes|concludes")} y2={y("reality") + 9} stroke={BLUE} strokeWidth="2" opacity=".6" />
              <polygon points={`${x(c.step) - 4},${y("reality") + 12} ${x(c.step)},${y("reality") + 6} ${x(c.step) + 4},${y("reality") + 12}`} fill={BLUE} />
            </g>
          ))}
          {claims.filter((c) => has(laneOf(c))).map((c, i) => <circle key={"k" + i} cx={x(c.step)} cy={y(laneOf(c))} r={c.world === "reality" ? 2.5 : dot} fill="var(--ink)" opacity={o(c.step)} />)}
          {story.filter((c) => has(laneOf(c)) && (c.kind !== "accepted" || c.world !== "reality")).map((c) => <circle key={c.id} cx={x(c.step)} cy={y(laneOf(c))} r={c.world === "reality" ? 3.5 : ring} fill="none" stroke={BLUE} strokeWidth="2" opacity={o(c.step)} />)}
          {story.filter((c) => c.kind === "accepted" && c.world === "reality").map((c) => <circle key={c.id} cx={x(c.step)} cy={y("reality")} r={4.5} fill={BLUE} opacity={o(c.step)} />)}
          {diags.map(({ e, d, home }, i) => has(laneOf(home)) && firstOf[i] && (
            <g key={"s" + i} opacity={o(e.step)}>
              <Shape kind={d.kind} x={x(e.step) + dxOf[i]} y={y(laneOf(home))} r={row < 24 ? 4.5 : 6} />
              {countOf[i] > 1 && <text x={x(e.step) + dxOf[i] + 8} y={y(laneOf(home)) - 4} fontSize="9" fontWeight="800" fill={RED} fontFamily="var(--f-ui)" stroke="var(--paper)" strokeWidth="2.5" paintOrder="stroke">{countOf[i]}</text>}
            </g>
          ))}
        </g>
        {/* one click target per mark: it opens what the mark stands for */}
        {[...spots.entries()].map(([key, sp]) => {
          const open = () => { if (onPickItem) onPickItem(sp.items); else onPick?.(sp.items[0].step); };
          return (
            <circle key={key} className={`flow-spot ${tip === key ? "on" : ""}`} cx={sp.x} cy={sp.y} r={Math.min(10, COL / 2 - 1)} fill="transparent"
              tabIndex={0} role="button" aria-label={sp.items.map((it) => it.label).join("; ")}
              onMouseEnter={() => setTip(key)} onMouseLeave={() => setTip((t) => (t === key ? null : t))}
              onFocus={() => setTip(key)} onBlur={() => setTip((t) => (t === key ? null : t))}
              onClick={(e) => { e.stopPropagation(); open(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }} />
          );
        })}
      </svg>
    </div>
    {tipClue && (() => {
      const cx = Math.min(Math.max(x(tipClue.n) - scrollL, 170), boxW - 170);
      const who = meta?.agents.find((a) => a.id === tipClue.speaker);
      return (
        <div className="flow-tip" style={{ left: cx, top: 4, ["--arrow" as any]: `${x(tipClue.n) - scrollL - cx}px` }} role="tooltip">
          <div className="ft-head">
            {who ? <Portrait id={who.id} size={20} name={who.name} /> : null}
            <strong>{who ? who.short : "Narration"}</strong>
            <span className="ft-clue">clue {tipClue.n} · p. {tipClue.page}</span>
          </div>
          <p className="ft-words">{tipClue.text}</p>
          <div className="ft-hint">Click to find it in the text</div>
        </div>
      );
    })()}
    {tipSpot && (
      <FlowTip lane={tipSpot.lane} items={tipSpot.items} tl={tl} byText={byText} name={nameOfPerson(who(tipSpot.lane))}
        left={Math.min(Math.max(tipSpot.x - scrollL, 170), boxW - 170)} arrow={tipSpot.x - scrollL - Math.min(Math.max(tipSpot.x - scrollL, 170), boxW - 170)} top={tipSpot.y - 12} />
    )}
    </div>
  );
}

/** The card shown on a mark: who holds it and how, the clue, then each thing on that spot: the proposition with its value
 *  in Reality and its verdicts, a line spoken, a conclusion of DEC with its rule, a verdict and when it shows. */
function FlowTip({ lane, items, tl, byText, name, left, arrow, top }: {
  lane: string; items: FlowItem[]; tl: Timeline; byText: Map<string, Viewpoint>; name: string; left: number; arrow: number; top: number;
}) {
  const [pid, verb] = lane.split("|") as [string, Verb | undefined];
  const st = tl.steps.find((s) => s.n === items[0].step);
  const order = ["verdict", "claim", "speech", "conclusion"];
  const all = [...items].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const sorted = all.slice(0, 3), more = all.length - sorted.length;
  return (
    <div className="flow-tip" style={{ left, top, ["--arrow" as any]: `${arrow}px` }} role="tooltip">
      <div className="ft-head">
        {pid === "reality" ? <RealityDisc size={18} /> : <Portrait id={pid} size={20} name={name} />}
        <strong>{name}</strong>
        <span className="muted">{pid === "reality" ? "true in the story" : verb ? VERB[verb].label : ""}</span>
        {st && <span className="ft-clue">clue {st.n} · p. {st.page}</span>}
      </div>
      {sorted.map((it, i) => {
        const row = it.text ? byText.get(it.text) : undefined;
        if (it.kind === "speech") return (
          <div key={i} className="ft-item">
            <VerbIcon verb="says" size={16} />
            <span>
              <span className="ft-sub">in this line:</span>
              {(it.texts ?? []).slice(0, 3).map((t, k) => {
                const r = byText.get(t);
                return <span key={k} className="ft-prop">{t}{r && <span className="ft-meta"><RealityDisc value={r.reality.value} size={13} /> Reality: {REALITY[r.reality.value].short.toLowerCase()}</span>}</span>;
              })}
              {(it.texts?.length ?? 0) > 3 && <span className="ft-sub">…and {it.texts!.length - 3} more</span>}
            </span>
          </div>
        );
        if (it.kind === "verdict" && it.diag) return (
          <div key={i} className="ft-item ft-verdict">
            <DiagIcon kind={it.diag.kind} size={16} />
            <span><strong className="red">{DIAG[it.diag.kind].label}</strong>: {it.diag.text}.<span className="ft-sub"> “{it.text}” · visible from clue {it.at}</span></span>
          </div>
        );
        if (it.kind === "conclusion") return (
          <div key={i} className="ft-item">
            <span className="ft-dec" aria-hidden="true">⚙</span>
            <span><span className="ft-sub">{it.accepted ? "DEC carries it into Reality" : "DEC infers it"}</span><br />{it.text}{it.rule && <span className="ft-sub"><br />because {it.rule}</span>}</span>
          </div>
        );
        return (
          <div key={i} className="ft-item">
            {pid === "reality" ? <span className="ft-dot" /> : verb ? <VerbIcon verb={verb} size={16} /> : null}
            <span>
              {it.text}
              {row && pid !== "reality" && (
                <span className="ft-meta"><RealityDisc value={row.reality.value} size={13} /> Reality: {REALITY[row.reality.value].short.toLowerCase()}
                  {row.diagnoses.filter((d) => d.person === pid || (pid === "hosmer" && d.person === "windibank")).map((d, k) => <span key={k} className="ft-diag"><DiagIcon kind={d.kind} size={13} /> {DIAG[d.kind].label}</span>)}
                </span>
              )}
            </span>
          </div>
        );
      })}
      {more > 0 && <div className="ft-sub" style={{ paddingTop: 3 }}>…and {more} more here</div>}
      <div className="ft-hint">Click to open in the text</div>
    </div>
  );
}
