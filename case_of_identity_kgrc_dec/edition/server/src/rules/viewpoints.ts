// Reader-facing model of a proposition: what Reality says, and what each PERSON (one entry per person, personas merged
// into the person behind the mask once the identity is known) says / believes / concludes / supposes about it.
// Diagnoses are explicit: LIE (says p, believes otherwise), DELUSION (believes p, Reality rules p out),
// HONEST MISTAKE (says and believes p, Reality rules p out). Everything is computed from the per-world statuses
// (perspectives.ts), which are in turn computed from DEC's materialised views.
import { NS, type Mode } from "../config.ts";
import { agents, catalog, sentences, type Agent } from "../data.ts";
import { localName, plain, type Part } from "../render.ts";
import { gov, propositionView, isContent, type Status, type WorldStatus } from "./perspectives.ts";

export type Verb = "says" | "believes" | "concludes" | "supposes";
export const VERB_OF: Record<string, Verb> = { uttered: "says", believes: "believes", establishes: "concludes", conjectures: "supposes" };
const DEC_TYPE_OF_VERB: Record<Verb, string> = { says: "verbatim", believes: "doxastic", concludes: "epistemic", supposes: "conjectural" };

export type Stance = {
  verb: Verb; polarity: "yes" | "no"; world: string; worldTitle: string; status: Status;
  asName?: string;        // the person holds this stance under another name (e.g. Windibank as "Hosmer Angel")
  assumption?: string;    // a "no" that holds only under a declared single-value assumption
  how: string;            // plain English
  dec: string;            // the same in DEC's terms
};
export type DiagnosisKind = "lie" | "delusion" | "mistake";
export type Diagnosis = { kind: DiagnosisKind; person: string; personName: string; world: string; text: string; assumption?: string };
export type Person = { id: string; name: string; short: string; kind: string; alias?: string; stances: Stance[]; diagnoses: DiagnosisKind[] };
export type RealityVerdict = { value: "true" | "false" | "false-if" | "unknown"; how: string; dec: string; assumption?: string };
export type Viewpoint = {
  id: string; text: string; parts: Part[]; world: string; sentences: string[];
  reality: RealityVerdict; people: Person[]; silent: string[]; diagnoses: Diagnosis[]; divergent: boolean;
};

const HOLDS: Status[] = ["asserted", "received", "derived"];
const NEG: Status[] = ["contradicted", "contradicted-assuming"];

const CLOSURE_TEXT: Record<string, string> = {
  hasOccupation: "assuming a person has only one occupation",
  typedOn: "assuming a letter was typed on one machine only",
  writtenBy: "assuming a letter has one author only",
};
function assumptionOf(s: WorldStatus): string | undefined {
  if (s.status !== "contradicted-assuming") return undefined;
  const w = (s.witnesses ?? []).find((x) => x.axiom.kind === "closure");
  const p = w && w.axiom.kind === "closure" ? localName(w.axiom.predicate) : "";
  return CLOSURE_TEXT[p] ?? (p ? `assuming “${p}” has a single value` : "under a single-value assumption");
}

function witnessText(s: WorldStatus): string {
  const w = (s.witnesses ?? [])[0];
  return w ? plain(w.parts) : "";
}

/** Plain-English justification of a world status. */
function howText(s: WorldStatus): string {
  switch (s.status) {
    case "asserted": return s.world === "reality" ? "stated by the story" : /[“”]/.test(s.title) ? `stated: ${s.title}` : `stated in “${s.title}”`;
    case "received": return s.world === "reality" ? `taken from ${s.receivedFromTitle ?? s.receivedFrom}, which the story accepts` : `inherited from ${s.receivedFromTitle ?? s.receivedFrom}`;
    case "derived": return `inferred by DEC: ${s.hintText ?? "an OWL rule"}`;
    case "contradicted": return `incompatible with “${witnessText(s)}”`;
    case "contradicted-assuming": return `incompatible with “${witnessText(s)}”, ${assumptionOf(s)}`;
    default: return "nothing either way";
  }
}
function decText(s: WorldStatus): string {
  const st = s.status === "received" ? `received from ${s.receivedFrom} (permeation)` : s.status === "derived" ? `derived (${s.hint?.rule ?? "OWL"})` : s.status;
  return `${s.decType} world ${s.world} · ${st}`;
}

/** A stance is the person's own only if it is not merely inherited (a hypothesis copies Reality; DEC permeation). */
function inherited(s: WorldStatus): boolean {
  if (s.status === "received") return true;
  if (NEG.includes(s.status)) return (s.witnesses ?? []).every((w) => w.origin === "received");
  return false;
}

function realityVerdict(statuses: WorldStatus[]): RealityVerdict {
  const r = statuses.find((x) => x.world === "reality");
  if (!r) return { value: "unknown", how: "the story does not say", dec: "no reality world" };
  const value = HOLDS.includes(r.status) ? "true" : r.status === "contradicted" ? "false" : r.status === "contradicted-assuming" ? "false-if" : "unknown";
  return { value, how: r.status === "not-determined" ? "the story does not say" : howText(r), dec: decText(r), assumption: assumptionOf(r) };
}

/** Persons shown for a mode, in a FIXED order (the kaleidoscope keeps everyone in the same place). */
const ORDER = ["mary", "windibank", "hosmer", "holmes", "watson", "mother", "reader", "whatif"];
function iriOf(a: Agent, mode: Mode) { return mode === "gold" ? a.gold : a.sim; }

/** Personas whose worlds are governed, through identity, by the person behind the mask: merged into that person. */
type Gov = ReturnType<typeof gov>;

export function mergedPersonas(mode: Mode, G: Gov = gov(mode)): Map<string, string> {
  const out = new Map<string, string>();
  for (const a of agents.filter((x) => x.kind === "persona" && (x as any).maskOf)) {
    const owner = agents.find((x) => x.id === (a as any).maskOf);
    const pi = iriOf(a, mode), oi = owner && iriOf(owner, mode);
    if (!pi || !oi) continue;
    const personaWorlds = G.filter((g) => g.agent === pi && !g.viaIdentity).map((g) => g.world);
    if (personaWorlds.length && personaWorlds.every((w) => G.some((g) => g.agent === oi && g.world === w && g.viaIdentity))) out.set(a.id, owner!.id);
  }
  return out;
}

export function peopleFor(mode: Mode, G: Gov = gov(mode)): { agent: Agent; alias?: string }[] {
  const merged = mergedPersonas(mode, G);
  const governing = new Set(G.map((g) => g.agent));
  return ORDER.map((id) => agents.find((a) => a.id === id)!).filter((a) => {
    const iri = iriOf(a, mode);
    return iri && a.kind !== "reality" && governing.has(iri) && !merged.has(a.id);
  }).map((a) => {
    const alias = [...merged.entries()].find(([, owner]) => owner === a.id)?.[0];
    return { agent: a, alias: alias ? agents.find((x) => x.id === alias)!.name : undefined };
  });
}

/** `G`: the governance to use (by default the final one; the Deductions timeline passes the governance known at a clue). */
export function viewpointFrom(view: { id: string; parts: Part[]; text: string; world: string; statuses: WorldStatus[] }, mode: Mode, G: Gov = gov(mode)): Viewpoint {
  const reality = realityVerdict(view.statuses);
  const people: Person[] = [];
  const silent: string[] = [];
  const diagnoses: Diagnosis[] = [];
  for (const { agent, alias } of peopleFor(mode, G)) {
    const iri = iriOf(agent, mode)!;
    const stances: Stance[] = [];
    for (const s of view.statuses) {
      for (const g of s.governedBy.filter((x) => x.agent === iri)) {
        if (inherited(s) || !(HOLDS.includes(s.status) || NEG.includes(s.status))) continue;
        const owner = g.viaIdentity ? G.find((x) => x.world === s.world && x.predicate === g.predicate && !x.viaIdentity) : undefined;
        const ownerAgent = owner && agents.find((a) => iriOf(a, mode) === owner.agent);
        const verb = VERB_OF[g.predicate];
        stances.push({
          verb, polarity: HOLDS.includes(s.status) ? "yes" : "no", world: s.world, worldTitle: s.title, status: s.status,
          asName: ownerAgent ? ownerAgent.name : undefined, assumption: assumptionOf(s), how: howText(s), dec: decText(s),
        });
      }
    }
    // one stance per (verb, polarity, world): identity can duplicate governance
    const uniq = stances.filter((x, i) => stances.findIndex((y) => y.verb === x.verb && y.world === x.world) === i);
    const order: Verb[] = ["says", "believes", "concludes", "supposes"];
    uniq.sort((a, b) => order.indexOf(a.verb) - order.indexOf(b.verb));
    const kinds: DiagnosisKind[] = [];
    const says = uniq.filter((x) => x.verb === "says" && x.polarity === "yes");
    const believesNo = uniq.filter((x) => x.verb === "believes" && x.polarity === "no");
    const believesYes = uniq.filter((x) => x.verb === "believes" && x.polarity === "yes");
    const realityFalse = reality.value === "false" || reality.value === "false-if";
    const name = agent.short;
    for (const s of says) {
      if (believesNo.length) {
        kinds.push("lie");
        diagnoses.push({ kind: "lie", person: agent.id, personName: agent.name, world: s.world,
          text: `${name}${s.asName ? ` (as ${s.asName})` : ""} says it, but believes otherwise`, assumption: believesNo[0].assumption });
      } else if (believesYes.length && realityFalse) {
        kinds.push("mistake");
        diagnoses.push({ kind: "mistake", person: agent.id, personName: agent.name, world: s.world,
          text: `${name} says it in good faith, but it is false`, assumption: reality.assumption });
      }
    }
    if (believesYes.length && realityFalse) {
      kinds.push("delusion");
      diagnoses.push({ kind: "delusion", person: agent.id, personName: agent.name, world: believesYes[0].world,
        text: `${name} believes it, but Reality rules it out`, assumption: reality.assumption });
    }
    if (uniq.length) people.push({ id: agent.id, name: agent.name, short: agent.short, kind: agent.kind, alias, stances: uniq, diagnoses: [...new Set(kinds)] });
    else { people.push({ id: agent.id, name: agent.name, short: agent.short, kind: agent.kind, alias, stances: [], diagnoses: [] }); silent.push(agent.id); }
  }
  const pols = new Set(people.flatMap((p) => p.stances.map((s) => s.polarity)));
  if (reality.value === "true") pols.add("yes");
  if (reality.value === "false" || reality.value === "false-if") pols.add("no");
  const rank: Record<DiagnosisKind, number> = { lie: 0, delusion: 1, mistake: 2 };
  diagnoses.sort((a, b) => rank[a.kind] - rank[b.kind]);
  const pr = catalog.propositions[view.id];
  return { id: view.id, text: view.text, parts: view.parts, world: view.world, sentences: pr?.sentences ?? [], reality, people, silent, diagnoses, divergent: pols.size > 1 };
}

const vpCache = new Map<string, Viewpoint>();
export function viewpoint(pid: string, mode: Mode): Viewpoint | null {
  const key = pid + "|" + mode;
  if (vpCache.has(key)) return vpCache.get(key)!;
  const v = propositionView(pid, mode);
  if (!v) return null;
  const vp = viewpointFrom(v, mode);
  vpCache.set(key, vp);
  return vp;
}

// ---------------------------------------------------------------- sentence-level marks
export type Mark = DiagnosisKind | "reasoning" | "identity" | "annotated";
const IDENTITY_P = [NS.owl + "sameAs", NS.crm + "P1_is_identified_by", NS.prof + "usedAppellation"];

function worldsOf(mode: Mode) { return mode === "gold" ? catalog.worlds.gold : catalog.worlds.sim; }

/** Does the diagnosis belong to THIS sentence? Only where the world that carries it (the statement or the belief)
 *  is anchored: a lie is marked where it is said, not wherever its content is mentioned. */
function anchoredHere(d: Diagnosis, pid: string, sid: string, mode: Mode): boolean {
  const pr = catalog.propositions[pid];
  if (pr.world !== d.world) return false;
  const segs: string[] = expand(worldsOf(mode)[pr.world]?.segments ?? []);
  return pr.sentences.length <= 1 || segs.length === 0 || segs.includes(sid);
}

/** Sentence segmentation splits after abbreviations ("Hosmer—Mr." | "Angel—was a cashier…"): a segment ending with
 *  one also covers the next sentence of the paragraph. */
function expand(segs: string[]): string[] {
  const out = new Set(segs);
  for (const id of segs) {
    const s = sentences.get(id);
    if (s && /\b(Mr|Mrs|Dr|St)\.$/.test(s.text.trim())) {
      const [p, n] = id.split(".S");
      const next = `${p}.S${String(Number(n) + 1).padStart(n.length, "0")}`;
      if (sentences.has(next)) out.add(next);
    }
  }
  return [...out];
}

export function sentencePids(sid: string, mode: Mode): string[] {
  const s = sentences.get(sid);
  if (!s) return [];
  return (mode === "gold" ? s.props : s.simProps).filter(isContent);
}

export function sentenceMarks(sid: string, mode: Mode): { marks: Mark[]; diagnoses: Diagnosis[] } {
  const pids = sentencePids(sid, mode);
  const marks = new Set<Mark>();
  const diags: Diagnosis[] = [];
  const ws = worldsOf(mode);
  for (const pid of pids) {
    const pr = catalog.propositions[pid];
    if (pr.world === "shared") continue;
    const vp = viewpoint(pid, mode);
    if (!vp) continue;
    for (const d of vp.diagnoses) {
      if (anchoredHere(d, pid, sid, mode) && !diags.some((x) => x.kind === d.kind && x.person === d.person)) { diags.push(d); marks.add(d.kind); }
    }
    const p = pr.p.replace(/^<|>$/g, "");
    if (IDENTITY_P.includes(p)) marks.add("identity");
    const t = ws[pr.world]?.decType;
    if (t === "epistemic" || t === "conjectural") marks.add("reasoning");
  }
  if (pids.length) marks.add("annotated");
  const order: Mark[] = ["lie", "delusion", "mistake", "identity", "reasoning", "annotated"];
  return { marks: order.filter((m) => marks.has(m)), diagnoses: diags };
}

export const DEC_TYPE_OF = DEC_TYPE_OF_VERB;
