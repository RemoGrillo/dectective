// Static edition data produced by scripts/build_edition_data.py and curated annotations.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ANNOTATIONS_DIR, DATA_DIR, NS, REALITY, type Mode } from "./config.ts";

const j = (dir: string, f: string) => JSON.parse(readFileSync(path.join(dir, f), "utf8"));

export type WorldInfo = {
  local: string; iri: string; decType: string; title: string; desc: string; checkpoint: string;
  governedBy: { agent: string; predicate: string }[]; modules: string[]; segments: string[]; basis: string[];
  notes: string[]; materializedBy: string[];
};
export type Proposition = {
  id: string; dataset: "gold" | "sim"; world: string; s: string; p: string; o: string; module: string;
  sentences: string[]; anchorLevel: "proposition" | "module"; checkpoint: string; basis: string;
};
export type Sentence = { id: string; text: string; start: number; end: number; props: string[]; simProps: string[] };
export type Paragraph = {
  id: string; order: number; section: string; page: number; kind: string; speaker: string;
  hasNarration: boolean; revealedBy: string; sentences: Sentence[];
};
export type Run = {
  id: string; kind: string; dataset: string; question: string; test?: string; query_file?: string; slice: string;
  checkInconsistencies: boolean; closedFor: string[]; excludedAxioms: string[]; materialise_ms_median: number | null;
  n_worlds: number; inconsistency_pairs: number; asserted: number; materialised: number; diagnostics: string[]; test_result: any; worlds: string[];
};
export type Agent = { id: string; name: string; short: string; monogram: string; role: string; gold: string | null; sim: string | null; kind: string };

export const text = j(DATA_DIR, "text.json") as {
  sections: { id: string; title: string; subtitle: string; from: string; to: string }[];
  checkpoints: { id: string; after: string; label: string; desc: string; page: number }[];
  paragraphs: Paragraph[]; speakerNames: Record<string, string>;
};
export const catalog = j(DATA_DIR, "catalog.json") as {
  worlds: { gold: Record<string, WorldInfo>; sim: Record<string, WorldInfo> };
  propositions: Record<string, Proposition>; modules: any[]; namespaces: Record<string, string>; simToGold: Record<string, string>;
};
export const runs = j(DATA_DIR, "runs.json") as Run[];
export const buildInfo = j(DATA_DIR, "build_info.json");
export const agents = (j(ANNOTATIONS_DIR, "agents.json").agents) as Agent[];
export const labels = j(ANNOTATIONS_DIR, "labels.json") as {
  entities: Record<string, string>; classes: Record<string, string>; predicates: Record<string, string>;
};
const ablationFile = path.join(DATA_DIR, "..", "..", "prototype", "results", "ablations", "summary.json");
export const ablations: Record<string, any> = existsSync(ablationFile) ? JSON.parse(readFileSync(ablationFile, "utf8")) : {};

export const sentences = new Map<string, Sentence & { paragraph: Paragraph }>();
for (const p of text.paragraphs) for (const s of p.sentences) sentences.set(s.id, { ...s, paragraph: p });

export const goldToSim: Record<string, string> = Object.fromEntries(Object.entries(catalog.simToGold).map(([s, g]) => [g, s]));

/** Graph IRIs for a world in a given mode. */
export function graphs(mode: Mode, local: string): { M: string; A: string } {
  if (mode === "gold") return { M: local === "reality" ? REALITY : NS.w + local, A: NS.asserted + local };
  return { M: `${NS.snapshot}${mode}/${local}`, A: `${NS.snapshotAsserted}${mode}/${local}` };
}

/** Worlds available in a mode (checkpoint-limited for the reader simulation). */
export function worldsIn(mode: Mode): WorldInfo[] {
  if (mode === "gold") return Object.values(catalog.worlds.gold);
  const order = ["C1", "C2", "C3", "C4", "G"];
  return Object.values(catalog.worlds.sim).filter((w) => order.indexOf(w.checkpoint) <= order.indexOf(mode));
}

export function agentByIri(iri: string): Agent | undefined {
  return agents.find((a) => a.gold === iri || a.sim === iri);
}

/** DEC permeation sources by world type (matrix of DecUtils.DecPermeations, documented types only). */
export function sourcesOf(decType: string, mode: Mode): string[] {
  const all = worldsIn(mode);
  const epi = all.filter((w) => w.decType === "epistemic").map((w) => w.local);
  switch (decType) {
    case "doxastic": case "epistemic": return ["shared"];
    case "conjectural": return ["shared", "reality"];
    case "reality": return ["shared", ...epi];
    default: return [];
  }
}
