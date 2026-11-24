// Windibank's denial to Holmes (P119): “I cannot waste time over this sort of fantastic talk… If you can catch the man,
// catch him.” Implied content: he is not Hosmer Angel (W15, owl:differentFrom), said to Holmes (F10). A lie: his own
// beliefs (W06) and Reality (Holmes's accepted solution) hold the identity — and OWL itself excludes being both the same
// and not the same, so no declared assumption is involved.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.ts";
import { EDITION_DIR } from "../src/config.ts";

const app = createApp();
const ST = "http://example.org/dectective/story/";
const DIFF = "<http://www.w3.org/2002/07/owl#differentFrom>";
const iri = (s: string) => `<${s}>`;

async function status(s: string, p: string, o: string, mode = "gold") {
  const r = await request(app).get("/api/status").query({ s, p, o, mode });
  expect(r.status).toBe(200);
  return { ...r.body, byWorld: Object.fromEntries(r.body.statuses.map((x: any) => [x.world, x])) };
}

describe("the denial in the model", () => {
  it("is a statement of Windibank's, anchored at P119.S02–S03, contradicted with certainty by his beliefs and by Reality", async () => {
    const b = await status(iri(ST + "windibank"), DIFF, iri(ST + "hosmer"));
    expect(b.text).toBe("James Windibank is not the same person as Hosmer Angel");
    expect(b.byWorld.v_windibank_denial.status).toBe("asserted");
    for (const w of ["windibank_beliefs", "reality", "holmes_reconstruction"]) {
      expect(b.byWorld[w].status).toBe("contradicted");                       // not "contradicted-assuming": no closure involved
      expect(b.byWorld[w].witnesses[0].axiom.kind).toBe("distinct");
    }
    expect(b.byWorld.reality.witnesses.some((w: any) => w.origin === "received" && w.originWorld === "holmes_reconstruction")).toBe(true);
    expect(b.byWorld.mary_D1.status).toBe("not-determined");                  // Mary holds neither
  });

  it("the sentence shows the claim with a Lie told to Holmes, and the identity mark", async () => {
    const r = (await request(app).get("/api/sentence/P119.S02")).body;
    const vp = r.viewpoints.find((v: any) => v.text === "James Windibank is not the same person as Hosmer Angel");
    expect(vp.reality.value).toBe("false");
    const lie = vp.diagnoses.find((d: any) => d.kind === "lie");
    expect(lie.person).toBe("windibank");
    expect(lie.to).toBe("Holmes");
    expect(lie.text).toBe("Windibank says it to Holmes, but believes otherwise");
    expect(lie.assumption).toBeUndefined();
    expect(r.marks).toEqual(expect.arrayContaining(["lie", "identity"]));
  });

  it("the other lies now say whom they were told to", async () => {
    const r = (await request(app).get("/api/sentence/P067.S01")).body;
    expect(r.diagnoses.find((d: any) => d.kind === "lie").text).toBe("Windibank says it to Mary, but believes otherwise");
  });

  it("a Lie case file is generated for it, with DEC's own conflict check", async () => {
    const d = (await request(app).get("/api/dossiers/insincere-v_windibank_denial")).body;
    expect(d.stamp.word).toBe("Lie");
    expect(d.summary).toBe("James Windibank said to Holmes that he is not the same person as Hosmer Angel, but his own beliefs exclude it, and Reality rules it out.");
    expect(d.anchors).toEqual(expect.arrayContaining(["P119.S02", "P119.S03"]));
    const decStep = d.steps.find((s: any) => s.by === "dec");
    expect(decStep.text).toMatch(/conflict with Windibank's beliefs \(run check-denial\)/);
    expect(d.caveats.some((c: any) => /one occupation/.test(c.text))).toBe(false);
  });
});

describe("DEC's own check (run check-denial)", () => {
  const run = JSON.parse(readFileSync(path.join(EDITION_DIR, "..", "prototype/results/edition_complement/check_denial.json"), "utf8"));
  const diags: string[] = run.accounting.dec_diagnostics.filter((d: string) => /disagreesWith|delusionalWorld/.test(d));
  it("flags the denial against Windibank's beliefs and Reality, and none of his other statements to Holmes", () => {
    expect(diags).toContain("http://example.org/dectective/world/v_windibank_denial http://w3id.org/conjectures/disagreesWith http://example.org/dectective/world/windibank_beliefs");
    expect(diags).toContain("http://example.org/dectective/world/v_windibank_denial http://w3id.org/conjectures/disagreesWith http://w3id.org/conjectures/reality");
    expect(diags.filter((d) => /v_windibank_(delighted|machine)/.test(d))).toEqual([]);
  });
});

describe("spoiler-free stages", () => {
  it("before the unmasking stage the sentence is sealed; at it, the claim is false and nothing is diagnosed as a lie (no beliefs are attributed)", async () => {
    expect((await request(app).get("/api/sentence/P119.S02").query({ mode: "C3" })).body.hidden).toBe(true);
    const r = (await request(app).get("/api/sentence/P119.S02").query({ mode: "C4" })).body;
    const vp = r.viewpoints.find((v: any) => /is not the same person as/.test(v.text));
    expect(vp.reality.value).toBe("false");
    expect(vp.diagnoses.filter((d: any) => d.kind === "lie")).toEqual([]);
  });
});

describe("Deductions timeline", () => {
  it("the denial enters at P119.S02, but the lie becomes detectable only once Windibank's beliefs are known", async () => {
    const tl = (await request(app).get("/api/timeline")).body;
    const sidOf = (n: number) => tl.steps.find((s: any) => s.n === n)?.sid;
    expect(tl.steps.some((s: any) => s.sid === "P119.S02")).toBe(true);
    const ev = tl.events.find((e: any) => e.kind === "verdict" && e.diagnosis?.kind === "lie" && /is not the same person as Hosmer/.test(e.text));
    expect(ev).toBeTruthy();
    expect(sidOf(ev.step)).toBe("P126.S11");
  });
});
