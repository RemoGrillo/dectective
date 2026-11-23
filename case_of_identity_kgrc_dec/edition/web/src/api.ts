// Thin client for the edition API, with an in-memory cache and a React hook.
import { useEffect, useState } from "react";

export type Mode = "gold" | "C1" | "C2" | "C3" | "C4";
export type Status = "asserted" | "received" | "derived" | "contradicted" | "contradicted-assuming" | "not-determined";
export type DecType = "reality" | "epistemic" | "doxastic" | "conjectural" | "verbatim" | "shared";
export type Part = { text: string; iri?: string; kind?: string };
export type Term = { type: string; value: string };
export type Witness = {
  triple: { s: Term; p: Term; o: Term };
  axiom: { kind: "disjoint" | "closure"; a?: string; b?: string; predicate?: string };
  origin: string; originWorld?: string; parts: Part[];
};
export type Governor = { agent: string; name: string; predicate: string; viaIdentity: boolean };
export type WorldStatus = {
  world: string; title: string; decType: DecType; governedBy: Governor[]; status: Status;
  witnesses?: Witness[]; receivedFrom?: string; receivedFromTitle?: string; hint?: { rule: string; [k: string]: any }; hintText?: string;
};
export type StanceItem = { world: string; title: string; predicate: string; status: Status; viaIdentity: boolean; inherited: boolean };
export type AgentStance = { agent: string; name: string; short: string; kind: string; items: StanceItem[]; summary: string; flags: string[] };
export type PropositionView = {
  id: string; parts: Part[]; text: string; world: string; module?: string; basis?: string; anchorLevel?: string;
  statuses: WorldStatus[]; agents: AgentStance[];
};
export type CyEl = { data: Record<string, any>; classes?: string };
export type Stamp = { word: string; sub: string };
export type DossierRef = { id: string; number: number; title: string; typeLabel: string; verdict: { label: string; tone: string }; stamp: Stamp };
export type Agent = { id: string; name: string; short: string; monogram: string; role: string; gold?: string; sim?: string; kind: string; maskOf?: string };
export type Section = { id: string; title: string; subtitle: string; from: string; to: string };
export type Checkpoint = { id: string; after: string; label: string; desc: string; page: number };
export type Meta = {
  title: string; decCommit: string; build: any; modes: Mode[]; sections: Section[]; checkpoints: Checkpoint[];
  agents: Agent[]; closures: Record<string, string[]>; prefixes: string; graphs: { iri: string; role: string }[]; portraits: Record<string, { full: string; face: string }>;
};
export type Mark = "lie" | "delusion" | "mistake" | "reasoning" | "identity" | "annotated";
export type TextSentence = {
  id: string; text: string; marks: Mark[]; diagnoses: { kind: "lie" | "delusion" | "mistake"; person: string; text: string }[]; nProps: number;
  dossiers: { id: string; number: number; type: string; tone: string; stamp: Stamp }[];
};
export type Verb = "says" | "believes" | "concludes" | "supposes";
export type VStance = { verb: Verb; polarity: "yes" | "no"; world: string; worldTitle: string; status: Status; asName?: string; assumption?: string; how: string; dec: string };
export type Diagnosis = { kind: "lie" | "delusion" | "mistake"; person: string; personName: string; world: string; text: string; assumption?: string };
export type VPerson = { id: string; name: string; short: string; kind: string; alias?: string; stances: VStance[]; diagnoses: Diagnosis["kind"][] };
export type RealityVerdict = { value: "true" | "false" | "false-if" | "unknown"; how: string; dec: string; assumption?: string };
export type Viewpoint = {
  id: string; text: string; parts: Part[]; world: string; sentences: string[];
  reality: RealityVerdict; people: VPerson[]; silent: string[]; diagnoses: Diagnosis[]; divergent: boolean;
};
export type TextParagraph = {
  id: string; kind: string; order: number; page: number; revealedBy: string; section: string; speaker: string; hasNarration: boolean; sentences: TextSentence[];
};
export type TextPayload = { paragraphs: TextParagraph[]; sections: Section[]; checkpoints: Checkpoint[]; speakerNames: Record<string, string> };
export type SentenceView = {
  id: string; hidden?: boolean; reason?: string; text: string; paragraph: { id: string; speaker: string; page: number; section: string };
  mode: Mode; marks: Mark[]; diagnoses: Diagnosis[]; viewpoints: Viewpoint[]; dossiers: DossierRef[];
  units: { id: string; coverage: string; theme: string; issue: string; content: string; kgrcScenes: string[] }[];
  kgrcAuto: string[]; graph: CyEl[];
};
export type Cell = { value: string; label: string; isIri: boolean };
export type Step = { n: number; title: string; text: string; sparql: string; kind: "select" | "ask"; columns?: string[]; rows?: Record<string, Cell>[]; result?: boolean; by: "dec" | "edition" | "kgrc" };
export type Dossier = DossierRef & {
  type: string; subtitle: string; summary: string; mode: Mode; anchors: string[]; steps: Step[];
  caveats: { kind: string; text: string }[]; dec: { run: string; world: string; relation: string; other?: string; kind: string }[];
  graph: CyEl[]; anchorTexts: { id: string; text: string }[]; nSteps?: number;
};
export type WorldInfo = {
  local: string; iri: string; title: string; desc: string; decType: DecType; checkpoint: string; basis: string[]; notes: string[];
  sources: string[]; materializedBy: string[]; governedBy: (Governor & { world: string })[];
  delusional?: string[]; disagreesWith?: { other: string; runs: string[]; closedForOnly?: boolean }[]; defect?: string | null; [k: string]: any;
};
export type TStep = { n: number; sid: string; page: number; stage: string; text: string; speaker: string; newTriples: number };
export type TPremise = { text: string; world: string; step: number | null; background?: boolean };
export type TConclusion = {
  id: string; step: number; kind: "inferred" | "accepted"; cls: "story" | "minor"; world: string; worldTitle: string; person?: string; personName?: string; verb?: Verb;
  text: string; parts: Part[]; rule: string; ruleText: string; premises: TPremise[]; explainedAt: number | null;
};
export type TClaim = { step: number; world: string; worldTitle: string; person?: string; personName?: string; verb?: Verb; text: string };
export type TEvent = { step: number; pid: string; text: string; kind: "reality" | "verdict"; from?: string; to?: string;
  diagnosis?: { kind: "lie" | "delusion" | "mistake"; person: string; personName: string; text: string; assumption?: string } };
export type Timeline = {
  steps: TStep[]; final: number; identityStep: number; worldEntry: Record<string, number>;
  conclusions: TConclusion[]; claims: TClaim[]; events: TEvent[];
  totals: { conclusions: number; minor: number; verdicts: number }; metrics: any;
  cap: number | null; hidden: { conclusions: number; verdicts: number; steps: number };
};
export type Example = { id: string; category: string; question: string; sparql: string; note?: string };

const cache = new Map<string, Promise<any>>();

export async function getJSON<T = any>(url: string): Promise<T> {
  if (!cache.has(url)) {
    const p = fetch(url, { headers: { Accept: "application/json" } }).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
      return r.json();
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return cache.get(url)!;
}

export function useApi<T = any>(url: string | null): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean; url: string | null }>({ data: null, error: null, loading: !!url, url });
  useEffect(() => {
    if (!url) { setState({ data: null, error: null, loading: false, url }); return; }
    let alive = true;
    setState((s) => ({ data: s.url === url ? s.data : null, error: null, loading: true, url }));
    getJSON<T>(url).then(
      (data) => { if (alive) setState({ data, error: null, loading: false, url }); },
      (e) => { if (alive) setState({ data: null, error: String(e.message ?? e), loading: false, url }); },
    );
    return () => { alive = false; };
  }, [url]);
  return { data: state.url === url ? state.data : null, error: state.error, loading: state.loading };
}

export type SparqlResult =
  | { kind: "select"; vars: string[]; rows: Record<string, { type: string; value: string; datatype?: string; "xml:lang"?: string }>[]; truncated: boolean; ms: number }
  | { kind: "ask"; boolean: boolean; ms: number }
  | { kind: "graph"; text: string; ms: number };

export async function runSparql(query: string, signal?: AbortSignal): Promise<SparqlResult> {
  const t0 = performance.now();
  const isGraph = /\b(CONSTRUCT|DESCRIBE)\b/i.test(query.replace(/#[^\n]*/g, ""));
  const r = await fetch("/sparql", {
    method: "POST", signal,
    headers: { "Content-Type": "application/sparql-query", Accept: isGraph ? "text/turtle" : "application/sparql-results+json" },
    body: query,
  });
  const ms = Math.round(performance.now() - t0);
  if (!r.ok) throw new Error(await r.text());
  if (isGraph) return { kind: "graph", text: await r.text(), ms };
  const j = await r.json();
  if (typeof j.boolean === "boolean") return { kind: "ask", boolean: j.boolean, ms };
  return { kind: "select", vars: j.head.vars, rows: j.results.bindings, truncated: r.headers.has("X-Results-Truncated"), ms };
}
