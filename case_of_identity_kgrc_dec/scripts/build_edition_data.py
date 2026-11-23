#!/usr/bin/env python3
"""Assemble the data of the digital edition from artefacts that already exist (no DEC recomputation).

Inputs (all produced by the audit pipeline):
  prototype/results/metrics/<q>/dec.plain.dump.txt   DEC materialisation of each test slice (gold, C2-C4)
  prototype/results/edition_complement/*.dump.txt    complementary runs (6 gold worlds; one per checkpoint C1-C4)
  prototype/results/leakage_C*.dump.txt              reality-reaching slices of each checkpoint
  prototype/modules/catalog.jsonl + modules/*.trig    asserted content per world (gold, sim)
  prototype/fixtures/*/manifest.json, results/test_results.json, metrics/<q>/dec.json   tests, runs, diagnostics
  data/text/segments.csv, sentences.csv; data/passage_inventory.csv, text_graph_alignment.csv, kgrc/alignment_auto.csv
  sources/kgrc/ACaseOfIdentity.ttl; edition/annotations/*.json (curated display data, anchors, speakers, sections)

Outputs (edition/data/, deterministic):
  edition.nq        all quads for the SPARQL store (sorted N-Quads)
  text.json         sections, checkpoints, paragraphs, sentences, speakers, proposition links
  catalog.json      worlds (type, governing agents, labels), propositions (anchors), modules
  runs.json         DEC runs (kind, dataset, flags, timings, sizes, diagnostics)
  provenance.json   for each DEC view graph: triple -> runs that materialised it
  timeline.json     deductions timeline: clues (sentences), first clue of every content triple per world, run metrics
  build_info.json   counts per graph family + SHA-256 of every output
Graph naming (also documented in the edition):
  default graph                          = DEC reality (gold), copy of <http://w3id.org/conjectures/reality>
  <http://example.org/dectective/world/X>          DEC materialised view of gold world X
  <http://example.org/dectective/asserted/X>       asserted content of gold world X ('reality' for facts)
  <http://example.org/dectective/snapshot/Ck/X>    DEC view of world X at reader checkpoint Ck (X = w01.., reality, shared)
  <http://example.org/dectective/snapshot-asserted/Ck/X>  asserted content at Ck
  <http://example.org/dectective/edition/text|annotation|runs|timeline>   edition layers
  <http://kgc.knowledge-graph.jp/data/ACaseOfIdentity>             original KGRC graph (CC BY 4.0)
Usage: python -I scripts/build_edition_data.py <project_root>
"""
import csv
import glob
import hashlib
import json
import os
import re
import sys

import rdflib
from rdflib import XSD, Literal, URIRef
from rdflib.namespace import RDF, RDFS

ST = "http://example.org/dectective/story/"
W = "http://example.org/dectective/world/"
PROF = "http://example.org/dectective/profile#"
DEC = "http://w3id.org/conjectures/"
REALITY = DEC + "reality"
EDNS = "http://example.org/dectective/edition#"
EDB = "http://example.org/dectective/edition/"
G_TEXT, G_ANN, G_RUNS, G_TL = EDB + "text", EDB + "annotation", EDB + "runs", EDB + "timeline"
ASSERTED = "http://example.org/dectective/asserted/"
SNAP = "http://example.org/dectective/snapshot/"
SNAPA = "http://example.org/dectective/snapshot-asserted/"
KGRC_G = "http://kgc.knowledge-graph.jp/data/ACaseOfIdentity"
KGRC_D = "http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/"
DEC_COMMIT = "e6775b39e22893176c45e3a161e49a7d2c718fb2"
CK = ["C1", "C2", "C3", "C4", "G"]
LIT = re.compile(r'^"(.*)"(?:@([A-Za-z0-9-]+)|\^\^(\S+))?$', re.S)


def E(local):
    return URIRef(EDNS + local)


def local(iri):
    s = str(iri)
    return s.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def term(tok):
    if tok.startswith('"'):
        m = LIT.match(tok)
        if not m:
            return Literal(tok.strip('"'))
        lex, lang, dt = m.groups()
        return Literal(lex, lang=lang) if lang else Literal(lex, datatype=URIRef(dt)) if dt else Literal(lex)
    return URIRef(tok)


def parse_dump(path):
    out = []
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.startswith("<"):
            continue
        w, rest = line.split("> ", 1)
        s, p, o = rest.split(" ", 2)
        out.append((w[1:], URIRef(s), URIRef(p), term(o)))
    return out


def nt(t):
    return t.n3()


# ---------------------------------------------------------------------- deductions timeline
RDF_NS, RDFS_NS, OWL_NS = str(RDF), str(RDFS), "http://www.w3.org/2002/07/owl#"
CRM_NS, INF_NS = "http://www.cidoc-crm.org/cidoc-crm/", "http://www.cidoc-crm.org/extensions/crminf/"
VOCAB = (PROF, CRM_NS, INF_NS, OWL_NS, RDFS_NS, RDF_NS, DEC)
KEEP_OWL = {OWL_NS + "sameAs", OWL_NS + "differentFrom"}


def tl_content(s, p, o, world="reality"):
    """A statement about the story (not schema, not DEC bookkeeping; a world's own governance only in reality)."""
    s, p, o = str(s), str(p), o
    if s.startswith(VOCAB) or s.startswith(W):
        return False
    if world != "reality" and str(o).startswith(W):
        return False
    if p.startswith(RDFS_NS) or p.startswith(DEC) or (p.startswith(OWL_NS) and p not in KEEP_OWL):
        return False
    if p == RDF_NS + "type" and str(o).startswith((RDF_NS, RDFS_NS, OWL_NS, DEC)):
        return False
    if p == OWL_NS + "sameAs" and s == str(o):
        return False
    return True


def tl_class(s, p, o):
    """'story' = what a reader would call a deduction; 'minor' = CIDOC CRM bookkeeping (superclasses, inverses)."""
    p = str(p)
    if p.startswith(PROF) or p in KEEP_OWL or p == CRM_NS + "P1_is_identified_by":
        return "story"
    if p == RDF_NS + "type" and str(o).startswith(PROF):
        return "story"
    return "minor"


def build_timeline(root, gold_worlds, paragraphs, add):
    import gzip
    from rdflib.util import from_n3
    tdir = os.path.join(root, "prototype/results/timeline")
    meta = json.load(open(os.path.join(tdir, "steps.json"), encoding="utf-8"))
    metrics = json.load(open(os.path.join(tdir, "metrics.json"), encoding="utf-8"))
    page = {s["id"]: p["page"] for p in paragraphs for s in p["sentences"]}
    stage = {s["id"]: p["revealedBy"] for p in paragraphs for s in p["sentences"]}
    dtype = {w: v["decType"] for w, v in gold_worlds.items()}

    def wname(iri):
        return "reality" if iri == REALITY else local(iri)

    first = {}                                   # (world, s, p, o) -> (step, how)
    for st in meta["steps"]:
        n = st["step"]
        A = {}
        ds = rdflib.Dataset()
        ds.parse(os.path.join(tdir, f"step_{n:02d}.trig"), format="trig")
        for s, p, o, g in ds.quads():
            gw = "reality" if g is None or str(g) == str(ds.default_graph.identifier) else local(g)
            A.setdefault(gw, set()).add((s, p, o))
        M = {}
        with gzip.open(os.path.join(tdir, f"step_{n:02d}.dump.txt.gz"), "rt", encoding="utf-8") as f:
            tmp = os.path.join(tdir, ".dump.tmp")
            open(tmp, "w", encoding="utf-8").write(f.read())
        for w, s, p, o in parse_dump(tmp):
            M.setdefault(wname(w), set()).add((s, p, o))
        os.remove(tmp)
        present = set(M)
        for w, triples in sorted(M.items()):
            if w == "shared":
                continue
            t = dtype.get(w, "verbatim")
            srcs = ["shared"] + ([x for x in present if dtype.get(x) == "epistemic"] if t == "reality" else ["reality"] if t == "conjectural" else []) if t != "verbatim" else []
            for tr in triples:
                if not tl_content(*tr, w) or (w, *tr) in first or n == 0:
                    continue
                if tr in A.get(w, set()):
                    how = "asserted"
                else:
                    src = next((x for x in srcs if tr in M.get(x, set())), None)
                    how = f"received:{src}" if src else "derived"
                first[(w, *tr)] = (n, how)
    steps = [{"n": st["step"], "sid": st["sentence"], "page": page.get(st["sentence"]), "stage": stage.get(st["sentence"]),
              "new": st["new"], "asserted": st["asserted"]} for st in meta["steps"] if st["step"] > 0]
    entries = sorted([w, nt(s), nt(p), nt(o), n, how, tl_class(s, p, o)] for (w, s, p, o), (n, how) in first.items())
    entry_step = {w: next(st["n"] for st in steps if st["sid"] == sid) for w, sid in meta["entries"].items()}
    # RDF: clues and DEC's story-level conclusions (inferred, or accepted into Reality from Holmes's solution)
    for st in steps:
        si = URIRef(EDB + f"clue/{st['n']:02d}")
        add(si, RDF.type, E("Clue"), G_TL)
        add(si, E("order"), Literal(st["n"], datatype=XSD.integer), G_TL)
        add(si, E("sentence"), URIRef(EDB + "text/" + st["sid"]), G_TL)
    for w, s, p, o, n, how, cl in entries:
        if cl != "story" or not (how == "derived" or (w == "reality" and how.startswith("received:") and how != "received:shared")):
            continue
        ci = URIRef(EDB + "conclusion/" + hashlib.sha1(f"{w} {s} {p} {o}".encode()).hexdigest()[:12])
        for t in ((ci, RDF.type, E("Conclusion")), (ci, RDF.subject, from_n3(s)), (ci, RDF.predicate, from_n3(p)), (ci, RDF.object, from_n3(o)),
                  (ci, E("inGraph"), URIRef(REALITY if w == "reality" else W + w)), (ci, E("how"), Literal("inferred" if how == "derived" else "accepted into reality")),
                  (ci, E("firstClue"), URIRef(EDB + f"clue/{n:02d}"))):
            add(*t, G_TL)
    return {"steps": steps, "worldEntry": entry_step, "entries": entries,
            "metrics": {k: metrics[k] for k in ("flags", "averages", "total_ms", "monotonic", "violations")} | {"perStep": metrics["steps"]}}


def main(root):
    ed = os.path.join(root, "edition")
    out_dir = os.path.join(ed, "data")
    os.makedirs(out_dir, exist_ok=True)
    ann = {n: json.load(open(os.path.join(ed, "annotations", n + ".json"), encoding="utf-8"))
           for n in ("sections", "speakers", "agents", "worlds", "labels", "triple_anchors")}
    name_map = json.load(open(os.path.join(root, "prototype/gold/sim_name_map.json")))["map"]
    sim2gold = {v.replace("st:", ""): k.replace("st:", "") for k, v in name_map.items()}
    cat = [json.loads(l) for l in open(os.path.join(root, "prototype/modules/catalog.jsonl"), encoding="utf-8")]
    quads = set()                       # (s, p, o, g) rdflib terms; g None = default graph
    prov = {}                           # graph IRI -> triple key -> set(run ids)
    runs = []

    def add(s, p, o, g):
        quads.add((s, p, o, URIRef(g) if g else None))

    # ------------------------------------------------------------------ 1. DEC materialisations
    manifests = {}
    for m in glob.glob(os.path.join(root, "prototype/fixtures/*/manifest.json")):
        man = json.load(open(m, encoding="utf-8"))
        for q in man["queries"]:
            manifests[q["id"]] = (man, os.path.basename(os.path.dirname(m)), q)
    tests = json.load(open(os.path.join(root, "prototype/results/test_results.json"), encoding="utf-8"))

    def graph_for(dataset, world_iri):
        if dataset == "gold":
            return world_iri
        return SNAP + dataset + "/" + local(world_iri)

    def ingest(run_id, dataset, dump_path):
        seen = set()
        for w, s, p, o in parse_dump(dump_path):
            seen.add(str(w))
            g = graph_for(dataset, w)
            add(s, p, o, g)
            prov.setdefault(g, {}).setdefault(f"{nt(s)} {nt(p)} {nt(o)}", set()).add(run_id)
            if dataset == "gold" and w == REALITY:
                add(s, p, o, None)
        run_worlds[run_id] = sorted(seen)

    run_worlds = {}
    for qid in sorted(manifests):
        man, fx, q = manifests[qid]
        mdir = os.path.join(root, "prototype/results/metrics", qid)
        dec = json.load(open(os.path.join(mdir, "dec.json"), encoding="utf-8"))
        warm = sorted(x["materialise_total_ms"] for x in dec["runs"] if not x["warmup"])
        ablation = bool(man.get("exclude_axioms"))
        rec = {"id": qid, "kind": "ablation" if ablation else "test", "test": fx, "dataset": man["dataset"],
               "question": q.get("note") and man["question"] or man["question"], "query_file": f"prototype/fixtures/{fx}/{q['file']}",
               "slice": f"prototype/fixtures/{fx}/slices/{qid}.trig",
               "checkInconsistencies": "checkInconsistencies" in man.get("dec_flags", []), "closedFor": man.get("closed_for", []),
               "excludedAxioms": man.get("exclude_axioms", []), "materialise_ms_median": warm[len(warm) // 2] if warm else None,
               "n_worlds": dec["accounting"]["n_worlds"], "inconsistency_pairs": dec["accounting"]["inconsistency_pairs"],
               "asserted": dec["accounting"]["asserted_total"], "materialised": dec["accounting"]["materialised_total"],
               "diagnostics": [d for d in dec["accounting"]["dec_diagnostics"] if "disagreesWith" in d or "delusionalWorld" in d],
               "test_result": tests.get(qid)}
        runs.append(rec)
        if not ablation:                 # the ablation run removes axioms: kept as a run record, not merged into the views
            ingest(qid, man["dataset"], os.path.join(mdir, "dec.plain.dump.txt"))
        else:
            run_worlds[qid] = sorted({str(w) for w, *_ in parse_dump(os.path.join(mdir, "dec.plain.dump.txt"))})
    comp = os.path.join(root, "prototype/results/edition_complement")
    cj = json.load(open(os.path.join(comp, "dec.json")))
    runs.append({"id": "complement-gold", "kind": "complement", "dataset": "gold", "question": "Complementary materialisation (6 worlds never in a test slice)",
                 "slice": "prototype/results/edition_complement/slice.trig", "checkInconsistencies": False, "closedFor": [], "excludedAxioms": [],
                 "materialise_ms_median": cj["runs"][0]["materialise_total_ms"], "n_worlds": cj["accounting"]["n_worlds"],
                 "inconsistency_pairs": cj["accounting"]["inconsistency_pairs"], "asserted": cj["accounting"]["asserted_total"],
                 "materialised": cj["accounting"]["materialised_total"], "diagnostics": [], "test_result": None})
    ingest("complement-gold", "gold", os.path.join(comp, "dec.dump.txt"))
    for ck in ("C1", "C2", "C3", "C4"):
        sj = json.load(open(os.path.join(comp, f"snapshot_{ck}.json")))
        runs.append({"id": f"complement-{ck}", "kind": "complement", "dataset": ck, "question": f"Whole checkpoint {ck} without conflict-check flags",
                     "slice": f"prototype/results/edition_complement/snapshot_{ck}.trig", "checkInconsistencies": False, "closedFor": [], "excludedAxioms": [],
                     "materialise_ms_median": sj["runs"][0]["materialise_total_ms"], "n_worlds": sj["accounting"]["n_worlds"],
                     "inconsistency_pairs": sj["accounting"]["inconsistency_pairs"], "asserted": sj["accounting"]["asserted_total"],
                     "materialised": sj["accounting"]["materialised_total"], "diagnostics": [], "test_result": None})
        ingest(f"complement-{ck}", ck, os.path.join(comp, f"snapshot_{ck}.dump.txt"))
        lk = os.path.join(root, f"prototype/results/leakage_{ck}.dump.txt")
        if os.path.exists(lk):
            lj = json.load(open(os.path.join(root, f"prototype/results/leakage_{ck}.json")))
            runs.append({"id": f"leakage-{ck}", "kind": "leakage-check", "dataset": ck, "question": f"Reality-reaching slice of {ck} (leakage check)",
                         "slice": f"prototype/results/leakage_{ck}.reality_slice.trig", "checkInconsistencies": False, "closedFor": [], "excludedAxioms": [],
                         "materialise_ms_median": lj["runs"][0]["materialise_total_ms"], "n_worlds": lj["accounting"]["n_worlds"],
                         "inconsistency_pairs": lj["accounting"]["inconsistency_pairs"], "asserted": lj["accounting"]["asserted_total"],
                         "materialised": lj["accounting"]["materialised_total"], "diagnostics": [], "test_result": None})
            ingest(f"leakage-{ck}", ck, lk)

    for rec in runs:                     # worlds present in each run's materialisation (pairs tested together)
        rec["worlds"] = run_worlds.get(rec["id"], [])

    # ------------------------------------------------------------------ 2. asserted content, worlds, propositions
    sent_rows = list(csv.DictReader(open(os.path.join(root, "data/text/sentences.csv"), encoding="utf-8")))
    sent_ids = {r["sent_id"] for r in sent_rows}
    rules = ann["triple_anchors"]["rules"]

    def anchors(s, p, o, fallback):
        names = [sim2gold.get(local(x), local(x)) if isinstance(x, URIRef) else str(x) for x in (s, p, o)]
        for rs, rp, ro, sents in rules:
            if rs in ("*", names[0]) and rp in ("*", names[1]) and ro in ("*", names[2]):
                return [x for x in sents if x in sent_ids], "proposition"
        return [x for x in fallback if x in sent_ids], "module"

    worlds = {"gold": {}, "sim": {}}
    props = {}
    governing = {PROF + "believes": "believes", PROF + "establishes": "establishes", PROF + "conjectures": "conjectures", PROF + "uttered": "uttered"}
    for rec in cat:
        if rec["role"] == "dec":
            continue
        ds = rec["dataset"]
        mds = rdflib.Dataset()
        mds.parse(os.path.join(root, rec["file"]), format="trig")
        wloc = "reality" if rec["graph"] == "default" else rec["graph"].replace("w:", "")
        if rec["role"] == "schema":
            wloc = "shared"
        info = worlds[ds].setdefault(wloc, {"local": wloc, "iri": (REALITY if wloc == "reality" else W + wloc),
                                            "decType": "reality" if wloc == "reality" else rec.get("dec_type") or "shared",
                                            "governedBy": [], "modules": [], "segments": [], "basis": set(), "checkpoint": rec["checkpoint"],
                                            "notes": []})
        info["modules"].append(rec["id"])
        info["segments"] = sorted(set(info["segments"]) | set(rec["segments"]))
        info["basis"].add(rec["basis"])
        if rec.get("note"):
            info["notes"].append(rec["note"])
        if CK.index(rec["checkpoint"]) < CK.index(info["checkpoint"]):
            info["checkpoint"] = rec["checkpoint"]
        for s, p, o, g in mds.quads():
            if ds == "gold":
                add(s, p, o, ASSERTED + wloc)
            else:
                for ck in CK[:4]:
                    if CK.index(rec["checkpoint"]) <= CK.index(ck):
                        add(s, p, o, SNAPA + ck + "/" + wloc)
            if rec["role"] == "schema":
                continue
            sents, level = anchors(s, p, o, rec["segments"])
            key = f"{ds}|{wloc}|{nt(s)} {nt(p)} {nt(o)}"
            pid = "prop_" + hashlib.sha1(key.encode()).hexdigest()[:12]
            props[pid] = {"id": pid, "dataset": ds, "world": wloc, "s": nt(s), "p": nt(p), "o": nt(o), "module": rec["id"],
                          "sentences": sents, "anchorLevel": level, "checkpoint": rec["checkpoint"], "basis": rec["basis"]}
            pi = URIRef(EDB + "prop/" + pid)
            for t in ((pi, RDF.type, E("Proposition")), (pi, RDF.subject, s), (pi, RDF.predicate, p), (pi, RDF.object, o),
                      (pi, E("inModule"), URIRef(EDB + "module/" + rec["id"])), (pi, E("dataset"), Literal(ds)),
                      (pi, E("world"), Literal(wloc)), (pi, E("anchorLevel"), Literal(level)), (pi, E("fromCheckpoint"), Literal(rec["checkpoint"]))):
                add(*t, G_ANN)
            add(pi, E("inGraph"), URIRef(ASSERTED + wloc) if ds == "gold" else URIRef(SNAPA + "C4/" + wloc), G_ANN)
            for sid in sents:
                add(pi, E("supportedBy"), URIRef(EDB + "text/" + sid), G_ANN)
    # governing agents (asserted, reality)
    for ds in ("gold", "sim"):
        for pid, pr in props.items():
            if pr["dataset"] != ds or pr["p"][1:-1] not in governing:
                continue
            wl = local(pr["o"][1:-1])
            if worlds[ds].get(wl):
                worlds[ds][wl]["governedBy"].append({"agent": pr["s"][1:-1], "predicate": governing[pr["p"][1:-1]]})
        worlds[ds] = {k: v for k, v in worlds[ds].items() if v}
        for k, v in worlds[ds].items():
            v["basis"] = sorted(v["basis"])
            v["governedBy"] = sorted({(g["agent"], g["predicate"]) for g in v["governedBy"]})
            v["governedBy"] = [{"agent": a, "predicate": p} for a, p in v["governedBy"]]
            lab = ann["worlds"][ds].get(k, {})
            v["title"], v["desc"] = lab.get("title", k), lab.get("desc", "")
            v["materializedBy"] = sorted({r for g, d in prov.items() if (g == v["iri"] if ds == "gold" else g.endswith("/" + k) and g.startswith(SNAP))
                                          for rs in d.values() for r in rs})
    # module nodes
    for rec in cat:
        mi = URIRef(EDB + "module/" + rec["id"])
        add(mi, RDF.type, E("Module"), G_ANN)
        add(mi, E("dataset"), Literal(rec["dataset"]), G_ANN)
        add(mi, E("role"), Literal(rec["role"]), G_ANN)
        add(mi, E("basis"), Literal(rec["basis"]), G_ANN)
        add(mi, E("checkpoint"), Literal(rec["checkpoint"]), G_ANN)
        if rec.get("dec_type"):
            add(mi, E("decType"), Literal(rec["dec_type"]), G_ANN)
        if rec.get("note"):
            add(mi, RDFS.comment, Literal(rec["note"]), G_ANN)
        for sid in rec["segments"]:
            if sid in sent_ids:
                add(mi, E("supportedBy"), URIRef(EDB + "text/" + sid), G_ANN)
    # world nodes (annotation)
    for ds in ("gold", "sim"):
        for k, v in worlds[ds].items():
            wi = URIRef(v["iri"]) if ds == "gold" else URIRef(SNAP + "world/" + k)
            add(wi, RDF.type, E("World"), G_ANN)
            add(wi, E("dataset"), Literal(ds), G_ANN)
            add(wi, E("decType"), Literal(v["decType"]), G_ANN)
            add(wi, RDFS.label, Literal(v["title"]), G_ANN)
            add(wi, E("firstCheckpoint"), Literal(v["checkpoint"]), G_ANN)
            for gb in v["governedBy"]:
                add(wi, E("governedBy"), URIRef(gb["agent"]), G_ANN)

    # ------------------------------------------------------------------ 3. text layer
    segs = list(csv.DictReader(open(os.path.join(root, "data/text/segments.csv"), encoding="utf-8")))
    speakers = {p["para"]: p["speaker"] for p in ann["speakers"]["paragraphs"]}
    agent_iri = {a["id"]: a["gold"] for a in ann["agents"]["agents"]}
    sections = ann["sections"]["sections"]
    cps = ann["sections"]["checkpoints"]

    def section_of(pid):
        n = int(pid[1:])
        return next(s["id"] for s in sections if int(s["from"][1:]) <= n <= int(s["to"][1:]))

    def revealed(pid):
        n = int(pid[1:])
        return next(c["id"] for c in cps if n <= int(c["after"][1:]))

    by_sent = {}
    for pid, pr in props.items():
        for sid in pr["sentences"]:
            by_sent.setdefault(sid, {"gold": [], "sim": []})[pr["dataset"]].append(pid)
    paragraphs = []
    sbyp = {}
    for r in sent_rows:
        sbyp.setdefault(r["para_id"], []).append(r)
    for i, sg in enumerate(segs):
        pid = sg["para_id"]
        quoted = re.sub(r"“[^”]*”", "", sg["text"])
        narration = len(re.findall(r"[A-Za-z]{2,}", quoted)) > 0
        spk = speakers[pid]
        para = {"id": pid, "order": i + 1, "section": section_of(pid), "page": int(sg["printed_page_start"]), "kind": sg["kind"],
                "speaker": spk, "hasNarration": narration, "revealedBy": revealed(pid), "sentences": []}
        pi = URIRef(EDB + "text/" + pid)
        add(pi, RDF.type, E("Paragraph"), G_TEXT)
        add(pi, E("order"), Literal(i + 1, datatype=XSD.integer), G_TEXT)
        add(pi, E("inSection"), URIRef(EDB + "text/section/" + para["section"]), G_TEXT)
        add(pi, E("printedPage"), Literal(para["page"], datatype=XSD.integer), G_TEXT)
        add(pi, E("revealedBy"), Literal(para["revealedBy"]), G_TEXT)
        add(pi, E("speaker"), URIRef(agent_iri[spk]) if spk in agent_iri and agent_iri[spk] else E(spk), G_TEXT)
        for r in sbyp[pid]:
            si = URIRef(EDB + "text/" + r["sent_id"])
            add(si, RDF.type, E("Sentence"), G_TEXT)
            add(si, E("inParagraph"), pi, G_TEXT)
            add(si, E("text"), Literal(r["text"]), G_TEXT)
            add(si, E("startOffset"), Literal(int(r["start"]), datatype=XSD.integer), G_TEXT)
            add(si, E("endOffset"), Literal(int(r["end"]), datatype=XSD.integer), G_TEXT)
            links = by_sent.get(r["sent_id"], {"gold": [], "sim": []})
            para["sentences"].append({"id": r["sent_id"], "text": r["text"], "start": int(r["start"]), "end": int(r["end"]),
                                      "props": sorted(links["gold"]), "simProps": sorted(links["sim"])})
        paragraphs.append(para)
    for s in sections:
        si = URIRef(EDB + "text/section/" + s["id"])
        add(si, RDF.type, E("Section"), G_TEXT)
        add(si, RDFS.label, Literal(s["title"]), G_TEXT)

    # ------------------------------------------------------------------ 4. annotation: alignment units, KGRC links, tests
    # The audit notes are in Italian; the edition is English-only: issues come from a curated translation,
    # short Italian glosses in enunciator/perspective/story_time are normalised, corrections stay in the audit CSV.
    issues_en = json.load(open(os.path.join(root, "edition/annotations/alignment_issues_en.json"), encoding="utf-8"))
    gloss = [("in parte riferisce", "partly reporting"), ("riferisce la ditta", "reporting the firm"), ("riferisce il", "reporting the"),
             ("riferisce", "reporting"), ("(sulla madre)", "(on the mother)"), ("(su ", "(on "), ("(stato)", "(state)"),
             ("(futuro ipotetico)", "(hypothetical future)")]
    for r in csv.DictReader(open(os.path.join(root, "data/text_graph_alignment.csv"), encoding="utf-8")):
        ui = URIRef(EDB + "unit/" + r["unit_id"])
        add(ui, RDF.type, E("AlignmentUnit"), G_ANN)
        if r["issue"]:
            r["issue"] = issues_en[r["unit_id"]]
        for k in ("enunciator", "perspective", "story_time"):
            for a, b in gloss:
                r[k] = r[k].replace(a, b)
        for k in ("theme", "enunciator", "perspective", "info_status", "coverage", "issue", "story_time"):
            if r[k]:
                add(ui, E(re.sub(r"_(\w)", lambda m: m.group(1).upper(), k)), Literal(r[k]), G_ANN)
        add(ui, E("propositionalContent"), Literal(r["propositional_content"]), G_ANN)
        for sid in r["sent_ids"].split(";"):
            add(ui, E("supportedBy"), URIRef(EDB + "text/" + sid), G_ANN)
        for k in filter(None, r["kgrc_iris"].split(";")):
            add(ui, E("kgrcScene"), URIRef(KGRC_D + k.replace("d:", "")), G_ANN)
    for r in csv.DictReader(open(os.path.join(root, "data/kgrc/alignment_auto.csv"), encoding="utf-8")):
        if r["placed_by"] == "score":
            add(URIRef(KGRC_D + r["scene"].replace("d:", "")), E("autoAlignedSentence"), URIRef(EDB + "text/" + r["sent_id"]), G_ANN)
    for rec in runs:
        ri = URIRef(EDB + "run/" + rec["id"])
        add(ri, RDF.type, E("DecRun"), G_RUNS)
        add(ri, E("kind"), Literal(rec["kind"]), G_RUNS)
        add(ri, E("dataset"), Literal(rec["dataset"]), G_RUNS)
        add(ri, E("decCommit"), Literal(DEC_COMMIT), G_RUNS)
        add(ri, E("checkInconsistencies"), Literal(rec["checkInconsistencies"]), G_RUNS)
        for c in rec["closedFor"]:
            add(ri, E("closedFor"), URIRef(c), G_RUNS)
        for a in rec["excludedAxioms"]:
            add(ri, E("excludedAxiom"), Literal(a), G_RUNS)
        for k in ("n_worlds", "inconsistency_pairs", "asserted", "materialised"):
            add(ri, E(re.sub(r"_(\w)", lambda m: m.group(1).upper(), k)), Literal(rec[k], datatype=XSD.integer), G_RUNS)
        if rec["materialise_ms_median"] is not None:
            add(ri, E("materialiseMs"), Literal(round(rec["materialise_ms_median"], 3), datatype=XSD.decimal), G_RUNS)
        if rec.get("test_result"):
            tr = rec["test_result"]
            add(ri, E("question"), Literal(rec["question"]), G_RUNS)
            add(ri, E("classification"), Literal(tr["classification"]), G_RUNS)
            add(ri, E("matchesExpectedDEC"), Literal(bool(tr["matches_expected"].get("dec"))), G_RUNS)
        for d in rec["diagnostics"]:
            s, p, o = d.split(" ", 2)
            di = URIRef(EDB + "diag/" + hashlib.sha1((rec["id"] + d).encode()).hexdigest()[:12])
            add(di, RDF.type, E("DecDiagnosis"), G_RUNS)
            add(di, E("run"), ri, G_RUNS)
            g1 = s if rec["dataset"] == "gold" else (SNAP + rec["dataset"] + "/" + local(s))
            add(di, E("world"), URIRef(g1), G_RUNS)
            if p.endswith("disagreesWith"):
                add(di, E("relation"), URIRef(DEC + "disagreesWith"), G_RUNS)
                g2 = o if rec["dataset"] == "gold" else (SNAP + rec["dataset"] + "/" + local(o))
                add(di, E("otherWorld"), URIRef(g2), G_RUNS)
            else:
                add(di, E("relation"), URIRef(DEC + "delusionalWorld"), G_RUNS)

    # ------------------------------------------------------------------ 5. original KGRC graph
    kg = rdflib.Graph()
    kg.parse(os.path.join(root, "sources/kgrc/ACaseOfIdentity.ttl"), format="turtle")
    for s, p, o in kg:
        add(s, p, o, KGRC_G)

    # ------------------------------------------------------------------ 6. deductions timeline (prefix runs, scripts/run_edition_timeline.py)
    timeline = build_timeline(root, worlds["gold"], paragraphs, add)

    # ------------------------------------------------------------------ write
    lines = []
    for s, p, o, g in quads:
        lines.append(f"{nt(s)} {nt(p)} {nt(o)}" + (f" <{g}>" if g is not None else "") + " .")
    lines.sort()
    with open(os.path.join(out_dir, "edition.nq"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    # validate N-Quads round trip
    chk = rdflib.Dataset()
    chk.parse(os.path.join(out_dir, "edition.nq"), format="nquads")
    text = {"sections": sections, "checkpoints": cps, "paragraphs": paragraphs, "speakerNames": ann["speakers"]["agents"]}
    run_ids = sorted({r for d in prov.values() for rs in d.values() for r in rs})
    provj = {"runs": run_ids, "graphs": {g: {k: sorted(run_ids.index(r) for r in v) for k, v in sorted(d.items())} for g, d in sorted(prov.items())}}
    catalog = {"worlds": worlds, "propositions": props,
               "modules": [{k: v for k, v in r.items()} for r in cat],
               "namespaces": {"st": ST, "w": W, "prof": PROF, "dec": DEC, "ed": EDNS, "asserted": ASSERTED, "snapshot": SNAP,
                              "snapshotAsserted": SNAPA, "kgrc": KGRC_G, "text": G_TEXT, "annotation": G_ANN, "runs": G_RUNS},
               "simToGold": sim2gold}
    for name, obj in (("text.json", text), ("catalog.json", catalog), ("runs.json", runs), ("provenance.json", provj), ("timeline.json", timeline)):
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, sort_keys=True, indent=None if name == "provenance.json" else 1)
    fam = {}
    for s, p, o, g in quads:
        key = "default" if g is None else ("world" if str(g).startswith(W) or str(g) == REALITY else
                                           "asserted" if str(g).startswith(ASSERTED) else "snapshot" if str(g).startswith(SNAP) else
                                           "snapshot-asserted" if str(g).startswith(SNAPA) else str(g).rsplit("/", 1)[-1])
        fam[key] = fam.get(key, 0) + 1
    info = {"quads": len(lines), "parsed_back": sum(1 for _ in chk.quads()), "families": dict(sorted(fam.items())),
            "propositions": len(props), "runs": len(runs),
            "sha256": {n: hashlib.sha256(open(os.path.join(out_dir, n), "rb").read()).hexdigest()
                       for n in ("edition.nq", "text.json", "catalog.json", "runs.json", "provenance.json", "timeline.json")}}
    with open(os.path.join(out_dir, "build_info.json"), "w") as f:
        json.dump(info, f, indent=1, sort_keys=True)
    print(json.dumps({k: v for k, v in info.items() if k != "sha256"}, indent=1))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
