// A runaway query is cancelled (the worker is terminated) and the endpoint keeps answering.
import { describe, expect, it } from "vitest";
import request from "supertest";

process.env.SPARQL_TIMEOUT_MS = "400";
const { createApp } = await import("../src/index.ts");
const app = createApp();

describe("SPARQL timeout", () => {
  it("cancels a cross product over the store and recovers", async () => {
    const slow = "SELECT (COUNT(*) AS ?n) WHERE { ?a ?b ?c . ?d ?e ?f . ?g ?h ?i }";
    const r = await request(app).get("/sparql").query({ query: slow });
    expect(r.status).toBe(503);
    expect(r.text).toMatch(/cancelled/);
    const ok = await request(app).get("/sparql").query({ query: "ASK { ?s ?p ?o }" });
    expect(ok.status).toBe(200);
  }, 30000);
});
