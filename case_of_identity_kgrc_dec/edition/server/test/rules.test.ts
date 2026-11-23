// Perspective rules on known cases of the story (statuses per world, agent stances, flags).
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.ts";

const app = createApp();
const ST = "http://example.org/dectective/story/";
const PROF = "http://example.org/dectective/profile#";
const TYPE = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>";
const SAME = "<http://www.w3.org/2002/07/owl#sameAs>";
const iri = (s: string) => `<${s}>`;

async function status(s: string, p: string, o: string, mode = "gold") {
  const r = await request(app).get("/api/status").query({ s, p, o, mode });
  expect(r.status).toBe(200);
  const byWorld = Object.fromEntries(r.body.statuses.map((x: any) => [x.world, x]));
  const agent = (short: string) => r.body.agents.find((a: any) => a.short === short);
  return { ...r.body, byWorld, agent };
}

describe("status of a proposition across worlds", () => {
  it("the first journey to France as an actual journey: Mary's belief against Holmes's account and the narrative", async () => {
    const b = await status(iri(ST + "journey_france_1"), TYPE, iri(PROF + "ActualJourney"));
    expect(b.byWorld.mary_D1.status).toBe("asserted");
    expect(b.byWorld.v_mary_france.status).toBe("asserted");
    // Holmes's reconstruction states the journey was pretended: a declared disjointness rules the proposition out
    expect(b.byWorld.holmes_reconstruction.status).toBe("contradicted");
    expect(b.byWorld.holmes_reconstruction.witnesses[0].origin).toBe("asserted");
    expect(b.byWorld.holmes_reconstruction.witnesses[0].axiom.kind).toBe("disjoint");
    // the narrative receives it from the accepted (epistemic) account
    expect(b.byWorld.reality.status).toBe("contradicted");
    expect(b.byWorld.reality.witnesses.some((w: any) => w.origin === "received" && w.originWorld === "holmes_reconstruction")).toBe(true);
    // Watson's hypothesis contradicts it only through the narrative it inherits
    expect(b.byWorld.watson_hyp.status).toBe("contradicted");
    expect(b.byWorld.watson_hyp.witnesses.every((w: any) => w.origin === "received" && w.originWorld === "reality")).toBe(true);
  });

  it("stances: Mary says and believes it (sincere but false); Watson has no stance of his own", async () => {
    const b = await status(iri(ST + "journey_france_1"), TYPE, iri(PROF + "ActualJourney"));
    expect(b.agent("Mary").flags).toContain("sincere-but-false");
    expect(b.agent("Watson").items.every((i: any) => i.inherited)).toBe(true);
    expect(b.agent("Watson").summary).toMatch(/no stance of their own/);
    expect(b.agent("Reality").summary).toMatch(/rules it out/);
  });

  it("the identity Hosmer = Windibank holds in the narrative but is absent from Mary's beliefs (opacity)", async () => {
    const b = await status(iri(ST + "hosmer"), SAME, iri(ST + "windibank"));
    expect(b.byWorld.holmes_reconstruction.status).toBe("asserted");
    expect(b.byWorld.reality.status).toBe("received");
    expect(b.byWorld.reality.receivedFrom).toBe("holmes_reconstruction");
    expect(b.byWorld.mary_D1.status).toBe("not-determined");
    // Windibank's own beliefs state the converse: derived by symmetry
    expect(b.byWorld.windibank_beliefs.status).toBe("derived");
    expect(b.byWorld.windibank_beliefs.hint.rule).toBe("symmetric");
  });

  it("Windibank says the disappearance was involuntary and believes the opposite (insincerity), also as Hosmer via identity", async () => {
    const b = await status(iri(ST + "disappearance"), TYPE, iri(PROF + "InvoluntaryDisappearance"));
    expect(b.agent("Windibank").flags).toContain("says-what-they-believe-false");
    expect(b.agent("Hosmer").flags).toContain("says-what-they-believe-false");
    expect(b.agent("Hosmer").summary).toMatch(/via identity/);
    expect(b.agent("Mary").summary).toBe("believes it");
  });

  it("investigation mode hides what comes after the checkpoint", async () => {
    const r = await request(app).get("/api/sentence/P128.S07").query({ mode: "C1" });
    expect(r.body.hidden).toBe(true);
    const ok = await request(app).get("/api/sentence/P031.S10").query({ mode: "C1" });
    expect(ok.body.hidden).toBeUndefined();
    expect(JSON.stringify(ok.body)).not.toMatch(/story\/windibank\b.*sameAs|Windibank is Hosmer/);
  });
});

describe("sentence kaleidoscope (reader-facing viewpoints)", () => {
  it("P067.S01: Windibank's lie, with Hosmer merged into Windibank in the whole story", async () => {
    const r = await request(app).get("/api/sentence/P067.S01");
    expect(r.status).toBe(200);
    expect(r.body.marks).toContain("lie");
    expect(r.body.diagnoses.map((d: any) => [d.kind, d.person])).toContainEqual(["lie", "windibank"]);
    const vp = r.body.viewpoints[0];
    expect(vp.reality.value).toBe("false");
    const ids = vp.people.map((p: any) => p.id);
    expect(ids).toContain("windibank");
    expect(ids).not.toContain("hosmer");                     // the persona is merged into the man behind the mask
    expect(vp.people.find((p: any) => p.id === "windibank").alias).toBe("Hosmer Angel");
    expect(r.body.dossiers.map((d: any) => d.id)).toContain("insincere-v_windibank_reassure");
    expect(r.body.graph.length).toBeGreaterThan(0);
  });

  it("the lie is marked where it is said (P067.S01), not where Mary repeats the content (P059.S02: her delusion)", async () => {
    const t = (await request(app).get("/api/text")).body;
    const s = (id: string) => t.paragraphs.flatMap((p: any) => p.sentences).find((x: any) => x.id === id);
    expect(s("P067.S01").marks).toContain("lie");
    expect(s("P059.S02").marks).not.toContain("lie");
    expect(s("P059.S02").marks).toContain("delusion");
    // KGRC alignment alone no longer makes a sentence interactive
    expect(t.paragraphs.flatMap((p: any) => p.sentences).every((x: any) => !("layers" in x))).toBe(true);
  });

  it("the second journey as an actual journey: Mary's belief is a delusion; Holmes concludes otherwise; silent people carry no stance", async () => {
    const r = await request(app).get("/api/sentence/P039.S01");
    const vp = r.body.viewpoints.find((v: any) => /second journey.*actual/.test(v.text));
    expect(vp.diagnoses.map((d: any) => d.kind)).toEqual(["delusion"]);
    const mary = vp.people.find((p: any) => p.id === "mary");
    expect(mary.stances).toEqual([expect.objectContaining({ verb: "believes", polarity: "yes" })]);
    expect(vp.people.find((p: any) => p.id === "holmes").stances[0]).toMatchObject({ verb: "concludes", polarity: "no" });
    expect(vp.silent).toContain("watson");
    expect(vp.people.find((p: any) => p.id === "watson").stances).toEqual([]);
  });

  it("Hosmer's 'cashier' is a lie only under the one-occupation assumption", async () => {
    const r = await request(app).get("/api/sentence/P041.S04");
    const lie = r.body.diagnoses.find((d: any) => d.kind === "lie");
    expect(lie.person).toBe("windibank");
    expect(lie.assumption).toMatch(/one occupation/);
  });
});
