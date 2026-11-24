// The case files as an experiment: five questions put to DEC (annotations/questions.json). Each case file tests one
// question on one case in the story; each question is also measured by audit queries (T01–T10) that ran the same data
// and rules four ways: DEC, named graphs without DEC, one merged graph, stored triples only. The answers per
// configuration are read from runs.json (test_result.matches_expected): nothing here is re-computed.
import { readFileSync } from "node:fs";
import path from "node:path";
import { ANNOTATIONS_DIR } from "./config.ts";
import { runs } from "./data.ts";

type Config = { id: string; label: string; desc: string };
type Role = { label: string; desc: string };
type CaseRef = { id: string; role: string; shows: string };
type QuestionDef = {
  id: string; short: string; title: string; answer: { word: string; sub: string }; finding: string;
  tests: string[]; extraRuns?: string[]; cases: CaseRef[];
};
const Q = JSON.parse(readFileSync(path.join(ANNOTATIONS_DIR, "questions.json"), "utf8")) as {
  question: string; lede: string; configs: Config[]; roles: Record<string, Role>;
  tests: Record<string, { ask: string; expect: string }>; questions: QuestionDef[];
};

export type AuditRow = { id: string; label: string; ask: string; expect: string; matches: Record<string, boolean | null>; note?: string };
export type CaseRole = { kind: string; label: string; desc: string; shows: string };
export type QuestionRef = { id: string; n: number; short: string; title: string; answer: { word: string; sub: string } };

const runById = new Map(runs.map((r) => [r.id, r]));

function auditRow(id: string): AuditRow {
  const r = runById.get(id);
  const t = Q.tests[id];
  if (!r || !t) throw new Error(`questions.json: unknown audit query ${id}`);
  const m = r.test_result?.matches_expected ?? {};
  return { id, label: id.split("_")[0], ask: t.ask, expect: t.expect, note: r.test_result?.note,
    matches: Object.fromEntries(Q.configs.map((c) => [c.id, m[c.id] ?? null])) };
}

/** How many audit queries each configuration answers as expected. */
function score(rows: AuditRow[]) {
  return Object.fromEntries(Q.configs.map((c) => [c.id, { ok: rows.filter((r) => r.matches[c.id] === true).length, of: rows.filter((r) => r.matches[c.id] !== null).length }]));
}

/** Case-file ids in the order of the questions (numbering of the case files). */
export const caseOrder: string[] = Q.questions.flatMap((q) => q.cases.map((c) => c.id));

export function questionOf(dossierId: string): { question: QuestionRef; role: CaseRole } | null {
  const i = Q.questions.findIndex((q) => q.cases.some((c) => c.id === dossierId));
  if (i < 0) return null;
  const q = Q.questions[i], c = q.cases.find((x) => x.id === dossierId)!;
  const role = Q.roles[c.role];
  if (!role) throw new Error(`questions.json: unknown role ${c.role}`);
  return { question: { id: q.id, n: i + 1, short: q.short, title: q.title, answer: q.answer }, role: { kind: c.role, ...role, shows: c.shows } };
}

/** The audit queries behind a case file's question, with the answer of each configuration. */
export function auditFor(dossierId: string) {
  const q = Q.questions.find((x) => x.cases.some((c) => c.id === dossierId));
  if (!q) return null;
  const rows = q.tests.map(auditRow);
  return { configs: Q.configs, rows, score: score(rows), extra: (q.extraRuns ?? []).map((id) => ({ id, question: runById.get(id)?.question ?? id })) };
}

/** The whole casebook: the research question, the configurations, the roles, and each question with its cases. */
export function casebook(index: { id: string; number: number; [k: string]: any }[]) {
  const byId = new Map(index.map((d) => [d.id, d]));
  const all = Q.questions.flatMap((q) => q.tests).filter((t, i, xs) => xs.indexOf(t) === i).map(auditRow);
  return {
    question: Q.question, lede: Q.lede, configs: Q.configs, roles: Q.roles, score: score(all), nTests: all.length,
    questions: Q.questions.map((q, i) => {
      const rows = q.tests.map(auditRow);
      return {
        id: q.id, n: i + 1, short: q.short, title: q.title, answer: q.answer, finding: q.finding, score: score(rows), nTests: rows.length, rows,
        cases: q.cases.filter((c) => byId.has(c.id)).map((c) => ({ ...byId.get(c.id)!, role: { kind: c.role, ...Q.roles[c.role], shows: c.shows } })),
      };
    }),
  };
}
