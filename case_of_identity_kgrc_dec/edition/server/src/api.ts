// JSON API of the edition.
import { Router, type Request } from "express";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ANNOTATIONS_DIR, PORTRAITS_DIR, DEC_COMMIT, GRAPHS, MODES, NS, PREFIXES, REALITY, type Mode } from "./config.ts";
import { agents, buildInfo, catalog, graphs, labels, runs, sentences, text, worldsIn } from "./data.ts";
import { dossierIndex, dossiers, dossiersForSentence } from "./dossiers.ts";
import { buildGraph } from "./graph.ts";
import { label, plain, renderTriple } from "./render.ts";
import { CLOSURES, identicalClosedValues, pairConflicts } from "./rules/incompatibility.ts";
import { agentStances, isContent, kaleidoscope, propositionView, statusIn, worldsSummary } from "./rules/perspectives.ts";
import { timelinePayload } from "./timeline.ts";
import { mergedPersonas, peopleFor, sentenceMarks, viewpoint, viewpointFrom, type Viewpoint } from "./rules/viewpoints.ts";
import { ask, parseN3, select } from "./store.ts";

/** "was an actual journey" → "an actual journey" (class phrase without the verb). */
const humanClass = (iri: string) => (labels.classes[iri.split("#").pop()!.split("/").pop()!] ?? label(iri)).replace(/^(was|is|has|will) /, "");
const mode = (req: Request): Mode => (MODES as readonly string[]).includes(String(req.query.mode)) ? (req.query.mode as Mode) : "gold";
const checkpointOrder = ["C1", "C2", "C3", "C4", "G"];

const kgrcAligned = new Map<string, string[]>();
for (const r of select(`SELECT ?scene ?s WHERE { GRAPH <${GRAPHS.annotation}> { ?scene ed:autoAlignedSentence ?s } }`)) {
  const sid = r.s.value.split("/").pop()!;
  kgrcAligned.set(sid, [...(kgrcAligned.get(sid) ?? []), r.scene.value.split("/").pop()!]);
}
const units = select(`SELECT ?unit ?s ?coverage ?theme ?issue ?content WHERE { GRAPH <${GRAPHS.annotation}> {
    ?unit a ed:AlignmentUnit ; ed:supportedBy ?s ; ed:coverage ?coverage ; ed:theme ?theme ; ed:propositionalContent ?content . OPTIONAL { ?unit ed:issue ?issue } } }`);
const unitsBySentence = new Map<string, any[]>();
for (const u of units) {
  const sid = u.s.value.split("/").pop()!;
  const scenes = select(`SELECT ?scene WHERE { GRAPH <${GRAPHS.annotation}> { <${u.unit.value}> ed:kgrcScene ?scene } }`).map((r) => r.scene.value.split("/").pop());
  unitsBySentence.set(sid, [...(unitsBySentence.get(sid) ?? []), { id: u.unit.value.split("/").pop(), coverage: u.coverage.value, theme: u.theme.value, issue: u.issue?.value ?? "", content: u.content.value, kgrcScenes: scenes }]);
}

function textPayload(m: Mode) {
  return {
    ...text,
    paragraphs: text.paragraphs.map((p) => ({
      ...p,
      sentences: p.sentences.map((s) => {
        const { marks, diagnoses } = sentenceMarks(s.id, m);
        const ds = m === "gold" ? dossiersForSentence(s.id) : [];
        return {
          id: s.id, text: s.text, marks, diagnoses: diagnoses.map((d) => ({ kind: d.kind, person: d.person, text: d.text })),
          nProps: (m === "gold" ? s.props : s.simProps).filter(isContent).length,
          dossiers: ds.map((d) => ({ id: d.id, number: d.number, type: d.typeLabel, tone: d.verdict.tone, stamp: d.stamp })),
        };
      }),
    })),
  };
}
const textCache = new Map<Mode, any>();

// ---------------------------------------------------------------- knowledge map (all content propositions x people)
const kmCache = new Map<Mode, any>();
function knowledgeMap(m: Mode) {
  if (kmCache.has(m)) return kmCache.get(m);
  const ds = m === "gold" ? "gold" : "sim";
  const seen = new Set<string>();
  const rows: Viewpoint[] = [];
  for (const pr of Object.values(catalog.propositions)) {
    if (pr.dataset !== ds || !isContent(pr.id)) continue;
    if (m !== "gold" && checkpointOrder.indexOf(pr.checkpoint) > checkpointOrder.indexOf(m)) continue;
    const k = `${pr.s} ${pr.p} ${pr.o}`;
    if (seen.has(k) || pr.world === "shared") continue;
    seen.add(k);
    rows.push(viewpoint(pr.id, m)!);
  }
  rows.sort((a, b) => (a.sentences[0] ?? "Z").localeCompare(b.sentences[0] ?? "Z"));
  const res = { mode: m, people: peopleFor(m).map(({ agent, alias }) => ({ id: agent.id, short: agent.short, name: agent.name, kind: agent.kind, alias })), rows };
  kmCache.set(m, res);
  return res;
}

// ---------------------------------------------------------------- names: only names that pick out more than one person
function names(m: Mode) {
  const g = graphs(m, "reality");
  const apps = select(`SELECT DISTINCT ?app ?label WHERE { GRAPH <${g.A}> { ?app a crm:E41_Appellation ; rdfs:label ?label } }`);
  return apps.map((a) => {
    const persons = select(`SELECT ?p ?asserted WHERE { GRAPH <${g.M}> { ?p crm:P1_is_identified_by <${a.app.value}> } BIND(EXISTS { GRAPH <${g.A}> { ?p crm:P1_is_identified_by <${a.app.value}> } } AS ?asserted) }`)
      .map((p) => ({ iri: p.p.value, id: agents.find((x) => x.gold === p.p.value || x.sim === p.p.value)?.id ?? null, name: label(p.p.value), inferred: p.asserted.value !== "true" }));
    // which belief worlds know the link (a name picking out a second person)
    const believers = worldsIn(m).filter((w) => w.decType === "doxastic").filter((w) =>
      persons.filter((p) => p.inferred).some((p) => ask(`ASK { GRAPH <${graphs(m, w.local).M}> { <${p.iri}> crm:P1_is_identified_by <${a.app.value}> } }`))).map((w) => w.title);
    return { appellation: a.app.value, label: a.label.value, persons, believers };
  }).filter((x) => x.persons.length > 1);
}

// ---------------------------------------------------------------- world map: DEC verdicts aggregated over runs + defect check
const worldsCache = new Map<Mode, any>();
function worldsPayload(m: Mode) {
  const ds = m === "gold" ? "gold" : m;
  const W = worldsSummary(m);
  const local = (iri: string) => (iri === REALITY ? "reality" : iri.split("/").pop()!);
  const known = new Set(W.map((w) => w.local));
  const pairs = new Map<string, { a: string; b: string; runs: { id: string; kind: string; closedFor: boolean }[] }>();
  const delusional = new Map<string, { id: string; kind: string; closedFor: boolean }[]>();
  const tested = new Map<string, Set<string>>();               // world -> worlds it shared a conflict-checked slice with
  for (const x of runs.filter((r) => r.dataset === ds)) {
    const run = { id: x.id, kind: x.kind, closedFor: x.closedFor.length > 0 };
    for (const d of x.diagnostics) {
      const [s, p, o] = d.split(" ");
      if (p === NS.dec + "disagreesWith") {
        const [a, b] = [local(s), local(o)].sort();
        const k = a + "|" + b;
        if (!pairs.has(k)) pairs.set(k, { a, b, runs: [] });
        const e = pairs.get(k)!;
        if (!e.runs.some((r) => r.id === run.id)) e.runs.push(run);
      } else if (o === NS.dec + "delusionalWorld") {
        const w = local(s);
        if (!delusional.has(w)) delusional.set(w, []);
        if (!delusional.get(w)!.some((r) => r.id === run.id)) delusional.get(w)!.push(run);
      }
    }
    if (x.checkInconsistencies) {
      const ws = x.worlds.map(local);
      for (const a of ws) for (const b of ws) if (a !== b) { if (!tested.has(a)) tested.set(a, new Set()); tested.get(a)!.add(b); }
    }
  }
  const disagreements = [...pairs.values()].filter((p) => known.has(p.a) && known.has(p.b)).map((p) => {
    const gA = graphs(m, p.a).M, gB = graphs(m, p.b).M;
    const conflicts = pairConflicts(m, gA, gB);
    const identical = identicalClosedValues(m, gA, gB);
    const real = conflicts.filter((c) => c.kind === "disjoint");
    const verdict = conflicts.length === 0 && identical.length > 0 ? "artifact"     // only DEC's closedFor defect (identical values)
      : real.length === 0 && conflicts.length > 0 ? "assumption"                     // only under a declared closure
      : conflicts.length > 0 ? "conflict" : "unexplained";
    return {
      ...p, verdict,
      conflicts: conflicts.slice(0, 12).map((c) => ({ kind: c.kind, text: c.kind === "disjoint"
        ? `${label(c.detail.x)} — ${humanClass(c.detail.c)} and ${humanClass(c.detail.d)}`
        : `${label(c.detail.x)} ${labels.predicates[c.detail.p.split("#").pop()!] ?? label(c.detail.p)} ${label(c.detail.y)} and ${label(c.detail.z)}` })),
      identical: identical.slice(0, 6).map((i) => `${label(i.x)} ${label(i.p)} ${label(i.y)}`),
    };
  });
  const worlds = W.map((w) => ({
    ...w,
    delusional: delusional.get(w.local) ?? [],
    delusionalVerdict: (delusional.get(w.local) ?? []).length === 0 ? null
      : disagreements.some((d) => (d.a === w.local || d.b === w.local) && (d.a === "reality" || d.b === "reality") && d.verdict === "artifact") ? "artifact"
      : disagreements.some((d) => (d.a === w.local || d.b === w.local) && (d.a === "reality" || d.b === "reality") && d.verdict === "assumption") ? "assumption" : "conflict",
    testedWith: [...(tested.get(w.local) ?? [])].sort(),
  }));
  return { mode: m, worlds, disagreements, runs: runs.filter((r) => r.dataset === ds).map((r) => ({ id: r.id, kind: r.kind, closedFor: r.closedFor, checkInconsistencies: r.checkInconsistencies })) };
}

/** Portraits available now (read at each request, so new images need no restart): id → oval image and face thumbnail.
 *  Uses the web versions in portraits/web/ (scripts/build_portraits.py) when present, the original file otherwise. */
function portraitIndex(): Record<string, { full: string; face: string }> {
  if (!existsSync(PORTRAITS_DIR)) return {};
  const webDir = path.join(PORTRAITS_DIR, "web");
  const web = existsSync(webDir) ? readdirSync(webDir) : [];
  const out: Record<string, { full: string; face: string }> = {};
  for (const f of readdirSync(PORTRAITS_DIR).filter((x) => /\.(png|jpe?g|webp)$/i.test(x)).sort()) {
    const id = f.replace(/\.[^.]+$/, "").toLowerCase();
    const full = web.includes(`${id}.webp`) ? `/portraits/web/${id}.webp` : `/portraits/${f}`;
    out[id] = { full, face: web.includes(`${id}-face.webp`) ? `/portraits/web/${id}-face.webp` : full };
  }
  return out;
}

// ---------------------------------------------------------------- Venn: who says / believes / concludes / supposes what, against Reality
// One set per (person, verb) with the facts the person holds (own stances, not inherited) + Reality (facts true in
// the story). Links: what X SAYS that Y BELIEVES (deceives = X believes otherwise and Reality rules it out;
// misleads = false but X sincere; tells = not false); clashes = a fact held by someone and the Reality fact that
// rules it out.
const vennCache = new Map<Mode, any>();
function vennPayload(m: Mode) {
  if (vennCache.has(m)) return vennCache.get(m);
  const km = knowledgeMap(m);
  const rows: Viewpoint[] = km.rows.filter((r: Viewpoint) => r.people.some((p) => p.stances.some((s) => s.polarity === "yes")));
  const sets = new Map<string, { id: string; kind: string; person?: string; personName?: string; alias?: string; label: string; worlds: Set<string>; items: Set<string> }>();
  const realityItems = new Set<string>();
  const items = rows.map((r, i) => {
    const memb: string[] = [];
    for (const p of r.people) {
      for (const st of p.stances.filter((x) => x.polarity === "yes")) {
        const id = `${p.id}:${st.verb}`;
        if (!sets.has(id)) sets.set(id, { id, kind: st.verb, person: p.id, personName: p.short, alias: p.alias, label: `${p.short} ${st.verb}`, worlds: new Set(), items: new Set() });
        sets.get(id)!.worlds.add(st.worldTitle);
        sets.get(id)!.items.add(r.id);
        if (!memb.includes(id)) memb.push(id);
      }
    }
    if (r.reality.value === "true") { realityItems.add(r.id); memb.push("reality"); }
    return { id: r.id, n: i + 1, text: r.text, reality: r.reality.value, realityHow: r.reality.how, sets: memb.sort(),
      diagnoses: r.diagnoses.map((d) => ({ kind: d.kind, person: d.person, personName: d.personName, text: d.text, assumption: d.assumption })) };
  });
  // what X says that Y believes
  const links: any[] = [];
  for (const a of sets.values()) {
    if (a.kind !== "says") continue;
    for (const b of sets.values()) {
      if (b.kind !== "believes" || b.person === a.person) continue;
      const shared = [...a.items].filter((x) => b.items.has(x));
      if (!shared.length) continue;
      const kindOf = (pid: string) => {
        const it = items.find((x) => x.id === pid)!;
        if (it.diagnoses.some((d) => d.kind === "lie" && d.person === a.person)) return "deceives";
        return it.reality === "false" || it.reality === "false-if" ? "misleads" : "tells";
      };
      const kinds = shared.map(kindOf);
      const kind = kinds.includes("deceives") ? "deceives" : kinds.includes("misleads") ? "misleads" : "tells";
      links.push({ from: a.id, to: b.id, kind, items: shared, byItem: Object.fromEntries(shared.map((x, i) => [x, kinds[i]])) });
    }
  }
  // clashes: a fact held by someone that Reality rules out, and the Reality fact that does it (when it is also shown)
  const keyOf = new Map(rows.map((r) => { const pr = catalog.propositions[r.id]; return [`${pr.s} ${pr.p} ${pr.o}`, r.id]; }));
  const clashes: any[] = [];
  const realityWorld = worldsIn(m).find((w) => w.local === "reality")!;
  for (const r of rows.filter((x) => x.reality.value === "false" || x.reality.value === "false-if")) {
    const pr = catalog.propositions[r.id];
    const st = statusIn({ s: parseN3(pr.s), p: parseN3(pr.p), o: parseN3(pr.o) }, m, realityWorld);
    for (const w of st.witnesses ?? []) {
      const other = keyOf.get(`${w.triple.s.type === "uri" ? `<${w.triple.s.value}>` : JSON.stringify(w.triple.s.value)} <${w.triple.p.value}> ${w.triple.o.type === "uri" ? `<${w.triple.o.value}>` : JSON.stringify(w.triple.o.value)}`);
      clashes.push({ item: r.id, other: other ?? null, text: plain(w.parts), assumption: w.axiom.kind === "closure" });
    }
  }
  const res = {
    mode: m,
    sets: [{ id: "reality", kind: "reality", label: "Reality", size: realityItems.size, worlds: ["Reality"] },
      ...[...sets.values()].map((x) => ({ id: x.id, kind: x.kind, person: x.person, personName: x.personName, alias: x.alias, label: x.label, size: x.items.size, worlds: [...x.worlds].sort() }))],
    items, links, clashes,
  };
  vennCache.set(m, res);
  return res;
}

const examplesFile = YAML.parse(readFileSync(path.join(ANNOTATIONS_DIR, "examples.yaml"), "utf8"));
export const examples = (examplesFile.examples as any[]).map((e) => ({ ...e, sparql: (examplesFile.prefixes as string) + "\n" + e.sparql.trim() + "\n" }));

export function api(): Router {
  const r = Router();
  r.get("/meta", (_req, res) => res.json({
    title: "A Case of Identity — an augmented edition", decCommit: DEC_COMMIT, build: buildInfo, modes: MODES,
    sections: text.sections, checkpoints: text.checkpoints, agents, closures: CLOSURES, prefixes: PREFIXES,
    portraits: portraitIndex(),
    graphs: [
      { iri: "(default graph)", role: "Reality, whole story (copy of DEC's reality world)" },
      { iri: REALITY, role: "Reality, whole story (DEC reality world)" },
      { iri: NS.w + "<world>", role: "DEC materialised view of a world (e.g. w:mary_D1)" },
      { iri: NS.asserted + "<world>", role: "what a world states before DEC's inferences ('reality' = narrated facts)" },
      { iri: NS.snapshot + "<Ck>/<world>", role: "DEC view at spoiler-free stage C1–C4 (neutral names st:pA…)" },
      { iri: NS.snapshotAsserted + "<Ck>/<world>", role: "what a world states at stage Ck" },
      { iri: GRAPHS.text, role: "text: sections, paragraphs, sentences, speakers, pages" },
      { iri: GRAPHS.annotation, role: "propositions, modules, worlds, alignment units, KGRC links" },
      { iri: GRAPHS.runs, role: "DEC runs and their diagnoses (disagreesWith, delusionalWorld)" },
      { iri: "http://example.org/dectective/edition/timeline", role: "Deductions: clues (sentences) and the first clue of each DEC conclusion (ed:firstClue)" },
      { iri: GRAPHS.kgrc, role: "original KGRC graph (CC BY 4.0, SIG-SWO JSAI)" },
    ],
  }));
  r.get("/text", (req, res) => {
    const m = mode(req);
    if (!textCache.has(m)) textCache.set(m, textPayload(m));
    res.json(textCache.get(m));
  });
  r.get("/sentence/:id", (req, res) => {
    const m = mode(req);
    const s = sentences.get(req.params.id);
    if (!s) return res.status(404).json({ error: "unknown sentence" });
    const stage = text.checkpoints.find((c) => c.id === m);
    if (m !== "gold" && checkpointOrder.indexOf(s.paragraph.revealedBy) > checkpointOrder.indexOf(m)) {
      return res.json({ id: s.id, hidden: true, reason: `This sentence comes after “${stage?.label ?? m}”.` });
    }
    const k = kaleidoscope(s.id, m);
    const { marks, diagnoses } = sentenceMarks(s.id, m);
    // most telling first: a diagnosis, then disagreement, then the rest
    const vps = (k.propositions as any[]).map((p) => viewpointFrom(p, m)).sort((a, b) =>
      (b.diagnoses.length ? 2 : b.divergent ? 1 : 0) - (a.diagnoses.length ? 2 : a.divergent ? 1 : 0));
    const top = vps.slice(0, 4);
    const triples = top.map((v) => { const pr = catalog.propositions[v.id]; return { s: parseN3(pr.s), p: parseN3(pr.p), o: parseN3(pr.o) }; });
    const statuses = new Map(top.map((v, i) => [`${triples[i].s.value}|${triples[i].p.value}|${triples[i].o.type === "uri" ? triples[i].o.value : JSON.stringify(triples[i].o.value)}`,
      (k.propositions as any[]).find((p) => p.id === v.id).statuses]));
    res.json({
      id: s.id, text: s.text, paragraph: { id: s.paragraph.id, speaker: s.paragraph.speaker, page: s.paragraph.page, section: s.paragraph.section },
      mode: m, marks, diagnoses, viewpoints: vps, dossiers: m === "gold" ? dossiersForSentence(s.id) : [],
      units: unitsBySentence.get(s.id) ?? [], kgrcAuto: kgrcAligned.get(s.id) ?? [],
      graph: triples.length ? buildGraph(triples, m, { statuses }) : [],
    });
  });
  r.get("/proposition/:id", (req, res) => {
    const v = propositionView(req.params.id, mode(req));
    if (!v) return res.status(404).json({ error: "unknown proposition" });
    res.json(v);
  });
  r.get("/dossiers", (_req, res) => res.json(dossierIndex()));
  r.get("/dossiers/:id", (req, res) => {
    const d = dossiers().find((x) => x.id === req.params.id);
    if (!d) return res.status(404).json({ error: "unknown dossier" });
    res.json({ ...d, anchorTexts: d.anchors.map((a) => ({ id: a, text: sentences.get(a)?.text ?? "" })) });
  });
  r.get("/venn", (req, res) => res.json(vennPayload(mode(req))));
  r.get("/worlds", (req, res) => {
    const m = mode(req);
    if (!worldsCache.has(m)) worldsCache.set(m, worldsPayload(m));
    res.json(worldsCache.get(m));
  });
  r.get("/knowledge", (req, res) => res.json(knowledgeMap(mode(req))));
  r.get("/names", (req, res) => res.json(names(mode(req))));
  r.get("/agents/:id", (req, res) => {
    const m = mode(req);
    const a = agents.find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: "unknown agent" });
    const km = knowledgeMap(m);
    const merged = mergedPersonas(m);
    const shownAs = merged.get(a.id) ?? a.id;                 // a persona's stances live in the person behind the mask
    const iri = m === "gold" ? a.gold : a.sim;
    const worlds = worldsSummary(m).filter((w) => w.governedBy.some((g: any) => g.agent === iri && (!merged.has(a.id) || !g.viaIdentity)));
    const stances = km.rows.map((r: Viewpoint) => {
      const p = r.people.find((x) => x.id === shownAs);
      let st = p?.stances ?? [];
      if (merged.has(a.id)) st = st.filter((x) => x.asName === a.name);
      return { id: r.id, text: r.text, parts: r.parts, sentences: r.sentences, reality: r.reality.value, stances: st, diagnoses: r.diagnoses.filter((d) => d.person === shownAs) };
    });
    const nm = names(m).filter((n) => n.persons.some((p) => p.id === a.id || p.id === shownAs));
    res.json({ agent: a, mode: m, mergedInto: merged.get(a.id) ?? null, alias: [...merged.entries()].filter(([, o]) => o === a.id).map(([p]) => agents.find((x) => x.id === p)!.name),
      worlds, stances, names: nm });
  });
  r.get("/timeline", (req, res) => res.json(timelinePayload(mode(req))));
  r.get("/examples", (_req, res) => res.json(examples));
  r.get("/runs", (_req, res) => res.json(runs.map(({ diagnostics, test_result, ...x }) => ({ ...x, nDiagnostics: diagnostics.length, test: test_result ? { classification: test_result.classification, matches: test_result.matches_expected } : null }))));
  r.get("/status", (req, res) => {
    // ad hoc: status of an arbitrary triple (N-Triples terms) in every world of a mode
    const m = mode(req);
    const { s, p, o } = req.query as Record<string, string>;
    if (!s || !p || !o) return res.status(400).json({ error: "s, p, o required (N-Triples terms)" });
    const t = { s: parseN3(s), p: parseN3(p), o: parseN3(o) };
    const statuses = worldsIn(m).filter((w) => w.local !== "shared").map((w) => statusIn(t, m, w));
    const parts = renderTriple(t.s, t.p, t.o);
    res.json({ text: plain(parts), statuses, agents: agentStances(statuses, m), viewpoint: viewpointFrom({ id: "adhoc", parts, text: plain(parts), world: "", statuses }, m) });
  });
  return r;
}
