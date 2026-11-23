// "Deductions": what DEC can conclude at each clue of the story (data/timeline.json, from one DEC run per clue on the
// growing prefix of the gold model — scripts/run_edition_timeline.py; no conflict check).
// DEC's materialisation grows monotonically with the prefix (checked by the run script), so a triple holds in a
// world at clue k iff its first clue ≤ k, and a world rules p out at clue k iff one of p's (final) witnesses has
// first clue ≤ k. From these step statuses the edition's usual rules give Reality's value and the verdicts
// (lie / delusion / honest mistake) clue by clue.
import { readFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR, NS, type Mode } from "./config.ts";
import { agentByIri, catalog, sentences, worldsIn } from "./data.ts";
import { label, plain, renderTriple, type Part } from "./render.ts";
import { n3, parseN3, type TermJSON } from "./store.ts";
import { derivationHints, type Hint } from "./rules/derivation.ts";
import { witnesses, type Triple, type Witness } from "./rules/incompatibility.ts";
import { gov, isContent, type Status, type WorldStatus } from "./rules/perspectives.ts";
import { VERB_OF, viewpointFrom, type DiagnosisKind } from "./rules/viewpoints.ts";

type Entry = [string, string, string, string, number, string, "story" | "minor"];
type TL = {
  steps: { n: number; sid: string; page: number; stage: string; new: number; asserted: number }[];
  worldEntry: Record<string, number>; entries: Entry[]; metrics: any;
};
const TLD: TL = JSON.parse(readFileSync(path.join(DATA_DIR, "timeline.json"), "utf8"));
const FINAL = TLD.steps.at(-1)!.n;
const first = new Map<string, { step: number; how: string; cls: string }>();
for (const [w, s, p, o, n, how, cls] of TLD.entries) first.set(`${w}|${s} ${p} ${o}`, { step: n, how, cls });
const tkey = (w: string, t: Triple) => `${w}|${n3(t.s)} ${n3(t.p)} ${n3(t.o)}`;
const stepOf = (w: string, t: Triple) => first.get(tkey(w, t))?.step ?? Infinity;
const entryOf = (w: string) => (w === "reality" ? 1 : TLD.worldEntry[w] ?? Infinity);
const T = (t: Triple) => plain(renderTriple(t.s, t.p, t.o));
const IDENTITY: Triple = { s: { type: "uri", value: NS.st + "hosmer" }, p: { type: "uri", value: NS.owl + "sameAs" }, o: { type: "uri", value: NS.st + "windibank" } };
export const identityStep = Math.min(stepOf("reality", IDENTITY), stepOf("reality", { ...IDENTITY, s: IDENTITY.o, o: IDENTITY.s }));

const GOLD = worldsIn("gold").filter((w) => w.local !== "shared");
const worldTitle = (w: string) => GOLD.find((x) => x.local === w)?.title ?? w;

/** Governance known at clue k: a world's own governor from its entry; "via identity" only once Reality has the identity. */
function govAt(k: number) {
  return gov("gold").filter((g) => (g.viaIdentity ? identityStep <= k : true) && entryOf(g.world) <= k);
}
function personOf(world: string) {
  const g = gov("gold").find((x) => x.world === world && !x.viaIdentity);
  const a = g && agentByIri(g.agent);
  return a ? { person: a.id, personName: a.short, verb: VERB_OF[g!.predicate] } : {};
}

// ---------------------------------------------------------------- conclusions (what DEC infers, with its premises)
type Premise = { text: string; world: string; step: number; background?: boolean };
const RULE_TEXT: Record<string, (h: any) => string> = {
  identity: (h) => `same person, same facts: ${label(h.from)} is ${label(h.to)}`,
  symmetric: () => "it works both ways",
  subclass: (h) => `every “${label(h.from)}” is also of this kind`,
  "inverse-functional": (h) => `a single identifying trait (“${label(h.property)}”): two things that share it are one`,
  inverse: () => "the same relation, seen from the other side",
  subproperty: (h) => `“${label(h.from)}” implies the more general relation`,
  domain: (h) => `only this kind of thing can “${label(h.property)}”`,
  range: (h) => `only this kind of thing can be the object of “${label(h.property)}”`,
  accepted: () => "Holmes's solution is accepted by the story, so DEC copies it into Reality",
  unidentified: () => "an OWL rule of DEC's reasoner",
};
const uri = (v: string): TermJSON => ({ type: "uri", value: v });

function premisesFor(t: Triple, w: string, h: Hint | { rule: "accepted"; src: string }): Premise[] {
  const P = (x: Triple, world = w): Premise => ({ text: T(x), world, step: stepOf(world, x) });
  const BG = (txt: string): Premise => ({ text: txt, world: "shared", step: 0, background: true });
  switch (h.rule) {
    case "accepted": return [P(t, h.src)];
    case "identity": {
      const orig: Triple = t.s.value === h.to ? { ...t, s: uri(h.from) } : { ...t, o: uri(h.from) };
      const a: Triple = { s: uri(h.from), p: uri(NS.owl + "sameAs"), o: uri(h.to) }, b: Triple = { s: uri(h.to), p: a.p, o: uri(h.from) };
      return [P(orig), stepOf(w, a) <= stepOf(w, b) ? P(a) : P(b)];
    }
    case "symmetric": return [P({ s: t.o, p: t.p, o: t.s })];
    case "subclass": return [P({ ...t, o: uri(h.from) }), BG(`every “${label(h.from)}” is a “${label(t.o.value)}” (schema)`)];
    case "inverse-functional": {
      const a = P({ s: t.s, p: uri(h.property), o: uri(h.value) }), b = P({ s: t.o, p: uri(h.property), o: uri(h.value) });
      return [a, b, { text: `Holmes's rule: “${label(h.property)}” identifies one thing`, world: w, step: entryOf(w), background: true }];
    }
    case "inverse": return [P({ s: t.o, p: uri(h.property), o: t.s }), BG("the two relations are inverses (schema)")];
    case "subproperty": return [P({ ...t, p: uri(h.from) }), BG("schema: the first relation implies the second")];
    case "domain": return [P({ s: t.s, p: uri(h.property), o: uri(h.value) }), BG("schema: domain of the relation")];
    case "range": return [P({ s: uri(h.value), p: uri(h.property), o: t.s }), BG("schema: range of the relation")];
    default: return [];
  }
}

export type Conclusion = {
  id: string; step: number; kind: "inferred" | "accepted"; cls: string; world: string; worldTitle: string; person?: string; personName?: string; verb?: string;
  text: string; parts: Part[]; rule: string; ruleText: string; premises: Premise[]; explainedAt: number | null;
};

function conclusions(): Conclusion[] {
  const out: Conclusion[] = [];
  for (const [w, s, p, o, n, how, cls] of TLD.entries) {
    const accepted = w === "reality" && how.startsWith("received:") && how !== "received:shared";
    if (how !== "derived" && !accepted) continue;
    const t: Triple = { s: parseN3(s), p: parseN3(p), o: parseN3(o) };
    // among the rules that explain it in the final graph, the one whose premises were all available at this clue
    const options: (Hint | { rule: "accepted"; src: string })[] = accepted ? [{ rule: "accepted", src: how.slice(9) }] : derivationHints(t, "gold", w);
    const scored = options.map((h) => {
      const ps = premisesFor(t, w, h);
      const f = ps.map((x) => x.step);
      return { h, ps, at: ps.length && f.every(Number.isFinite) ? Math.max(...f) : Infinity };
    });
    // a rule whose premises arrive only later cannot be the reason: then say "an OWL rule" rather than guess
    const best = scored.find((x) => x.at === n) ?? scored.filter((x) => x.at <= n).sort((a, b) => b.at - a.at)[0] ?? { h: { rule: "unidentified" } as Hint, ps: [], at: Infinity };
    const h = best.h, premises = best.ps;
    const finite = premises.filter((x) => Number.isFinite(x.step)).map((x) => x.step);
    // class hierarchy, domain and range only re-classify what is already known: kept, but as "minor"
    const kind = ["subclass", "domain", "range"].includes(h.rule) ? "minor" : cls;
    out.push({
      id: `c${out.length}`, step: n, kind: accepted ? "accepted" : "inferred", cls: kind, world: w, worldTitle: worldTitle(w), ...personOf(w),
      text: T(t), parts: renderTriple(t.s, t.p, t.o), rule: h.rule, ruleText: RULE_TEXT[h.rule]?.(h) ?? RULE_TEXT.unidentified(h),
      premises, explainedAt: premises.length && finite.length === premises.length ? Math.max(...finite) : null,
    });
  }
  // within a clue: what Reality accepts from the solution, then new facts about real people, then the persona's
  const interest = (c: Conclusion) => (c.kind === "accepted" ? 4 : c.rule === "identity" && /^(James Windibank|Mary Sutherland|Mary's mother)/.test(c.text) ? 3
    : c.rule === "identity" ? 1 : 2) + (c.world === "reality" ? 0.5 : 0);
  return out.sort((a, b) => a.step - b.step || (a.cls === b.cls ? 0 : a.cls === "story" ? -1 : 1) || interest(b) - interest(a) || a.text.localeCompare(b.text));
}

// ---------------------------------------------------------------- claims entering (what the text adds at each clue)
function claims() {
  return TLD.entries.filter(([, , , , , how, cls]) => how === "asserted" && cls === "story").map(([w, s, p, o, n]) => {
    const t: Triple = { s: parseN3(s), p: parseN3(p), o: parseN3(o) };
    return { step: n, world: w, worldTitle: worldTitle(w), ...personOf(w), text: T(t) };
  }).sort((a, b) => a.step - b.step || a.world.localeCompare(b.world));
}

// ---------------------------------------------------------------- statuses at clue k, and the events they produce
const witCache = new Map<string, (Witness & { step: number })[]>();
function witnessesAt(t: Triple, w: string, decType: string) {
  const k = tkey(w, t);
  if (!witCache.has(k)) witCache.set(k, witnesses(t, "gold", w, decType).map((x) => ({ ...x, step: stepOf(w, x.triple) })));
  return witCache.get(k)!;
}
function statusesAt(t: Triple, k: number): WorldStatus[] {
  const G = govAt(k);
  return GOLD.filter((w) => entryOf(w.local) <= k).map((w) => {
    const governedBy = G.filter((g) => g.world === w.local).map((g) => ({ agent: g.agent, name: agentByIri(g.agent)?.short ?? "", predicate: g.predicate, viaIdentity: g.viaIdentity }));
    const base = { world: w.local, title: w.title, decType: w.decType, governedBy };
    const f = first.get(tkey(w.local, t));
    if (f && f.step <= k) {
      const status: Status = f.how === "asserted" ? "asserted" : f.how.startsWith("received:") ? "received" : "derived";
      const src = f.how.startsWith("received:") ? f.how.slice(9) : undefined;
      return { ...base, status, receivedFrom: src, receivedFromTitle: src ? worldTitle(src) : undefined };
    }
    const ws = witnessesAt(t, w.local, w.decType).filter((x) => x.step <= k).map((x) => ({ ...x, parts: renderTriple(x.triple.s, x.triple.p, x.triple.o) }));
    if (ws.length) return { ...base, status: ws.some((x) => x.axiom.kind === "disjoint") ? "contradicted" : "contradicted-assuming", witnesses: ws };
    return { ...base, status: "not-determined" as Status };
  });
}

export type TEvent = { step: number; pid: string; text: string; kind: "reality" | "verdict"; from?: string; to?: string;
  diagnosis?: { kind: DiagnosisKind; person: string; personName: string; text: string; assumption?: string } };

function events() {
  const out: TEvent[] = [];
  const seen = new Set<string>();
  for (const pr of Object.values(catalog.propositions)) {
    if (pr.dataset !== "gold" || pr.world === "shared" || !isContent(pr.id)) continue;
    const k = `${pr.s} ${pr.p} ${pr.o}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const t: Triple = { s: parseN3(pr.s), p: parseN3(pr.p), o: parseN3(pr.o) };
    const parts = renderTriple(t.s, t.p, t.o), txt = plain(parts);
    const cand = new Set<number>([1, identityStep]);
    for (const w of GOLD) {
      cand.add(entryOf(w.local));
      cand.add(stepOf(w.local, t));
      for (const x of witnessesAt(t, w.local, w.decType)) cand.add(x.step);
    }
    let prev: ReturnType<typeof viewpointFrom> | null = null;
    for (const k of [...cand].filter((x) => Number.isFinite(x) && x >= 1 && x <= FINAL).sort((a, b) => a - b)) {
      const vp = viewpointFrom({ id: pr.id, parts, text: txt, world: pr.world, statuses: statusesAt(t, k) }, "gold", govAt(k));
      const r0 = prev?.reality.value ?? "unknown";
      if (vp.reality.value !== r0) out.push({ step: k, pid: pr.id, text: txt, kind: "reality", from: r0, to: vp.reality.value });
      for (const d of vp.diagnoses) {
        if (!prev?.diagnoses.some((x) => x.kind === d.kind && x.person === d.person)) {
          out.push({ step: k, pid: pr.id, text: txt, kind: "verdict", diagnosis: { kind: d.kind, person: d.person, personName: d.personName, text: d.text, assumption: d.assumption } });
        }
      }
      prev = vp;
    }
  }
  return out.sort((a, b) => a.step - b.step || a.text.localeCompare(b.text));
}

// ---------------------------------------------------------------- payload
let cache: any = null;
function full() {
  if (cache) return cache;
  const steps = TLD.steps.map((s) => {
    const sen = sentences.get(s.sid);
    return { n: s.n, sid: s.sid, page: s.page, stage: s.stage, text: sen?.text ?? "", speaker: sen?.paragraph.speaker ?? "", newTriples: s.new };
  });
  const cl = conclusions();
  const cs = claims();
  const ev = events();
  cache = {
    steps, final: FINAL, identityStep, worldEntry: TLD.worldEntry, conclusions: cl, claims: cs, events: ev,
    totals: { conclusions: cl.filter((c) => c.cls === "story").length, minor: cl.filter((c) => c.cls === "minor").length,
      verdicts: ev.filter((e) => e.kind === "verdict").length },
    metrics: TLD.metrics,
  };
  return cache;
}

const ORDER = ["C1", "C2", "C3", "C4", "G"];
/** The timeline as a reader at `mode` may see it: in a spoiler-free stage, nothing after the stage (counts only). */
export function timelinePayload(mode: Mode) {
  const f = full();
  if (mode === "gold") return { ...f, cap: null, hidden: { conclusions: 0, verdicts: 0, steps: 0 } };
  const cap = Math.max(0, ...f.steps.filter((s: any) => ORDER.indexOf(s.stage) <= ORDER.indexOf(mode)).map((s: any) => s.n));
  const keep = (x: { step: number }) => x.step <= cap;
  return {
    ...f, cap, steps: f.steps.filter((s: any) => s.n <= cap),
    conclusions: f.conclusions.filter(keep), claims: f.claims.filter(keep), events: f.events.filter(keep),
    hidden: { conclusions: f.conclusions.filter((c: Conclusion) => c.step > cap && c.cls === "story").length,
      verdicts: f.events.filter((e: TEvent) => e.step > cap && e.kind === "verdict").length, steps: f.steps.length - f.steps.filter((s: any) => s.n <= cap).length },
  };
}
