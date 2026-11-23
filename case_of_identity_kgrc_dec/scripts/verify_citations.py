#!/usr/bin/env python3
"""Verify that identifiers cited in reports/*.md and README.md exist.

Checks: KGRC IRIs written as d:XXX (subjects or objects of the source graph), segment IDs P### and
sentence IDs P###.S## (data/text/segments.csv, sentences.csv), prototype IRIs st:/w: (prototype modules).
Output: prototype/results/citation_check.json ; exit 1 if anything cited does not exist.
Usage: python -I scripts/verify_citations.py <project_root>
"""
import csv
import glob
import json
import os
import re
import sys

import rdflib

D = "http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/"
# Illustrative IRIs deliberately cited as examples of a FUTURE design (not existing data); wildcards end with "_".
ILLUSTRATIVE = {"w:holmes_thinks_mary_believes"}


def main(root):
    g = rdflib.Graph()
    g.parse(os.path.join(root, "sources/kgrc/ACaseOfIdentity.ttl"), format="turtle")
    kg_terms = {str(x)[len(D):] for t in g for x in (t[0], t[2]) if str(x).startswith(D)}
    paras = {r["para_id"] for r in csv.DictReader(open(os.path.join(root, "data/text/segments.csv"), encoding="utf-8"))}
    sents = {r["sent_id"] for r in csv.DictReader(open(os.path.join(root, "data/text/sentences.csv"), encoding="utf-8"))}
    proto = set()
    for f in glob.glob(os.path.join(root, "prototype/modules/*/*.trig")):
        ds = rdflib.Dataset()
        ds.parse(f, format="trig")
        for s, p, o, c in ds.quads():
            for x in (s, o, c):
                if x is None:
                    continue
                u = str(getattr(x, "identifier", x))
                for pre, ab in (("http://example.org/dectective/story/", "st:"), ("http://example.org/dectective/world/", "w:")):
                    if u.startswith(pre):
                        proto.add(ab + u[len(pre):])
    report, bad = {}, 0
    files = glob.glob(os.path.join(root, "reports/*.md")) + [os.path.join(root, "README.md")]
    for f in files:
        if not os.path.exists(f):
            continue
        txt = open(f, encoding="utf-8").read()
        missing = []
        for m in set(re.findall(r"(?<![\w/#])d:([A-Za-z0-9_]+[a-z0-9]|\d+[a-z]?)\b", txt)):
            if m not in kg_terms:
                missing.append("d:" + m)
        for m in set(re.findall(r"\bP\d{3}\.S\d{2}\b", txt)):
            if m not in sents:
                missing.append(m)
        for m in set(re.findall(r"\bP\d{3}\b(?!\.S)", txt)):
            if m not in paras:
                missing.append(m)
        for m in set(re.findall(r"\b(?:st|w):[A-Za-z0-9_]+", txt)):
            if m.endswith("_") or m in ILLUSTRATIVE:
                continue
            if m not in proto:
                missing.append(m)
        report[os.path.relpath(f, root)] = sorted(missing)
        bad += len(missing)
        print(os.path.relpath(f, root), "missing:", sorted(missing)[:20])
    json.dump(report, open(os.path.join(root, "prototype/results/citation_check.json"), "w"), indent=2)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
