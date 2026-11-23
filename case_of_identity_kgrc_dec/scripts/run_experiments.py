#!/usr/bin/env python3
"""Orchestrate slices, runs and checks for every fixture query.

Per query (.rq):
  1. slice_for_query.py -> prototype/fixtures/<T>/slices/<qid>.trig (+ .report.json)
  2. Runner on the slice for configs asserted, flat, ctx, dec:
       warm : one JVM, --warmup W --reps R          -> prototype/results/metrics/<qid>/<cfg>.json
       cold : C separate JVMs, --warmup 0 --reps 1   -> <cfg>.cold<i>.json
  3. DEC instrumented run (phase breakdown) + plain run, both dumped; SHA-256 of the sorted
     materialisation must be identical                -> <qid>/dec.instrumented.json
  4. answer preservation: ctx on the FULL dataset vs ctx on the slice (rows must be identical);
     DEC on the full dataset only with --full-dec (expensive: minutes per dataset)
Per dataset (gold, C1..C4), with --full-dataset-timing: one DEC run on the full dataset (slicing effect).
Every JVM runs with -Xmx<heap> under `timeout`; runs are sequential (never parallel).
Usage: python -I scripts/run_experiments.py <root> [--reps 10] [--warmup 1] [--cold 3] [--only T05]
                                             [--full-dec] [--full-dataset-timing] [--heap 4g] [--timeout 600]
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import time

CONFIGS = ["asserted", "flat", "ctx", "dec"]


def java(root, heap, timeout, args):
    cp = os.path.join(root, "prototype/runner/target/dec-metrics-runner-0.1.0.jar") + ":" + os.path.join(root, "prototype/runner/target/lib/*")
    cmd = ["timeout", str(timeout), "java", f"-Xmx{heap}", "-cp", cp, "dectective.Runner"] + args
    t0 = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, time.time() - t0, p.stderr[-1500:]


def rows_of(path):
    try:
        r = json.load(open(path, encoding="utf-8"))["query_result"]
        return r.get("ask") if r["type"] == "ASK" else sorted(r["rows"])
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--reps", type=int, default=10)
    ap.add_argument("--warmup", type=int, default=1)
    ap.add_argument("--cold", type=int, default=3)
    ap.add_argument("--only", default="")
    ap.add_argument("--k", type=int, default=2)
    ap.add_argument("--heap", default="4g")
    ap.add_argument("--timeout", type=int, default=600)
    ap.add_argument("--full-dec", action="store_true")
    ap.add_argument("--full-dataset-timing", action="store_true")
    ap.add_argument("--schema", default="minimal")
    a = ap.parse_args()
    root = a.root
    res_dir = os.path.join(root, "prototype/results")
    log = []
    fixtures = sorted(glob.glob(os.path.join(root, "prototype/fixtures/T*/manifest.json")))
    for mpath in fixtures:
        tdir = os.path.dirname(mpath)
        tid = os.path.basename(tdir)
        if a.only and not tid.startswith(a.only):
            continue
        man = json.load(open(mpath, encoding="utf-8"))
        ds = man["dataset"]
        full = os.path.join(root, "prototype/gold/gold_retrospective.trig" if ds == "gold" else f"prototype/sim/{ds}.trig")
        os.makedirs(os.path.join(tdir, "slices"), exist_ok=True)
        for q in man["queries"]:
            qid, qf = q["id"], os.path.join(tdir, q["file"])
            mdir = os.path.join(res_dir, "metrics", qid)
            os.makedirs(mdir, exist_ok=True)
            sl, rep = os.path.join(tdir, "slices", qid + ".trig"), os.path.join(tdir, "slices", qid + ".report.json")
            p = subprocess.run([sys.executable, "-I", os.path.join(root, "scripts/slice_for_query.py"), root, "--dataset", ds,
                                "--query", qf, "--manifest", mpath, "--out", sl, "--report", rep, "--k", str(a.k), "--schema", a.schema],
                               capture_output=True, text=True)
            entry = {"test": tid, "query": qid, "dataset": ds, "slice_rc": p.returncode, "slice_msg": (p.stdout + p.stderr).strip()[-300:]}
            print(f"[{tid}] {qid}: {entry['slice_msg']}", flush=True)
            if p.returncode != 0:
                log.append(entry)
                continue
            for cfg in CONFIGS:
                rc, dt, err = java(root, a.heap, a.timeout, ["--data", sl, "--query", qf, "--config", cfg, "--warmup", str(a.warmup),
                                                             "--reps", str(a.reps), "--out", os.path.join(mdir, f"{cfg}.json")])
                entry[f"{cfg}_warm_rc"], entry[f"{cfg}_warm_wall_s"] = rc, round(dt, 2)
                if rc != 0:
                    entry[f"{cfg}_warm_err"] = err
                for i in range(a.cold):
                    rc, dt, err = java(root, a.heap, a.timeout, ["--data", sl, "--query", qf, "--config", cfg, "--warmup", "0",
                                                                 "--reps", "1", "--out", os.path.join(mdir, f"{cfg}.cold{i}.json")])
                    entry.setdefault(f"{cfg}_cold_rc", []).append(rc)
                print(f"    {cfg}: warm rc={entry[f'{cfg}_warm_rc']} {entry[f'{cfg}_warm_wall_s']}s", flush=True)
            # instrumented vs plain DEC (same materialisation?)
            rc1, _, _ = java(root, a.heap, a.timeout, ["--data", sl, "--query", qf, "--config", "dec", "--warmup", "0", "--reps", "1",
                                                       "--dump", os.path.join(mdir, "dec.plain.dump.txt"), "--out", os.path.join(mdir, "dec.plain.json")])
            rc2, _, _ = java(root, a.heap, a.timeout, ["--data", sl, "--query", qf, "--config", "dec", "--warmup", "0", "--reps", "1", "--instrument",
                                                       "--dump", os.path.join(mdir, "dec.instrumented.dump.txt"), "--out", os.path.join(mdir, "dec.instrumented.json")])
            if rc1 == 0 and rc2 == 0:
                h1 = json.load(open(os.path.join(mdir, "dec.plain.json")))["materialised_sha256"]
                h2 = json.load(open(os.path.join(mdir, "dec.instrumented.json")))["materialised_sha256"]
                entry["instrumented_equivalent"] = h1 == h2
            # answer preservation (ctx full vs slice)
            rcf, dtf, _ = java(root, a.heap, a.timeout, ["--data", full, "--query", qf, "--config", "ctx", "--warmup", "0", "--reps", "1",
                                                         "--out", os.path.join(mdir, "ctx.full.json")])
            entry["preserved_ctx"] = (rows_of(os.path.join(mdir, "ctx.full.json")) == rows_of(os.path.join(mdir, "ctx.json"))) if rcf == 0 else None
            if a.full_dec:
                rcd, dtd, errd = java(root, a.heap, a.timeout, ["--data", full, "--query", qf, "--config", "dec", "--warmup", "0", "--reps", "1",
                                                                "--out", os.path.join(mdir, "dec.full.json")])
                entry["dec_full_rc"], entry["dec_full_wall_s"] = rcd, round(dtd, 1)
                entry["preserved_dec"] = (rows_of(os.path.join(mdir, "dec.full.json")) == rows_of(os.path.join(mdir, "dec.json"))) if rcd == 0 else None
            print(f"    instrumented_equivalent={entry.get('instrumented_equivalent')} preserved_ctx={entry.get('preserved_ctx')} preserved_dec={entry.get('preserved_dec')}", flush=True)
            log.append(entry)
    if a.full_dataset_timing:
        q = os.path.join(root, "prototype/exploratory/probe.rq")
        for ds in ["gold", "C1", "C2", "C3", "C4"]:
            full = os.path.join(root, "prototype/gold/gold_retrospective.trig" if ds == "gold" else f"prototype/sim/{ds}.trig")
            out = os.path.join(res_dir, "metrics", f"_full_{ds}")
            os.makedirs(out, exist_ok=True)
            for cfg in ["dec", "ctx", "flat"]:
                rc, dt, err = java(root, a.heap, a.timeout, ["--data", full, "--query", q, "--config", cfg, "--warmup", "0", "--reps", "1",
                                                             "--out", os.path.join(out, f"{cfg}.json")])
                log.append({"full_dataset": ds, "config": cfg, "rc": rc, "wall_s": round(dt, 1), "err": err if rc else ""})
                print(f"[full {ds}] {cfg}: rc={rc} {dt:.1f}s", flush=True)
    name = "run_log" + ("_" + a.only if a.only else "") + ".json"
    with open(os.path.join(res_dir, name), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
