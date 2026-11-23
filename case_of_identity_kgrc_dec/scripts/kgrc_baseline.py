#!/usr/bin/env python3
"""Configuration (0): what the ORIGINAL KGRC graph already answers for each test question.

Runs one SPARQL query per test on sources/kgrc/ACaseOfIdentity.ttl (rdflib) and stores rows plus
the kind of answer (lookup of explicit content / absent / not representable). No inference.
Output: prototype/results/kgrc_baseline.json
Usage: python -I scripts/kgrc_baseline.py <project_root>
"""
import json
import os
import sys

import rdflib

P = """PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX kgc: <http://kgc.knowledge-graph.jp/ontology/kgc.owl#>
PREFIX pred: <http://kgc.knowledge-graph.jp/data/predicate/>
PREFIX d: <http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/>
"""
EN = 'OPTIONAL { ?s kgc:source ?src FILTER(lang(?src)="en") } OPTIONAL { ?s kgc:infoSource ?info }'
TESTS = {
    "T01": ("Who is Hosmer Angel?",
            f"SELECT ?s ?who ?src ?info WHERE {{ ?s kgc:hasProperty pred:Hosmer ; kgc:subject ?who . {EN} }}",
            "lookup of Holmes's explicit statement d:504 (not a deduction; not usable as owl:sameAs)"),
    "T02": ("Does Mary know the identity?",
            f"SELECT ?s ?p ?src ?info WHERE {{ ?s kgc:subject d:Sutherland ; kgc:hasPredicate ?p . FILTER(?p IN (pred:know, pred:notKnow, pred:notice, pred:understand, pred:believe, pred:notBelieve)) {EN} }}",
            "no scene attributes (or denies) the identity to Mary; absence cannot be distinguished from non-annotation"),
    "T03": ("Do Hosmer's attributes transfer to Windibank?",
            f"SELECT ?s ?subj ?src ?info WHERE {{ ?s kgc:subject ?subj ; kgc:what ?o . FILTER(?subj IN (d:Hosmer, d:Windibank)) FILTER(?o IN (d:Color_glasses, d:Eyes_of_Hosmer, d:eyes_of_Windibank)) {EN} }}",
            "attributes are stored per name and source; nothing transfers (no identity link), so no inconsistency can surface either"),
    "T04": ("Who said what to whom?",
            f"SELECT ?s ?speaker ?whom ?src WHERE {{ ?s kgc:hasPredicate pred:say ; kgc:subject ?speaker . OPTIONAL {{ ?s kgc:whom ?whom }} OPTIONAL {{ ?s kgc:source ?src FILTER(lang(?src)=\"en\") }} }}",
            "speakers recoverable from say-scenes; addressee rarely annotated (kgc:infoReceiver never used)"),
    "T05": ("Which statements are insincere?",
            f"SELECT ?s ?src ?info WHERE {{ ?s rdf:type kgc:Thought ; kgc:infoSource ?info . FILTER(CONTAINS(STR(?info), 'Windibank') || CONTAINS(STR(?info), 'Hosmer')) {EN} }}",
            "not representable: the speaker's contemporaneous belief is not annotated next to the utterances (only scattered Thoughts with placeholder sources)"),
    "T06": ("Is Mary's belief about France contradicted?",
            f"SELECT ?s ?src ?info WHERE {{ ?s kgc:source ?src . FILTER(lang(?src)='en' && REGEX(?src, '(?i)france|bordeaux|pretend')) OPTIONAL {{ ?s kgc:infoSource ?info }} }}",
            "Mary's statements and Holmes's attribution of her belief (d:513) exist; the 'pretended journeys' (P128.S07) are absent, so no explicit divergence"),
    "T07": ("Which hypotheses are incompatible with the evidence?",
            f"SELECT ?s ?src ?info WHERE {{ VALUES ?s {{ d:378 d:380 d:382 d:250 d:252 }} {EN} }}",
            "hypotheses present as statements (Watson 378/380, rejected by Holmes 382; Mary's Thought 250); no compatibility notion"),
    "T08": ("How do conclusions change after new evidence?",
            f"SELECT (COUNT(?s) AS ?n) WHERE {{ ?s kgc:then ?o }}",
            "no snapshots; narrative order (IDs, then) allows cutting checkpoints, but solution scenes and labels leak (see graph_audit §5)"),
    "T09": ("What follows from the typewritten documents?",
            f"SELECT ?s ?src ?info WHERE {{ VALUES ?s {{ d:435 d:439 d:441 d:443 d:450 d:575 d:577 }} {EN} }}",
            "premises and Holmes's conclusion (d:575 'matched Hosmer') are present as statements; no inference structure; d:441 loses the shared use of the machine"),
    "T10": ("Does the ending change Mary's beliefs?",
            f"SELECT ?s ?p ?o WHERE {{ VALUES ?s {{ d:578 d:579 d:580 }} ?s ?p ?o . FILTER(?p != kgc:source || lang(?o)='en') }}",
            "d:578 'Sutherland does not believe in Holmes' is categorical; the conditional is broken (d:579 empty, kgc:if d:580)"),
}


def main(root):
    g = rdflib.Graph()
    g.parse(os.path.join(root, "sources/kgrc/ACaseOfIdentity.ttl"), format="turtle")
    out = {}
    D = "http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/"
    for tid, (question, q, interp) in TESTS.items():
        res = g.query(P + q)
        rows = [{str(k): (str(v).replace(D, "d:").replace("http://kgc.knowledge-graph.jp/data/predicate/", "pred:") if v is not None else None)
                 for k, v in zip(res.vars, r)} for r in res]
        out[tid] = {"question": question, "query": q, "n_rows": len(rows), "rows": rows[:40], "kind_of_answer": interp}
        print(tid, len(rows), "|", interp[:90])
    with open(os.path.join(root, "prototype/results/kgrc_baseline.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
