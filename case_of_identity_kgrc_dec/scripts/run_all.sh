#!/usr/bin/env bash
# Reproduce the whole audit from sources/ (run from the project root: bash scripts/run_all.sh).
# Network is needed only for step 0 (acquisition; existing files are never overwritten, drift is reported)
# and for the first Maven build (dependencies into vendor/m2). No sudo, nothing installed system-wide.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY=".venv/bin/python -I"
MVN="vendor/maven/bin/mvn -B -q -Dmaven.repo.local=$ROOT/vendor/m2"

# Environment
[ -x .venv/bin/python ] || { python3 -m venv .venv && .venv/bin/python -m pip install -q -r scripts/requirements.txt; }
[ -d vendor/dec-reasoner/.git ] || bash scripts/setup_vendor.sh   # vendor/ is not versioned

echo "== 0. sources (idempotent; checksum drift reported)"
$PY scripts/acquire.py .
$PY scripts/record_provenance.py . > /dev/null

echo "== 1. text: extraction, normalisation, segmentation, collation"
$PY scripts/extract_text.py .
$PY scripts/normalize.py .
$PY scripts/segment.py .
$PY scripts/collate_html.py .

echo "== 2. graph audit, KGRC baseline, alignment"
$PY scripts/graph_audit.py . > /dev/null
$PY scripts/kgrc_baseline.py .
$PY scripts/align_candidates.py .
$PY scripts/build_alignment.py . > /dev/null

echo "== 3. DEC reasoner and measurement runner (Java 17+, Jena 4.8.0)"
[ -f vendor/dec-reasoner/target/dec-1.0.0.jar ] || (cd vendor/dec-reasoner && $MVN clean install -DskipTests)
(cd vendor/dec-reasoner && $MVN test) > prototype/results/logs/dec_mvn_test.log 2>&1 || echo "DEC unit tests: see log"
(cd prototype/runner && $MVN package -DskipTests)

echo "== 4. exploratory DEC behaviour tests"
$PY scripts/run_exploratory.py . > /dev/null

echo "== 5. prototype modules, gold, checkpoints, fixtures, leakage checks"
$PY scripts/build_prototype.py .
$PY scripts/build_fixtures.py .
$PY scripts/check_leakage.py .

echo "== 6. experiments (slices per .rq, 4 configurations, metrics) and sensitivity series"
$PY scripts/run_experiments.py . --reps 10 --warmup 1 --cold 3 --heap 4g --timeout 1200 --full-dataset-timing
$PY scripts/sensitivity.py . --reps 3 --timeout 900
$PY scripts/aggregate_metrics.py .

echo "== 7. citation check"
$PY scripts/verify_citations.py .
echo "done"
