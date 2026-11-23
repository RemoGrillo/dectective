#!/usr/bin/env python3
"""Ablations isolating DEC's two conflict mechanisms on stored slices.

T05a: slice without dec:checkInconsistencies (closedFor only) and without dec:closedFor (OWL check only).
T09c: slice without dec:closedFor.
Each variant is derived by removing the corresponding triple from the stored slice; DEC run once.
Output: prototype/results/ablations/<variant>.trig/.json and prototype/results/ablations/summary.json
Usage: python -I scripts/run_ablations.py <project_root>
"""
import json
import os
import subprocess
import sys

VARIANTS = [
    ("T05a_closedFor_only", "T05_insincerity", "T05a_content_vs_speaker_belief", "checkInconsistencies"),
    ("T05a_owlcheck_only", "T05_insincerity", "T05a_content_vs_speaker_belief", "closedFor"),
    ("T09c_no_closedFor", "T09_typewriter_C3", "T09c_authorship_alternatives", "closedFor"),
]


def main(root):
    out = os.path.join(root, "prototype/results/ablations")
    os.makedirs(out, exist_ok=True)
    cp = os.path.join(root, "prototype/runner/target/dec-metrics-runner-0.1.0.jar") + ":" + os.path.join(root, "prototype/runner/target/lib/*")
    summary = {}
    for name, fx, qid, drop in VARIANTS:
        src = os.path.join(root, "prototype/fixtures", fx, "slices", qid + ".trig")
        dst = os.path.join(out, name + ".trig")
        with open(src, encoding="utf-8") as f, open(dst, "w", encoding="utf-8") as g:
            for line in f:
                if drop not in line:
                    g.write(line)
        res = os.path.join(out, name + ".json")
        p = subprocess.run(["timeout", "900", "java", "-Xmx4g", "-cp", cp, "dectective.Runner", "--data", dst,
                            "--query", os.path.join(root, "prototype/fixtures", fx, qid + ".rq"), "--config", "dec",
                            "--warmup", "0", "--reps", "1", "--out", res], capture_output=True, text=True)
        if p.returncode != 0:
            summary[name] = {"error": p.stderr[-400:]}
            continue
        r = json.load(open(res))
        diag = [d.replace("http://example.org/dectective/world/", "w:").replace("http://w3id.org/conjectures/", "dec:")
                for d in r["accounting"]["dec_diagnostics"] if "disagreesWith" in d or "delusional" in d]
        summary[name] = {"dropped": drop, "rows": [x.replace("http://example.org/dectective/world/", "w:") for x in r["query_result"]["rows"]],
                         "mat_ms": r["runs"][0]["materialise_total_ms"], "diagnostics": sorted(diag)}
        print(name, summary[name]["rows"], round(summary[name]["mat_ms"]), "ms")
    json.dump(summary, open(os.path.join(out, "summary.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
