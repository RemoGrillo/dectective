#!/usr/bin/env python3
"""Render the performance tables (markdown) from the result files, so no number is transcribed by hand.
Inputs: prototype/results/metrics_summary.csv, metrics_aggregate.json, sensitivity.json, metrics/*/dec.instrumented.json
Output: reports/dec_performance_tables.md
Usage: python -I scripts/render_performance_tables.py <project_root>
"""
import csv
import glob
import json
import math
import os
import statistics as st
import sys


def f(x, n=1):
    try:
        return f"{float(x):,.{n}f}".replace(",", " ")
    except (TypeError, ValueError):
        return "–"


def main(root):
    rd = os.path.join(root, "prototype/results")
    rows = list(csv.DictReader(open(os.path.join(rd, "metrics_summary.csv"), encoding="utf-8")))
    agg = json.load(open(os.path.join(rd, "metrics_aggregate.json"), encoding="utf-8"))
    sens = json.load(open(os.path.join(rd, "sensitivity.json"), encoding="utf-8")) if os.path.exists(os.path.join(rd, "sensitivity.json")) else None
    L = ["# Tabelle di prestazione (generate da `scripts/render_performance_tables.py`)", "",
         "Tempi in millisecondi; mediane su 10 ripetizioni a JVM calda (dopo 1 warm-up) salvo 'cold' (media di 3 JVM nuove).",
         "Conteggi dall'ultima ripetizione (deterministici). Definizioni in `dec_performance.md`.", ""]
    L += ["## 1. DEC per query (slice)", "",
          "| query | mondi | coppie | asserite | materializzate | permeate | inf. banali | inf. tassonomiche | inf. sostanziali | diagn. DEC | mediana ms | IQR | cold ms | 1ª query ms | overhead vs ctx | utilità |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        if r["config"] != "dec":
            continue
        L.append(f"| {r['query']} | {r['n_worlds']} | {r['inconsistency_pairs']} | {r['asserted_total']} | {r['materialised_total']} | {r['permeated_total']} | "
                 f"{r['inferred_trivial']} | {r['inferred_taxonomic']} | {r['inferred_substantive']} | {r['dec_diagnostic']} | {f(r['mat_ms_median'])} | "
                 f"{f(r['mat_ms_iqr'])} | {f(r['cold_mat_ms_mean'])} | {f(r['query_first_ms_median'], 2)} | {f(r.get('overhead_vs_ctx'), 2)} | {f(r['inference_utility'], 4)} |")
    L += ["", "## 2. Confronto tra configurazioni per query (mediana ms di materializzazione / triple materializzate)", "",
          "| query | asserted | flat | ctx | dec |", "|---|---|---|---|---|"]
    by = {}
    for r in rows:
        by.setdefault(r["query"], {})[r["config"]] = r
    for q, cs in by.items():
        L.append(f"| {q} | " + " | ".join(f"{f(cs[c]['mat_ms_median'])} / {cs[c]['materialised_total']}" if c in cs else "–" for c in ("asserted", "flat", "ctx", "dec")) + " |")
    L += ["", "## 3. Aggregati sulle 30 query", "", "| metrica | flat | ctx | dec |", "|---|---|---|---|"]
    pc = agg["per_config"]
    def m(c, k, s="median"):
        return f(pc[c][k].get(s)) if pc[c].get(k) else "–"
    for k, lab in (("mat_ms_median", "materializzazione ms (mediana delle mediane)"), ("cold_mat_ms_mean", "materializzazione a freddo ms (mediana)"),
                   ("materialised_total", "triple materializzate (mediana)"), ("inferred_substantive", "inferenze sostanziali (mediana)"),
                   ("redundancy", "ridondanza tra mondi (mediana)"), ("throughput_triples_per_s", "throughput triple/s (mediana)")):
        L.append(f"| {lab} | {m('flat', k)} | {m('ctx', k)} | {m('dec', k)} |")
    for k, lab in (("mat_ms_median", "materializzazione ms (media)"),):
        L.append(f"| {lab} | {m('flat', k, 'mean')} | {m('ctx', k, 'mean')} | {m('dec', k, 'mean')} |")
    L.append(f"| amplificazione (media geometrica) | {f(pc['flat']['geomean_amplification'])} | {f(pc['ctx']['geomean_amplification'])} | {f(pc['dec']['geomean_amplification'])} |")
    L.append(f"| conoscenza nuova sostanziale / asserite (media geometrica) | {f(pc['flat']['geomean_new_knowledge_rate'], 3)} | {f(pc['ctx']['geomean_new_knowledge_rate'], 3)} | {f(pc['dec']['geomean_new_knowledge_rate'], 3)} |")
    L.append(f"| risposte conformi all'attesa (su 29) | {pc['flat']['matches_expected']['true']} | {pc['ctx']['matches_expected']['true']} | {pc['dec']['matches_expected']['true']} |")
    L.append(f"| overhead DEC vs ctx / vs flat (media geometrica) | | | {f(pc['dec']['geomean_overhead_vs_ctx'], 2)} / {f(pc['dec']['geomean_overhead_vs_flat'], 2)} |")
    # phases
    L += ["", "## 4. Fasi DEC (esecuzione strumentata, una per query; quota sul totale di `handlePermeation`)", "",
          "| query | totale ms | permeazione+inferenza mondi % | verifyInconsistencies % | verifyClosedFor % | restore % |", "|---|---|---|---|---|---|"]
    for d in sorted(glob.glob(os.path.join(rd, "metrics", "T*"))):
        p = os.path.join(d, "dec.instrumented.json")
        if not os.path.exists(p):
            continue
        ph = json.load(open(p))["runs"][0]["phases"]
        tot = ph["handlePermeation_ms"]
        L.append(f"| {os.path.basename(d)} | {f(tot)} | {f(100 * ph.get('permeateWorlds_ms', 0) / tot)} | {f(100 * ph.get('verifyInconsistencies_ms', 0) / tot)} | "
                 f"{f(100 * ph.get('verifyClosedFor_ms', 0) / tot)} | {f(100 * ph.get('restore_ms', 0) / tot)} |")
    # full datasets
    L += ["", "## 5. Dataset completi senza slicing (una esecuzione; query sonda)", "",
          "| dataset | quadruple in input | mondi | coppie | dec s | ctx s | flat s | triple materializzate dec / ctx / flat |", "|---|---|---|---|---|---|---|---|"]
    for ds in ("C1", "C2", "C3", "C4", "gold"):
        v = agg["full_dataset_timings"].get(ds)
        if not v:
            continue
        L.append(f"| {ds} | {v['dec']['input_quads']} | {v['dec']['n_worlds']} | {v['dec']['inconsistency_pairs']} | {f(v['dec']['mat_ms'] / 1000)} | "
                 f"{f(v['ctx']['mat_ms'] / 1000)} | {f(v['flat']['mat_ms'] / 1000)} | {v['dec']['materialised_total']} / {v['ctx']['materialised_total']} / {v['flat']['materialised_total']} |")
    s = agg["slicing"]
    L += ["", f"Slice/completo (triple): mediana {f(s['size_reduction_ratio']['median'], 3)}, min {f(s['size_reduction_ratio']['min'], 3)}, max {f(s['size_reduction_ratio']['max'], 3)}. "
          f"Risposte preservate (ctx, slice vs completo): {s['preserved_ctx']}/30. Materializzazione strumentata equivalente (SHA-256): {s['instrumented_equivalent']}/30.", ""]
    if sens:
        L += ["## 6. Serie di sensibilità (base: slice di " + sens["query"] + f"; {sens['reps']} ripetizioni, mediana)", "",
              "| serie | valore | input | mondi | coppie | dec ms | ctx ms | dec/ctx |", "|---|---|---|---|---|---|---|---|"]
        for p in sens["A_background"]:
            d, c = p["dec"], p["ctx"]
            L.append(f"| A: triple di sfondo | {p['background_triples']} | {d.get('input_quads', '–')} | {d.get('n_worlds', '–')} | {d.get('inconsistency_pairs', '–')} | "
                     f"{f(d.get('mat_ms_median')) if d.get('rc') == 0 else 'timeout' if d.get('timeout') else 'errore'} | {f(c.get('mat_ms_median'))} | "
                     f"{f(d['mat_ms_median'] / c['mat_ms_median'], 1) if d.get('rc') == 0 and c.get('rc') == 0 else '–'} |")
        for p in sens["B_worlds"]:
            d, c = p["dec"], p["ctx"]
            L.append(f"| B: mondi in più | {p['extra_worlds']} | {d.get('input_quads', '–')} | {d.get('n_worlds', '–')} | {d.get('inconsistency_pairs', '–')} | "
                     f"{f(d.get('mat_ms_median')) if d.get('rc') == 0 else 'timeout' if d.get('timeout') else 'errore'} | {f(c.get('mat_ms_median'))} | "
                     f"{f(d['mat_ms_median'] / c['mat_ms_median'], 1) if d.get('rc') == 0 and c.get('rc') == 0 else '–'} |")
    with open(os.path.join(root, "reports/dec_performance_tables.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    print("written", len(L), "lines")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
