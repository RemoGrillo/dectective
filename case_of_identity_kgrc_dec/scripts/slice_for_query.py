#!/usr/bin/env python3
"""Build the minimal dataset ("slice") needed by ONE SPARQL query, to keep DEC materialisation small.

Selection (declared, heuristic, verified afterwards by answer preservation):
  1. candidate modules = catalog modules of the requested dataset (gold, or sim with checkpoint <= Ck);
  2. seed IRIs = IRIs occurring in the query algebra (constants and GRAPH names) + `seed_iris` and
     whole modules listed in the fixture manifest (`require_modules`);
  3. worlds: every world module whose graph IRI is a seed is included whole;
  4. default-graph triples (facts) are added by k-hop expansion over story IRIs (st:, w:) starting
     from the seeds and from the IRIs used in the selected worlds; governing triples whose object
     is a selected world are always added; governing triples for non-selected worlds are dropped;
  5. DEC configuration: typing of the governing predicates actually used; checkInconsistencies and
     closedFor only if the manifest asks for them (`dec_flags`);
  6. schema (shared world): only the profile/axiom triples about terms used by the selected triples,
     plus the CIDOC CRM / CRMinf fragment for the CRM terms used (extract_onto_module.py), never the
     whole ontology.
Guardrails: --max-world-triples (default 5000) and --max-worlds (default 25; the inconsistency check
is pairwise, n(n-1)/2). Exceeding them aborts with an explicit error instead of running DEC.
Output: slice TriG + JSON report (sizes before/after per graph, modules touched, signature, k).
Usage: python -I scripts/slice_for_query.py <root> --dataset gold|C1..C4 --query q.rq --manifest m.json
                                            --out slice.trig --report report.json [--k 2]
"""
import argparse
import json
import os
import sys

import rdflib
from rdflib import RDF, RDFS, OWL, URIRef, BNode
from rdflib.plugins.sparql import prepareQuery

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_onto_module import extract, load_sources  # noqa: E402

ST = "http://example.org/dectective/story/"
W = "http://example.org/dectective/world/"
PROF = "http://example.org/dectective/profile#"
CRM = "http://www.cidoc-crm.org/cidoc-crm/"
INF = "http://www.cidoc-crm.org/extensions/crminf/"
DEC = "http://w3id.org/conjectures/"
CK = ["C1", "C2", "C3", "C4", "G"]
GOVERNING = {PROF + "believes", PROF + "establishes", PROF + "conjectures", PROF + "uttered"}


def query_iris(text):
    q = prepareQuery(text)
    found = set()

    def walk(x):
        if isinstance(x, URIRef):
            found.add(x)
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, (list, tuple, set)):
            for v in x:
                walk(v)
        elif hasattr(x, "items"):
            for _, v in x.items():
                walk(v)
    walk(q.algebra)
    return found


def story(x):
    return isinstance(x, URIRef) and (str(x).startswith(ST) or str(x).startswith(W))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--query", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--k", type=int, default=2)
    ap.add_argument("--max-world-triples", type=int, default=5000)
    ap.add_argument("--max-worlds", type=int, default=25)
    ap.add_argument("--schema", choices=["minimal", "fragment"], default="minimal",
                    help="minimal: profile axioms of used terms + CRM closure only for CRM terms named in the query; "
                         "fragment: also domain/range and the CRM/CRMinf closure of every CRM term reached")
    a = ap.parse_args()
    root = a.root
    man = json.load(open(a.manifest, encoding="utf-8"))
    cat = [json.loads(l) for l in open(os.path.join(root, "prototype/modules/catalog.jsonl"), encoding="utf-8")]
    if a.dataset == "gold":
        cand = [r for r in cat if r["dataset"] == "gold"]
    else:
        cand = [r for r in cat if r["dataset"] == "sim" and CK.index(r["checkpoint"]) <= CK.index(a.dataset)]
    # load candidate modules
    mods = {}
    for r in cand:
        d = rdflib.Dataset()
        d.parse(os.path.join(root, r["file"]), format="trig")
        mods[r["id"]] = (r, d)
    full_counts = {}
    for r, d in mods.values():
        key = r["graph"]
        full_counts[key] = full_counts.get(key, 0) + sum(1 for _ in d.quads())
    qtext = open(a.query, encoding="utf-8").read()
    seeds = {i for i in query_iris(qtext) if story(i)} | {URIRef(x) for x in man.get("seed_iris", [])}
    required = set(man.get("require_modules", []))
    # 3. worlds
    sel_worlds = {}
    for mid, (r, d) in mods.items():
        if r["role"] == "world" and (URIRef(r["graph"].replace("w:", W)) in seeds or mid in required):
            sel_worlds[URIRef(r["graph"].replace("w:", W))] = (r, d)   # URIRef keys: rdflib terms never equal plain str
    # 4. facts by k-hop expansion
    facts = []
    for mid, (r, d) in mods.items():
        if r["role"] in ("fact", "crminf"):
            for s, p, o, g in d.quads():
                facts.append((s, p, o, mid))
    frontier = set(seeds) | set(sel_worlds.keys())
    for r, d in sel_worlds.values():
        for s, p, o, g in d.quads():
            frontier |= {x for x in (s, o) if story(x)}
    selected = set()
    reached = set(frontier)
    for _ in range(a.k):
        new = set()
        for (s, p, o, mid) in facts:
            if str(p) in GOVERNING:
                continue
            if (s in reached or o in reached) and (s, p, o) not in selected:
                selected.add((s, p, o))
                new |= {x for x in (s, o) if story(x)}
        reached |= new
    for (s, p, o, mid) in facts:                       # required fact modules are added whole
        if mid in required and str(p) not in GOVERNING:
            selected.add((s, p, o))
    gov = [(s, p, o) for (s, p, o, mid) in facts if str(p) in GOVERNING and o in sel_worlds]
    # world IRIs referenced by communicative acts (prof:hasContent) must not create dangling worlds
    selected = {t for t in selected if not (t[1] == URIRef(PROF + "hasContent") and t[2] not in sel_worlds)}
    # 5. DEC configuration
    used_gov = {p for (_, p, _) in gov}
    dec_triples = []
    for mid, (r, d) in mods.items():
        if r["role"] != "dec":
            continue
        for s, p, o, g in d.quads():
            if p == RDF.type and str(o).endswith("Predicate") and s not in used_gov:
                continue
            if str(p) == DEC + "checkInconsistencies" and "checkInconsistencies" not in man.get("dec_flags", []):
                continue
            if str(p) == DEC + "closedFor" and str(o) not in man.get("closed_for", []):
                continue
            dec_triples.append((s, p, o))
    # 6. schema: terms used
    used_terms = set()
    content = list(selected) + gov + [t[:3] for r, d in sel_worlds.values() for t in d.quads()]
    for s, p, o in content:
        used_terms.add(p)
        if p == RDF.type:
            used_terms.add(o)
    prof_g = rdflib.Graph().parse(os.path.join(root, "prototype/profile/dtv_profile.ttl"), format="turtle")
    ax = rdflib.Dataset()
    ax.parse(os.path.join(root, "prototype/modules/schema/S03_axioms.trig"), format="trig")
    schema = rdflib.Graph()
    crm_terms = set()
    todo = {t for t in used_terms if str(t).startswith(PROF)}
    done = set()
    while todo:                                          # profile closure (super-classes/properties inside prof:)
        t = todo.pop()
        if t in done:
            continue
        done.add(t)
        for s, p, o in prof_g.triples((t, None, None)):
            if p in (RDFS.comment, RDFS.label):
                continue
            to_crm = isinstance(o, URIRef) and str(o).startswith((CRM, INF))
            if a.schema == "minimal" and (p in (RDFS.domain, RDFS.range) or to_crm):
                continue                                 # minimal: no domain/range typing, no links into CRM
            schema.add((s, p, o))
            if isinstance(o, URIRef):
                if str(o).startswith(PROF):
                    todo.add(o)
                elif to_crm:
                    crm_terms.add(o)
    q_terms = {i for i in query_iris(qtext) if str(i).startswith((CRM, INF))}
    for t in (used_terms if a.schema == "fragment" else q_terms):
        if str(t).startswith((CRM, INF)):
            crm_terms.add(t)
    excluded = set(man.get("exclude_axioms", []))      # ablation: drop analytic axioms by subject local name
    for s, p, o, g in ax.quads():                        # axioms only if both sides are in use
        if str(s).rsplit("#", 1)[-1] in excluded:
            continue
        if s in done and (not isinstance(o, URIRef) or o in done or not str(o).startswith(PROF)):
            schema.add((s, p, o))
    if crm_terms:
        for t in extract(load_sources(root), [str(x) for x in crm_terms]):
            schema.add(t)
    # assemble
    out = rdflib.Dataset()
    for t in selected:
        out.add(t + (out.default_graph.identifier,)) if False else out.default_graph.add(t)
    for t in gov:
        out.default_graph.add(t)
    for t in dec_triples:
        out.default_graph.add(t)
    if len(schema):
        sg = out.graph(URIRef(W + "shared"))
        for t in schema:
            sg.add(t)
        out.default_graph.add((URIRef(W + "shared"), RDF.type, URIRef(DEC + "sharedWorld")))
    for wiri, (r, d) in sel_worlds.items():
        g = out.graph(URIRef(wiri))
        for s, p, o, _ in d.quads():
            g.add((s, p, o))
    sizes = {"default": len(out.default_graph)}
    for g in out.graphs():
        if g.identifier != out.default_graph.identifier and len(g):
            sizes[str(g.identifier)] = len(g)
    n_worlds = len([k for k in sizes if k != "default"])
    report = {"dataset": a.dataset, "query": os.path.relpath(a.query, root), "k": a.k,
              "seeds": sorted(str(s) for s in seeds), "worlds_selected": sorted(sel_worlds.keys()),
              "modules_candidate": len(mods), "fact_triples_selected": len(selected), "governing_triples": len(gov),
              "dec_config_triples": len(dec_triples), "schema_triples": len(schema), "crm_terms": len(crm_terms),
              "excluded_axioms": sorted(excluded), "schema_mode": a.schema,
              "sizes_after": sizes, "sizes_full_by_graph": full_counts,
              "total_after": sum(sizes.values()), "total_full": sum(full_counts.values()),
              "inconsistency_pairs_upper_bound": n_worlds * (n_worlds + 1) // 2}
    if any(v > a.max_world_triples for v in sizes.values()) or n_worlds > a.max_worlds:
        report["error"] = "guardrail exceeded"
        json.dump(report, open(a.report, "w"), indent=2)
        print("GUARDRAIL EXCEEDED", sizes, n_worlds, file=sys.stderr)
        sys.exit(2)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    out.serialize(destination=a.out, format="trig")
    json.dump(report, open(a.report, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"slice {os.path.basename(a.out)}: {report['total_after']} triples (full {report['total_full']}), worlds {n_worlds}")


if __name__ == "__main__":
    main()
