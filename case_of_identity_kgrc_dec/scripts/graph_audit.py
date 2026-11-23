#!/usr/bin/env python3
"""Reproducible technical audit of sources/kgrc/ACaseOfIdentity.ttl (KGRC 2023ikgrc).

Outputs:
  data/graph_stats.json               all statistics (counting method stated per item)
  data/kgrc/scenes.csv                one row per scene node
  data/kgrc/entities.csv              one row per non-scene typed node
  data/kgrc/anomalies.json            syntactic/lexical anomalies with real IRIs
  data/kgrc/source_vs_text.csv        each kgc:source@en vs best-matching Doyle sentence
  data/kgrc/query_results/*.json      results of scripts/queries/kgrc/*.rq
Usage: python -I scripts/graph_audit.py <project_root>
"""
import collections
import csv
import glob
import json
import os
import re
import sys

import networkx as nx
import rdflib
from rapidfuzz import fuzz, process
from rdflib import OWL, RDF, RDFS, BNode, Literal, URIRef

KGC = rdflib.Namespace("http://kgc.knowledge-graph.jp/ontology/kgc.owl#")
D = "http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/"
PRED = "http://kgc.knowledge-graph.jp/data/predicate/"
SCENE_TYPES = {KGC.Statement, KGC.Situation, KGC.Thought, KGC.Talk}
SCENE_REL = ["then", "because", "therefore", "if", "at_the_same_time", "otherwise", "and", "after"]
FIVE_W = ["what", "whom", "who", "when", "where", "why", "how", "from", "to", "on", "time"]


def sh(x):
    s = str(x)
    for a, b in ((D, "d:"), (PRED, "pred:"), (str(KGC), "kgc:"), (str(RDF), "rdf:"), (str(RDFS), "rdfs:"), (str(OWL), "owl:")):
        s = s.replace(a, b)
    return s


def ns_of(u):
    s = str(u)
    m = re.match(r"(.*[#/])", s)
    return m.group(1) if m else s


def main(root):
    ttl = os.path.join(root, "sources/kgrc/ACaseOfIdentity.ttl")
    g = rdflib.Graph()
    g.parse(ttl, format="turtle")
    stats = {"file": "sources/kgrc/ACaseOfIdentity.ttl", "parser": f"rdflib {rdflib.__version__}"}

    # ---------- 1. basic counts ----------
    subjects = set(g.subjects())
    iris, bnodes, lits = set(), set(), []
    for t in g:
        for x in t:
            if isinstance(x, URIRef):
                iris.add(x)
            elif isinstance(x, BNode):
                bnodes.add(x)
    for o in g.objects():
        if isinstance(o, Literal):
            lits.append(o)
    stats["basic"] = {
        "triples": len(g), "distinct_subjects": len(subjects),
        "distinct_iris_any_position": len(iris), "blank_nodes": len(bnodes),
        "literal_occurrences": len(lits), "distinct_literals": len(set(lits)),
        "literal_datatypes": dict(collections.Counter(str(l.datatype) if l.datatype else ("rdf:langString" if l.language else "xsd:string(plain)") for l in lits)),
    }

    # ---------- 2. namespaces, classes, predicates ----------
    ns_pos = collections.defaultdict(collections.Counter)
    for s, p, o in g:
        for pos, x in (("s", s), ("p", p), ("o", o)):
            if isinstance(x, URIRef):
                ns_pos[ns_of(x)][pos] += 1
    stats["namespaces"] = {k: dict(v) for k, v in sorted(ns_pos.items(), key=lambda kv: -sum(kv[1].values()))}
    stats["classes"] = {sh(k): v for k, v in collections.Counter(o for o in g.objects(None, RDF.type)).most_common()}
    stats["predicates"] = {sh(k): v for k, v in collections.Counter(p for p in g.predicates()).most_common()}
    scene_pred_values = collections.Counter(o for o in g.objects(None, KGC.hasPredicate))
    stats["action_vocabulary"] = {
        "distinct_hasPredicate_values": len(scene_pred_values),
        "distinct_hasProperty_values": len(set(g.objects(None, KGC.hasProperty))),
        "top_hasPredicate": {sh(k): v for k, v in scene_pred_values.most_common(30)},
    }

    # ---------- 3. languages ----------
    lang_by_pred = collections.defaultdict(collections.Counter)
    for s, p, o in g:
        if isinstance(o, Literal):
            lang_by_pred[sh(p)][o.language or "none"] += 1
    stats["literal_languages_by_predicate"] = {k: dict(v) for k, v in lang_by_pred.items()}

    # ---------- 4. scenes ----------
    scene_nodes = {s for s in subjects if set(g.objects(s, RDF.type)) & SCENE_TYPES}
    type_combo = collections.Counter(tuple(sorted(sh(t) for t in set(g.objects(s, RDF.type)) & SCENE_TYPES)) for s in scene_nodes)
    ids = [str(s).replace(D, "") for s in scene_nodes]
    numeric = sorted(int(i) for i in ids if re.fullmatch(r"\d+", i))
    suffixed = sorted(i for i in ids if re.fullmatch(r"\d+[a-z]", i))
    gaps = sorted(set(range(1, max(numeric) + 1)) - set(numeric)) if numeric else []
    has_en = sum(1 for s in scene_nodes if any(isinstance(o, Literal) and o.language == "en" for o in g.objects(s, KGC.source)))
    has_ja = sum(1 for s in scene_nodes if any(isinstance(o, Literal) and o.language == "ja" for o in g.objects(s, KGC.source)))
    content_less = [str(s).replace(D, "") for s in scene_nodes if not (set(g.objects(s, KGC.hasPredicate)) | set(g.objects(s, KGC.hasProperty)))]
    is_ = {t: {s for s in scene_nodes if (s, RDF.type, t) in g} for t in (KGC.Statement, KGC.Situation, KGC.Thought)}
    info = {t: sum(1 for s in v if (s, KGC.infoSource, None) in g) for t, v in is_.items()}
    stats["scenes"] = {
        "method": "subjects typed kgc:Statement|Situation|Thought|Talk (a node with two scene types counted once)",
        "scene_nodes": len(scene_nodes), "type_combinations": {"+".join(k): v for k, v in type_combo.items()},
        "numeric_ids": len(numeric), "numeric_id_range": [numeric[0], numeric[-1]] if numeric else None,
        "suffixed_ids": suffixed, "missing_numeric_ids_in_range": len(gaps), "missing_ids_sample": gaps[:40],
        "with_source_en": has_en, "with_source_ja": has_ja,
        "without_hasPredicate_or_hasProperty": {"count": len(content_less), "ids": sorted(content_less)},
        "with_infoSource_by_type": {sh(k): {"with": v, "total": len(is_[k])} for k, v in info.items()},
        "paper_table1_reference": {"scenes": 544, "hasPredicate": 449, "hasProperty": 86, "subject": 464, "infoSource": 396, "infoReceiver": 0,
                                   "note": "Kozaki et al. 2023, Table 1 (same file blob 022b8cb7 on branch ikgrc2023)"},
    }
    # try to reproduce the paper's counts with alternative counting methods
    numeric_scenes = {s for s in scene_nodes if re.fullmatch(r"\d+", str(s).replace(D, ""))}
    alt = {}
    for name, nodes in (("all_scene_nodes", scene_nodes), ("numeric_id_scenes_only", numeric_scenes)):
        alt[name] = {"n": len(nodes)}
        for p in ("hasPredicate", "hasProperty", "subject", "infoSource", "what", "when", "whom", "how", "why", "time"):
            alt[name][p + "_triples"] = sum(1 for s in nodes for _ in g.objects(s, KGC[p]))
    alt["any_subject"] = {p + "_triples": len(list(g.triples((None, KGC[p], None)))) for p in ("hasPredicate", "hasProperty", "subject", "infoSource", "what", "when", "whom", "how", "why", "time")}
    alt["subjects_with_hasPredicate_or_hasProperty"] = len(set(g.subjects(KGC.hasPredicate, None)) | set(g.subjects(KGC.hasProperty, None)))
    stats["scenes"]["counting_alternatives"] = alt

    # ---------- 5. scene relations and order ----------
    rel_counts = {r: len(list(g.triples((None, KGC[r], None)))) for r in SCENE_REL}
    stats["scene_relations_triples"] = rel_counts
    G = nx.DiGraph()
    for a, b in g.subject_objects(KGC.then):
        G.add_edge(str(a).replace(D, ""), str(b).replace(D, ""))
    comps = list(nx.weakly_connected_components(G))
    outdeg_gt1 = [n for n in G if G.out_degree(n) > 1]
    indeg_gt1 = [n for n in G if G.in_degree(n) > 1]
    backward = []
    for a, b in G.edges():
        na, nb = re.match(r"\d+", a), re.match(r"\d+", b)
        if na and nb and int(nb.group()) < int(na.group()):
            backward.append((a, b))
    times = {str(s).replace(D, ""): str(o) for s, o in g.subject_objects(KGC.time)}
    time_order_conflicts = [(a, b, times[a], times[b]) for a, b in G.edges() if a in times and b in times and times[b] < times[a]]
    stats["then_graph"] = {
        "edges": G.number_of_edges(), "nodes": G.number_of_nodes(), "weak_components": len(comps),
        "largest_component": max(len(c) for c in comps) if comps else 0,
        "is_dag": nx.is_directed_acyclic_graph(G), "nodes_outdeg_gt1": outdeg_gt1[:30], "nodes_indeg_gt1": indeg_gt1[:30],
        "edges_to_lower_numeric_id": backward, "scene_nodes_not_in_then_graph": len(scene_nodes) - len({n for n in G}),
        "kgc_time_values": dict(sorted(collections.Counter(times.values()).items())),
        "then_edges_against_kgc_time": time_order_conflicts,
    }

    # ---------- 6. speech embedding (kgc:what between scenes) ----------
    emb = [(a, b) for a, b in g.subject_objects(KGC.what) if a in scene_nodes and b in scene_nodes]
    E = nx.DiGraph()
    E.add_edges_from((str(a).replace(D, ""), str(b).replace(D, "")) for a, b in emb)
    depth = max((len(p) - 1 for n in E for p in [nx.dag_longest_path(E.subgraph(nx.descendants(E, n) | {n}))]), default=0) if E.number_of_edges() and nx.is_directed_acyclic_graph(E) else None
    say_acts = set(g.subjects(KGC.hasPredicate, URIRef(PRED + "say")))
    stats["embedding"] = {
        "what_edges_between_scenes": len(emb), "embedding_parents": len({a for a, _ in emb}),
        "max_nesting_depth": depth, "say_scenes": len(say_acts),
        "say_scenes_with_embedded_scene": sum(1 for a in say_acts if any(b in scene_nodes for b in g.objects(a, KGC.what))),
        "embedded_statement_infoSource_equals_parent_subject": None,
    }
    same, diff, missing = 0, [], 0
    for a, b in emb:
        subj = set(g.objects(a, KGC.subject))
        srcs = set(g.objects(b, KGC.infoSource))
        if not srcs:
            missing += 1
        elif srcs & subj:
            same += 1
        else:
            diff.append((sh(a), sorted(sh(x) for x in subj), sh(b), sorted(sh(x) for x in srcs)))
    stats["embedding"]["embedded_statement_infoSource_equals_parent_subject"] = {"same": same, "different": len(diff), "embedded_without_infoSource": missing, "different_examples": diff[:25]}

    # ---------- 7. infoSource ----------
    info_vals = collections.Counter(sh(o) for o in g.objects(None, KGC.infoSource))
    stats["infoSource_values"] = dict(info_vals.most_common())
    persons = set(g.subjects(RDF.type, KGC.Person))
    stats["infoSource_not_typed_person"] = sorted({sh(o) for o in g.objects(None, KGC.infoSource) if o not in persons})

    # ---------- 8. entities ----------
    ent_types = ["Person", "Place", "PhysicalObject", "Object", "OFobj", "AbstractTime", "Property", "Action", "NotAction", "CanNotAction", "CanAction", "Animal"]
    stats["entities"] = {"method": "distinct subjects with rdf:type kgc:<Class> (multi-typing allowed; not disjoint)",
                         **{t: len(set(g.subjects(RDF.type, KGC[t]))) for t in ent_types}}
    stats["entities"]["persons"] = {sh(p): sorted(str(l) for l in g.objects(p, RDFS.label)) for p in sorted(persons)}

    # ---------- 9. identity ----------
    stats["identity"] = {
        "owl_sameAs": len(list(g.triples((None, OWL.sameAs, None)))),
        "owl_differentFrom": len(list(g.triples((None, OWL.differentFrom, None)))),
        "hasProperty_pred_Hosmer": [sh(s) for s in g.subjects(KGC.hasProperty, URIRef(PRED + "Hosmer"))],
        "pred_Hosmer_vs_d_Hosmer_linked": bool(list(g.triples((URIRef(PRED + "Hosmer"), None, URIRef(D + "Hosmer")))) or list(g.triples((URIRef(D + "Hosmer"), None, URIRef(PRED + "Hosmer"))))),
        "labels_Hosmer": sorted(str(l) for l in g.objects(URIRef(D + "Hosmer"), RDFS.label)),
        "labels_Windibank": sorted(str(l) for l in g.objects(URIRef(D + "Windibank"), RDFS.label)),
        "scenes_mentioning_Hosmer": len({s for s, p, o in g if o == URIRef(D + "Hosmer") and s in scene_nodes}),
        "scenes_mentioning_Windibank": len({s for s, p, o in g if o == URIRef(D + "Windibank") and s in scene_nodes}),
    }

    # ---------- 10. negation, modality, mental ----------
    notpred = collections.Counter(sh(p) for p in g.objects(None, KGC.hasPredicate) if re.search(r"/predicate/(not|cannot|canNot)[A-Z]", str(p)))
    stats["negation_modality"] = {
        "kgc_Not_triples": len(list(g.triples((None, KGC.Not, None)))),
        "kgc_can_triples": len(list(g.triples((None, KGC.can, None)))),
        "kgc_canNot_triples": len(list(g.triples((None, KGC.canNot, None)))),
        "kgc_if_triples": rel_counts["if"],
        "hasPredicate_negative_lexical": dict(notpred.most_common()),
        "Thought_scenes": len(is_[KGC.Thought]),
    }

    # ---------- 11. anomalies ----------
    pred_local = collections.Counter()
    for p in g.predicates():
        pred_local[str(p)] += 1
    odd_preds = {sh(p): n for p, n in pred_local.items() if re.search(r"[^\x00-\x7F]", p) or p.endswith("#") or p.endswith("/") or "hadPredicate" in p}
    lower = collections.defaultdict(set)
    for x in iris:
        if str(x).startswith(D):
            lower[str(x).lower()].add(sh(x))
    case_dups = [sorted(v) for v in lower.values() if len(v) > 1]
    amp = sorted({sh(x) for x in iris if "&#" in str(x)})
    ent_in_lit = sum(1 for l in lits if "&#" in str(l) or "&amp;" in str(l))
    ja_re = re.compile(r"[぀-ヿ一-鿿]")
    en_tagged_ja = [(sh(s), str(o)) for s, p, o in g if isinstance(o, Literal) and o.language == "en" and ja_re.search(str(o))]
    untagged = [(sh(s), sh(p), str(o)) for s, p, o in g if isinstance(o, Literal) and not o.language and not o.datatype and p != KGC.time]
    multi_label_conflict = {}
    for p in persons:
        labs = [str(l) for l in g.objects(p, RDFS.label)]
        if len([l for l in labs if ja_re.search(l)]) > 1:
            multi_label_conflict[sh(p)] = labs
    declared = {s for s in g.subjects(RDF.type, OWL.ObjectProperty)} | {s for s in g.subjects(RDF.type, OWL.DatatypeProperty)} | {s for s in g.subjects(RDF.type, OWL.AnnotationProperty)}
    schema_2023 = rdflib.Graph().parse(os.path.join(root, "sources/kgrc/kgc.owl"), format="xml")
    schema_root = rdflib.Graph().parse(os.path.join(root, "sources/kgrc/kgc.owl.root"), format="xml")
    def terms(sg):
        return {s for s in sg.subjects(RDF.type, None) if isinstance(s, URIRef)}
    t23, troot = terms(schema_2023), terms(schema_root)
    used_kgc = {p for p in g.predicates() if str(p).startswith(str(KGC))} | {o for o in g.objects(None, RDF.type) if str(o).startswith(str(KGC))}
    stats["schema"] = {
        "inline_declared_properties": len(declared),
        "kgc_terms_used": len(used_kgc),
        "kgc_terms_used_not_in_2023ikgrc_kgc_owl": sorted(sh(x) for x in used_kgc - t23),
        "kgc_terms_used_not_in_root_kgc_owl": sorted(sh(x) for x in used_kgc - troot),
        "kgc_terms_used_not_declared_anywhere": sorted(sh(x) for x in used_kgc - t23 - troot - declared),
        "terms_2023ikgrc_kgc_owl": len(t23), "terms_root_kgc_owl": len(troot),
        "in_root_not_in_2023": sorted(sh(x) for x in troot - t23), "in_2023_not_in_root": sorted(sh(x) for x in t23 - troot),
        "pred_namespace_terms_declared_in_any_schema": sum(1 for x in set(g.objects(None, KGC.hasPredicate)) if x in t23 | troot),
        "inline_comment_namespace": "comments in the TTL header cite http://kgc.knowledge-graph.jp/ontology/kgcc.owl# (double 'c'); the declared prefix is kgc.owl#",
    }
    infosrc_typo = [sh(o) for o in set(g.objects(None, KGC.infoSource)) if str(o).lower() in {str(p).lower() for p in persons} and o not in persons]
    anomalies = {
        "odd_predicate_iris": odd_preds,
        "case_insensitive_duplicate_iris": case_dups,
        "iris_containing_html_entities": amp,
        "literals_containing_html_entities": ent_in_lit,
        "en_tagged_literals_with_japanese_script": en_tagged_ja[:20], "en_tagged_literals_with_japanese_script_count": len(en_tagged_ja),
        "untagged_plain_literals": untagged[:30], "untagged_plain_literals_count": len(untagged),
        "persons_with_multiple_japanese_labels": multi_label_conflict,
        "infoSource_iri_case_variant_of_person": infosrc_typo,
        "scenes_without_hasPredicate_or_hasProperty": stats["scenes"]["without_hasPredicate_or_hasProperty"],
    }
    stats["anomalies_summary"] = {k: (len(v) if isinstance(v, (list, dict)) else v) for k, v in anomalies.items()}

    # ---------- 12. kgc:source vs Doyle text ----------
    sents = list(csv.DictReader(open(os.path.join(root, "data/text/sentences.csv"), encoding="utf-8")))
    norm = open(os.path.join(root, "data/text/normalized.txt"), encoding="utf-8").read()
    choices = [s["text"] for s in sents]
    rows = []
    for s in sorted(scene_nodes, key=lambda x: str(x)):
        for o in g.objects(s, KGC.source):
            if isinstance(o, Literal) and o.language == "en":
                q = str(o)
                best = process.extractOne(q, choices, scorer=fuzz.token_set_ratio)
                verbatim = len(q) >= 25 and q in norm
                rows.append({"scene": sh(s), "source_en": q, "best_sentence": sents[best[2]]["sent_id"],
                             "token_set_ratio": round(best[1], 1), "partial_ratio": round(fuzz.partial_ratio(q, best[0]), 1),
                             "verbatim_substring_of_doyle": verbatim})
    with open(os.path.join(root, "data/kgrc/source_vs_text.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    ratios = sorted(r["token_set_ratio"] for r in rows)
    stats["source_vs_doyle"] = {
        "method": "each kgc:source@en of a scene vs all normalised sentences (data/text/sentences.csv); rapidfuzz token_set_ratio best match; verbatim = exact substring (len>=25)",
        "en_sources": len(rows), "verbatim_substrings": sum(r["verbatim_substring_of_doyle"] for r in rows),
        "token_set_ratio_quartiles": [ratios[len(ratios) // 4], ratios[len(ratios) // 2], ratios[3 * len(ratios) // 4]],
        "share_ratio_ge_90": round(sum(1 for r in ratios if r >= 90) / len(ratios), 3),
        "interpretation_note": "token_set_ratio rewards word overlap of short paraphrases; high values do not mean quotation",
    }

    # ---------- 13. scene table / entity table ----------
    scene_rows = []
    for s in sorted(scene_nodes, key=lambda x: (len(str(x)), str(x))):
        def j(p):
            return "|".join(sorted(sh(o) for o in g.objects(s, p)))
        en = [str(o) for o in g.objects(s, KGC.source) if isinstance(o, Literal) and o.language == "en"]
        ja = [str(o) for o in g.objects(s, KGC.source) if isinstance(o, Literal) and o.language == "ja"]
        parents = "|".join(sorted(sh(a) for a in g.subjects(KGC.what, s) if a in scene_nodes))
        row = {"scene": sh(s), "types": "|".join(sorted(sh(t) for t in set(g.objects(s, RDF.type)) & SCENE_TYPES)),
               "subject": j(KGC.subject), "hasPredicate": j(KGC.hasPredicate), "hasProperty": j(KGC.hasProperty),
               "infoSource": j(KGC.infoSource), "embedded_in": parents}
        for p in FIVE_W + SCENE_REL + ["Not", "can", "canNot"]:
            row[p] = j(KGC[p])
        row["source_en"] = " || ".join(en)
        row["source_ja"] = " || ".join(ja)
        scene_rows.append(row)
    with open(os.path.join(root, "data/kgrc/scenes.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(scene_rows[0].keys()))
        w.writeheader()
        w.writerows(scene_rows)
    ent_rows = []
    for s in sorted({s for s in subjects if s not in scene_nodes and (s, RDF.type, None) in g}, key=str):
        types = sorted(sh(t) for t in g.objects(s, RDF.type))
        if any(t.startswith("owl:") for t in types):
            continue
        labs = list(g.objects(s, RDFS.label))
        ent_rows.append({"iri": sh(s), "types": "|".join(types),
                         "label_en": "|".join(str(l) for l in labs if l.language == "en"),
                         "label_ja": "|".join(str(l) for l in labs if l.language == "ja"),
                         "label_other": "|".join(str(l) for l in labs if l.language not in ("en", "ja")),
                         "scene_mentions": len({x for x, p, o in g.triples((None, None, s)) if x in scene_nodes})})
    with open(os.path.join(root, "data/kgrc/entities.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(ent_rows[0].keys()))
        w.writeheader()
        w.writerows(ent_rows)
    stats["entity_table_rows"] = len(ent_rows)
    stats["entities_with_en_label"] = sum(1 for r in ent_rows if r["label_en"])

    # ---------- 14. SPARQL queries ----------
    qdir = os.path.join(root, "scripts/queries/kgrc")
    qres = {}
    for qf in sorted(glob.glob(os.path.join(qdir, "*.rq"))):
        q = open(qf, encoding="utf-8").read()
        res = g.query(q)
        out = [{str(k): sh(v) if v is not None else None for k, v in zip(res.vars, row)} for row in res]
        name = os.path.basename(qf)[:-3]
        with open(os.path.join(root, "data/kgrc/query_results", name + ".json"), "w", encoding="utf-8") as f:
            json.dump(out, f, indent=1, ensure_ascii=False)
        qres[name] = len(out)
    stats["sparql_result_rows"] = qres

    with open(os.path.join(root, "data/kgrc/anomalies.json"), "w", encoding="utf-8") as f:
        json.dump(anomalies, f, indent=2, ensure_ascii=False)
    with open(os.path.join(root, "data/graph_stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    print(json.dumps({k: stats[k] for k in ("basic", "scenes", "identity", "negation_modality", "anomalies_summary", "source_vs_doyle", "sparql_result_rows")}, indent=1, ensure_ascii=False)[:6000])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
