// Incompatibility of a proposition with the content of a world, under DECLARED axioms only:
//  - owl:disjointWith between classes (shared schema, asserted graph of the world 'shared');
//  - closure assumptions (dec:closedFor) with the CORRECT semantics: same subject, DIFFERENT object
//    (DEC's own verifyClosedFor also flags identical values: see reports/dec_reasoner_notes.md §3);
//  - owl:sameAs vs owl:differentFrom between the same two individuals ("distinct"): excluded by OWL itself, no declared
//    axiom needed (Jena's OWL reasoner, hence DEC's conflict check, flags it too).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { EDITION_DIR, NS, type Mode } from "../config.ts";
import { graphs, sourcesOf, worldsIn } from "../data.ts";
import { ask, n3, select, type TermJSON } from "../store.ts";

export type Triple = { s: TermJSON; p: TermJSON; o: TermJSON };
export type Axiom = { kind: "disjoint"; a: string; b: string } | { kind: "closure"; predicate: string } | { kind: "distinct" };
const SAME = NS.owl + "sameAs", DIFFERENT = NS.owl + "differentFrom";
export type Witness = { triple: Triple; axiom: Axiom; origin: "asserted" | "received" | "derived"; originWorld?: string };

/** Closure assumptions declared in the prototype's DEC configuration modules (gold: D03, D04; sim: sD03). */
function readClosures(): { gold: string[]; sim: string[] } {
  const dir = path.join(EDITION_DIR, "..", "prototype", "modules", "dec");
  const out = { gold: [] as string[], sim: [] as string[] };
  for (const f of readdirSync(dir)) {
    const m = readFileSync(path.join(dir, f), "utf8").match(/dec:closedFor\s+prof:(\w+)/);
    if (m) (f.startsWith("s") ? out.sim : out.gold).push(NS.prof + m[1]);
  }
  return out;
}
export const CLOSURES = readClosures();

export function axiomGraph(mode: Mode): string {
  return graphs(mode, "shared").A;
}

export function closuresFor(mode: Mode): string[] {
  return mode === "gold" ? CLOSURES.gold : CLOSURES.sim;
}

export function has(graph: string, t: Triple): boolean {
  return ask(`ASK { GRAPH <${graph}> { ${n3(t.s)} ${n3(t.p)} ${n3(t.o)} } }`);
}

export function originOf(t: Triple, mode: Mode, world: string, decType: string): { origin: Witness["origin"]; originWorld?: string } {
  const g = graphs(mode, world);
  if (has(g.A, t)) return { origin: "asserted" };
  for (const src of sourcesOf(decType, mode)) {
    if (worldsIn(mode).some((w) => w.local === src) && has(graphs(mode, src).M, t)) return { origin: "received", originWorld: src };
  }
  return { origin: "derived" };
}

/** Witnesses in M(world) that make `t` incompatible with the world, with the axiom used. */
export function witnesses(t: Triple, mode: Mode, world: string, decType: string): Witness[] {
  const { M } = graphs(mode, world);
  const AX = axiomGraph(mode);
  const out: Witness[] = [];
  if (t.p.value === NS.rdf + "type" && t.o.type === "uri") {
    const rows = select(`SELECT DISTINCT ?d WHERE {
      GRAPH <${M}> { ${n3(t.s)} a ?d }
      { GRAPH <${AX}> { ${n3(t.o)} owl:disjointWith ?d } } UNION { GRAPH <${AX}> { ?d owl:disjointWith ${n3(t.o)} } } }`);
    for (const r of rows) {
      const w: Triple = { s: t.s, p: t.p, o: r.d };
      out.push({ triple: w, axiom: { kind: "disjoint", a: t.o.value, b: r.d.value }, ...originOf(w, mode, world, decType) });
    }
  }
  if ((t.p.value === SAME || t.p.value === DIFFERENT) && t.o.type === "uri") {
    // a = b is excluded by a ≠ b (either direction), and vice versa
    const other = t.p.value === SAME ? DIFFERENT : SAME;
    for (const [x, y] of [[t.s, t.o], [t.o, t.s]] as const) {
      const w: Triple = { s: x, p: { type: "uri", value: other }, o: y };
      if (has(M, w)) out.push({ triple: w, axiom: { kind: "distinct" }, ...originOf(w, mode, world, decType) });
    }
  }
  if (closuresFor(mode).includes(t.p.value)) {
    const rows = select(`SELECT DISTINCT ?z WHERE {
      GRAPH <${M}> { ${n3(t.s)} ${n3(t.p)} ?z }
      FILTER(?z != ${n3(t.o)})
      FILTER NOT EXISTS { GRAPH <${M}> { ?z owl:sameAs ${n3(t.o)} } } }`);
    for (const r of rows) {
      const w: Triple = { s: t.s, p: t.p, o: r.z };
      out.push({ triple: w, axiom: { kind: "closure", predicate: t.p.value }, ...originOf(w, mode, world, decType) });
    }
  }
  return out;
}

/** World-pair incompatibilities found by the edition (used to explain or question DEC's world-level verdicts). */
export function pairConflicts(mode: Mode, gA: string, gB: string): { kind: string; detail: Record<string, string> }[] {
  const AX = axiomGraph(mode);
  const out: { kind: string; detail: Record<string, string> }[] = [];
  for (const r of select(`SELECT DISTINCT ?x ?c ?d WHERE {
      GRAPH <${gA}> { ?x a ?c } GRAPH <${gB}> { ?x a ?d }
      { GRAPH <${AX}> { ?c owl:disjointWith ?d } } UNION { GRAPH <${AX}> { ?d owl:disjointWith ?c } } }`)) {
    out.push({ kind: "disjoint", detail: { x: r.x.value, c: r.c.value, d: r.d.value } });
  }
  for (const r of select(`SELECT DISTINCT ?x ?y WHERE {
      { GRAPH <${gA}> { ?x owl:sameAs ?y } GRAPH <${gB}> { { ?x owl:differentFrom ?y } UNION { ?y owl:differentFrom ?x } } }
      UNION { GRAPH <${gA}> { ?x owl:differentFrom ?y } GRAPH <${gB}> { { ?x owl:sameAs ?y } UNION { ?y owl:sameAs ?x } } }
      FILTER(?x != ?y) }`)) {
    out.push({ kind: "distinct", detail: { x: r.x.value, y: r.y.value } });
  }
  for (const p of closuresFor(mode)) {
    for (const r of select(`SELECT DISTINCT ?x ?y ?z WHERE {
        GRAPH <${gA}> { ?x <${p}> ?y } GRAPH <${gB}> { ?x <${p}> ?z }
        FILTER(?y != ?z) FILTER NOT EXISTS { GRAPH <${gA}> { ?y owl:sameAs ?z } } FILTER NOT EXISTS { GRAPH <${gB}> { ?y owl:sameAs ?z } } }`)) {
      out.push({ kind: "closure", detail: { x: r.x.value, p, y: r.y.value, z: r.z.value } });
    }
  }
  return out;
}

/** Same subject with IDENTICAL values on a closed predicate in both graphs (what DEC's defective check also flags). */
export function identicalClosedValues(mode: Mode, gA: string, gB: string): { x: string; p: string; y: string }[] {
  const out: { x: string; p: string; y: string }[] = [];
  for (const p of closuresFor(mode)) {
    for (const r of select(`SELECT DISTINCT ?x ?y WHERE { GRAPH <${gA}> { ?x <${p}> ?y } GRAPH <${gB}> { ?x <${p}> ?y } FILTER(isIRI(?x) && STRSTARTS(STR(?x), "${NS.st}")) }`)) {
      out.push({ x: r.x.value, p, y: r.y.value });
    }
  }
  return out;
}
