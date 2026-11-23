// Deterministic English rendering of IRIs and propositions (no language model involved).
import { NS, REALITY } from "./config.ts";
import { agentByIri, catalog, labels } from "./data.ts";
import { parseN3, type TermJSON } from "./store.ts";

export type Part = { text: string; iri?: string; kind?: "entity" | "class" | "predicate" | "world" | "literal" };

export function localName(iri: string): string {
  return iri.split("#").pop()!.split("/").pop()!;
}

function humanize(s: string): string {
  return s.replace(/^[A-Z]\d+i?_/, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

export function worldTitle(iri: string): string {
  if (iri === REALITY) return catalog.worlds.gold.reality.title;
  const loc = localName(iri);
  if (iri.startsWith(NS.snapshot)) return catalog.worlds.sim[loc]?.title ?? loc;
  return catalog.worlds.gold[loc]?.title ?? catalog.worlds.sim[loc]?.title ?? loc;
}

export function label(iri: string): string {
  const loc = localName(iri);
  if (iri.startsWith(NS.w) || iri.startsWith(NS.snapshot) || iri === REALITY) return worldTitle(iri);
  if (labels.entities[loc]) return labels.entities[loc];
  if (iri.startsWith(NS.prof) || iri.startsWith(NS.crm) || iri.startsWith(NS.owl)) return humanize(loc);
  return humanize(loc);
}

const TYPE = NS.rdf + "type";

/** Render a triple as an English sentence made of parts (entities are linkable chips). */
export function renderTriple(s: TermJSON | string, p: TermJSON | string, o: TermJSON | string): Part[] {
  const S = typeof s === "string" ? parseN3(s) : s;
  const P = typeof p === "string" ? parseN3(p) : p;
  const O = typeof o === "string" ? parseN3(o) : o;
  const subj: Part = { text: label(S.value), iri: S.value, kind: "entity" };
  if (P.value === TYPE && O.type === "uri") {
    const cl = labels.classes[localName(O.value)];
    return [subj, { text: " " + (cl ?? "is a " + humanize(localName(O.value))), iri: O.value, kind: "class" }];
  }
  if (P.value === NS.prof + "uttered" && O.type === "uri" && O.value.startsWith(NS.w)) {
    const title = worldTitle(O.value);
    const quote = title.includes(": ") ? title.slice(title.indexOf(": ") + 2) : `“${title}”`;
    return [subj, { text: " said ", iri: P.value, kind: "predicate" }, { text: quote, iri: O.value, kind: "world" }];
  }
  let pl = labels.predicates[localName(P.value)] ?? humanize(localName(P.value));
  if (P.value === NS.owl + "sameAs" && !agentByIri(S.value)) pl = "is the same as";
  const obj: Part = O.type === "uri" ? { text: label(O.value), iri: O.value, kind: O.value.startsWith(NS.w) ? "world" : "entity" }
    : { text: `“${O.value}”`, kind: "literal" };
  return [subj, { text: ` ${pl} `, iri: P.value, kind: "predicate" }, obj];
}

export function plain(parts: Part[]): string {
  return parts.map((x) => x.text).join("").replace(/\s+/g, " ").trim();
}
