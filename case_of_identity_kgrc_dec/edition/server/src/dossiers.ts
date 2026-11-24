// Case files: automatically generated, step-by-step documentation of why a statement or a set of beliefs is diagnosed.
// Every step EXECUTES a SPARQL query (shown to the reader) and renders its result in deterministic English.
import { GRAPHS, NS, REALITY, type Mode } from "./config.ts";
import { ablations, agentByIri, catalog, graphs, labels, runs, sentences, text, worldsIn, type WorldInfo } from "./data.ts";
import { buildGraph, type El } from "./graph.ts";
import { label, localName, plain, renderTriple, worldTitle, type Part } from "./render.ts";
import { closuresFor, identicalClosedValues, pairConflicts, type Triple } from "./rules/incompatibility.ts";
import { gov, statusIn, type WorldStatus } from "./rules/perspectives.ts";
import { ask, displayQuery, select, type Row } from "./store.ts";
import { caseOrder, questionOf } from "./casebook.ts";

export type Cell = { value: string; label: string; isIri: boolean };
/** by: who produces the step's answer — DEC (its inferences or verdicts), the edition (a check over DEC's views), KGRC (comparison). */
export type Step = { n: number; title: string; text: string; sparql: string; kind: "select" | "ask"; columns: string[]; rows: Record<string, Cell>[]; result?: boolean; by: "dec" | "edition" | "kgrc" };
export type Caveat = { kind: "assumption" | "attribution" | "defect" | "reported" | "semantics" | "scope"; text: string };
/** The diagram of a case file: the network (legacy) and the triples it is about (for the Venn of the case). */
function fg(focus: Triple[], mode: Mode, opts?: Parameters<typeof buildGraph>[2]) {
  return { graph: buildGraph(focus, mode, opts), focus };
}

export type Dossier = {
  id: string; number: number; type: string; typeLabel: string; title: string; subtitle: string;
  verdict: { label: string; tone: "red" | "black" | "grey" }; stamp: { word: string; sub: string }; summary: string; anchors: string[]; steps: Step[];
  caveats: Caveat[]; dec: { run: string; world: string; relation: string; other?: string; kind: string }[]; graph: El[]; focus: Triple[]; mode: Mode;
};

const cell = (t: { type: string; value: string } | undefined): Cell =>
  !t ? { value: "", label: "", isIri: false } : t.type === "uri" ? { value: t.value, label: label(t.value), isIri: true } : { value: t.value, label: t.value, isIri: false };

class Builder {
  steps: Step[] = [];
  mode: Mode;
  constructor(mode: Mode = "gold") { this.mode = mode; }
  select(title: string, q: string, text: (rows: Row[]) => string, by: Step["by"] = "edition"): Row[] {
    const rows = select(q);
    const columns = rows.length ? Object.keys(rows[0]) : (q.match(/SELECT\s+(DISTINCT\s+)?([^{]*?)\s*WHERE/i)?.[2] ?? "").split(/\s+/).filter((x) => x.startsWith("?")).map((x) => x.slice(1));
    this.steps.push({ n: this.steps.length + 1, title, text: text(rows), sparql: displayQuery(q), kind: "select", columns, rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cell(v)]))), by });
    return rows;
  }
  ask(title: string, q: string, text: (b: boolean) => string, by: Step["by"] = "edition"): boolean {
    const b = ask(q);
    this.steps.push({ n: this.steps.length + 1, title, text: text(b), sparql: displayQuery(q), kind: "ask", columns: [], rows: [], result: b, by });
    return b;
  }
}

const T = (t: Triple) => plain(renderTriple(t.s, t.p, t.o));
/** Reported speech: "X said that he …" when the claim is about the speaker. */
const reported = (t: Triple, speaker: string) => t.s.value === speaker ? plain([{ text: "he" }, ...renderTriple(t.s, t.p, t.o).slice(1)]) : T(t);
const nt = (t: Triple) => `${t.s.type === "uri" ? `<${t.s.value}>` : JSON.stringify(t.s.value)} <${t.p.value}> ${t.o.type === "uri" ? `<${t.o.value}>` : JSON.stringify(t.o.value)}`;
/** Close an opening quotation mark left open by sentence segmentation. */
export const balanced = (t: string) => ((t.match(/“/g) ?? []).length > (t.match(/”/g) ?? []).length ? t + "”" : t);
const lst = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const G = (local: string, mode: Mode = "gold") => graphs(mode, local);
const humanClass = (iri: string) => labels.classes[localName(iri)]?.replace(/^(was|is|has|will) (an? |only an? )?/, "") ?? localName(iri).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const decRelation = (r: string) => r === "disagreesWith" ? "conflict with" : r === "delusionalWorld" ? "delusional" : r;

function decDiagnostics(world: string, mode: Mode): Dossier["dec"] {
  const wiri = G(world, mode).M;
  return select(`SELECT ?run ?rel ?other WHERE { GRAPH <${GRAPHS.runs}> { ?d ed:world <${wiri}> ; ed:relation ?rel ; ed:run ?run . OPTIONAL { ?d ed:otherWorld ?other } } } ORDER BY ?run`)
    .map((r) => ({ run: localName(r.run.value), world, relation: localName(r.rel.value), other: r.other ? r.other.value : undefined, kind: runs.find((x) => x.id === localName(r.run.value))?.kind ?? "" }));
}

function contentTriples(world: string, mode: Mode = "gold"): Triple[] {
  return select(`SELECT ?s ?p ?o WHERE { GRAPH <${G(world, mode).A}> { ?s ?p ?o } FILTER(?p != rdfs:label) }`).map((r) => ({ s: r.s, p: r.p, o: r.o }));
}

function anchorsFor(ts: Triple[], extra: string[] = []): string[] {
  const out = new Set(extra);
  for (const pr of Object.values(catalog.propositions)) {
    if (ts.some((t) => pr.s === `<${t.s.value}>` && pr.p === `<${t.p.value}>` && (pr.o === `<${t.o.value}>` || pr.o === JSON.stringify(t.o.value)))) pr.sentences.forEach((s) => out.add(s));
  }
  return [...out].filter((s) => sentences.has(s)).sort();
}

function speakersOf(vworld: string): { act: string; speakers: string[]; asserted: string; addressee?: string; reporter?: string; note: string } | null {
  const rows = select(`SELECT ?act ?speaker ?addressee ?reporter WHERE { ?act prof:hasContent <${NS.w + vworld}> ; crm:P14_carried_out_by ?speaker .
      OPTIONAL { ?act prof:addressee ?addressee } OPTIONAL { ?act prof:reportedBy ?reporter } }`);
  if (!rows.length) return null;
  const asserted = select(`SELECT ?speaker WHERE { GRAPH <${NS.asserted}reality> { ?act prof:hasContent <${NS.w + vworld}> ; crm:P14_carried_out_by ?speaker } }`)[0]?.speaker.value ?? rows[0].speaker.value;
  const mods = catalog.worlds.gold[vworld]?.notes.join(" ") ?? "";
  return { act: rows[0].act.value, speakers: [...new Set(rows.map((r) => r.speaker.value))], asserted, addressee: rows[0].addressee?.value, reporter: rows[0].reporter?.value, note: mods };
}

// ---------------------------------------------------------------- 1 & 2: insincere / false but sincere
function utteranceDossier(vworld: string, kind: "insincere" | "false-sincere", t: Triple, beliefWorld: string, bst: WorldStatus, rst: WorldStatus): Dossier {
  const b = new Builder();
  const sp = speakersOf(vworld)!;
  const vw = catalog.worlds.gold[vworld];
  b.select("What was said", `SELECT ?s ?p ?o WHERE { GRAPH <${NS.asserted}${vworld}> { ?s ?p ?o } }`,
    (rows) => `The statement records ${rows.length === 1 ? "one proposition" : rows.length + " propositions"}: ${lst(rows.map((r) => "“" + plain(renderTriple(r.s, r.p, r.o)) + "”"))}. A statement keeps what was said, without assuming the speaker means it (DEC: verbatim world).`);
  b.select("Who said it, to whom, reported by whom", `SELECT ?act ?speaker ?addressee ?reporter WHERE {
      ?act prof:hasContent <${NS.w + vworld}> ; crm:P14_carried_out_by ?speaker .
      OPTIONAL { ?act prof:addressee ?addressee } OPTIONAL { ?act prof:reportedBy ?reporter } }`,
    (rows) => {
      const names = [...new Set(rows.map((r) => label(r.speaker.value)))];
      const s = `It was said by ${label(sp.asserted)}` + (names.length > 1 ? `. Since Reality makes ${lst(names)} the same person, it was also said by ${lst(names.filter((n) => n !== label(sp.asserted)))}` : "") + ".";
      return s + (sp.addressee ? ` It is addressed to ${label(sp.addressee)}.` : "") + (sp.reporter ? ` It is known only through ${label(sp.reporter)}'s report.` : "");
    });
  b.select("The speaker's own beliefs", `SELECT ?agent ?world WHERE { VALUES ?agent { ${sp.speakers.map((x) => `<${x}>`).join(" ")} } ?agent prof:believes ?world }`,
    (rows) => `What ${lst([...new Set(rows.map((r) => label(r.agent.value)))])} believe${rows.length > 1 ? "" : "s"} is kept in “${worldTitle(NS.w + beliefWorld)}”. What is true in Reality does not leak into it (DEC: doxastic world).`);
  if (kind === "insincere") {
    const w = bst.witnesses![0];
    const ax = w.axiom.kind === "disjoint" ? `the rule that nothing is both ${humanClass(w.axiom.a)} and ${humanClass(w.axiom.b)}`
      : w.axiom.kind === "distinct" ? "the rule that two names cannot be the same person and not the same person (OWL itself, no added assumption)"
      : `the assumption that “${localName(w.axiom.predicate)}” has one value only`;
    b.select("Why the speaker cannot believe it", w.axiom.kind === "disjoint"
      ? `SELECT ?d WHERE { GRAPH <${NS.w + beliefWorld}> { <${t.s.value}> a ?d } { GRAPH <${NS.asserted}shared> { <${t.o.value}> owl:disjointWith ?d } } UNION { GRAPH <${NS.asserted}shared> { ?d owl:disjointWith <${t.o.value}> } } }`
      : w.axiom.kind === "distinct"
      ? `SELECT ?x ?y WHERE { GRAPH <${NS.w + beliefWorld}> { ?x <${w.triple.p.value}> ?y } VALUES (?x ?y) { (<${t.s.value}> <${t.o.value}>) (<${t.o.value}> <${t.s.value}>) } }`
      : `SELECT ?z WHERE { GRAPH <${NS.w + beliefWorld}> { <${t.s.value}> <${t.p.value}> ?z } FILTER(?z != <${t.o.value}>) }`,
      () => `The speaker's beliefs contain “${plain(w.parts)}” (${w.origin === "asserted" ? "stated there" : w.origin === "received" ? "inherited from " + w.originWorld : "inferred there by DEC"}). By ${ax}, this excludes “${T(t)}”. So the speaker said something they believed false.`);
  } else {
    b.ask("Does the speaker believe it?", `ASK { GRAPH <${NS.w + beliefWorld}> { ${nt(t)} } }`,
      (x) => x ? `Yes: “${T(t)}” is among the speaker's beliefs. Saying it was sincere.` : `Not directly (status among the beliefs: ${bst.status}).`);
  }
  const rw = rst.witnesses?.[0];
  b.select("Is it true in Reality?", rw?.axiom.kind === "distinct" ? `SELECT ?x ?y WHERE { ?x <${rw.triple.p.value}> ?y VALUES (?x ?y) { (<${t.s.value}> <${t.o.value}>) (<${t.o.value}> <${t.s.value}>) } }`
      : rw ? `SELECT ?d WHERE { <${t.s.value}> a ?d . { GRAPH <${NS.asserted}shared> { <${t.o.value}> owl:disjointWith ?d } } UNION { GRAPH <${NS.asserted}shared> { ?d owl:disjointWith <${t.o.value}> } } }`
      : `SELECT ?p ?o WHERE { <${t.s.value}> ?p ?o FILTER(?p = <${t.p.value}>) }`,
    () => rst.status.startsWith("contradicted") ? `No. Reality contains “${plain(rw!.parts)}”${rw!.origin === "received" ? " (from " + worldTitle(NS.w + rw!.originWorld!) + ")" : ""}, so what was said is false in the story.` : `Reality does not show it to be false (status: ${rst.status}).`);
  b.select("DEC's own verdict", `SELECT ?run ?relation ?other WHERE { GRAPH <${GRAPHS.runs}> { ?d ed:world <${NS.w + vworld}> ; ed:relation ?relation ; ed:run ?run . OPTIONAL { ?d ed:otherWorld ?other } } } ORDER BY ?run`,
    (rows) => rows.length ? `DEC's consistency checks recorded: ${lst([...new Set(rows.map((r) => decRelation(localName(r.relation.value)) + (r.other ? " " + worldTitle(r.other.value) : "") + " (run " + localName(r.run.value) + ")"))])}.` : "No DEC run checked this statement for conflicts.", "dec");
  const caveats: Caveat[] = [];
  if (sp.speakers.length > 1) caveats.push({ kind: "assumption", text: `That ${lst(sp.speakers.map(label))} are one person comes from Holmes's solution, which the story accepts.` });
  const bw = catalog.worlds.gold[beliefWorld];
  if (bw?.basis.includes("analyst")) caveats.push({ kind: "attribution", text: `“${bw.title}” are attributed by the editors from Holmes's solution: Windibank never states his beliefs.` });
  if (kind === "insincere" && bst.witnesses![0].axiom.kind === "closure") caveats.push({ kind: "assumption", text: `Assumes a person has one occupation at a time (DEC: closedFor ${localName((bst.witnesses![0].axiom as any).predicate)}).` });
  if (sp.reporter) caveats.push({ kind: "reported", text: `Reported by ${label(sp.reporter)}: the exact words are not in the text.` + (/hedged/i.test(sp.note) ? " The report is hedged: “he seemed to think, with me, that something had happened”." : "") });
  if (decDiagnostics(vworld, "gold").some((d) => d.relation === "delusionalWorld")) caveats.push({ kind: "semantics", text: "DEC also labels this statement “delusional” (test E08). For a statement this only means its content is false in Reality." });
  const tone = kind === "insincere" ? "red" : "black";
  const believer = gov("gold").find((g) => g.world === beliefWorld && g.predicate === "believes" && !g.viaIdentity)?.agent ?? sp.speakers.at(-1)!;
  const props: Triple[] = [t, ...(bst.witnesses ?? []).map((w) => w.triple)];
  return {
    id: `${kind}-${vworld}`, number: 0, type: kind, typeLabel: kind === "insincere" ? "Lie" : "Honest mistake", mode: "gold",
    title: `${label(sp.asserted)}: “${T(t)}”`, subtitle: vw.title,
    verdict: { label: kind === "insincere" ? "Says what he believes false" : "Said in good faith, but false", tone },
    stamp: kind === "insincere"
      ? { word: "Lie", sub: bst.witnesses![0].axiom.kind === "closure" ? "says what he believes false · if one job at a time" : "says what he believes false" }
      : { word: "Honest mistake", sub: "said in good faith, but false" },
    summary: kind === "insincere"
      ? `${label(sp.asserted)} said${sp.addressee ? ` to ${label(sp.addressee)}` : ""} that ${reported(t, sp.asserted)}, but ${believer === sp.asserted ? "his" : label(believer) + "'s"} own beliefs exclude it, and Reality rules it out.`
      : `${label(sp.asserted)} said${sp.addressee ? ` to ${label(sp.addressee)}` : ""} that ${reported(t, sp.asserted)} and believed it, but Reality rules it out. A false statement can be sincere.`,
    anchors: anchorsFor([t], catalog.worlds.gold[vworld].segments), steps: b.steps, caveats, dec: decDiagnostics(vworld, "gold"),
    ...fg(props, "gold", { worlds: [vworld, beliefWorld, "reality", "holmes_reconstruction"] }),
  };
}

function discoverUtterances(): Dossier[] {
  const out: Dossier[] = [];
  const W = catalog.worlds.gold;
  for (const v of Object.values(W).filter((w) => w.decType === "verbatim")) {
    const sp = speakersOf(v.local);
    if (!sp) continue;
    const beliefWorlds = [...new Set(gov("gold").filter((g) => g.predicate === "believes" && sp.speakers.includes(g.agent)).map((g) => g.world))];
    for (const t of contentTriples(v.local)) {
      const rst = statusIn(t, "gold", W.reality);
      for (const bwl of beliefWorlds) {
        const bst = statusIn(t, "gold", W[bwl]);
        if (bst.status.startsWith("contradicted")) out.push(utteranceDossier(v.local, "insincere", t, bwl, bst, rst));
        else if (["asserted", "received", "derived"].includes(bst.status) && rst.status.startsWith("contradicted")) out.push(utteranceDossier(v.local, "false-sincere", t, bwl, bst, rst));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- 3: delusional worlds
function delusionalDossier(w: WorldInfo): Dossier {
  const b = new Builder();
  const dec = decDiagnostics(w.local, "gold");
  b.select("DEC's verdict", `SELECT ?run ?other WHERE { GRAPH <${GRAPHS.runs}> { ?d ed:world <${w.iri}> ; ed:run ?run ; ed:relation ?rel . OPTIONAL { ?d ed:otherWorld ?other } FILTER(?rel = dec:delusionalWorld || ?other = dec:reality) } } ORDER BY ?run`,
    (rows) => `DEC labels “${w.title}” delusional in ${new Set(rows.map((r) => r.run.value)).size} run(s) (${lst([...new Set(rows.map((r) => localName(r.run.value)))])}): these beliefs cannot all be true together with Reality.`, "dec");
  const content = contentTriples(w.local);
  const per = content.map((t) => ({ t, st: statusIn(t, "gold", catalog.worlds.gold.reality) }));
  const conflicts = per.filter((x) => x.st.status.startsWith("contradicted"));
  b.select(`What “${w.title}” contains`, `SELECT ?s ?p ?o WHERE { GRAPH <${NS.asserted}${w.local}> { ?s ?p ?o } }`,
    (rows) => `${rows.length} beliefs are stated. Against Reality: ${lst(per.map((x) => `“${T(x.t)}” ${x.st.status.startsWith("contradicted") ? "is ruled out" : x.st.status === "not-determined" ? "is not settled" : "agrees"}`))}.`);
  const pc = pairConflicts("gold", w.iri, REALITY);
  b.select("Which rules make them clash", `SELECT DISTINCT ?x ?c ?d WHERE {
      GRAPH <${w.iri}> { ?x a ?c } GRAPH <${REALITY}> { ?x a ?d }
      { GRAPH <${NS.asserted}shared> { ?c owl:disjointWith ?d } } UNION { GRAPH <${NS.asserted}shared> { ?d owl:disjointWith ?c } } }`,
    (rows) => rows.length ? `Clashes with Reality: ${lst(rows.map((r) => `${label(r.x.value)} is “${humanClass(r.c.value)}” here but “${humanClass(r.d.value)}” in Reality`))}.` + (pc.some((c) => c.kind === "closure") ? ` If a person has one value only for some properties, also: ${lst(pc.filter((c) => c.kind === "closure").map((c) => `${label(c.detail.x)} ${localName(c.detail.p)} ${label(c.detail.y)} vs ${label(c.detail.z)}`))}.` : "")
      : (pc.length ? `No clash between kinds; only single-value differences: ${lst(pc.map((c) => `${label(c.detail.x)} ${localName(c.detail.p)} ${label(c.detail.y)} vs ${label(c.detail.z)}`))}.` : "The edition finds NO clash with Reality: nothing is of two incompatible kinds, and no single-value property has two different values."));
  const caveats: Caveat[] = [];
  let verdict: Dossier["verdict"];
  let stamp: Dossier["stamp"];
  let summary: string;
  if (pc.length === 0) {
    const ident = identicalClosedValues("gold", w.iri, REALITY);
    b.select("So why does DEC flag it?", `SELECT ?x ?y WHERE { VALUES ?p { ${closuresFor("gold").map((p) => `<${p}>`).join(" ")} } GRAPH <${w.iri}> { ?x ?p ?y } GRAPH <${REALITY}> { ?x ?p ?y } FILTER(STRSTARTS(STR(?x), "${NS.st}")) }`,
      (rows) => rows.length ? `Both sides give the SAME value to a single-value property (${lst(ident.map((i) => `${label(i.x)} ${localName(i.p)} ${label(i.y)}`))}). DEC's single-value check also fires on identical values (its test “<=” is always true): the flag is a bug, not a conflict.` : "No identical single-value property found.", "dec");
    const abl = ablations["T05a_owlcheck_only"]?.diagnostics?.filter((d: string) => d.includes(w.local) && d.includes("reality")) ?? null;
    if (abl) caveats.push({ kind: "defect", text: `Control run without the single-value check (T05a, no dec:closedFor): ${abl.length ? "still flagged" : "NOT flagged against Reality"}. The flag depends on the faulty check.` });
    caveats.push({ kind: "defect", text: "Known bug of fvitali/dec-reasoner@e6775b39, DecStatementHandler.verifyClosedFor (reports/dec_reasoner_notes.md §3)." });
    verdict = { label: "DEC flags it, but nothing conflicts", tone: "grey" };
    stamp = { word: "False alarm", sub: "DEC flags it, but nothing conflicts" };
    summary = `DEC labels “${w.title}” delusional, but these beliefs agree with Reality. The flag comes from a bug in DEC's single-value check, which fires on identical values.`;
  } else {
    verdict = { label: "Beliefs that Reality rules out", tone: "red" };
    stamp = { word: "Delusion", sub: "beliefs that Reality rules out" };
    summary = `Some of “${w.title}” cannot be true in Reality: ${lst(conflicts.map((x) => "“" + T(x.t) + "”"))}. A clash grounded in the text, not a psychological judgement.`;
    caveats.push({ kind: "semantics", text: "“Delusional” is DEC's technical term: incompatible with Reality given the data and rules. Holmes himself calls Mary's conviction a “delusion” (P138.S02)." });
    caveats.push({ kind: "assumption", text: "The clashes rest on shared rules: a journey is not both actual and pretended, a disappearance not both voluntary and involuntary, eyes not both weak and keen." });
  }
  const props = (conflicts.length ? conflicts.map((x) => x.t) : content).slice(0, 8);
  return {
    id: `delusional-${w.local}`, number: 0, type: "delusional", typeLabel: pc.length === 0 ? "False alarm" : "Delusion", title: w.title, subtitle: w.desc, verdict, stamp, summary, mode: "gold",
    anchors: anchorsFor(props, w.segments.slice(0, 12)), steps: b.steps, caveats, dec, ...fg(props, "gold", { worlds: [w.local, "reality", "holmes_reconstruction"] }),
  };
}

// ---------------------------------------------------------------- 4 & 5: identity, de re / de dicto, consequences
function identityDossier(): Dossier {
  const b = new Builder();
  const H = NS.st + "hosmer", Wb = NS.st + "windibank", M = NS.st + "mary";
  b.select("Where the identity is asserted", `SELECT ?g WHERE { GRAPH ?g { { <${H}> owl:sameAs <${Wb}> } UNION { <${Wb}> owl:sameAs <${H}> } } FILTER(STRSTARTS(STR(?g), "${NS.asserted}")) }`,
    (rows) => `“Hosmer Angel is James Windibank” is stated in ${lst(rows.map((r) => "“" + worldTitle(NS.w + localName(r.g.value)) + "”"))}. The two stay distinct entries in the graph: the identity is a proposition, not a merge.`);
  b.ask("Is it true in Reality?", `ASK { <${H}> owl:sameAs <${Wb}> }`,
    (x) => x ? "Yes. The story accepts Holmes's solution, so DEC copies it into Reality (DEC: epistemic → reality permeation)." : "No.", "dec");
  b.ask("Does Mary hold it?", `ASK { GRAPH <${NS.w}mary_D1> { <${H}> owl:sameAs <${Wb}> } }`,
    (x) => x ? "Yes." : "No. Reality does not leak into Mary's beliefs. She does not believe they are different men either: she simply has no belief about it.");
  b.ask("In Mary's beliefs, is she engaged to Hosmer?", `ASK { GRAPH <${NS.w}mary_D1> { <${M}> prof:engagedTo <${H}> } }`, (x) => x ? "Yes: she says so (P041.S02)." : "No.");
  b.ask("In Reality, is she engaged to Windibank?", `ASK { <${M}> prof:engagedTo <${Wb}> }`,
    (x) => x ? "Yes. DEC infers it from the identity: the man she was engaged to was, in fact, Windibank (de re)." : "No.", "dec");
  b.ask("…and inside Mary's world?", `ASK { GRAPH <${NS.w}mary_D1> { <${M}> prof:engagedTo <${Wb}> } }`,
    (x) => x ? "Yes — this would be a leak." : "No. The inference stays out of her beliefs: she was engaged to “Hosmer”, not knowingly to her stepfather (de dicto).");
  b.select("How KGRC encodes it", `SELECT ?scene ?source WHERE { GRAPH <${GRAPHS.kgrc}> { VALUES ?scene { d:504 d:507 d:518 } ?scene kgc:source ?source FILTER(lang(?source) = "en") } }`,
    (rows) => `In KGRC the identity is scene d:504 (“Windibank is Hosmer”), and the substitution is already applied inside Mary's beliefs: ${lst(rows.filter((r) => !r.scene.value.endsWith("504")).map((r) => "“" + r.source.value + "”"))}.`, "kgrc");
  const props: Triple[] = [
    { s: { type: "uri", value: H }, p: { type: "uri", value: NS.owl + "sameAs" }, o: { type: "uri", value: Wb } },
    { s: { type: "uri", value: M }, p: { type: "uri", value: NS.prof + "engagedTo" }, o: { type: "uri", value: H } },
    { s: { type: "uri", value: M }, p: { type: "uri", value: NS.prof + "engagedTo" }, o: { type: "uri", value: Wb } },
  ];
  return {
    id: "identity-hosmer", number: 0, type: "identity", typeLabel: "Identity", title: "Who is Hosmer Angel?", mode: "gold",
    subtitle: "One man, two names, two points of view", verdict: { label: "True in Reality, unknown to Mary", tone: "black" },
    stamp: { word: "Same person", sub: "true in Reality, unknown to Mary" },
    summary: "Holmes's solution makes Hosmer Angel and James Windibank the same man in Reality. DEC keeps the identity where it belongs: it changes what is true (Mary was engaged to her stepfather) but never enters Mary's beliefs.",
    anchors: anchorsFor(props, ["P126.S11", "P041.S02"]), steps: b.steps, caveats: [{ kind: "assumption", text: "The identity is Holmes's conclusion. The story accepts it: Windibank half-admits it (P127.S01) and the firm's letter confirms it (P136.S06)." }],
    dec: decDiagnostics("holmes_reconstruction", "gold"), ...fg(props, "gold", { worlds: ["holmes_reconstruction", "mary_D1", "reality", "windibank_beliefs"] }),
  };
}

function consequencesDossier(): Dossier {
  const b = new Builder();
  const Wb = NS.st + "windibank", H = NS.st + "hosmer";
  const rows = b.select("Propositions about Windibank that nobody stated", `SELECT ?p ?o WHERE {
      <${Wb}> ?p ?o . <${H}> ?p ?o .
      FILTER NOT EXISTS { GRAPH <${NS.asserted}reality> { <${Wb}> ?p ?o } }
      FILTER(?p != owl:sameAs && STRSTARTS(STR(?p), "${NS.prof}") || ?p = crm:P1_is_identified_by) }`,
    (rs) => `In Reality, ${rs.length} propositions hold of Windibank only because they hold of Hosmer Angel: ${lst(rs.map((r) => "“" + plain(renderTriple({ type: "uri", value: Wb }, r.p, r.o)) + "”"))}.`, "dec");
  const values = rows.map((r) => `(<${r.p.value}> ${r.o.type === "uri" ? `<${r.o.value}>` : JSON.stringify(r.o.value)})`).join(" ");
  b.ask("Do any of them enter Mary's world?", `ASK { VALUES (?p ?o) { ${values} } GRAPH <${NS.w}mary_D1> { <${Wb}> ?p ?o } }`,
    (x) => x ? "Yes — this would be a leak." : "No. None of them reaches Mary's beliefs: she knows nothing of him as the bridegroom.");
  const props: Triple[] = rows.slice(0, 5).map((r) => ({ s: { type: "uri", value: Wb }, p: r.p, o: r.o }));
  return {
    id: "consequences-identity", number: 0, type: "consequence", typeLabel: "Inference", title: "What follows from the identity", mode: "gold",
    subtitle: "Propositions DEC adds to Reality once Hosmer is Windibank", verdict: { label: "Inferred by DEC, never stated", tone: "black" },
    stamp: { word: "Inferred", sub: "by DEC, never stated" },
    summary: "Nobody states these propositions: DEC infers them in Reality from what holds of Hosmer and the accepted identity (e.g. Windibank wore tinted glasses).",
    anchors: anchorsFor(rows.map((r) => ({ s: { type: "uri", value: H }, p: r.p, o: r.o })), ["P051.S06", "P126.S11"]), steps: b.steps, caveats: [{ kind: "semantics", text: "These are the reasoner's inferences, not readings of the text." }],
    dec: [], ...fg(props, "gold", { worlds: ["reality", "mary_D1", "holmes_reconstruction"] }),
  };
}

// ---------------------------------------------------------------- 6: hypotheses over time (spoiler-free stages)
const STAGE: Record<string, string> = Object.fromEntries((text.checkpoints as any[]).map((c) => [c.id, c.label]));
function hypothesisDossier(simWorld: string, goldTwin?: string): Dossier {
  const b = new Builder("C4");
  const w = catalog.worlds.sim[simWorld];
  const cks = ["C1", "C2", "C3", "C4"] as Mode[];
  const states: string[] = [];
  for (const ck of cks) {
    if (!worldsIn(ck).some((x) => x.local === simWorld)) { states.push(`${STAGE[ck]}: not yet formed`); continue; }
    const pc = pairConflicts(ck, G(simWorld, ck).M, G("reality", ck).M);
    const decRuns = runs.filter((r) => r.dataset === ck && r.checkInconsistencies);
    const flagged = decRuns.filter((r) => r.diagnostics.some((d) => d.includes(NS.w + simWorld + " ") && d.includes("disagreesWith") && (d.includes("reality") || d.includes("DefaultGraph"))));
    const content = contentTriples(simWorld, ck);
    const established = content.length > 0 && content.every((t) => ask(`ASK { GRAPH <${G("reality", ck).M}> { ${nt(t)} } }`));
    states.push(`${STAGE[ck]}: ${pc.filter((c) => c.kind !== "closure").length ? "ruled out" : established ? "true" : "still possible"}` + (decRuns.length ? ` (DEC ${flagged.length ? "flags a conflict" : "finds no conflict"})` : ""));
    b.select(`Up to “${STAGE[ck]}”`,
      `SELECT DISTINCT ?x ?c ?d WHERE { GRAPH <${G(simWorld, ck).M}> { ?x a ?c } GRAPH <${G("reality", ck).M}> { ?x a ?d }
        { GRAPH <${G("shared", ck).A}> { ?c owl:disjointWith ?d } } UNION { GRAPH <${G("shared", ck).A}> { ?d owl:disjointWith ?c } } }`,
      (rows) => rows.length ? `Ruled out by what the reader now knows: ${lst(rows.map((r) => `${label(r.x.value)} is “${humanClass(r.c.value)}” in the guess but “${humanClass(r.d.value)}” in Reality`))}.`
        : established ? `Now true: its content holds in Reality (Holmes's solution has been accepted).`
        : `Nothing known so far rules it out: still possible (which is not the same as proven).`);
  }
  const final = states.at(-1)!;
  const incompatible = final.includes("ruled out");
  return {
    id: `hypothesis-${simWorld}`, number: 0, type: "hypothesis", typeLabel: "A reader's guess over time", title: w.title, subtitle: "Spoiler-free reading, stage by stage", mode: "C4",
    verdict: incompatible ? { label: "Possible until the unmasking, then ruled out", tone: "red" }
      : final.includes("true") ? { label: "Possible until the unmasking, then true", tone: "black" } : { label: "Never ruled out", tone: "black" },
    stamp: incompatible ? { word: "Refuted", sub: "possible until the unmasking" }
      : final.includes("true") ? { word: "Confirmed", sub: "at the unmasking" } : { word: "Still open", sub: "never ruled out" },
    summary: states.join(" · "), anchors: w.segments.length ? w.segments : ["P096.S04", "P100.S03", "P118.S06", "P128.S11"], steps: b.steps,
    caveats: [{ kind: "scope", text: "The stages simulate what a first-time READER knows, not what Holmes knows. At the unmasking, Holmes's solution is accepted by typing it as an accepted account (DEC has no “settle” operation)." },
      { kind: "attribution", text: "These guesses belong to a simulated reader (st:solver), not to a character." }],
    dec: (["C3", "C4"] as Mode[]).flatMap((ck) => decDiagnostics(simWorld, ck)), ...fg(contentTriples(simWorld, "C4").slice(0, 4), "C4", { worlds: [simWorld, "reality", "w10", "w01"] }),
  };
}

function watsonDossier(): Dossier {
  const b = new Builder();
  b.select("Watson's hypothesis", `SELECT ?s ?p ?o WHERE { GRAPH <${NS.asserted}watson_hyp> { ?s ?p ?o } }`,
    (rows) => `Watson supposes that ${lst(rows.map((r) => plain(renderTriple(r.s, r.p, r.o))))} (P099.S01).`);
  const pc = pairConflicts("gold", NS.w + "watson_hyp", REALITY);
  b.select("Does it clash with Reality?", `SELECT ?run ?other WHERE { GRAPH <${GRAPHS.runs}> { ?d ed:world <${NS.w}watson_hyp> ; ed:relation dec:disagreesWith ; ed:run ?run ; ed:otherWorld ?other } }`,
    (rows) => (rows.length ? `DEC flags it (${rows.length}).` : "DEC's consistency check finds no conflict (run T07c_watson).") + (pc.length ? "" : " The edition agrees: no rule excludes it."), "dec");
  b.select("Holmes's rejection", `SELECT ?text WHERE { GRAPH <${GRAPHS.text}> { <${NS.edb}text/P100.S01> ed:text ?text } }`,
    (rows) => `Holmes replies: ${rows[0] ? balanced(rows[0].text.value) : ""} He sets it aside; he does not disprove it.`);
  return {
    id: "hypothesis-watson", number: 0, type: "hypothesis", typeLabel: "Guess", title: "Watson's breach-of-promise guess", subtitle: "Rejected by Holmes, but never disproved", mode: "gold",
    verdict: { label: "Rejected by Holmes, not disproved", tone: "grey" }, stamp: { word: "Rejected", sub: "by Holmes, not disproved" },
    summary: "Holmes sets aside Watson's explanation of the typed signature, yet nothing in the data rules it out. The edition does not invent a contradiction.",
    anchors: ["P099.S01", "P100.S01"], steps: b.steps, caveats: [{ kind: "semantics", text: "A guess inherits Reality (DEC: conjectural permeation); only its own content is checked here." }],
    dec: decDiagnostics("watson_hyp", "gold"), ...fg(contentTriples("watson_hyp"), "gold", { worlds: ["watson_hyp", "reality"] }),
  };
}

// ---------------------------------------------------------------- 7: typewriter
function typewriterDossier(): Dossier {
  const b = new Builder("C3");
  const g = (l: string) => G(l, "C3");
  const S = NS.st;
  b.select("The evidence, up to “The typewriter”", `SELECT ?x ?profile WHERE { GRAPH <${g("reality").M}> { ?x prof:hasDefectProfile ?profile } }`,
    (rows) => `At this point, ${lst(rows.map((r) => label(r.x.value)))} show the same defects (${rows[0] ? label(rows[0].profile.value) : "?"}).`);
  b.ask("Is the machine identity true in Reality?", `ASK { GRAPH <${g("reality").M}> { <${S}m1> owl:sameAs <${S}m2> } }`, (x) => x ? "Yes." : "No: shared defects do not, by themselves, make two machines one.");
  b.ask("Under Holmes's principle?", `ASK { GRAPH <${g("w22").M}> { <${S}m1> owl:sameAs <${S}m2> } }`,
    (x) => x ? "Yes. Inside Holmes's assumption that “no two of them write exactly alike”, DEC infers that the two machines are one — but only there, as a supposition." : "No.", "dec");
  b.select("…so the letters were typed on the office machine", `SELECT ?letter WHERE { GRAPH <${g("w22").M}> { ?letter prof:typedOn <${S}m2> ; prof:purportsToBeFrom <${S}pC> } }`,
    (rows) => `Inside that supposition: ${lst(rows.map((r) => label(r.letter.value)))} were typed on the office typewriter.`, "dec");
  b.select("But who used the machine?", `SELECT ?m ?users WHERE { GRAPH <${g("reality").M}> { ?m prof:usedBy ?users } }`,
    (rows) => `Windibank himself says “We do all our correspondence with this machine at the office” (P117.S01): the machine is used by ${rows[0] ? label(rows[0].users.value) : "several people"}. The typewriter evidence alone does not single out the author.`);
  const pairs = b.select("Two authorship hypotheses", `SELECT ?h ?other WHERE { GRAPH <${GRAPHS.runs}> { ?d ed:run ed:x ; ed:world ?h ; ed:otherWorld ?other } }`.replace("ed:x", `<${NS.edb}run/T09c_authorship_alternatives>`),
    (rows) => `DEC (run T09c, assuming one author per letter) reports conflicts between: ${lst(rows.map((r) => `${worldTitle(r.h.value)} ↔ ${worldTitle(r.other.value)}`))}.`, "dec");
  const ident = identicalClosedValues("C3", g("w22").M, g("w23").M);
  b.select("Which of these are real?", `SELECT ?x ?y WHERE { GRAPH <${g("w22").M}> { ?x prof:writtenBy ?y } GRAPH <${g("w23").M}> { ?x prof:writtenBy ?y } }`,
    () => `Stepfather vs other clerk is a real clash, but only if a letter has one author. The pairs with Holmes's typewriter assumption are false alarms: both sides hold the SAME proposition (${lst(ident.map((i) => label(i.x) + " written by " + label(i.y)))}) and DEC's single-value check fires on identical values.`);
  void pairs;
  return {
    id: "typewriter", number: 0, type: "typewriter", typeLabel: "Evidence", title: "What the typewritten letters prove", subtitle: "Up to “The typewriter”", mode: "C3",
    verdict: { label: "Same machine only under Holmes's rule; the typist stays open", tone: "black" },
    stamp: { word: "Only if…", sub: "same machine only under Holmes's rule" },
    summary: "The shared defects prove the same machine only if one accepts Holmes's rule that no two typewriters write alike. Who typed the letters stays open: the whole office uses that machine.",
    anchors: ["P116.S01", "P116.S02", "P116.S04", "P117.S01", "P118.S04", "P118.S06"], steps: b.steps,
    caveats: [{ kind: "assumption", text: "Holmes's rule (“unless they are quite new, no two of them write exactly alike”) is a premise, not a fact." },
      { kind: "attribution", text: "“Another clerk typed them” is a what-if added by the editors; it is not in the text." },
      { kind: "defect", text: "The extra conflicts with Holmes's typewriter assumption come from DEC's single-value bug (identical values)." }],
    dec: (["w23", "w24", "w22"]).flatMap((w) => decDiagnostics(w, "C3")),
    ...fg([{ s: { type: "uri", value: S + "m1" }, p: { type: "uri", value: NS.owl + "sameAs" }, o: { type: "uri", value: S + "m2" } },
      { s: { type: "uri", value: S + "d1" }, p: { type: "uri", value: NS.prof + "writtenBy" }, o: { type: "uri", value: S + "pB" } }], "C3", { worlds: ["w22", "w23", "w24", "reality"] }),
  };
}

// ---------------------------------------------------------------- 8: predicted vs observed
function predictionDossier(): Dossier {
  const b = new Builder();
  b.ask("Does Holmes ever address Mary after she leaves?", `ASK { ?act a prof:CommunicativeAct ; crm:P14_carried_out_by st:holmes ; prof:addressee st:mary }`,
    (x) => x ? "Yes." : "No. After P080 Holmes never speaks or writes to Mary.");
  b.select("Where Mary's rejection exists", `SELECT ?g ?x ?y WHERE { GRAPH ?g { ?x prof:rejects ?y } }`,
    (rows) => `Only in ${lst([...new Set(rows.map((r) => "“" + worldTitle(r.g.value) + "”"))])}, about a telling that never happens (“If I tell her she will not believe me”).`);
  b.ask("Mary's last attested belief", `ASK { GRAPH w:mary_D1 { st:hosmer a prof:ExpectedToReturn } }`,
    (x) => x ? "Unchanged: she expects Hosmer to come back (P079.S03). No scene changes it." : "Not found.");
  b.select("KGRC's rendering of the ending", `SELECT ?scene ?p ?o WHERE { GRAPH <${GRAPHS.kgrc}> { VALUES ?scene { d:578 d:579 } ?scene ?p ?o FILTER(?p IN (kgc:source, kgc:if, kgc:hasPredicate)) FILTER(!isLiteral(?o) || lang(?o) = "en") } }`,
    () => "KGRC turns the prediction into a plain fact, d:578 (“Sutherland does not believe in Holmes”); its “if” part, d:579, is an empty node not linked to it.", "kgrc");
  return {
    id: "prediction-ending", number: 0, type: "prediction", typeLabel: "Prediction", title: "“If I tell her she will not believe me”", subtitle: "The ending (P138)", mode: "gold",
    verdict: { label: "Predicted, never observed: Mary does not change her mind in the text", tone: "black" },
    stamp: { word: "Predicted", sub: "never observed in the text" },
    summary: "The reader learns the solution; Mary never does, in the text. Holmes's sentence predicts how she would react to a telling that never happens.",
    anchors: ["P079.S03", "P137.S01", "P138.S01", "P138.S02"], steps: b.steps, caveats: [{ kind: "semantics", text: "DEC has no “if… then”: the prediction is modelled as a belief of Holmes about hypothetical events." }],
    dec: decDiagnostics("holmes_prediction", "gold"), ...fg([{ s: { type: "uri", value: NS.st + "hyp_reaction" }, p: { type: "uri", value: NS.prof + "rejects" }, o: { type: "uri", value: NS.st + "hyp_telling" } },
      { s: { type: "uri", value: NS.st + "hosmer" }, p: { type: "uri", value: NS.rdf + "type" }, o: { type: "uri", value: NS.prof + "ExpectedToReturn" } }], "gold", { worlds: ["holmes_prediction", "mary_D1", "reality"] }),
  };
}

// ---------------------------------------------------------------- 9: names
function nameDossier(app: string): Dossier {
  const b = new Builder();
  const A = NS.st + app;
  b.select(`Whom does ${label(A)} pick out?`, `SELECT ?g ?person WHERE { VALUES ?g { dec:reality w:holmes_reconstruction w:windibank_beliefs w:mary_D1 }
      GRAPH ?g { ?person crm:P1_is_identified_by <${A}> } } ORDER BY ?g`,
    (rows) => {
      const by = new Map<string, string[]>();
      for (const r of rows) by.set(r.g.value, [...(by.get(r.g.value) ?? []), label(r.person.value)]);
      return [...by].map(([g, ps]) => `in “${worldTitle(g)}”: ${lst([...new Set(ps)])}`).join("; ") + ".";
    });
  b.select("Stated or inferred?", `SELECT ?person ?asserted WHERE { ?person crm:P1_is_identified_by <${A}> BIND(EXISTS { GRAPH <${NS.asserted}reality> { ?person crm:P1_is_identified_by <${A}> } } AS ?asserted) }`,
    (rows) => lst(rows.map((r) => `${label(r.person.value)}: ${r.asserted.value === "true" ? "stated" : "inferred by DEC through the identity"}`)) + ".", "dec");
  b.select("Who used the name as a persona?", `SELECT ?act ?agent WHERE { GRAPH <${NS.asserted}holmes_reconstruction> { ?act prof:usedAppellation <${A}> ; crm:P14_carried_out_by ?agent } }`,
    (rows) => rows.length ? `${lst([...new Set(rows.map((r) => label(r.agent.value)))])} used this name to impersonate Hosmer (Holmes's solution, P126.S11).` : "No impersonation uses this name.");
  b.ask("Does Mary's world contain any naming proposition?", `ASK { GRAPH w:mary_D1 { ?x crm:P1_is_identified_by ?n } }`,
    (x) => x ? "Yes." : "No: who-is-called-what lives in Reality, and Reality does not leak into Mary's beliefs.");
  return {
    id: `name-${app}`, number: 0, type: "name", typeLabel: "Names", title: `The name ${label(A).replace("the name ", "")}`, subtitle: "A name is not a person", mode: "gold",
    verdict: { label: app === "app_hosmer_angel" ? "One name, one mask, one man behind it" : "Names the stepfather (and so, Hosmer)", tone: "black" },
    stamp: app === "app_hosmer_angel" ? { word: "A mask", sub: "the name covers Windibank" } : { word: "Two names", sub: "one man" },
    summary: "Names are kept apart from the people they name, and two names are never merged. What a name picks out depends on the point of view: in Reality, “Hosmer Angel” picks out Windibank too.",
    anchors: app === "app_hosmer_angel" ? ["P018.S03", "P093.S01", "P096.S02", "P126.S11"] : ["P020.S02", "P110.S01"], steps: b.steps,
    caveats: [{ kind: "semantics", text: "Two names of the same person are NOT declared identical (no owl:sameAs between names)." }],
    dec: [], ...fg([{ s: { type: "uri", value: NS.st + "hosmer" }, p: { type: "uri", value: NS.crm + "P1_is_identified_by" }, o: { type: "uri", value: A } },
      { s: { type: "uri", value: NS.st + "windibank" }, p: { type: "uri", value: NS.crm + "P1_is_identified_by" }, o: { type: "uri", value: A } }], "gold", { worlds: ["reality", "holmes_reconstruction"] }),
  };
}

// ---------------------------------------------------------------- registry
let all: Dossier[] | null = null;
export function dossiers(): Dossier[] {
  if (all) return all;
  const list: Dossier[] = [];
  list.push(identityDossier(), consequencesDossier());
  list.push(...discoverUtterances());
  const delusional = new Set(runs.flatMap((r) => r.dataset === "gold" ? r.diagnostics.filter((d) => d.endsWith("delusionalWorld")).map((d) => d.split(" ")[0]) : []));
  for (const w of Object.values(catalog.worlds.gold)) if (delusional.has(w.iri) && w.decType !== "verbatim") list.push(delusionalDossier(w));
  list.push(hypothesisDossier("w20"), hypothesisDossier("w21"), watsonDossier(), typewriterDossier(), predictionDossier(), nameDossier("app_hosmer_angel"));
  // numbered in the order of the questions they test (annotations/questions.json); any case file not listed there goes last
  const rank = (d: Dossier) => { const i = caseOrder.indexOf(d.id); return i < 0 ? caseOrder.length + list.indexOf(d) : i; };
  list.sort((a, b) => rank(a) - rank(b));
  list.forEach((d, i) => (d.number = i + 1));
  all = list;
  return all;
}

export function dossierIndex() {
  return dossiers().map(({ steps, graph, focus, ...rest }) => ({ ...rest, nSteps: steps.length, ...(questionOf(rest.id) ?? {}) }));
}

export function dossiersForSentence(sid: string) {
  return dossiers().filter((d) => d.anchors.includes(sid)).map((d) => ({ id: d.id, number: d.number, title: d.title, typeLabel: d.typeLabel, verdict: d.verdict, stamp: d.stamp }));
}
