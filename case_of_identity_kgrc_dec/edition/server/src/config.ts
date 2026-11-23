import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const EDITION_DIR = path.resolve(here, "..", "..");
export const DATA_DIR = path.join(EDITION_DIR, "data");
export const ANNOTATIONS_DIR = path.join(EDITION_DIR, "annotations");
export const WEB_DIST = path.join(EDITION_DIR, "web", "dist");
/** Character portraits (PNG/JPG/WebP named <agent id>.png), served at /portraits/ without rebuilding the SPA. */
export const PORTRAITS_DIR = path.join(EDITION_DIR, "portraits");
export const PORT = Number(process.env.PORT ?? 4410);
export const SPARQL_TIMEOUT_MS = Number(process.env.SPARQL_TIMEOUT_MS ?? 10000);
export const SPARQL_MAX_ROWS = Number(process.env.SPARQL_MAX_ROWS ?? 10000);

export const NS = {
  st: "http://example.org/dectective/story/",
  w: "http://example.org/dectective/world/",
  prof: "http://example.org/dectective/profile#",
  dec: "http://w3id.org/conjectures/",
  ed: "http://example.org/dectective/edition#",
  edb: "http://example.org/dectective/edition/",
  asserted: "http://example.org/dectective/asserted/",
  snapshot: "http://example.org/dectective/snapshot/",
  snapshotAsserted: "http://example.org/dectective/snapshot-asserted/",
  crm: "http://www.cidoc-crm.org/cidoc-crm/",
  inf: "http://www.cidoc-crm.org/extensions/crminf/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  kgc: "http://kgc.knowledge-graph.jp/ontology/kgc.owl#",
  kgrcD: "http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/",
  kgrcPred: "http://kgc.knowledge-graph.jp/data/predicate/",
} as const;

export const REALITY = NS.dec + "reality";
export const GRAPHS = {
  text: NS.edb + "text",
  annotation: NS.edb + "annotation",
  runs: NS.edb + "runs",
  kgrc: "http://kgc.knowledge-graph.jp/data/ACaseOfIdentity",
} as const;

export const DEC_COMMIT = "e6775b39e22893176c45e3a161e49a7d2c718fb2";
export const MODES = ["gold", "C1", "C2", "C3", "C4"] as const;
export type Mode = (typeof MODES)[number];
export const CHECKPOINT_ORDER = ["C1", "C2", "C3", "C4", "G"];

export const PREFIXES = Object.entries({
  st: NS.st, w: NS.w, prof: NS.prof, dec: NS.dec, ed: NS.ed, crm: NS.crm, inf: NS.inf,
  rdf: NS.rdf, rdfs: NS.rdfs, owl: NS.owl, xsd: NS.xsd, kgc: NS.kgc, d: NS.kgrcD, pred: NS.kgrcPred,
}).map(([p, u]) => `PREFIX ${p}: <${u}>`).join("\n");
