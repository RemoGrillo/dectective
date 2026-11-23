// Elements for the "who holds what" diagrams: people → their perspectives (worlds) → statements → things and ideas.
// Every element carries a column ("col") so the client can lay the diagram out left-to-right without overlaps.
// Labels use the reader-facing vocabulary; the DEC term is kept in data.dec for tooltips.
import { NS, type Mode } from "./config.ts";
import { agentByIri, worldsIn } from "./data.ts";
import { label, localName, plain, renderTriple } from "./render.ts";
import type { Triple } from "./rules/incompatibility.ts";
import { gov, statusIn, type WorldStatus } from "./rules/perspectives.ts";
import { mergedPersonas } from "./rules/viewpoints.ts";

export type El = { data: Record<string, any>; classes?: string };

const key = (t: Triple) => `${t.s.value}|${t.p.value}|${t.o.type === "uri" ? t.o.value : JSON.stringify(t.o.value)}`;
const short = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const STATUS_EDGE: Record<string, string> = {
  asserted: "states", received: "inherits", derived: "DEC infers", contradicted: "rules out", "contradicted-assuming": "rules out if…",
};
const VERB: Record<string, string> = { uttered: "says", believes: "believes", establishes: "concludes", conjectures: "supposes" };
const CLASS_TEXT = (iri: string) => localName(iri).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

export function buildGraph(props: Triple[], mode: Mode, opts: { worlds?: string[]; statuses?: Map<string, WorldStatus[]> } = {}): El[] {
  const els = new Map<string, El>();
  const add = (e: El) => { if (!els.has(e.data.id)) els.set(e.data.id, e); };
  const worlds = worldsIn(mode).filter((w) => w.local !== "shared" && (!opts.worlds || opts.worlds.includes(w.local)));
  const usedWorlds = new Set<string>();
  const merged = mergedPersonas(mode);
  const personNode = (iri: string) => {
    const ag = agentByIri(iri);
    const id = "a:" + iri;
    add({ data: { id, label: ag?.short ?? label(iri), iri, kind: "person", agent: ag?.id ?? null, col: 0 }, classes: "person" });
    return id;
  };
  const propNode = (t: Triple, cls = "prop") => {
    const id = "p:" + key(t);
    add({ data: { id, label: short(plain(renderTriple(t.s, t.p, t.o))), kind: "proposition", col: 2 }, classes: cls });
    for (const x of [t.s, t.o]) {
      if (x.type !== "uri") continue;
      if (x.value.startsWith(NS.st)) {
        const ag = agentByIri(x.value);
        if (ag && ag.kind !== "reality") continue;    // people already appear in the first column
        add({ data: { id: "e:" + x.value, label: label(x.value), iri: x.value, kind: "thing", col: 3 }, classes: "thing" });
        add({ data: { id: `about:${id}:${x.value}`, source: id, target: "e:" + x.value, kind: "about" }, classes: "about" });
      } else if (t.p.value === NS.rdf + "type" && x === t.o) {
        add({ data: { id: "c:" + x.value, label: CLASS_TEXT(x.value), iri: x.value, kind: "idea", col: 3 }, classes: "idea" });
        add({ data: { id: `isa:${id}:${x.value}`, source: id, target: "c:" + x.value, kind: "about" }, classes: "about" });
      }
    }
    return id;
  };
  for (const t of props) {
    const pid = propNode(t, "prop main");
    const sts = opts.statuses?.get(key(t)) ?? worlds.map((w) => statusIn(t, mode, w));
    for (const s of sts) {
      if (opts.worlds && !opts.worlds.includes(s.world)) continue;
      if (s.status === "not-determined") continue;
      // conjectures that merely inherit Reality add nothing to the picture
      if (s.status === "received" && s.receivedFrom === "reality") continue;
      if (s.status.startsWith("contradicted") && (s.witnesses ?? []).every((w) => w.origin === "received" && w.originWorld === "reality") && s.world !== "reality") continue;
      usedWorlds.add(s.world);
      add({ data: { id: `st:${pid}:${s.world}`, source: "w:" + s.world, target: pid, kind: "status", status: s.status, label: STATUS_EDGE[s.status], dec: s.status }, classes: "status " + s.status });
      for (const w of (s.witnesses ?? []).slice(0, 2)) {
        const wid = propNode(w.triple, "prop witness");
        add({ data: { id: `st:${wid}:${s.world}`, source: "w:" + s.world, target: wid, kind: "status", status: "holds", label: "states", dec: w.origin }, classes: "status holds" });
        const ax = w.axiom.kind === "disjoint" ? `can't be both (${CLASS_TEXT(w.axiom.a)} / ${CLASS_TEXT(w.axiom.b)})` : `one value only (${localName(w.axiom.predicate)}): an assumption`;
        add({ data: { id: `inc:${pid}:${wid}`, source: pid, target: wid, kind: "incompatible", label: ax }, classes: "incompatible" + (w.axiom.kind === "closure" ? " assumption" : "") });
      }
    }
  }
  for (const w of worlds) {
    if (!usedWorlds.has(w.local)) continue;
    add({ data: { id: "w:" + w.local, label: short(w.title, 44), kind: "world", decType: w.decType, col: 1, dec: `${w.decType} world ${w.local}` }, classes: "world " + w.decType });
    for (const g of gov(mode).filter((x) => x.world === w.local)) {
      const ag = agentByIri(g.agent);
      if (ag && merged.has(ag.id)) continue;   // a persona is drawn as the person behind the mask ("says (as Hosmer)")
      const a = personNode(g.agent);
      const asName = g.viaIdentity ? gov(mode).find((x) => x.world === w.local && x.predicate === g.predicate && !x.viaIdentity) : undefined;
      const asAgent = asName && agentByIri(asName.agent);
      add({ data: { id: `gov:${g.agent}:${w.local}:${g.predicate}`, source: a, target: "w:" + w.local, kind: "governs",
        label: VERB[g.predicate] + (asAgent ? ` (as ${asAgent.short})` : ""), viaIdentity: g.viaIdentity }, classes: "governs" + (g.viaIdentity ? " via-identity" : "") });
    }
  }
  return [...els.values()];
}

export { key as tripleKey };
