// In-process Oxigraph store used by the API (the public /sparql endpoint runs in a worker, see sparql/worker.ts).
import oxigraph from "oxigraph";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR, PREFIXES } from "./config.ts";

export type TermJSON = { type: "uri" | "literal" | "bnode"; value: string; lang?: string; datatype?: string };
export type Row = Record<string, TermJSON>;

let store: oxigraph.Store | null = null;

export function loadStore(file = path.join(DATA_DIR, "edition.nq")): oxigraph.Store {
  if (store) return store;
  const s = new oxigraph.Store();
  s.load(readFileSync(file, "utf8"), { format: "application/n-quads" });
  store = s;
  return s;
}

function toJSON(t: any): TermJSON {
  if (t.termType === "NamedNode") return { type: "uri", value: t.value };
  if (t.termType === "BlankNode") return { type: "bnode", value: t.value };
  const out: TermJSON = { type: "literal", value: t.value };
  if (t.language) out.lang = t.language;
  else if (t.datatype && t.datatype.value !== "http://www.w3.org/2001/XMLSchema#string") out.datatype = t.datatype.value;
  return out;
}

/** SELECT with the standard prefixes prepended; returns plain JSON rows. */
export function select(query: string): Row[] {
  const res = loadStore().query(PREFIXES + "\n" + query) as Map<string, any>[];
  return res.map((m) => {
    const r: Row = {};
    for (const [k, v] of m) r[k] = toJSON(v);
    return r;
  });
}

export function ask(query: string): boolean {
  return loadStore().query(PREFIXES + "\n" + query) as boolean;
}

/** N3 serialisation of a term given as JSON (used to build parameterised queries). */
export function n3(t: TermJSON | string): string {
  if (typeof t === "string") return t.startsWith("<") || t.startsWith('"') ? t : `<${t}>`;
  if (t.type === "uri") return `<${t.value}>`;
  if (t.type === "bnode") return `_:${t.value}`;
  const lex = JSON.stringify(t.value);
  return t.lang ? `${lex}@${t.lang}` : t.datatype ? `${lex}^^<${t.datatype}>` : lex;
}

/** Parse an N-Triples term string (as stored in catalog.json) into TermJSON. */
export function parseN3(s: string): TermJSON {
  if (s.startsWith("<")) return { type: "uri", value: s.slice(1, -1) };
  if (s.startsWith("_:")) return { type: "bnode", value: s.slice(2) };
  const m = s.match(/^"([\s\S]*)"(?:@([A-Za-z0-9-]+)|\^\^<([^>]+)>)?$/);
  if (!m) return { type: "literal", value: s };
  const value = JSON.parse(`"${m[1]}"`);
  return m[2] ? { type: "literal", value, lang: m[2] } : m[3] ? { type: "literal", value, datatype: m[3] } : { type: "literal", value };
}

/** Pretty-print a query for display (prefix block omitted, as it is implicit in the edition). */
export function displayQuery(q: string): string {
  return q.replace(/^\s*\n/, "").replace(/\n\s+/g, "\n  ").trim();
}
