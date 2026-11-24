// Deductions timeline: one DEC run per clue on the story read so far (scripts/run_edition_timeline.py).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.ts";
import { DATA_DIR, EDITION_DIR } from "../src/config.ts";

const app = createApp();
const tl = (await request(app).get("/api/timeline")).body;
const sidOf = (n: number) => tl.steps.find((s: any) => s.n === n)?.sid;
const stepAt = (sid: string) => tl.steps.find((s: any) => s.sid === sid)?.n;

describe("prefix runs", () => {
  it("every run succeeded and DEC's materialisation only grew from clue to clue", () => {
    const m = JSON.parse(readFileSync(path.join(EDITION_DIR, "..", "prototype/results/timeline/metrics.json"), "utf8"));
    expect(m.monotonic).toBe(true);
    expect(m.steps.length).toBe(tl.steps.length + 1);          // + the baseline (schema only)
    expect(m.flags).toMatch(/no checkInconsistencies/);
    expect(tl.metrics.monotonic).toBe(true);
  });
  it("worlds enter where they are said: Windibank's reassurance at P067.S01, his beliefs at the unmasking", () => {
    const t = JSON.parse(readFileSync(path.join(DATA_DIR, "timeline.json"), "utf8"));
    expect(sidOf(t.worldEntry.v_windibank_reassure)).toBe("P067.S01");
    expect(sidOf(t.worldEntry.windibank_beliefs)).toBe("P126.S11");
    expect(sidOf(t.worldEntry.mary_D1)).toBe("P031.S10");
  });
});

describe("conclusions and their premises", () => {
  it("Windibank wore tinted glasses: concluded at P126.S11 from Hosmer's glasses (P051.S06) and the identity", () => {
    const c = tl.conclusions.find((x: any) => x.world === "reality" && x.text === "James Windibank wore tinted glasses");
    expect(sidOf(c.step)).toBe("P126.S11");
    expect(c.rule).toBe("identity");
    expect(c.premises.map((p: any) => sidOf(p.step))).toEqual(["P051.S06", "P126.S11"]);
  });
  it("no identity-based conclusion before the unmasking", () => {
    expect(tl.identityStep).toBe(stepAt("P126.S11"));
    const early = tl.conclusions.filter((c: any) => c.rule === "identity" && c.step < tl.identityStep && c.world !== "holmes_same_machine");
    expect(early).toEqual([]);
  });
  it("every story-level conclusion is explained, and appears exactly when its last premise does", () => {
    const story = tl.conclusions.filter((c: any) => c.cls === "story");
    expect(story.length).toBeGreaterThan(40);
    for (const c of story) {
      expect(c.rule, c.text).not.toBe("unidentified");
      expect(c.explainedAt, `${c.world}: ${c.text}`).toBe(c.step);
    }
  });
  it("the typewriter: inside Holmes's principle the letters are typed on the office machine (P118.S06)", () => {
    const c = tl.conclusions.find((x: any) => x.world === "holmes_same_machine" && /letter no\. 1 was typed on the office typewriter/.test(x.text));
    expect(sidOf(c.step)).toBe("P118.S06");
    expect(tl.conclusions.some((x: any) => x.world === "reality" && /letter no\. 1 was typed on the office typewriter/.test(x.text))).toBe(false);
  });
});

describe("verdicts over time", () => {
  const verdict = (kind: string, person: string, re: RegExp) => tl.events.find((e: any) => e.kind === "verdict" && e.diagnosis.kind === kind && e.diagnosis.person === person && re.test(e.text));
  it("Windibank's lie about the disappearance becomes detectable only when his beliefs say it was deliberate", () => {
    const e = verdict("lie", "windibank", /disappearance/);
    expect(sidOf(e.step)).toBe("P128.S10");
    expect(e.step).toBeGreaterThan(stepAt("P067.S01"));
  });
  it("Mary's delusion about the second journey appears when Reality learns it was pretended", () => {
    const e = verdict("delusion", "mary", /second journey/);
    expect(sidOf(e.step)).toBe("P128.S07");
    const r = tl.events.find((x: any) => x.kind === "reality" && /second journey to France was an actual journey/.test(x.text) && x.to === "false");
    expect(r.step).toBe(e.step);
  });
  it("no verdict before the unmasking", () => {
    expect(tl.events.filter((e: any) => e.kind === "verdict" && e.step < tl.identityStep)).toEqual([]);
  });
});

describe("spoilers", () => {
  it("reading up to 'The clues' (C2) the timeline stops at the stage; beyond it only counts", async () => {
    const c2 = (await request(app).get("/api/timeline").query({ mode: "C2" })).body;
    expect(c2.cap).toBeLessThan(tl.final);
    expect(c2.steps.every((s: any) => Number(s.sid.slice(1, 4)) <= 100)).toBe(true);
    expect(c2.conclusions.every((c: any) => c.step <= c2.cap)).toBe(true);
    expect(c2.events.every((e: any) => e.step <= c2.cap)).toBe(true);
    expect(c2.hidden.verdicts).toBe(tl.totals.verdicts);
    expect(c2.conclusions.some((c: any) => /Windibank wore tinted glasses/.test(c.text))).toBe(false);
  });
});

describe("timeline: lines spoken and narration", () => {
  it("narration inside a paragraph credited to Windibank is not a line he speaks (clue P115.S01); his reply is", async () => {
    const tl = (await request(app).get("/api/timeline")).body;
    expect(tl.steps.find((s: any) => s.sid === "P115.S01")).toMatchObject({ speaker: "windibank", spoken: false });
    expect(tl.steps.find((s: any) => s.sid === "P115.S02")).toMatchObject({ speaker: "windibank", spoken: true });
    expect(tl.steps.find((s: any) => s.sid === "P059.S02").spoken).toBe(true);   // Mary, inside her quoted account
  });
  it("a line spoken stands for the propositions of its sentence (Holmes at P094.S02: the facts about letter no. 1)", async () => {
    const tl = (await request(app).get("/api/timeline")).body;
    const st = tl.steps.find((s: any) => s.sid === "P094.S02");
    expect(st.props).toEqual(expect.arrayContaining(["Hosmer's letter no. 1 purports to come from Hosmer Angel", "Hosmer's letter no. 1 is a typewritten letter"]));
    const sv = (await request(app).get("/api/sentence/P094.S02")).body;
    for (const v of sv.viewpoints) expect(st.props).toContain(v.text);   // the same propositions the sentence's panel shows
  });
});

describe("timeline: the Reality lane holds what is true, not the acts", () => {
  it("at Watson's guess (P099.S01) the guess stays in Watson's world, and 'Watson supposes a guess' is not story content", async () => {
    const tl = (await request(app).get("/api/timeline")).body;
    const st = tl.steps.find((x: any) => x.sid === "P099.S01");
    const here = tl.claims.filter((c: any) => c.step === st.n);
    expect(here.some((c: any) => c.world === "watson_hyp" && c.content === true && /deny the signature/.test(c.text))).toBe(true);
    expect(here.filter((c: any) => c.world === "reality" && c.content !== false)).toEqual([]);
    expect(here.some((c: any) => c.world === "reality" && c.content === false && /Watson supposes/.test(c.text))).toBe(true);
  });
  it("acts of telling and who-holds-what are never content; facts of the story are", async () => {
    const tl = (await request(app).get("/api/timeline")).body;
    const reality = tl.claims.filter((c: any) => c.world === "reality");
    for (const c of reality.filter((x: any) => /was addressed to|had the content|is an act of telling| said “|believes .*beliefs|is held by/.test(x.text))) expect(c.content).toBe(false);
    expect(reality.find((c: any) => /works as a traveller in wines/.test(c.text)).content).toBe(true);
  });
});

