// SPARQL 1.1 Protocol endpoint and the example gallery.
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index.ts";
import { examples } from "../src/api.ts";

const app = createApp();
const Q = "PREFIX st: <http://example.org/dectective/story/> PREFIX owl: <http://www.w3.org/2002/07/owl#> SELECT ?x WHERE { st:hosmer owl:sameAs ?x }";

describe("SPARQL protocol", () => {
  it("GET ?query= returns SPARQL JSON results", async () => {
    const r = await request(app).get("/sparql").query({ query: Q }).set("Accept", "application/sparql-results+json");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/sparql-results\+json/);
    const j = JSON.parse(r.text);
    expect(j.results.bindings.map((b: any) => b.x.value)).toContain("http://example.org/dectective/story/windibank");
    expect(r.headers["access-control-allow-origin"]).toBe("*");
  });
  it("POST form-urlencoded and POST application/sparql-query", async () => {
    const a = await request(app).post("/sparql").type("form").send({ query: Q });
    expect(a.status).toBe(200);
    const b = await request(app).post("/sparql").set("Content-Type", "application/sparql-query").send(Q);
    expect(b.status).toBe(200);
  });
  it("CSV via ?format= and via Accept", async () => {
    const a = await request(app).get("/sparql").query({ query: Q, format: "csv" });
    expect(a.headers["content-type"]).toMatch(/text\/csv/);
    expect(a.text.split(/\r?\n/)[0]).toBe("x");
    const b = await request(app).get("/sparql").query({ query: Q }).set("Accept", "text/csv");
    expect(b.headers["content-type"]).toMatch(/text\/csv/);
  });
  it("ASK and CONSTRUCT", async () => {
    const a = await request(app).get("/sparql").query({ query: "ASK { ?s ?p ?o }" });
    expect(JSON.parse(a.text).boolean).toBe(true);
    const c = await request(app).get("/sparql").query({ query: "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 3" });
    expect(c.headers["content-type"]).toMatch(/turtle/);
  });
  it("is read-only", async () => {
    const a = await request(app).post("/sparql").type("form").send({ update: "INSERT DATA { <a:a> <a:b> <a:c> }" });
    expect(a.status).toBe(403);
    const b = await request(app).post("/sparql").set("Content-Type", "application/sparql-query").send("INSERT DATA { <a:a> <a:b> <a:c> }");
    expect(b.status).toBe(403);
    const c = await request(app).post("/sparql").set("Content-Type", "application/sparql-update").send("DROP ALL");
    expect(c.status).toBe(403);
  });
  it("rejects malformed and missing queries; browsers are sent to the Lab", async () => {
    expect((await request(app).get("/sparql").query({ query: "SELEKT nothing" })).status).toBe(400);
    expect((await request(app).get("/sparql")).status).toBe(400);
    const html = await request(app).get("/sparql").set("Accept", "text/html,application/xhtml+xml");
    expect(html.status).toBe(303);
    expect(html.headers.location).toBe("/lab");
  });
});

describe("example gallery (natural language ↔ SPARQL)", () => {
  it("has at least 24 examples, each with a question and a category", () => {
    expect(examples.length).toBeGreaterThanOrEqual(24);
    for (const e of examples) { expect(e.question.length).toBeGreaterThan(10); expect(e.category).toBeTruthy(); }
  });
  for (const e of examples) {
    it(`runs and answers: ${e.id}`, async () => {
      const r = await request(app).post("/sparql").set("Content-Type", "application/sparql-query").send(e.sparql);
      expect(r.status, r.text).toBe(200);
      const j = JSON.parse(r.text);
      if (typeof j.boolean === "boolean") return;
      expect(j.results.bindings.length).toBeGreaterThan(0);
    }, 20000);
  }
});
