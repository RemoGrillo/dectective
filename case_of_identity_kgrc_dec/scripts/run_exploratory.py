#!/usr/bin/env python3
"""Run the exploratory DEC fixtures (prototype/exploratory/E*.trig) through the runner and check
behaviours stated in the paper/README against what the implementation actually materialises.

Each expectation is (world, subject, predicate, object, expected_presence) on the per-world dump
(<world> s p o lines). Expectations encode the DOCUMENTED behaviour; a mismatch is a finding,
not a test failure to be hidden. Output: prototype/results/exploratory/summary.json (+ dumps).
Usage: python -I scripts/run_exploratory.py <project_root>
"""
import json
import os
import subprocess
import sys

X = "http://example.org/x#"
DEC = "http://w3id.org/conjectures/"
RDFT = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
SAME = "http://www.w3.org/2002/07/owl#sameAs"
REAL = DEC + "reality"


def x(n):
    return X + n


EXPECT = {
    "E01_verbatim": [
        ("V", x("x"), RDFT, x("A"), True, "verbatim keeps its content"),
        ("V", x("x"), RDFT, x("B"), False, "no inference inside verbatim (paper §5.1, README)"),
        (REAL, x("x"), RDFT, x("A"), False, "verbatim content does not permeate to reality"),
    ],
    "E02_doxastic": [
        ("D", x("x"), RDFT, x("B"), True, "doxastic receives shared and infers locally"),
        (REAL, x("x"), RDFT, x("A"), False, "doxastic does not permeate to reality"),
        ("D", x("y"), RDFT, x("A"), False, "reality does not enter a doxastic world"),
    ],
    "E03_epistemic": [
        ("K", x("x"), RDFT, x("B"), True, "epistemic infers locally with shared"),
        (REAL, x("x"), RDFT, x("A"), True, "epistemic content permeates to reality"),
        (REAL, x("x"), RDFT, x("B"), True, "epistemic consequences are factual in reality"),
    ],
    "E04_conjectural": [
        ("C", x("x"), RDFT, x("Z"), True, "conjectural receives reality and infers with its hypothesis"),
        ("C", x("x"), RDFT, x("B"), True, "conjectural receives shared consequences"),
        (REAL, x("x"), RDFT, x("Z"), False, "conjectural consequences do not go back to reality"),
    ],
    "E05_default_named": [
        ("U", x("x"), RDFT, x("B"), True, "paper §5.1: untyped named graph defaults to a doxastic world (local inference)"),
        (REAL, x("x"), RDFT, x("A"), None, "observe: does an untyped named graph permeate to reality?"),
    ],
    "E06_identity": [
        (REAL, x("clark"), x("canDo"), x("flying"), False, "Lois's belief does not become a fact"),
        ("LoisB", x("clark"), x("canDo"), x("flying"), False, "Superman paradox blocked: reality's sameAs does not enter a doxastic world"),
        ("LoisC", x("clark"), x("canDo"), x("flying"), True, "conjectural world receives reality's sameAs: substitution happens there"),
        ("JimmyB", x("clark"), x("canDo"), x("flying"), True, "identity asserted inside a doxastic world substitutes locally"),
    ],
    "E07_nested": [
        ("MaryB", x("x"), RDFT, x("B"), None, "observe: is a world governed only from INSIDE another world recognised (inference with shared)?"),
        ("HolmesB", x("mary"), x("believes"), x("MaryB"), True, "Holmes's world keeps the attribution"),
        (REAL, x("mary"), x("believes"), x("MaryB"), False, "the inner attribution is not a fact"),
    ],
    "E08_verbatim_conflict": [
        ("*", x("B"), DEC + "disagreesWith", REAL, True, "doxastic world in conflict with reality -> disagreesWith dec:reality"),
        ("*", x("V"), DEC + "disagreesWith", REAL, None, "observe: verbatim world flagged as well? (verbatim has no inference but the check reasons on the union)"),
        ("*", x("V"), RDFT, DEC + "delusionalWorld", None, "observe: verbatim world typed delusional?"),
    ],
    "E09_closedfor": [
        ("*", x("B"), DEC + "disagreesWith", x("K"), True, "closedFor: different objects for the same subject disagree"),
        ("*", x("B"), RDFT, DEC + "delusionalWorld", True, "doxastic world disagreeing with reality (via epistemic K) is delusional"),
    ],
    "E10_disjoint_doxastic": [
        ("*", x("B"), DEC + "disagreesWith", x("K"), True, "OWL disjointness in shared yields disagreement"),
        ("*", x("B"), RDFT, DEC + "delusionalWorld", True, "and a delusional classification of Mary's world (technical label)"),
    ],
    "E11_reification": [
        ("*", x("x"), RDFT, x("B"), None, "observe: reified statement under a doxastic predicate gets local inference?"),
        (REAL, x("x"), RDFT, x("A"), False, "reified belief does not become a fact"),
    ],
    "E13_closedfor_same_value": [
        ("*", x("B1"), DEC + "disagreesWith", x("B2"), False, "paper §5.2: only DIFFERENT objects for the same subject disagree"),
    ],
    "E14_closedfor_break": [
        ("*", x("B1"), DEC + "disagreesWith", x("B2"), True, "real disagreement on :s4 (m4 vs mX) must be detected regardless of iteration order"),
    ],
    "E12_union_identity_leak": [
        ("LoisB", x("clark"), x("canDo"), x("flying"), True, "identity put in SHARED leaks into every non-verbatim world (configuration hazard)"),
    ],
}


PFX = "PREFIX : <http://example.org/x#> PREFIX dec: <http://w3id.org/conjectures/> PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> "
PROBES = {
    "E03_epistemic": [
        ("ASK { GRAPH dec:reality { :x a :B } }", True, "SPARQL: epistemic consequence visible in GRAPH dec:reality"),
        ("ASK { :x a :B }", True, "SPARQL: epistemic consequence visible in the default graph"),
    ],
    "E02_doxastic": [
        ("ASK { GRAPH dec:reality { :x a :A } }", False, "SPARQL: doxastic content absent from reality"),
        ("ASK { GRAPH :D { :x a :B } }", True, "SPARQL: local inference visible inside the doxastic world"),
    ],
    "E04_conjectural": [
        ("ASK { GRAPH :C { :x a :Z } }", True, "SPARQL: conjectural consequence visible in its world"),
        ("ASK { GRAPH dec:reality { :x a :Z } }", False, "SPARQL: conjectural consequence absent from reality"),
    ],
    "E06_identity": [
        ("ASK { GRAPH :LoisB { :clark :canDo :flying } }", False, "SPARQL: no Superman substitution in Lois's doxastic world"),
        ("ASK { GRAPH :LoisC { :clark :canDo :flying } }", True, "SPARQL: substitution in the conjectural world"),
    ],
    "E11_reification": [
        ("ASK { ?st rdf:subject :x ; rdf:predicate rdf:type ; rdf:object :B . }", None, "SPARQL: inferred triple re-emitted as a reified statement?"),
        ("ASK { :eve :believes ?st . ?st rdf:subject :x ; rdf:predicate rdf:type ; rdf:object :B . }", None, "SPARQL: ... and governed by :believes?"),
        ("ASK { GRAPH dec:reality { :x a :A } }", False, "SPARQL: reified belief not factual"),
    ],
    "E07_nested": [
        ("ASK { GRAPH :MaryB { :x a :B } }", None, "SPARQL: inner world gets inference with shared?"),
    ],
}


def main(root):
    exp_dir = os.path.join(root, "prototype/exploratory")
    out_dir = os.path.join(root, "prototype/results/exploratory")
    os.makedirs(out_dir, exist_ok=True)
    cp = os.path.join(root, "prototype/runner/target/dec-metrics-runner-0.1.0.jar") + ":" + os.path.join(root, "prototype/runner/target/lib/*")
    summary = {}
    for name, checks in EXPECT.items():
        trig = os.path.join(exp_dir, name + ".trig")
        dump = os.path.join(out_dir, name + ".dump.txt")
        res = os.path.join(out_dir, name + ".json")
        cmd = ["timeout", "120", "java", "-Xmx2g", "-cp", cp, "dectective.Runner", "--data", trig, "--query",
               os.path.join(exp_dir, "probe.rq"), "--config", "dec", "--warmup", "0", "--reps", "1", "--dump", dump, "--out", res]
        p = subprocess.run(cmd, capture_output=True, text=True)
        if p.returncode != 0:
            summary[name] = {"error": p.stderr[-2000:]}
            continue
        lines = set(open(dump, encoding="utf-8").read().splitlines())
        acc = json.load(open(res, encoding="utf-8"))["accounting"]
        rows = []
        for (w, s, pr, o, expected, why) in checks:
            if w == "*":
                present = any(l.endswith(f" {s} {pr} {o}") for l in lines)
            else:
                wiri = w if w.startswith("http") else x(w)
                present = f"<{wiri}> {s} {pr} {o}" in lines
            rows.append({"world": w, "triple": f"{s.replace(X, ':').replace(DEC, 'dec:')} {pr.split('#')[-1].replace(DEC, 'dec:')} {o.replace(X, ':').replace(DEC, 'dec:')}",
                         "expected": expected, "observed": present,
                         "verdict": "observed-only" if expected is None else ("as documented" if expected == present else "DIFFERS"),
                         "note": why})
        probes = []
        for i, (q, expected, why) in enumerate(PROBES.get(name, [])):
            qf = os.path.join(out_dir, f"{name}.probe{i}.rq")
            open(qf, "w", encoding="utf-8").write(PFX + q + "\n")
            pr = os.path.join(out_dir, f"{name}.probe{i}.json")
            pp = subprocess.run(["timeout", "120", "java", "-Xmx2g", "-cp", cp, "dectective.Runner", "--data", trig, "--query", qf,
                                 "--config", "dec", "--warmup", "0", "--reps", "1", "--out", pr], capture_output=True, text=True)
            obs = json.load(open(pr, encoding="utf-8"))["query_result"].get("ask") if pp.returncode == 0 else "ERROR"
            probes.append({"query": q, "expected": expected, "observed": obs,
                           "verdict": "observed-only" if expected is None else ("as documented" if expected == obs else "DIFFERS"), "note": why})
        summary[name] = {"checks": rows, "sparql_probes": probes,
                         "world_types": {k.replace(X, ":").replace(DEC, "dec:"): v["type"] for k, v in acc["worlds"].items()},
                         "dec_diagnostics": [d.replace(X, ":").replace(DEC, "dec:") for d in acc["dec_diagnostics"]]}
    with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    for name, s in summary.items():
        if "error" in s:
            print(name, "ERROR", s["error"][-300:])
            continue
        print("==", name, s["world_types"])
        for r in s["checks"]:
            print("   ", r["verdict"].ljust(13), "obs=" + str(r["observed"]).ljust(5), r["world"].ljust(30)[-30:], r["triple"], "|", r["note"])
        for r in s.get("sparql_probes", []):
            print("    SPARQL", r["verdict"].ljust(13), "obs=" + str(r["observed"]).ljust(5), r["note"])
        if s["dec_diagnostics"]:
            print("    diag:", s["dec_diagnostics"])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
