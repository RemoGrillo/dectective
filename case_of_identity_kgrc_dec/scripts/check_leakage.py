#!/usr/bin/env python3
"""Leakage checks for the simulation checkpoints prototype/sim/C1..C4.trig.

1. static-gold   : no triple of a GOLD module whose checkpoint is later than Ck may appear (after
                   gold->neutral renaming) in a reality-reaching graph of Ck (default graph, worlds
                   typed epistemic or shared).
2. critical      : solution-critical patterns forbidden in reality-reaching graphs before C4
                   (identity pB=pC, pretended journeys, voluntary disappearance, authorship of the
                   letters by pB, impersonation).
3. lexical       : literals (labels/comments, also in the shared schema) and IRIs must not reveal the
                   solution (forbidden tokens; gold IRIs such as st:hosmer / st:windibank; KGRC IRIs).
4. dynamic       : DEC is run on Ck; the materialised reality (dump) must not contain the critical
                   patterns (catches permeation from epistemic/shared worlds into reality and, through
                   reality, into conjectural worlds).
Exit code 1 if any leak is found. Output: prototype/results/leakage_report.json
Usage: python -I scripts/check_leakage.py <project_root>
"""
import json
import os
import re
import subprocess
import sys

import rdflib
from rdflib import RDF, Literal, URIRef

ST = "http://example.org/dectective/story/"
W = "http://example.org/dectective/world/"
PROF = "http://example.org/dectective/profile#"
DEC = "http://w3id.org/conjectures/"
OWL_SAME = "http://www.w3.org/2002/07/owl#sameAs"
CK = ["C1", "C2", "C3", "C4", "G"]
TOKENS = ["disguis", "pretend", "impersonat", "joke", "connivance", "windibank as", "is hosmer", "same person"]
GOLD_NAMES = ["hosmer", "windibank", "mary", "mother", "holmes", "watson"]


def reality_graphs(ds):
    typed = {}
    for g in ds.graphs():
        pass
    default = ds.default_graph
    for s, o in default.subject_objects(RDF.type):
        if str(o) in (DEC + "epistemicWorld", DEC + "sharedWorld"):
            typed[str(s)] = str(o)
    # worlds governed by an epistemic predicate
    epi_preds = {str(s) for s in default.subjects(RDF.type, URIRef(DEC + "epistemicPredicate"))}
    for s, p, o in default:
        if str(p) in epi_preds:
            typed[str(o)] = DEC + "epistemicWorld"
    graphs = {"default": default}
    for g in ds.graphs():
        if str(g.identifier) in typed:
            graphs[str(g.identifier)] = g
    return graphs


def critical(k):
    if CK.index(k) >= CK.index("C4"):
        return []
    return [
        ("identity pC=pB", lambda s, p, o: p == OWL_SAME and {s, o} == {ST + "pC", ST + "pB"}),
        ("pretended journey", lambda s, p, o: p == str(RDF.type) and o == PROF + "PretendedJourney"),
        ("voluntary disappearance", lambda s, p, o: p == str(RDF.type) and o == PROF + "VoluntaryDisappearance"),
        ("letters written by pB", lambda s, p, o: p == PROF + "writtenBy" and o == ST + "pB" and s in (ST + "d1", ST + "d2")),
        ("impersonation", lambda s, p, o: p == str(RDF.type) and o == PROF + "Impersonation"),
    ]


def reduced_for_reality(ds, rg, path_out):
    """Keep only graphs that can reach reality (default, epistemic, shared), drop conflict-check flags and the
    CRM fragment (schema, no story content). Doxastic/conjectural/verbatim worlds never permeate into reality,
    so removing them cannot hide a reality leak."""
    out = rdflib.Dataset()
    for s_, p_, o_ in ds.default_graph:
        if str(p_) in (DEC + "checkInconsistencies", DEC + "closedFor"):
            continue
        out.default_graph.add((s_, p_, o_))
    for gname, g in rg.items():
        if gname == "default":
            continue
        tg = out.graph(URIRef(gname))
        for t in g:
            if str(t[0]).startswith(("http://www.cidoc-crm.org/", )):
                continue
            tg.add(t)
    out.serialize(destination=path_out, format="trig")


def main(root, dynamic=True):
    cat = [json.loads(l) for l in open(os.path.join(root, "prototype/modules/catalog.jsonl"), encoding="utf-8")]
    nmap = json.load(open(os.path.join(root, "prototype/gold/sim_name_map.json"), encoding="utf-8"))["map"]
    nmap = {k.replace("st:", ST): v.replace("st:", ST) for k, v in nmap.items()}
    report, leaks = {}, 0
    cp = os.path.join(root, "prototype/runner/target/dec-metrics-runner-0.1.0.jar") + ":" + os.path.join(root, "prototype/runner/target/lib/*")
    for k in CK[:4]:
        path = os.path.join(root, f"prototype/sim/{k}.trig")
        ds = rdflib.Dataset()
        ds.parse(path, format="trig")
        rg = reality_graphs(ds)
        found = []
        # 1 static-gold
        later = [r for r in cat if r["dataset"] == "gold" and CK.index(r["checkpoint"]) > CK.index(k) and r["role"] in ("fact", "world")]
        for r in later:
            if r["role"] == "world" and r["dec_type"] not in ("epistemic", "shared"):
                continue
            gm = rdflib.Dataset()
            gm.parse(os.path.join(root, r["file"]), format="trig")
            for s, p, o, _ in gm.quads():
                ms, mo = nmap.get(str(s)), nmap.get(str(o)) if isinstance(o, URIRef) else None
                if ms is None or (isinstance(o, URIRef) and str(o).startswith(ST) and mo is None):
                    continue
                t = (URIRef(ms), p, URIRef(mo) if mo else o)
                for gname, g in rg.items():
                    if t in g:
                        found.append({"check": "static-gold", "module": r["id"], "graph": gname, "triple": [str(x) for x in t]})
        # 2 critical
        for name, pred in critical(k):
            for gname, g in rg.items():
                for s, p, o in g:
                    if pred(str(s), str(p), str(o)):
                        found.append({"check": "critical", "pattern": name, "graph": gname, "triple": [str(s), str(p), str(o)]})
        # 3 lexical
        for s, p, o, g in ds.quads():
            for x in (s, p, o):
                if isinstance(x, Literal):
                    low = str(x).lower()
                    for tok in TOKENS:
                        if tok in low:
                            found.append({"check": "lexical-literal", "token": tok, "graph": str(g) if g is not None else "default", "subject": str(s), "literal": str(x)[:160]})
                elif isinstance(x, URIRef):
                    u = str(x)
                    if u.startswith(ST) or u.startswith(W):
                        local = u.rsplit("/", 1)[-1].lower()
                        if any(n in local for n in GOLD_NAMES):
                            found.append({"check": "lexical-iri", "iri": u})
                    if "kgc.knowledge-graph.jp" in u:
                        found.append({"check": "lexical-iri", "iri": u})
        # 4 dynamic (DEC materialisation of the reality-reaching part only)
        if not dynamic:
            report[k] = {"leaks": found, "n_leaks": len(found), "reality_reaching_graphs": sorted(rg.keys()), "dynamic": "skipped"}
            leaks += len(found)
            print(k, "leaks:", len(found), sorted({f["check"] for f in found}))
            for f in found[:6]:
                print("   ", json.dumps(f, ensure_ascii=False)[:260])
            continue
        red = os.path.join(root, f"prototype/results/leakage_{k}.reality_slice.trig")
        reduced_for_reality(ds, rg, red)
        path = red
        dump = os.path.join(root, f"prototype/results/leakage_{k}.dump.txt")
        out = os.path.join(root, f"prototype/results/leakage_{k}.json")
        q = os.path.join(root, "prototype/exploratory/probe.rq")
        p = subprocess.run(["timeout", "300", "java", "-Xmx3g", "-cp", cp, "dectective.Runner", "--data", path, "--query", q,
                            "--config", "dec", "--warmup", "0", "--reps", "1", "--dump", dump, "--out", out], capture_output=True, text=True)
        if p.returncode != 0:
            found.append({"check": "dynamic", "error": p.stderr[-500:]})
        else:
            for line in open(dump, encoding="utf-8"):
                m = re.match(r"<([^>]+)> (\S+) (\S+) (.+)$", line.strip())
                if not m:
                    continue
                world, s, pr, o = m.groups()
                if world != DEC + "reality":
                    continue
                for name, pred in critical(k):
                    if pred(s, pr, o):
                        found.append({"check": "dynamic", "pattern": name, "world": world, "triple": [s, pr, o]})
        report[k] = {"leaks": found, "n_leaks": len(found), "reality_reaching_graphs": sorted(rg.keys())}
        leaks += len(found)
        print(k, "leaks:", len(found), sorted({f["check"] for f in found}))
        for f in found[:6]:
            print("   ", json.dumps(f, ensure_ascii=False)[:260])
    with open(os.path.join(root, "prototype/results/leakage_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    sys.exit(1 if leaks else 0)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".", dynamic="--no-dynamic" not in sys.argv)
