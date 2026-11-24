#!/usr/bin/env python3
"""Complementary DEC runs for the digital edition.

1. complement-gold: the gold worlds that no test slice materialised: holmes_mother (W03), holmes_motive (W04),
   v_windibank_delighted (W11), v_windibank_machine (W12), holmes_same_machine (W13), h_author_other (W14),
   v_windibank_denial (W15, added 2026-11-23 after the audit runs). Conjectural worlds receive reality, so the
   reconstruction (W02, epistemic) and the core facts are included too. No dec:checkInconsistencies, no dec:closedFor:
   this run only materialises permeation + local inference.
2. check-denial: DEC's own conflict check on Windibank's denial to Holmes (W15, P119), with his beliefs (W06), the
   reconstruction (W02) and, as controls, his other two statements to Holmes (W11, W12). dec:checkInconsistencies,
   no dec:closedFor (so the verdict does not depend on the closedFor defect). Not part of the audit suite (T01-T10).
3. complement-C1..C4: one materialisation per reader checkpoint (whole C_k without the conflict-check flags).
Reuses scripts/slice_for_query.py and the measurement runner; nothing else is recomputed.
Output: prototype/results/edition_complement/{manifest.json, slice.trig, slice.report.json, dec.json, dec.dump.txt,
        check_denial.*, snapshot_C*.*}
Usage: python -I scripts/run_edition_complement.py <project_root>
"""
import json
import os
import subprocess
import sys

MODULES = ["W03_holmes_mother", "W04_holmes_motive", "W11_v_windibank_delighted", "W12_v_windibank_machine",
           "W13_holmes_same_machine", "W14_h_author_other", "W02_holmes_reconstruction",
           "F01_persons", "F02_occupation", "F03_courtship", "F04_documents", "F05_windibank_visit", "F07_comm_acts_visit",
           "W15_v_windibank_denial", "F10_comm_act_denial"]
CHECK_DENIAL = ["W15_v_windibank_denial", "F10_comm_act_denial", "W06_windibank_beliefs", "W02_holmes_reconstruction",
                "W11_v_windibank_delighted", "W12_v_windibank_machine", "F07_comm_acts_visit", "F01_persons"]


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
    # DEC's own conflict check on the denial (checkInconsistencies, no closedFor)
    man = {"dataset": "gold", "question": "Does DEC flag Windibank's denial to Holmes (P119) against his own beliefs and Reality?",
           "seed_iris": [], "require_modules": CHECK_DENIAL, "dec_flags": ["checkInconsistencies"], "closed_for": []}
    mpath = os.path.join(out, "check_denial.manifest.json")
    json.dump(man, open(mpath, "w"), indent=2)
    sl, rep = os.path.join(out, "check_denial.slice.trig"), os.path.join(out, "check_denial.slice.report.json")
    subprocess.run([sys.executable, "-I", os.path.join(root, "scripts/slice_for_query.py"), root, "--dataset", "gold", "--query", q,
                    "--manifest", mpath, "--out", sl, "--report", rep], check=True)
    subprocess.run(["timeout", "900", "java", "-Xmx4g", "-cp", cp, "dectective.Runner", "--data", sl, "--query", q, "--config", "dec",
                    "--warmup", "0", "--reps", "1", "--dump", os.path.join(out, "check_denial.dump.txt"), "--out", os.path.join(out, "check_denial.json")],
                   check=True, capture_output=True)
    r = json.load(open(os.path.join(out, "check_denial.json")))
    diags = [d for d in r["accounting"]["dec_diagnostics"] if "disagreesWith" in d or "delusionalWorld" in d]
    print("check-denial: worlds", r["accounting"]["n_worlds"], "materialised", r["accounting"]["materialised_total"],
          "ms", round(r["runs"][0]["materialise_total_ms"]), "diagnostics", len(diags))
    for d in diags:
        print("   ", d.replace("http://example.org/dectective/world/", "w:").replace("http://w3id.org/conjectures/", "dec:"))
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
