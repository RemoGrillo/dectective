#!/usr/bin/env python3
"""Heuristic sensitivity series for DEC materialisation cost (small sample, no scalability claim).

Base: the slice of one representative query (default T06a: gold, checkInconsistencies on).
Series A (background): add N triples of the ORIGINAL KGRC graph to reality (default graph). They do
  not interact with the profile (different vocabulary) and are irrelevant to the query, but are
  reasoned on in reality and permeated into conjectural worlds. N in 0, 250, 500, 1000, 2000, 4000.
Series B (worlds): add M extra doxastic worlds with neutral, non-conflicting content (3 triples each),
  each governed by its own agent; the pairwise inconsistency check grows as n(n-1)/2. M in 2,4,8,16.
Each point: DEC (and ctx for reference) with --warmup 0 --reps R; a series stops at the first timeout,
which is recorded. Output: prototype/results/sensitivity.json
Usage: python -I scripts/sensitivity.py <root> [--query T06a_belief_worlds_vs_reality] [--reps 3] [--timeout 900]
"""
import argparse
import glob
import json
import os
import subprocess
import time

import rdflib
from rdflib import URIRef

W = "http://example.org/dectective/world/"
ST = "http://example.org/dectective/story/"
PROF = "http://example.org/dectective/profile#"


def run(root, data, qf, cfg, reps, timeout, out):
    cp = os.path.join(root, "prototype/runner/target/dec-metrics-runner-0.1.0.jar") + ":" + os.path.join(root, "prototype/runner/target/lib/*")
    t0 = time.time()
    p = subprocess.run(["timeout", str(timeout), "java", "-Xmx4g", "-cp", cp, "dectective.Runner", "--data", data, "--query", qf,
                        "--config", cfg, "--warmup", "0", "--reps", str(reps), "--out", out], capture_output=True, text=True)
    wall = time.time() - t0
    if p.returncode != 0:
        return {"rc": p.returncode, "wall_s": round(wall, 1), "timeout": p.returncode == 124}
    r = json.load(open(out))
    mats = [x["materialise_total_ms"] for x in r["runs"]]
    a = r["accounting"]
    return {"rc": 0, "wall_s": round(wall, 1), "mat_ms": mats, "mat_ms_median": sorted(mats)[len(mats) // 2],
            "input_quads": r["input_quads"], "materialised_total": a["materialised_total"], "n_worlds": a["n_worlds"],
            "inconsistency_pairs": a["inconsistency_pairs"], "answer": r["query_result"].get("rows", r["query_result"].get("ask"))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--query", default="T06a_belief_worlds_vs_reality")
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument("--timeout", type=int, default=900)
    a = ap.parse_args()
    root = a.root
    qf = glob.glob(os.path.join(root, "prototype/fixtures/*", a.query + ".rq"))[0]
    base = os.path.join(os.path.dirname(qf), "slices", a.query + ".trig")
    sdir = os.path.join(root, "prototype/results/sensitivity")
    os.makedirs(sdir, exist_ok=True)
    kg = rdflib.Graph()
    kg.parse(os.path.join(root, "sources/kgrc/ACaseOfIdentity.ttl"), format="turtle")
    kg_triples = sorted(kg, key=lambda t: (str(t[0]), str(t[1]), str(t[2])))   # deterministic order
    res = {"base_slice": os.path.relpath(base, root), "query": a.query, "reps": a.reps, "timeout_s": a.timeout, "A_background": [], "B_worlds": []}
    for n in [0, 250, 500, 1000, 2000, 4000]:
        ds = rdflib.Dataset()
        ds.parse(base, format="trig")
        for t in kg_triples[:n]:
            ds.default_graph.add(t)
        path = os.path.join(sdir, f"A_{n}.trig")
        ds.serialize(destination=path, format="trig")
        point = {"background_triples": n}
        for cfg in ("dec", "ctx"):
            point[cfg] = run(root, path, qf, cfg, a.reps, a.timeout, os.path.join(sdir, f"A_{n}_{cfg}.json"))
        res["A_background"].append(point)
        print("A", n, {c: point[c].get("mat_ms_median", "TIMEOUT" if point[c].get("timeout") else point[c].get("rc")) for c in ("dec", "ctx")}, flush=True)
        if point["dec"].get("timeout"):
            break
    for m in [2, 4, 8, 16]:
        ds = rdflib.Dataset()
        ds.parse(base, format="trig")
        for i in range(m):
            g = ds.graph(URIRef(f"{W}extra{i}"))
            g.add((URIRef(f"{ST}x{i}"), URIRef(PROF + "attended"), URIRef(ST + "ball")))
            g.add((URIRef(f"{ST}x{i}"), URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), URIRef("http://www.cidoc-crm.org/cidoc-crm/E21_Person")))
            g.add((URIRef(f"{ST}x{i}"), URIRef(PROF + "wore"), URIRef(f"{ST}hat{i}")))
            ds.default_graph.add((URIRef(f"{ST}agent{i}"), URIRef(PROF + "believes"), URIRef(f"{W}extra{i}")))
        path = os.path.join(sdir, f"B_{m}.trig")
        ds.serialize(destination=path, format="trig")
        point = {"extra_worlds": m}
        for cfg in ("dec", "ctx"):
            point[cfg] = run(root, path, qf, cfg, a.reps, a.timeout, os.path.join(sdir, f"B_{m}_{cfg}.json"))
        res["B_worlds"].append(point)
        print("B", m, {c: point[c].get("mat_ms_median", "TIMEOUT" if point[c].get("timeout") else point[c].get("rc")) for c in ("dec", "ctx")},
              "pairs", point["dec"].get("inconsistency_pairs"), flush=True)
        if point["dec"].get("timeout"):
            break
    with open(os.path.join(root, "prototype/results/sensitivity.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
