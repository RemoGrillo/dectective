// Automatic case files and the re-examination of DEC's world-level verdicts.
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.ts";

const app = createApp();

describe("case files as an experiment (casebook)", () => {
  it("groups every case file under one of five questions, numbered in question order", async () => {
    const cb = (await request(app).get("/api/casebook")).body;
    expect(cb.questions.map((q: any) => q.id)).toEqual(["identity", "sincerity", "belief", "evidence", "limits"]);
    const all = (await request(app).get("/api/dossiers")).body;
    const inBook = cb.questions.flatMap((q: any) => q.cases.map((c: any) => c.id));
    expect(new Set(inBook).size).toBe(all.length);
    expect(cb.questions.flatMap((q: any) => q.cases.map((c: any) => c.number))).toEqual(all.map((_: any, i: number) => i + 1));
  });

  it("reads the audit as reported: DEC 28/29, named graphs 15/29, one graph 10/29, stored only 15/29", async () => {
    const cb = (await request(app).get("/api/casebook")).body;
    expect(cb.nTests).toBe(29);
    expect(cb.score).toEqual({ dec: { ok: 28, of: 29 }, ctx: { ok: 15, of: 29 }, flat: { ok: 10, of: 29 }, asserted: { ok: 15, of: 29 } });
    const sincerity = cb.questions.find((q: any) => q.id === "sincerity");
    expect(sincerity.score.dec).toEqual({ ok: 3, of: 3 });
    expect(sincerity.score.ctx.ok).toBeLessThan(3);
  });

  it("a case file names its question, what DEC contributes, and the audit rows", async () => {
    const d = (await request(app).get("/api/dossiers/delusional-windibank_beliefs")).body;
    expect(d.question.id).toBe("belief");
    expect(d.role.kind).toBe("dec-wrong");
    expect(d.audit.rows.map((r: any) => r.label)).toEqual(["T06a", "T06b", "T06c"]);
    const tw = (await request(app).get("/api/dossiers/typewriter")).body;
    expect(tw.audit.rows.find((r: any) => r.label === "T09c").matches.dec).toBe(false);
  });

  it("a guess ruled out at the unmasking is stamped Refuted", async () => {
    const d = (await request(app).get("/api/dossiers/hypothesis-w21")).body;
    expect(d.summary).toMatch(/The unmasking: ruled out/);
    expect(d.stamp.word).toBe("Refuted");
  });
});

describe("case files (dossiers)", () => {
  it("discovers the expected instances", async () => {
    const r = await request(app).get("/api/dossiers");
    const ids = r.body.map((d: any) => d.id);
    for (const id of [
      "identity-hosmer", "insincere-v_hosmer_cashier", "insincere-v_windibank_reassure", "false-sincere-v_mary_france",
      "delusional-mary_D1", "delusional-windibank_beliefs", "hypothesis-w20", "hypothesis-w21", "typewriter", "prediction-ending",
    ]) expect(ids).toContain(id);
  });

  it("Mary's beliefs are divergent; Windibank's 'delusion' is flagged as an artifact of the closedFor defect", async () => {
    const mary = (await request(app).get("/api/dossiers/delusional-mary_D1")).body;
    expect(mary.verdict.tone).toBe("red");
    const wb = (await request(app).get("/api/dossiers/delusional-windibank_beliefs")).body;
    expect(wb.stamp.word).toBe("False alarm");
    expect(mary.stamp.word).toBe("Delusion");
    expect(wb.caveats.some((c: any) => c.kind === "defect")).toBe(true);
  });

  it("every step records the SPARQL that produced it, and anchors resolve to sentences", async () => {
    const d = (await request(app).get("/api/dossiers/insincere-v_windibank_reassure")).body;
    expect(d.steps.length).toBeGreaterThan(2);
    for (const s of d.steps) expect(s.sparql).toMatch(/SELECT|ASK/);
    expect(d.stamp.word).toBe("Lie");
    expect(d.steps.some((s: any) => s.by === "dec")).toBe(true);
    expect(d.anchorTexts.every((a: any) => a.text.length > 0)).toBe(true);
  });
});

describe("world map verdicts", () => {
  const verdict = (b: any, a: string, c: string) => b.disagreements.find((d: any) => (d.a === a && d.b === c) || (d.a === c && d.b === a))?.verdict;

  it("gold: Mary vs the narrative is a real conflict; Windibank's beliefs vs the narrative only an artifact", async () => {
    const b = (await request(app).get("/api/worlds")).body;
    expect(verdict(b, "mary_D1", "reality")).toBe("conflict");
    expect(verdict(b, "reality", "windibank_beliefs")).toBe("artifact");
    expect(verdict(b, "reality", "v_hosmer_cashier")).toBe("assumption");
    expect(b.worlds.find((w: any) => w.local === "windibank_beliefs").delusionalVerdict).toBe("artifact");
  });

  it("C3: the authorship alternatives disagree only through the closedFor defect", async () => {
    const b = (await request(app).get("/api/worlds").query({ mode: "C3" })).body;
    expect(verdict(b, "w22", "w23")).toBe("artifact");
    expect(verdict(b, "w23", "w24")).toBe("assumption");
  });
});
