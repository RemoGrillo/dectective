// Venn payloads: who says / believes / concludes / supposes what, against Reality.
// One set per (person, verb) with the facts the person holds (own stances, not inherited) + Reality (facts true in
// the story). Links: what X SAYS that Y BELIEVES (deceives = X believes otherwise; misleads = false but X sincere;
// tells = not false). Clashes: a fact held by someone and the Reality fact that rules it out.
// Used for the whole map (Cognitive worlds, on the Perspectives page) and for focused maps (one sentence, one case file).
import { createHash } from "node:crypto";
import type { Mode } from "./config.ts";
import { catalog, worldsIn } from "./data.ts";
import { plain, renderTriple } from "./render.ts";
import type { Triple } from "./rules/incompatibility.ts";
import { statusIn } from "./rules/perspectives.ts";
import { viewpointFrom, type Viewpoint } from "./rules/viewpoints.ts";
import { n3, parseN3 } from "./store.ts";

const keyOf = (t: Triple) => `${n3(t.s)} ${n3(t.p)} ${n3(t.o)}`;
const tripleOfRow = (r: Viewpoint): Triple | null => {
  const pr = catalog.propositions[r.id];
  return pr ? { s: parseN3(pr.s), p: parseN3(pr.p), o: parseN3(pr.o) } : (r as any).__triple ?? null;
};

/** The viewpoint (Reality + people) of any triple, in a mode. */
export function viewpointOfTriple(t: Triple, m: Mode): Viewpoint {
  const k = keyOf(t);
  const pr = Object.values(catalog.propositions).find((x) => x.dataset === (m === "gold" ? "gold" : "sim") && `${x.s} ${x.p} ${x.o}` === k);
  const id = pr?.id ?? "t_" + createHash("sha1").update(k).digest("hex").slice(0, 12);
  const statuses = worldsIn(m).filter((w) => w.local !== "shared").map((w) => statusIn(t, m, w));
  const parts = renderTriple(t.s, t.p, t.o);
  const vp = viewpointFrom({ id, parts, text: plain(parts), world: pr?.world ?? "", statuses }, m);
  (vp as any).__triple = t;
  return vp;
}

/** Venn of the given facts. With `addWitnesses`, the Reality facts that rule a false one out are added as facts too. */
export function vennFromViewpoints(rows0: Viewpoint[], m: Mode, addWitnesses: boolean) {
  const realityWorld = worldsIn(m).find((w) => w.local === "reality")!;
  const rows = [...rows0];
  const byKey = new Map<string, string>();
  for (const r of rows) { const t = tripleOfRow(r); if (t) byKey.set(keyOf(t), r.id); }
  // the witnesses in Reality of every false fact
  const witnessOf = new Map<string, { t: Triple; text: string; assumption: boolean }[]>();
  for (const r of rows0.filter((x) => x.reality.value === "false" || x.reality.value === "false-if")) {
    const t = tripleOfRow(r);
    if (!t) continue;
    const st = statusIn(t, m, realityWorld);
    witnessOf.set(r.id, (st.witnesses ?? []).map((w) => ({ t: w.triple, text: plain(w.parts), assumption: w.axiom.kind === "closure" })));
    if (addWitnesses) for (const w of st.witnesses ?? []) {
      const k = keyOf(w.triple);
      if (!byKey.has(k)) { const vp = viewpointOfTriple(w.triple, m); rows.push(vp); byKey.set(k, vp.id); }
    }
  }
  const sets = new Map<string, { id: string; kind: string; person?: string; personName?: string; alias?: string; label: string; worlds: Set<string>; items: Set<string> }>();
  let realityCount = 0;
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
    if (r.reality.value === "true") { realityCount++; memb.push("reality"); }
    return { id: r.id, n: i + 1, text: r.text, sid: r.sentences?.[0] ?? null, reality: r.reality.value, realityHow: r.reality.how, sets: memb.sort(),
      diagnoses: r.diagnoses.map((d) => ({ kind: d.kind, person: d.person, personName: d.personName, text: d.text, assumption: d.assumption })) };
  }).filter((it) => it.sets.length > 0);
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
  const clashes = [...witnessOf.entries()].flatMap(([item, ws]) => ws.map((w) => ({ item, other: byKey.get(keyOf(w.t)) ?? null, text: w.text, assumption: w.assumption })))
    .filter((c) => items.some((i) => i.id === c.item));
  return {
    mode: m,
    sets: [{ id: "reality", kind: "reality", label: "Reality", size: realityCount, worlds: ["Reality"] },
      ...[...sets.values()].map((x) => ({ id: x.id, kind: x.kind, person: x.person, personName: x.personName, alias: x.alias, label: x.label, size: x.items.size, worlds: [...x.worlds].sort() }))],
    items, links, clashes,
  };
}

/** A focused Venn: the given triples (deduplicated) plus the Reality facts that rule the false ones out. */
export function vennForTriples(triples: Triple[], m: Mode) {
  const seen = new Set<string>();
  const rows = triples.filter((t) => { const k = keyOf(t); if (seen.has(k)) return false; seen.add(k); return true; }).map((t) => viewpointOfTriple(t, m));
  return vennFromViewpoints(rows, m, true);
}
