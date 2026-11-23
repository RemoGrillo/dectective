#!/usr/bin/env python3
"""Complementary DEC run for the six gold worlds that no test slice materialised.

Worlds: holmes_mother (W03), holmes_motive (W04), v_windibank_delighted (W11), v_windibank_machine (W12),
holmes_same_machine (W13), h_author_other (W14). Conjectural worlds receive reality, so the reconstruction
(W02, epistemic) and the core facts are included too. No dec:checkInconsistencies, no dec:closedFor:
this run only materialises permeation + local inference (world-level verdicts come from the test runs).
Reuses scripts/slice_for_query.py and the measurement runner; nothing else is recomputed.
Output: prototype/results/edition_complement/{manifest.json, slice.trig, slice.report.json, dec.json, dec.dump.txt}
Usage: python -I scripts/run_edition_complement.py <project_root>
"""
import json
import os
import subprocess
import sys

MODULES = ["W03_holmes_mother", "W04_holmes_motive", "W11_v_windibank_delighted", "W12_v_windibank_machine",
           "W13_holmes_same_machine", "W14_h_author_other", "W02_holmes_reconstruction",
           "F01_persons", "F02_occupation", "F03_courtship", "F04_documents", "F05_windibank_visit", "F07_comm_acts_visit"]


def main(root):
    out = os.path.join(root, "prototype/results/edition_complement")
    os.makedirs(out, exist_ok=True)
    man = {"dataset": "gold", "question": "Complementary materialisation for the digital edition (no conflict check)",
           "seed_iris": [], "require_modules": MODULES, "dec_flags": [], "closed_for": []}
    mpath = os.path.join(out, "manifest.json")
    json.dump(man, open(mpath, "w"), indent=2)
    q = os.path.join(root, "prototype/exploratory/probe.rq")
    sl, rep = os.path.join(out, "slice.trig"), os.path.join(out, "slice.report.json")
    subprocess.run([sys.executable, "-I", os.path.join(root, "scripts/slice_for_query.py"), root, "--dataset", "gold", "--query", q,
                    "--manifest", mpath, "--out", sl, "--report", rep], check=True)
    cp = os.path.join(root, "prototype/runner/target/dec-metrics-runner-0.1.0.jar") + ":" + os.path.join(root, "prototype/runner/target/lib/*")
    subprocess.run(["timeout", "900", "java", "-Xmx4g", "-cp", cp, "dectective.Runner", "--data", sl, "--query", q, "--config", "dec",
                    "--warmup", "0", "--reps", "1", "--dump", os.path.join(out, "dec.dump.txt"), "--out", os.path.join(out, "dec.json")],
                   check=True, capture_output=True)
    r = json.load(open(os.path.join(out, "dec.json")))
    print("complement: worlds", r["accounting"]["n_worlds"], "materialised", r["accounting"]["materialised_total"],
          "ms", round(r["runs"][0]["materialise_total_ms"]))
    # Reader checkpoints: one materialisation per checkpoint (whole C_k TriG without the conflict-check flags),
    # so that Investigation mode has every world of every checkpoint (C1 had no test query at all).
    for ck in ("C1", "C2", "C3", "C4"):
        src = os.path.join(root, f"prototype/sim/{ck}.trig")
        dst = os.path.join(out, f"snapshot_{ck}.trig")
        with open(src, encoding="utf-8") as f, open(dst, "w", encoding="utf-8") as g:
            for line in f:
                if "checkInconsistencies" in line or "closedFor" in line:
                    continue
                g.write(line)
        subprocess.run(["timeout", "900", "java", "-Xmx4g", "-cp", cp, "dectective.Runner", "--data", dst, "--query", q, "--config", "dec",
                        "--warmup", "0", "--reps", "1", "--dump", os.path.join(out, f"snapshot_{ck}.dump.txt"),
                        "--out", os.path.join(out, f"snapshot_{ck}.json")], check=True, capture_output=True)
        r = json.load(open(os.path.join(out, f"snapshot_{ck}.json")))
        print(f"snapshot {ck}: worlds", r["accounting"]["n_worlds"], "materialised", r["accounting"]["materialised_total"],
              "ms", round(r["runs"][0]["materialise_total_ms"]))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
