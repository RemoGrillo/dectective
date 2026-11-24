// Worlds as a Venn diagram: what each person says / believes / concludes / supposes, against Reality, and who
// influences whom (what X says that Y believes).
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.ts";

const app = createApp();
const get = async (mode = "gold") => (await request(app).get("/api/venn").query({ mode })).body;

describe("Venn of the worlds", () => {
  it("whole story: Windibank deceives Mary — what he says (as Hosmer too) is what she believes, outside Reality", async () => {
    const v = await get();
    const l = v.links.find((x: any) => x.from === "windibank:says" && x.to === "mary:believes");
    expect(l.kind).toBe("deceives");
    const texts = l.items.map((id: string) => v.items.find((i: any) => i.id === id).text);
    expect(texts).toEqual(expect.arrayContaining([expect.stringMatching(/cashier/), expect.stringMatching(/disappearance .* involuntary/)]));
    for (const id of l.items.filter((id: string) => l.byItem[id] === "deceives")) {
      expect(v.items.find((i: any) => i.id === id).sets).not.toContain("reality");
    }
  });
  it("says and believes are separate sets: everything Windibank believes is true, unlike what he says", async () => {
    const v = await get();
    const believed = v.items.filter((i: any) => i.sets.includes("windibank:believes"));
    expect(believed.length).toBeGreaterThan(3);
    expect(believed.every((i: any) => i.reality === "true")).toBe(true);
    const said = v.items.filter((i: any) => i.sets.includes("windibank:says"));
    expect(said.some((i: any) => i.reality === "false")).toBe(true);
    expect(v.sets.some((s: any) => s.id === "hosmer:says")).toBe(false);     // the persona is merged into Windibank
  });
  it("Holmes's solution lies inside Reality; Watson's guess outside it, but not ruled out", async () => {
    const v = await get();
    expect(v.items.filter((i: any) => i.sets.includes("holmes:concludes")).every((i: any) => i.sets.includes("reality"))).toBe(true);
    const w = v.items.filter((i: any) => i.sets.includes("watson:supposes"));
    expect(w.length).toBeGreaterThan(0);
    expect(w.every((i: any) => i.reality === "unknown")).toBe(true);
  });
  it("up to Mary's visit (C1) the same testimony is only 'tells': nothing is judged yet", async () => {
    const v = await get("C1");
    expect(v.links.length).toBeGreaterThan(0);
    expect(v.links.every((l: any) => l.kind === "tells")).toBe(true);
    expect(v.sets.some((s: any) => s.id === "hosmer:says")).toBe(true);      // not yet unmasked: a separate person
    expect(v.items.every((i: any) => i.reality !== "false")).toBe(true);
  });
});

describe("focused Venn diagrams", () => {
  it("a sentence: Hosmer's 'cashier' sits in Mary believes ∩ Windibank says, clashing with the Reality fact that rules it out", async () => {
    const v = (await request(app).get("/api/venn/sentence/P041.S04")).body;
    const cashier = v.items.find((i: any) => /cashier/.test(i.text));
    expect(cashier.sets).toEqual(["mary:believes", "windibank:says"]);
    const trade = v.items.find((i: any) => /traveller in wines/.test(i.text));
    expect(trade.sets).toContain("reality");
    expect(v.clashes).toContainEqual(expect.objectContaining({ item: cashier.id, other: trade.id, assumption: true }));
    expect(v.links.find((l: any) => l.from === "windibank:says" && l.to === "mary:believes").kind).toBe("deceives");
  });
  it("a case file: the identity is in Reality and in Holmes's solution, the de re engagement only in Reality", async () => {
    const v = (await request(app).get("/api/venn/dossier/identity-hosmer")).body;
    expect(v.items.find((i: any) => /same person/.test(i.text)).sets).toEqual(expect.arrayContaining(["reality", "holmes:concludes"]));
    expect(v.items.find((i: any) => /engaged to James Windibank/.test(i.text)).sets).toEqual(["reality"]);
  });
});

describe("Venn of one proposition (the Kaleidoscope's side column)", () => {
  it("draws the denial in what Windibank says, outside Reality, with Reality's identity as its witness", async () => {
    const km = (await request(app).get("/api/knowledge")).body;
    const row = km.rows.find((r: any) => r.text === "James Windibank is not the same person as Hosmer Angel");
    const v = (await request(app).get(`/api/venn/proposition/${row.id}`)).body;
    const it0 = v.items.find((i: any) => i.text === row.text);
    expect(it0.sets).toContain("windibank:says");
    expect(it0.sets).not.toContain("reality");
    expect(v.clashes.length).toBeGreaterThan(0);
  });
  it("refuses an unknown proposition or one of the other dataset", async () => {
    expect((await request(app).get("/api/venn/proposition/nope")).status).toBe(404);
    const sim = (await request(app).get("/api/knowledge").query({ mode: "C4" })).body.rows[0].id;
    expect((await request(app).get(`/api/venn/proposition/${sim}`)).status).toBe(404);
  });
});
