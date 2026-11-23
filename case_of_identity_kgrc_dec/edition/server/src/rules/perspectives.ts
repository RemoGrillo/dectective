// The "kaleidoscope": status of the same proposition in every world, and the stance of every agent.
// Status rules (Method page): ASSERTED > RECEIVED > DERIVED > CONTRADICTED(-ASSUMING) > NOT DETERMINED.
import { NS, REALITY, type Mode } from "../config.ts";
import { agents, agentByIri, catalog, graphs, sentences, sourcesOf, worldsIn, type Agent, type WorldInfo } from "../data.ts";
import { label, plain, renderTriple, worldTitle, type Part } from "../render.ts";
import { n3, parseN3, select } from "../store.ts";
import { derivationHint, type Hint } from "./derivation.ts";
import { has, witnesses, type Triple, type Witness } from "./incompatibility.ts";

export type Status = "asserted" | "received" | "derived" | "contradicted" | "contradicted-assuming" | "not-determined";
export type WorldStatus = {
  world: string; title: string; decType: string; governedBy: { agent: string; name: string; predicate: string; viaIdentity: boolean }[];
  status: Status; receivedFrom?: string; receivedFromTitle?: string; hint?: Hint; hintText?: string; witnesses?: (Witness & { parts: Part[] })[];
};
export type AgentStance = {
  agent: string; name: string; short: string; kind: string;
  items: { world: string; title: string; predicate: string; status: Status; viaIdentity: boolean; inherited?: boolean }[];
  summary: string; flags: string[];
};

const GOV = { believes: NS.prof + "believes", establishes: NS.prof + "establishes", conjectures: NS.prof + "conjectures", uttered: NS.prof + "uttered" };

/** Governing relations in the materialised reality, including those obtained through identity (de re). */
export function governance(mode: Mode): { agent: string; predicate: string; world: string; viaIdentity: boolean }[] {
  const { M, A } = graphs(mode, "reality");
  const rows = select(`SELECT DISTINCT ?a ?pred ?w ?asserted WHERE {
      VALUES ?pred { prof:believes prof:establishes prof:conjectures prof:uttered }
      GRAPH <${M}> { ?a ?pred ?w }
      BIND(EXISTS { GRAPH <${A}> { ?a ?pred ?w } } AS ?asserted) }`);
  return rows.map((r) => ({
    agent: r.a.value,
    predicate: Object.entries(GOV).find(([, v]) => v === r.pred.value)![0],
    world: r.w.value.split("/").pop()!,
    viaIdentity: r.asserted.value !== "true",
  }));
}
const govCache = new Map<Mode, ReturnType<typeof governance>>();
export function gov(mode: Mode) {
  if (!govCache.has(mode)) govCache.set(mode, governance(mode));
  return govCache.get(mode)!;
}

export function statusIn(t: Triple, mode: Mode, w: WorldInfo): WorldStatus {
  const g = graphs(mode, w.local);
  const governedBy = gov(mode).filter((x) => x.world === w.local).map((x) => ({
    agent: x.agent, name: agentByIri(x.agent)?.short ?? x.agent.split("/").pop()!, predicate: x.predicate, viaIdentity: x.viaIdentity,
  }));
  const base = { world: w.local, title: w.title, decType: w.decType, governedBy };
  if (has(g.A, t)) return { ...base, status: "asserted" };
  if (has(g.M, t)) {
    for (const src of sourcesOf(w.decType, mode)) {
      if (has(graphs(mode, src).M, t)) return { ...base, status: "received", receivedFrom: src, receivedFromTitle: worldTitle(graphs(mode, src).M) };
    }
    const hint = derivationHint(t, mode, w.local);
    return { ...base, status: "derived", hint, hintText: hintText(hint) };
  }
  const ws = witnesses(t, mode, w.local, w.decType).map((x) => ({ ...x, parts: renderTriple(x.triple.s, x.triple.p, x.triple.o) }));
  if (ws.length) {
    const strict = ws.some((x) => x.axiom.kind === "disjoint");
    return { ...base, status: strict ? "contradicted" : "contradicted-assuming", witnesses: ws };
  }
  return { ...base, status: "not-determined" };
}

const HOLDS: Status[] = ["asserted", "received", "derived"];
const NEG: Status[] = ["contradicted", "contradicted-assuming"];

function stanceText(predicate: string, s: Status, inherited: boolean): string {
  const holds = HOLDS.includes(s), neg = NEG.includes(s);
  const tail = inherited ? " (inherited from Reality)" : "";
  switch (predicate) {
    case "uttered": return holds ? "says it" : neg ? "says the opposite" : "says nothing about it";
    case "believes": return holds ? "believes it" : neg ? "believes the opposite" + tail : "no attested belief";
    case "establishes": return holds ? "concludes it" : neg ? "concludes otherwise" : "the conclusion is silent";
    case "conjectures": return holds ? "supposes it" + tail : neg ? "the hypothesis excludes it" + tail : "the hypothesis is silent";
    default: return s;
  }
}

export function agentStances(statuses: WorldStatus[], mode: Mode): AgentStance[] {
  const out: AgentStance[] = [];
  for (const a of agents) {
    const iri = mode === "gold" ? a.gold : a.sim;
    if (!iri) continue;
    if (a.kind === "reality") {
      const r = statuses.find((x) => x.world === "reality");
      if (!r) continue;
      const summary = HOLDS.includes(r.status) ? "true in the story" : NEG.includes(r.status) ? "Reality rules it out" : "the story does not say";
      out.push({ agent: iri, name: a.name, short: a.short, kind: a.kind, items: [{ world: "reality", title: r.title, predicate: "reality", status: r.status, viaIdentity: false }], summary, flags: [] });
      continue;
    }
    const items = statuses.flatMap((s) => s.governedBy.filter((g) => g.agent === iri).map((g) => ({
      world: s.world, title: s.title, predicate: g.predicate, status: s.status, viaIdentity: g.viaIdentity,
      inherited: (s.witnesses ?? []).every((w) => w.origin === "received") && NEG.includes(s.status) || (s.status === "received" && s.receivedFrom === "reality"),
    })));
    const flags: string[] = [];
    const says = items.filter((i) => i.predicate === "uttered" && HOLDS.includes(i.status));
    const believesNot = items.filter((i) => i.predicate === "believes" && NEG.includes(i.status));
    const believes = items.filter((i) => i.predicate === "believes" && HOLDS.includes(i.status));
    const realityNeg = statuses.some((s) => s.world === "reality" && NEG.includes(s.status));
    if (says.length && believesNot.length) flags.push("says-what-they-believe-false");
    if (says.length && believes.length && realityNeg) flags.push("sincere-but-false");
    // Summary: only the agent's OWN positive or negative stances; conjectural worlds that merely inherit the
    // Reality, and silent worlds, are kept in `items` (details) but not in the summary.
    const own = items.filter((i) => !i.inherited && (HOLDS.includes(i.status) || NEG.includes(i.status)));
    const viaName = (i: (typeof items)[number]) => {
      const owner = gov(mode).find((g) => g.world === i.world && g.predicate === i.predicate && !g.viaIdentity);
      return owner ? agentByIri(owner.agent)?.short ?? "another name" : "another name";
    };
    let summary: string;
    if (own.length) {
      summary = [...new Set(own.map((i) => stanceText(i.predicate, i.status, false) + (i.viaIdentity ? ` (via identity: as ${viaName(i)})` : "")))].join("; ");
    } else if (items.some((i) => i.inherited)) {
      summary = "no stance of their own (their hypotheses only inherit Reality)";
    } else {
      summary = items.length ? "silent on this" : "no attested stance";
    }
    out.push({ agent: iri, name: a.name, short: a.short, kind: a.kind, items, summary, flags });
  }
  return out;
}

export type PropositionView = {
  id: string; parts: Part[]; text: string; world: string; module: string; basis: string; anchorLevel: string;
  statuses: WorldStatus[]; agents: AgentStance[];
};

export function propositionView(pid: string, mode: Mode): PropositionView | null {
  const pr = catalog.propositions[pid];
  if (!pr) return null;
  const t: Triple = { s: parseN3(pr.s), p: parseN3(pr.p), o: parseN3(pr.o) };
  const statuses = worldsIn(mode).filter((w) => w.local !== "shared").map((w) => statusIn(t, mode, w));
  return {
    id: pid, parts: renderTriple(t.s, t.p, t.o), text: plain(renderTriple(t.s, t.p, t.o)), world: pr.world, module: pr.module,
    basis: pr.basis, anchorLevel: pr.anchorLevel, statuses, agents: agentStances(statuses, mode),
  };
}

/** Propositions worth showing for a sentence: content, not scaffolding (types of persons, act plumbing, governing). */
const SCAFFOLD = [NS.prof + "hasContent", NS.prof + "addressee", NS.prof + "reportedBy", NS.prof + "heldBy", NS.crm + "P14_carried_out_by",
  GOV.believes, GOV.establishes, GOV.conjectures, GOV.uttered, NS.rdfs + "label", NS.crm + "P11_had_participant"];
const SCAFFOLD_CLASSES = [NS.crm + "E21_Person", NS.crm + "E41_Appellation", NS.crm + "E5_Event", NS.crm + "E74_Group", NS.prof + "CommunicativeAct",
  NS.prof + "Typewriter", NS.prof + "Occupation", NS.inf + "I2_Belief", NS.inf + "I7_Belief_Adoption", NS.inf + "I5_Inference_Making", NS.inf + "I3_Inference_Logic"];

export function isContent(pid: string): boolean {
  const pr = catalog.propositions[pid];
  const p = parseN3(pr.p).value, o = parseN3(pr.o);
  if (SCAFFOLD.includes(p)) return false;
  if (p === NS.rdf + "type" && SCAFFOLD_CLASSES.includes(o.value)) return false;
  if (p.startsWith(NS.inf)) return false;
  return true;
}

/** Deduplicate propositions that state the same triple in several worlds (keep one view per triple). */
function uniqueByTriple(pids: string[]): string[] {
  const seen = new Map<string, string>();
  for (const pid of pids) {
    const pr = catalog.propositions[pid];
    const k = `${pr.s} ${pr.p} ${pr.o}`;
    if (!seen.has(k)) seen.set(k, pid);
  }
  return [...seen.values()];
}

const cache = new Map<string, any>();
export function kaleidoscope(sid: string, mode: Mode) {
  const key = sid + "|" + mode;
  if (cache.has(key)) return cache.get(key);
  const s = sentences.get(sid);
  if (!s) return null;
  const pids = uniqueByTriple((mode === "gold" ? s.props : s.simProps).filter(isContent));
  const views = pids.map((pid) => propositionView(pid, mode)).filter(Boolean) as PropositionView[];
  const res = { sentence: sid, mode, propositions: views };
  cache.set(key, res);
  return res;
}

export function worldsSummary(mode: Mode) {
  return worldsIn(mode).map((w) => ({
    local: w.local, iri: graphs(mode, w.local).M, title: w.title, desc: w.desc, decType: w.decType, checkpoint: w.checkpoint,
    basis: w.basis, notes: w.notes, sources: sourcesOf(w.decType, mode), materializedBy: w.materializedBy,
    governedBy: gov(mode).filter((g) => g.world === w.local).map((g) => ({ ...g, name: agentByIri(g.agent)?.short ?? g.agent.split("/").pop() })),
  }));
}

export function agentList(): Agent[] {
  return agents;
}

export { REALITY };

/** Plain-English rendering of a derivation hint. */
export function hintText(h: Hint): string {
  switch (h.rule) {
    case "identity": return `identity: ${label(h.from)} is the same as ${label(h.to)} (owl:sameAs), so what holds of one holds of the other`;
    case "symmetric": return `symmetry of “${label(h.property)}”`;
    case "subclass": return `class hierarchy: every ${label(h.from)} is also of this class`;
    case "inverse-functional": return `inverse-functional “${label(h.property)}”: the shared value ${label(h.value)} identifies one individual`;
    case "inverse": return `the same relation seen from the other side (“${label(h.property)}”)`;
    case "subproperty": return `“${label(h.from)}” implies the more general relation`;
    case "domain": return `only this kind of thing can “${label(h.property)}” (schema)`;
    case "range": return `only this kind of thing can be the object of “${label(h.property)}” (schema)`;
    default: return "an OWL rule of DEC's reasoner (pattern not recognised by the edition)";
  }
}
