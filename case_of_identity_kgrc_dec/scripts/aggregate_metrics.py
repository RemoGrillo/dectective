#!/usr/bin/env python3
"""Aggregate runner outputs into per-query metrics, correctness against expectations and averages.

Inputs : prototype/results/metrics/<qid>/{asserted,flat,ctx,dec}.json (+ .cold<i>, dec.instrumented),
         prototype/fixtures/*/manifest.json (expectations), slices/*.report.json, results/run_log*.json
Outputs: prototype/results/metrics_summary.csv   one row per query x configuration
         prototype/results/test_results.json      observed vs expected per query and configuration
         prototype/results/metrics_aggregate.json averages across queries (mean, median, sd, min, max,
                                                  IQR; geometric mean for ratios) + full-dataset timings
Definitions (heuristic, declared in reports/dec_performance.md):
  amplification        = materialised_total / asserted_total
  new_knowledge_rate   = inferred_substantive_total / asserted_total
  trivial_share        = inferred_trivial_total / inferred_total
  permeated_share      = permeated_total / materialised_total
  throughput           = materialised_total / materialisation seconds (median over warm reps)
  inference_utility    = matched_non_asserted_triples / (inferred_total + permeated_total)
  answers_need_inference = observed answer differs from the 'asserted' (no inference) configuration
Usage: python -I scripts/aggregate_metrics.py <root>
"""
import csv
import glob
import json
import math
import os
import statistics as st
import sys

CONFIGS = ["asserted", "flat", "ctx", "dec"]


def q(xs, p):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * p
    f, c = math.floor(k), math.ceil(k)
    return xs[f] if f == c else xs[f] + (xs[c] - xs[f]) * (k - f)


def stats(xs):
    xs = [x for x in xs if x is not None]
    if not xs:
        return {}
    return {"n": len(xs), "mean": st.mean(xs), "median": st.median(xs), "sd": st.stdev(xs) if len(xs) > 1 else 0.0,
            "min": min(xs), "max": max(xs), "iqr": (q(xs, 0.75) - q(xs, 0.25))}


def gmean(xs):
    xs = [x for x in xs if x and x > 0]
    return math.exp(sum(math.log(x) for x in xs) / len(xs)) if xs else None


def observed(res):
    qr = res.get("query_result", {})
    return qr.get("ask") if qr.get("type") == "ASK" else sorted(qr.get("rows", []))


def main(root):
    rd = os.path.join(root, "prototype/results")
    expectations = {}
    for m in glob.glob(os.path.join(root, "prototype/fixtures/*/manifest.json")):
        man = json.load(open(m, encoding="utf-8"))
        tid = os.path.basename(os.path.dirname(m))
        for qq in man["queries"]:
            rep_path = os.path.join(os.path.dirname(m), "slices", qq["id"] + ".report.json")
            rep = json.load(open(rep_path)) if os.path.exists(rep_path) else {}
            expectations[qq["id"]] = {**qq, "test": tid, "dataset": man["dataset"], "slice": rep}
    runlog = {}
    for f in glob.glob(os.path.join(rd, "run_log*.json")):
        for e in json.load(open(f, encoding="utf-8")):
            if "query" in e:
                runlog[e["query"]] = e
    rows, tests = [], {}
    for qid, exp in sorted(expectations.items()):
        mdir = os.path.join(rd, "metrics", qid)
        if not os.path.isdir(mdir):
            continue
        res = {}
        for cfg in CONFIGS:
            p = os.path.join(mdir, f"{cfg}.json")
            if os.path.exists(p):
                res[cfg] = json.load(open(p, encoding="utf-8"))
        if not res:
            continue
        base_obs = observed(res["asserted"]) if "asserted" in res else None
        tests[qid] = {"test": exp["test"], "dataset": exp["dataset"], "classification": exp["classification"],
                      "expected": exp["expected"], "justification": exp["justification"],
                      "axioms_or_assumptions": exp["axioms_or_assumptions"], "world_time": exp["world_time"], "note": exp["note"],
                      "observed": {}, "matches_expected": {}, "answer_needs_inference": {},
                      "slice": {k: exp["slice"].get(k) for k in ("total_after", "total_full", "worlds_selected", "excluded_axioms")},
                      "preserved_ctx": runlog.get(qid, {}).get("preserved_ctx"), "preserved_dec": runlog.get(qid, {}).get("preserved_dec"),
                      "instrumented_equivalent": runlog.get(qid, {}).get("instrumented_equivalent")}
        for cfg, r in res.items():
            obs = observed(r)
            tests[qid]["observed"][cfg] = obs
            e = exp["expected"]
            if e is None:
                tests[qid]["matches_expected"][cfg] = None
            elif isinstance(e, bool):
                tests[qid]["matches_expected"][cfg] = (obs == e)
            else:
                tests[qid]["matches_expected"][cfg] = (sorted(e) == obs)
            tests[qid]["answer_needs_inference"][cfg] = (obs != base_obs)
            runs = [x for x in r["runs"] if not x["warmup"]]
            mat = [x["materialise_total_ms"] for x in runs]
            qf = [x.get("query_first_ms") for x in runs]
            qs = [x.get("query_second_ms") for x in runs]
            cold = []
            for i in range(10):
                cp = os.path.join(mdir, f"{cfg}.cold{i}.json")
                if os.path.exists(cp):
                    cold.append(json.load(open(cp))["runs"][0]["materialise_total_ms"])
            acc = r["accounting"]
            inferred = acc.get("inferred_total", 0)
            perm = acc.get("permeated_total", 0)
            qr = r.get("query_result", {})
            med = st.median(mat) if mat else None
            row = {"query": qid, "test": exp["test"], "dataset": exp["dataset"], "config": cfg,
                   "input_quads": r.get("input_quads"), "n_worlds": acc.get("n_worlds"),
                   "asserted_total": acc.get("asserted_total"), "materialised_total": acc.get("materialised_total"),
                   "permeated_total": perm, "inferred_total": inferred,
                   "inferred_trivial": acc.get("inferred_trivial_total"), "inferred_taxonomic": acc.get("inferred_taxonomic_total"),
                   "inferred_substantive": acc.get("inferred_substantive_total"), "dec_diagnostic": acc.get("dec_diagnostic_total"),
                   "redundancy": acc.get("redundancy"), "inconsistency_pairs": acc.get("inconsistency_pairs"),
                   "mat_ms_median": med, "mat_ms_mean": st.mean(mat) if mat else None, "mat_ms_sd": st.stdev(mat) if len(mat) > 1 else 0,
                   "mat_ms_min": min(mat) if mat else None, "mat_ms_max": max(mat) if mat else None,
                   "mat_ms_iqr": (q(mat, .75) - q(mat, .25)) if mat else None,
                   "cold_mat_ms_mean": st.mean(cold) if cold else None,
                   "query_first_ms_median": st.median([x for x in qf if x is not None]) if qf else None,
                   "query_second_ms_median": st.median([x for x in qs if x is not None]) if qs else None,
                   "cpu_ms_median": st.median([x["cpu_ms"] for x in runs]) if runs else None,
                   "gc_ms_total": sum(x["gc_ms"] for x in runs), "heap_delta_mb_median": st.median([x["heap_delta_mb"] for x in runs]) if runs else None,
                   "amplification": (acc["materialised_total"] / acc["asserted_total"]) if acc.get("asserted_total") else None,
                   "new_knowledge_rate": (acc.get("inferred_substantive_total", 0) / acc["asserted_total"]) if acc.get("asserted_total") else None,
                   "trivial_share": (acc.get("inferred_trivial_total", 0) / inferred) if inferred else None,
                   "permeated_share": (perm / acc["materialised_total"]) if acc.get("materialised_total") else None,
                   "throughput_triples_per_s": (acc["materialised_total"] / (med / 1000.0)) if med else None,
                   "ms_per_asserted": (med / acc["asserted_total"]) if med and acc.get("asserted_total") else None,
                   "matched_triples": qr.get("matched_triples"), "matched_non_asserted": qr.get("matched_non_asserted_triples"),
                   "inference_utility": (qr.get("matched_non_asserted_triples", 0) / (inferred + perm)) if (inferred + perm) else None,
                   "matches_expected": tests[qid]["matches_expected"][cfg], "answer_needs_inference": tests[qid]["answer_needs_inference"][cfg]}
            if cfg == "dec":
                ip = os.path.join(mdir, "dec.instrumented.json")
                if os.path.exists(ip):
                    ph = json.load(open(ip))["runs"][0]["phases"]
                    for k, v in ph.items():
                        row["phase_" + k] = v
                    pairs = acc.get("inconsistency_pairs") or 0
                    row["ms_per_inconsistency_pair"] = (ph.get("verifyInconsistencies_ms", 0) / pairs) if pairs else None
            rows.append(row)
    # DEC vs baselines
    by = {(r["query"], r["config"]): r for r in rows}
    for qid in tests:
        d, c, f = by.get((qid, "dec")), by.get((qid, "ctx")), by.get((qid, "flat"))
        if d and c and c["mat_ms_median"]:
            d["overhead_vs_ctx"] = d["mat_ms_median"] / c["mat_ms_median"]
            d["triples_vs_ctx"] = d["materialised_total"] / c["materialised_total"] if c["materialised_total"] else None
        if d and f and f["mat_ms_median"]:
            d["overhead_vs_flat"] = d["mat_ms_median"] / f["mat_ms_median"]
    fields = []
    for r in rows:
        for k in r:
            if k not in fields:
                fields.append(k)
    with open(os.path.join(rd, "metrics_summary.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    with open(os.path.join(rd, "test_results.json"), "w", encoding="utf-8") as fh:
        json.dump(tests, fh, indent=2, ensure_ascii=False)
    agg = {"n_queries": len(tests), "per_config": {}}
    for cfg in CONFIGS:
        rs = [r for r in rows if r["config"] == cfg]
        agg["per_config"][cfg] = {
            k: stats([r.get(k) for r in rs]) for k in ("mat_ms_median", "cold_mat_ms_mean", "query_first_ms_median", "asserted_total",
                                                         "materialised_total", "inferred_total", "inferred_substantive", "permeated_total",
                                                         "redundancy", "throughput_triples_per_s", "ms_per_asserted", "inference_utility")}
        agg["per_config"][cfg]["geomean_amplification"] = gmean([r.get("amplification") for r in rs])
        agg["per_config"][cfg]["geomean_new_knowledge_rate"] = gmean([r.get("new_knowledge_rate") for r in rs])
        agg["per_config"][cfg]["matches_expected"] = {"true": sum(1 for r in rs if r["matches_expected"] is True),
                                                      "false": sum(1 for r in rs if r["matches_expected"] is False),
                                                      "n/a": sum(1 for r in rs if r["matches_expected"] is None)}
        if cfg == "dec":
            agg["per_config"][cfg]["geomean_overhead_vs_ctx"] = gmean([r.get("overhead_vs_ctx") for r in rs])
            agg["per_config"][cfg]["geomean_overhead_vs_flat"] = gmean([r.get("overhead_vs_flat") for r in rs])
            agg["per_config"][cfg]["ms_per_inconsistency_pair"] = stats([r.get("ms_per_inconsistency_pair") for r in rs])
            for ph in ("phase_permeateWorlds_ms", "phase_verifyInconsistencies_ms", "phase_verifyClosedFor_ms", "phase_assignDecTypes_ms", "phase_restore_ms"):
                agg["per_config"][cfg][ph] = stats([r.get(ph) for r in rs])
    sl = [t["slice"] for t in tests.values() if t["slice"].get("total_full")]
    agg["slicing"] = {"size_reduction_ratio": stats([s["total_after"] / s["total_full"] for s in sl]),
                      "preserved_ctx": sum(1 for t in tests.values() if t["preserved_ctx"] is True),
                      "not_preserved_ctx": [k for k, t in tests.items() if t["preserved_ctx"] is False],
                      "preserved_dec": sum(1 for t in tests.values() if t["preserved_dec"] is True),
                      "not_preserved_dec": [k for k, t in tests.items() if t["preserved_dec"] is False],
                      "instrumented_equivalent": sum(1 for t in tests.values() if t["instrumented_equivalent"] is True),
                      "instrumented_not_equivalent": [k for k, t in tests.items() if t["instrumented_equivalent"] is False]}
    full = {}
    for d in glob.glob(os.path.join(rd, "metrics", "_full_*")):
        ds = os.path.basename(d)[6:]
        for cfg in ("dec", "ctx", "flat"):
            p = os.path.join(d, f"{cfg}.json")
            if os.path.exists(p):
                r = json.load(open(p))
                full.setdefault(ds, {})[cfg] = {"mat_ms": r["runs"][0]["materialise_total_ms"], "input_quads": r["input_quads"],
                                               "materialised_total": r["accounting"]["materialised_total"],
                                               "n_worlds": r["accounting"]["n_worlds"], "inconsistency_pairs": r["accounting"]["inconsistency_pairs"]}
    agg["full_dataset_timings"] = full
    with open(os.path.join(rd, "metrics_aggregate.json"), "w", encoding="utf-8") as fh:
        json.dump(agg, fh, indent=2, ensure_ascii=False)
    print(json.dumps({c: {"mat_ms_median(mean over queries)": agg["per_config"][c]["mat_ms_median"].get("mean"),
                          "matches": agg["per_config"][c]["matches_expected"]} for c in CONFIGS if agg["per_config"][c].get("mat_ms_median")}, indent=1))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
