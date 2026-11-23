#!/usr/bin/env bash
# Recreate vendor/ (not versioned): third-party repos at the pinned commits and Maven 3.9.9.
# Usage (from the project root): bash scripts/setup_vendor.sh [vendor_dir]
# Idempotent: existing pieces are left alone. Pins match sources/manifest.json.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V="${1:-$ROOT/vendor}"
mkdir -p "$V" "$V/m2"

DEC_URL="https://github.com/fvitali/dec-reasoner.git"
DEC_COMMIT="e6775b39e22893176c45e3a161e49a7d2c718fb2"
KGRC_URL="https://github.com/KnowledgeGraphJapan/KGRC-RDF.git"
KGRC_COMMIT="d62328bd166d8b1eafde529a61ee025775ce9a64"
MVN_VER="3.9.9"
MVN_TGZ="apache-maven-$MVN_VER-bin.tar.gz"
MVN_URL="https://archive.apache.org/dist/maven/maven-3/$MVN_VER/binaries/$MVN_TGZ"

if [ ! -d "$V/dec-reasoner/.git" ]; then
  echo "== dec-reasoner @ ${DEC_COMMIT:0:8}"
  git clone -q "$DEC_URL" "$V/dec-reasoner"
  git -C "$V/dec-reasoner" -c advice.detachedHead=false checkout -q "$DEC_COMMIT"
fi

if [ ! -d "$V/KGRC-RDF/.git" ]; then
  echo "== KGRC-RDF @ ${KGRC_COMMIT:0:8} (partial + sparse: 2023ikgrc)"
  git clone -q --filter=blob:none --no-checkout "$KGRC_URL" "$V/KGRC-RDF"
  git -C "$V/KGRC-RDF" sparse-checkout set 2023ikgrc
  git -C "$V/KGRC-RDF" -c advice.detachedHead=false checkout -q "$KGRC_COMMIT"
fi

if [ ! -x "$V/maven/bin/mvn" ]; then
  echo "== Maven $MVN_VER (SHA-512 verified)"
  [ -f "$V/$MVN_TGZ" ] || curl -fsSL -o "$V/$MVN_TGZ" "$MVN_URL"
  [ -f "$V/$MVN_TGZ.sha512" ] || curl -fsSL -o "$V/$MVN_TGZ.sha512" "$MVN_URL.sha512"
  (cd "$V" && echo "$(cut -d' ' -f1 "$MVN_TGZ.sha512")  $MVN_TGZ" | sha512sum -c --quiet)
  mkdir -p "$V/maven"
  tar -xzf "$V/$MVN_TGZ" -C "$V/maven" --strip-components=1
fi

echo "vendor ready: $V"
