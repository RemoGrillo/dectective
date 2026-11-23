#!/usr/bin/env python3
"""DEC run on growing prefixes of the story ("Deductions" timeline of the digital edition).

Every non-schema triple of the gold model gets the sentence from which a reader has it ("availability"):
  - a world (with its governance and CRMinf scaffolding: belief/adoption/inference nodes, communicative acts that
    carry it) enters when both its passage (module segments) and its first content have been read, counting only
    anchors at or after the start of its module's checkpoint window (so Windibank's beliefs do not enter at P024
    because Mary mentions his trade, and his reassurance enters where it is said, P067.S01);
  - a world's content triple: max(its first anchor, the world's entry);
  - any other fact: its first anchor (edition/data/catalog.json, propositions[].sentences); no anchor -> end of
    its module's checkpoint;
  - schema (S01-S03) and predicate typing (D01) from the start; conflict check and closedFor (D02-D04) never:
    these runs only materialise permeation + local inference (seconds instead of minutes per run).
  Manual corrections: edition/annotations/timeline_overrides.json.
One DEC run per distinct availability sentence ("clue"), plus a baseline with the schema only.
Outputs (prototype/results/timeline/):
  availability.csv            every decision (triple, module, world, anchors, chosen sentence, rule)
  steps.json                  clue list: step, sentence, triples asserted
  step_NN.trig / step_NN.json DEC input and Runner measurements (time, accounting)
  step_NN.dump.txt.gz         DEC materialisation ("<world> s p o"), gzipped
  metrics.json                per-run time / asserted / materialised / inferred + averages; monotonicity check
Usage: python3 -I scripts/run_edition_timeline.py <project_root> [--only-plan]
"""
import csv
import gzip
import json
import os
import subprocess
import sys

import rdflib
from rdflib import URIRef

W = "http://example.org/dectective/world/"
PROF = "http://example.org/dectective/profile#"
INF = "http://www.cidoc-crm.org/extensions/crminf/"
GOV = {PROF + "believes", PROF + "establishes", PROF + "conjectures", PROF + "uttered"}
TIE = {PROF + "hasContent", INF + "J4_that"}
BOUNDARY = {"C1": 80, "C2": 100, "C3": 118, "C4": 130, "G": 138}
CK = ["C1", "C2", "C3", "C4", "G"]


def para(sid):
    return int(sid[1:4])


def main(root, only_plan=False):
    ed = os.path.join(root, "edition")
    out = os.path.join(root, "prototype/results/timeline")
    os.makedirs(out, exist_ok=True)
    cat = [json.loads(l) for l in open(os.path.join(root, "prototype/modules/catalog.jsonl"), encoding="utf-8")]
    props = json.load(open(os.path.join(ed, "data/catalog.json"), encoding="utf-8"))["propositions"]
    over = json.load(open(os.path.join(ed, "annotations/timeline_overrides.json"), encoding="utf-8"))
    sents = list(csv.DictReader(open(os.path.join(root, "data/text/sentences.csv"), encoding="utf-8")))
    order = {r["sent_id"]: i for i, r in enumerate(sents)}
    end_of = {ck: max((r["sent_id"] for r in sents if para(r["sent_id"]) == BOUNDARY[ck]), key=order.get) for ck in CK}
    start_para = {ck: (BOUNDARY[CK[CK.index(ck) - 1]] + 1 if CK.index(ck) else 1) for ck in CK}
    anchors = {}                                   # (world, s p o) -> sorted anchors
    for p in props.values():
        if p["dataset"] == "gold":
            anchors[(p["world"], f'{p["s"]} {p["p"]} {p["o"]}')] = sorted((s for s in p["sentences"] if s in order), key=order.get)

    # load gold modules
    mods = []
    for rec in cat:
        if rec["dataset"] != "gold" or rec["id"] in ("D02_check", "D03_closed_writtenBy", "D04_closed_occupation"):
            continue
        d = rdflib.Dataset()
        d.parse(os.path.join(root, rec["file"]), format="trig")
        world = "shared" if rec["role"] == "schema" else "reality" if rec["graph"] == "default" else rec["graph"].replace("w:", "")
        graph = W + "shared" if rec["role"] == "schema" else None if rec["graph"] == "default" else W + world
        mods.append((rec, world, graph, [(s, p, o) for s, p, o, _ in d.quads()]))

    def key(s, p, o):
        return f"{s.n3()} {p.n3()} {o.n3()}"

    # world entries
    entry, entry_rule = {}, {}
    for rec, world, graph, triples in mods:
        if rec["role"] != "world":
            continue
        ck = rec["checkpoint"]
        allA = sorted({a for t in triples for a in anchors.get((world, key(*t)), [])}, key=order.get)
        inwin = [a for a in allA if para(a) >= start_para[ck]]
        segs = sorted((x for x in rec.get("segments") or [] if x in order and para(x) >= start_para[ck]), key=order.get)
        if world in over.get("worlds", {}):
            entry[world], entry_rule[world] = over["worlds"][world], "override"
        elif inwin and segs:
            # the world exists once the passage that carries it (module segment) has been read AND its first content has
            entry[world], entry_rule[world] = max(inwin[0], segs[0], key=order.get), "max(first module passage, first content anchor) in its checkpoint window"
        elif inwin:
            entry[world], entry_rule[world] = inwin[0], "first anchor in or after its checkpoint window"
        elif allA:
            entry[world], entry_rule[world] = allA[0], "first anchor (before its checkpoint window)"
        else:
            entry[world], entry_rule[world] = end_of[ck], "end of its checkpoint (no anchor)"

    # nodes tied to a world (communicative acts, belief / adoption / inference nodes)
    facts = [(rec, t) for rec, world, graph, triples in mods if world == "reality" for t in triples]
    tied = {}
    for _ in range(4):
        for rec, (s, p, o) in facts:
            if str(p) in TIE and str(o).startswith(W):
                tied.setdefault(s, str(o)[len(W):])
            elif str(p) == INF + "J2_concluded_that" and o in tied:
                tied.setdefault(s, tied[o])
            elif str(p) == INF + "J3_applied" and s in tied:
                tied.setdefault(o, tied[s])

    rows, avail = [], {}                           # avail: (graph, s, p, o) -> sentence ("" = from the start)
    for rec, world, graph, triples in mods:
        for s, p, o in triples:
            k = key(s, p, o)
            A = anchors.get((world, k), [])
            if rec["role"] in ("schema", "dec"):
                sid, rule = "", "background (schema / DEC typing)"
            elif k in over.get("triples", {}):
                sid, rule = over["triples"][k], "override"
            elif rec["role"] == "world":
                first = A[0] if A else entry[world]
                sid = max(first, entry[world], key=order.get)
                rule = "world content: max(first anchor, world entry)"
            elif str(p) in GOV and str(o).startswith(W) and str(o)[len(W):] in entry:
                sid, rule = entry[str(o)[len(W):]], f"governance of {str(o)[len(W):]}: enters with the world"
            elif s in tied and tied[s] in entry:
                sid, rule = entry[tied[s]], f"tied to {tied[s]} (act / CRMinf node): enters with the world"
            elif A:
                sid, rule = A[0], "first anchor"
            else:
                sid, rule = end_of[rec["checkpoint"]], "end of its module's checkpoint (no anchor)"
            avail[(graph, s, p, o)] = sid
            rows.append({"module": rec["id"], "world": world, "triple": k, "anchors": " ".join(A), "checkpoint": rec["checkpoint"],
                         "available_from": sid, "rule": rule})
    rows.sort(key=lambda r: (order.get(r["available_from"], -1), r["module"], r["triple"]))
    with open(os.path.join(out, "availability.csv"), "w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    clue_sents = sorted({s for s in avail.values() if s}, key=order.get)
    steps = [{"step": 0, "sentence": None}] + [{"step": i + 1, "sentence": s} for i, s in enumerate(clue_sents)]
    for st in steps:
        lim = -1 if st["sentence"] is None else order[st["sentence"]]
        st["asserted"] = sum(1 for v in avail.values() if (order[v] if v else -1) <= lim)
        st["new"] = sum(1 for v in avail.values() if v == st["sentence"]) if st["sentence"] else st["asserted"]
    json.dump({"entries": entry, "entryRules": entry_rule, "steps": steps}, open(os.path.join(out, "steps.json"), "w"), indent=1)
    print(f"{len(rows)} triples, {len(clue_sents)} clues, world entries: " + ", ".join(f"{w}@{s}" for w, s in sorted(entry.items(), key=lambda x: order[x[1]])))
    if only_plan:
        return

    cp = os.path.join(root, "prototype/runner/target/dec-metrics-runner-0.1.0.jar") + ":" + os.path.join(root, "prototype/runner/target/lib/*")
    q = os.path.join(root, "prototype/exploratory/probe.rq")
    prev, metrics, violations = None, [], []
    for st in steps:
        n = st["step"]
        lim = -1 if st["sentence"] is None else order[st["sentence"]]
        ds = rdflib.Dataset()
        for (g, s, p, o), sid in avail.items():
            if (order[sid] if sid else -1) <= lim:
                (ds.default_graph if g is None else ds.graph(URIRef(g))).add((s, p, o))
        trig = os.path.join(out, f"step_{n:02d}.trig")
        ds.serialize(destination=trig, format="trig")
        dump, js = os.path.join(out, f"step_{n:02d}.dump.txt"), os.path.join(out, f"step_{n:02d}.json")
        subprocess.run(["timeout", "900", "java", "-Xmx4g", "-cp", cp, "dectective.Runner", "--data", trig, "--query", q, "--config", "dec",
                        "--warmup", "0", "--reps", "1", "--dump", dump, "--out", js], check=True, capture_output=True)
        r = json.load(open(js))
        lines = set(open(dump, encoding="utf-8").read().splitlines())
        with open(dump, "rb") as f, gzip.GzipFile(dump + ".gz", "wb", compresslevel=9, mtime=0) as g:
            g.write(f.read())
        os.remove(dump)
        if prev is not None:
            lost = prev - lines
            if lost:
                violations.append({"step": n, "lost": len(lost), "examples": sorted(lost)[:5]})
        prev = lines
        acc = r["accounting"]
        m = {"step": n, "sentence": st["sentence"], "asserted": st["asserted"], "worlds": acc["n_worlds"], "materialised": acc["materialised_total"],
             "inferred_substantive": acc.get("inferred_substantive_total"), "ms": round(r["runs"][0]["materialise_total_ms"], 1)}
        metrics.append(m)
        print(f"step {n:02d} {st['sentence'] or 'baseline':9s} asserted {m['asserted']:4d} worlds {m['worlds']:2d} materialised {m['materialised']:6d} {m['ms']:8.1f} ms")
    runs = [m for m in metrics if m["step"] > 0]
    avg = {k: round(sum(m[k] or 0 for m in runs) / len(runs), 1) for k in ("asserted", "materialised", "inferred_substantive", "ms")}
    json.dump({"dec_commit": "e6775b39", "flags": "no checkInconsistencies, no closedFor", "steps": metrics, "averages": avg,
               "total_ms": round(sum(m["ms"] for m in runs), 1), "monotonic": not violations, "violations": violations},
              open(os.path.join(out, "metrics.json"), "w"), indent=1)
    print("averages", avg, "monotonic", not violations)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else ".", "--only-plan" in sys.argv)
