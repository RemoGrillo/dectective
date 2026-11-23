// Worlds over the clues: one lane per person and kind of world (what Mary says, what Mary believes, what Holmes concludes...),
// one column per clue, in reading order. Black = what the knowledge graph holds (the text says it). Red = what DEC adds
// (inferences, verdicts), with a shape per kind of gap. Clues after `n` are faded, so the picture grows as the reader goes on.
// Clicking a column calls onPick(n): the reader jumps to that clue in the text.
import { useEffect, useRef } from "react";
import type { Timeline } from "../api";
import { DIAG, VERB } from "../vocab";

const PEOPLE = ["mary", "windibank", "watson", "holmes", "whatif"];
const VERBS = ["says", "believes", "concludes", "supposes"];
const LEFT = 150, TOP = 36;
export const RED = "var(--red)"; // falsehood: deception, illusion, sincere error
export const BLUE = "var(--dec-blue)"; // what DEC concludes

const person = (p?: string) => (p === "hosmer" ? "windibank" : p ?? "");
export const laneOf = (c: { world: string; person?: string; verb?: string }) => (c.world === "reality" ? "reality" : `${person(c.person)}|${c.verb}`);

/** Marker shape per kind of gap: Deception = triangle, Illusion = diamond, Sincere error = square. */
function Shape({ kind, x, y, r = 6 }: { kind: "lie" | "delusion" | "mistake"; x: number; y: number; r?: number }) {
  const common = { fill: RED, stroke: "var(--paper)", strokeWidth: 1.2 };
  if (kind === "lie") return <polygon {...common} points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`} />;
  if (kind === "delusion") return <polygon {...common} points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} />;
  return <rect {...common} x={x - r} y={y - r} width={2 * r} height={2 * r} />;
}

export function FlowLegend() {
  return (
    <div className="row small" style={{ gap: 16, flexWrap: "wrap" }} aria-label="Legend">
      <span className="row" style={{ gap: 5 }}><svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="var(--ink)" /></svg>in the text (graph)</span>
      <span className="row" style={{ gap: 5 }}><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke={BLUE} strokeWidth="2" /></svg>inferred by DEC</span>
      <span className="row" style={{ gap: 5 }}><svg width="16" height="14"><Shape kind="lie" x={8} y={8} r={5} /></svg>{DIAG.lie.label}</span>
      <span className="row" style={{ gap: 5 }}><svg width="16" height="14"><Shape kind="delusion" x={8} y={7} r={5} /></svg>{DIAG.delusion.label}</span>
      <span className="row" style={{ gap: 5 }}><svg width="16" height="14"><Shape kind="mistake" x={8} y={7} r={4.5} /></svg>{DIAG.mistake.label}</span>
      <span className="row" style={{ gap: 5 }}><svg width="26" height="14"><line x1="13" y1="1" x2="13" y2="13" stroke={BLUE} strokeWidth="2" /><polygon points="9,9 13,14 17,9" fill={BLUE} /></svg>flows into Reality</span>
      <span className="row" style={{ gap: 5 }}><svg width="26" height="14"><line x1="13" y1="1" x2="13" y2="13" stroke={RED} strokeWidth="1.6" strokeDasharray="2 3" /></svg>Reality rules it out</span>
    </div>
  );
}

/** Where each diagnosed claim lives: lie/mistake in a "says" world, illusion in a "believes" world. */
export function diagnosesOf(tl: Timeline) {
  return tl.events.filter((e) => e.kind === "verdict" && e.diagnosis).map((e) => {
    const d = e.diagnosis!;
    const verb = d.kind === "delusion" ? "believes" : "says";
    const home = tl.claims.find((c) => c.verb === verb && (c.text.startsWith(e.text.slice(0, 40)) || e.text.startsWith(c.text.slice(0, 40)))
      && (d.kind !== "lie" || c.person !== "mary") && (d.kind === "lie" || c.person === d.person));
    return { e, d, home };
  }).filter((x) => !!x.home) as { e: Timeline["events"][number]; d: NonNullable<Timeline["events"][number]["diagnosis"]>; home: Timeline["claims"][number] }[];
}

export function FlowChart({ tl, n, row = 34, onPick, follow = false }: { tl: Timeline; n: number; row?: number; onPick?: (n: number) => void; follow?: boolean }) {
  const COL = row < 24 ? 24 : 30, dot = row < 24 ? 3 : 4, ring = row < 24 ? 5 : 6.5;
  const box = useRef<HTMLDivElement>(null);
  // What a character says is in the text itself: every clue sentence spoken by someone is a black dot in that person's "says" lane.
  const names = new Map(tl.claims.filter((c) => c.person).map((c) => [person(c.person), c.personName]));
  const speech = tl.steps.filter((st) => PEOPLE.includes(st.speaker)).map((st) => ({ step: st.n, world: "speech", worldTitle: "Speech", person: st.speaker, personName: names.get(st.speaker), verb: "says" as const, text: st.text }));
  const claims = [...tl.claims, ...speech], story = tl.conclusions.filter((c) => c.cls === "story");
  const lanes = [...new Set([...claims, ...story].map(laneOf))].sort((a, b) => {
    if (a === "reality" || b === "reality") return a === "reality" ? -1 : 1;
    const [pa, va] = a.split("|"), [pb, vb] = b.split("|");
    return (PEOPLE.indexOf(pa) - PEOPLE.indexOf(pb)) || (VERBS.indexOf(va) - VERBS.indexOf(vb));
  });
  const y = (k: string) => TOP + lanes.indexOf(k) * row + row / 2;
  const x = (s: number) => LEFT + (s - 0.5) * COL;
  const nameOf = (k: string) => (k === "reality" ? "Reality" : [...claims, ...story].find((c) => laneOf(c) === k)?.personName ?? k.split("|")[0]);
  const verbOf = (k: string) => (k === "reality" ? "true in the story" : VERB[k.split("|")[1] as keyof typeof VERB]?.label ?? "");
  const H = TOP + lanes.length * row + 8, W = LEFT + tl.final * COL + 10;
  const diags = diagnosesOf(tl);
  const o = (step: number) => (step > n ? 0.13 : 1);

  // keep the clue the reader has reached in view
  useEffect(() => {
    if (!follow || !box.current) return;
    box.current.scrollTo({ left: Math.max(0, x(n) - box.current.clientWidth * 0.55), behavior: "smooth" });
  }, [n, follow]);

  return (
    <div ref={box} style={{ overflowX: "auto" }}>
      <svg width={W} height={H} role="img" aria-label="Points of view against the clues" style={{ display: "block", minWidth: W }}>
        <rect x={0} y={TOP} width={W} height={row} fill="var(--yellow-soft)" />
        {tl.steps.map((s) => (
          <g key={s.n}>
            <rect x={x(s.n) - COL / 2} y={0} width={COL} height={H} fill={s.n === n ? "var(--yellow)" : "transparent"} opacity={s.n === n ? 0.4 : 1} />
            <text x={x(s.n)} y={13} textAnchor="middle" fontSize="11" fontWeight={s.n === n ? 800 : 500} fill="var(--ink)" fontFamily="var(--f-display)" opacity={s.n > n ? 0.4 : 1}>{s.n}</text>
            <text x={x(s.n)} y={26} textAnchor="middle" fontSize="8" fill="var(--muted)" opacity={s.n > n ? 0.4 : 1}>p{s.page}</text>
          </g>
        ))}
        {lanes.map((k, i) => {
          const steps = [...claims, ...story].filter((c) => laneOf(c) === k).map((c) => c.step);
          const from = k === "reality" ? 1 : Math.min(...steps);
          const newPerson = i > 0 && k.split("|")[0] !== lanes[i - 1].split("|")[0];
          return (
            <g key={k} opacity={from > n ? 0.35 : 1}>
              {newPerson && <line x1={0} x2={W} y1={y(k) - row / 2} y2={y(k) - row / 2} stroke="var(--ink)" strokeWidth="1" />}
              <line x1={LEFT} x2={W - 6} y1={y(k)} y2={y(k)} stroke="var(--line)" />
              {k !== "reality" && <line x1={x(from)} x2={x(Math.max(from, n))} y1={y(k)} y2={y(k)} stroke="var(--ink)" strokeWidth="1.5" opacity=".4" />}
              <text x={6} y={y(k) - 1} fontSize="11" fontWeight="700" fill="var(--ink)">{nameOf(k)}</text>
              <text x={6} y={y(k) + 9} fontSize="9" fill="var(--muted)">{verbOf(k)}</text>
            </g>
          );
        })}
        {diags.map(({ e, home }, i) => (
          <g key={"d" + i} opacity={o(e.step)}>
            <line x1={x(home.step)} x2={x(e.step)} y1={y(laneOf(home))} y2={y(laneOf(home))} stroke={RED} strokeWidth="3" opacity=".55" />
            <line x1={x(e.step)} x2={x(e.step)} y1={y("reality") + 8} y2={y(laneOf(home))} stroke={RED} strokeWidth="1.6" strokeDasharray="2 3" />
          </g>
        ))}
        {story.filter((c) => c.kind === "accepted").map((c) => (
          <g key={c.id} opacity={o(c.step)}>
            <line x1={x(c.step)} x2={x(c.step)} y1={y("holmes|concludes")} y2={y("reality") + 9} stroke={BLUE} strokeWidth="2" opacity=".6" />
            <polygon points={`${x(c.step) - 4},${y("reality") + 12} ${x(c.step)},${y("reality") + 6} ${x(c.step) + 4},${y("reality") + 12}`} fill={BLUE} />
          </g>
        ))}
        {claims.map((c, i) => <circle key={"k" + i} cx={x(c.step)} cy={y(laneOf(c))} r={c.world === "reality" ? 2 : dot} fill="var(--ink)" opacity={o(c.step)} />)}
        {story.filter((c) => c.kind !== "accepted" || c.world !== "reality").map((c) => <circle key={c.id} cx={x(c.step)} cy={y(laneOf(c))} r={c.world === "reality" ? 3.5 : ring} fill="none" stroke={BLUE} strokeWidth="2" opacity={o(c.step)} />)}
        {story.filter((c) => c.kind === "accepted" && c.world === "reality").map((c) => <circle key={c.id} cx={x(c.step)} cy={y("reality")} r={4.5} fill={BLUE} opacity={o(c.step)} />)}
        {diags.map(({ e, d, home }, i) => <g key={"s" + i} opacity={o(e.step)}><Shape kind={d.kind} x={x(e.step) + (i % 2 ? 4 : -4)} y={y(laneOf(home))} r={row < 24 ? 4.5 : 6} /></g>)}
        {/* click targets on top: a column = a clue = a sentence in the text */}
        {tl.steps.map((s) => (
          <rect key={"hit" + s.n} x={x(s.n) - COL / 2} y={0} width={COL} height={H} fill="transparent" onClick={() => onPick?.(s.n)} style={{ cursor: onPick ? "pointer" : "default" }}>
            <title>{`Clue ${s.n} · p. ${s.page}: ${s.text.slice(0, 90)}${s.text.length > 90 ? "…" : ""}${onPick ? " — click to go to it in the text" : ""}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
