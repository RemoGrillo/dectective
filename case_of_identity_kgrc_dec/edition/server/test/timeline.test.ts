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
