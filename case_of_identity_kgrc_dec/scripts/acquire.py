#!/usr/bin/env python3
"""Acquire all public sources for the audit and record provenance.

For every source: requested URL, effective URL (after redirects), HTTP status,
content-type, Last-Modified, access timestamp (UTC), size and SHA-256.
Files are written once into sources/ and made read-only. Re-running the script
never overwrites an existing file: it re-downloads to memory, compares the
checksum and reports drift instead.

Usage: python -I scripts/acquire.py <project_root>
"""
import datetime as dt
import hashlib
import json
import os
import stat
import sys
import urllib.request

UA = "research-audit-script/1.0 (reproducible source acquisition)"

SOURCES = [
    # --- text (chosen witness: PDF; HTML only for collation) ---
    ("text/iden.pdf", "https://sherlock-holm.es/stories/pdf/letter/2-sided/iden.pdf", "pdf", "story_witness"),
    ("text/iden.html", "https://sherlock-holm.es/stories/html/iden.html", "html", "story_collation"),
    ("text/sherlock-holm.es_colophon.html", "https://sherlock-holm.es/colophon/", "html", "story_site_notes"),
    # --- KGRC (raw; commit pinned separately via git clone) ---
    ("kgrc/ACaseOfIdentity.ttl", "https://raw.githubusercontent.com/KnowledgeGraphJapan/KGRC-RDF/master/2023ikgrc/ACaseOfIdentity.ttl", "text", "kgrc_graph"),
    ("kgrc/kgc.owl", "https://raw.githubusercontent.com/KnowledgeGraphJapan/KGRC-RDF/master/2023ikgrc/kgc.owl", "text", "kgrc_schema_2023"),
    ("kgrc/kgc.owl.root", "https://raw.githubusercontent.com/KnowledgeGraphJapan/KGRC-RDF/master/kgc.owl", "text", "kgrc_schema_root"),
    ("kgrc/README_2023ikgrc.md", "https://raw.githubusercontent.com/KnowledgeGraphJapan/KGRC-RDF/master/2023ikgrc/README.md", "text", "kgrc_doc"),
    ("kgrc/SampleSPARQL.md", "https://raw.githubusercontent.com/KnowledgeGraphJapan/KGRC-RDF/master/2023ikgrc/SampleSPARQL.md", "text", "kgrc_doc"),
    ("kgrc/LICENSE_2023ikgrc", "https://raw.githubusercontent.com/KnowledgeGraphJapan/KGRC-RDF/master/2023ikgrc/LICENSE", "text", "kgrc_license"),
    ("kgrc/README_root.md", "https://raw.githubusercontent.com/KnowledgeGraphJapan/KGRC-RDF/master/README.md", "text", "kgrc_doc"),
    # --- papers ---
    ("papers/arxiv_2606.15246v1.pdf", "https://arxiv.org/pdf/2606.15246v1", "pdf", "dec_paper"),
    ("papers/arxiv_2606.15246_abs.html", "https://arxiv.org/abs/2606.15246", "html", "dec_paper_metadata"),
    ("papers/ESWC_2023_SEMMES_Mystery.pdf", "https://ceur-ws.org/Vol-3443/ESWC_2023_SEMMES_Mystery.pdf", "pdf", "kgrc_paper"),
    # --- ontologies ---
    ("ontologies/cidoc_crm_v7.1.3.html", "https://cidoc-crm.org/html/cidoc_crm_v7.1.3.html", "html", "crm_spec"),
    ("ontologies/CIDOC_CRM_v7.1.3.rdf", "https://cidoc-crm.org/rdfs/7.1.3/CIDOC_CRM_v7.1.3.rdfs", "xml", "crm_rdfs"),
    ("ontologies/CRMinf_v1.2.1.html", "https://cidoc-crm.org/extensions/crminf/html/CRMinf_v1.2.1.html", "html", "crminf_spec"),
    ("ontologies/CRMinf_v1.2.1.rdf", "https://cidoc-crm.org/extensions/crminf/rdfs/1.2.1/CRMinf_v1.2.1.rdf", "xml", "crminf_rdfs"),
    ("ontologies/CRMinf_v1.2.1.owl", "https://cidoc-crm.org/extensions/crminf/owl/1.2.1/CRMinf_v1.2.1.owl", "xml", "crminf_owl"),
    ("ontologies/crminf_releases.html", "https://cidoc-crm.org/crminf/fm_releases", "html", "crminf_release_page"),
    ("ontologies/crminf_version_1.2.1.html", "https://cidoc-crm.org/crminf/ModelVersion/crminf-1.2.1", "html", "crminf_version_page"),
]

MAGIC = {"pdf": b"%PDF-", "xml": b"<?xml", "html": None, "text": None}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
        return body, r.geturl(), r.status, r.headers.get("Content-Type"), r.headers.get("Last-Modified")


def main(root):
    src_dir = os.path.join(root, "sources")
    manifest_path = os.path.join(src_dir, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
    entries = {e["path"]: e for e in manifest.get("files", [])}
    for rel, url, kind, role in SOURCES:
        path = os.path.join(src_dir, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        try:
            body, eff, status, ctype, lastmod = fetch(url)
        except Exception as exc:  # record failure precisely, continue with the rest
            entries[rel] = {"path": rel, "requested_url": url, "role": role, "error": repr(exc),
                            "accessed_utc": dt.datetime.now(dt.timezone.utc).isoformat()}
            print("FAIL", rel, exc)
            continue
        sha = hashlib.sha256(body).hexdigest()
        magic = MAGIC.get(kind)
        magic_ok = body.lstrip(b"\xef\xbb\xbf").lstrip()[: len(magic)] == magic if magic else None
        if kind == "html":
            magic_ok = b"<html" in body[:2000].lower() or b"<!doctype html" in body[:2000].lower()
        if os.path.exists(path):
            with open(path, "rb") as f:
                old = hashlib.sha256(f.read()).hexdigest()
            print(("SAME " if old == sha else "DRIFT"), rel, sha[:12], "(existing file kept)")
            if old != sha:
                entries[rel]["drift_observed"] = {"sha256": sha, "accessed_utc": dt.datetime.now(dt.timezone.utc).isoformat()}
            continue
        with open(path, "wb") as f:
            f.write(body)
        os.chmod(path, stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
        entries[rel] = {
            "path": rel, "role": role, "requested_url": url, "effective_url": eff, "http_status": status,
            "content_type": ctype, "last_modified": lastmod,
            "accessed_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "size_bytes": len(body), "sha256": sha, "magic_check": magic_ok,
        }
        print("OK   ", rel, len(body), sha[:12], "magic" if magic_ok else "NO-MAGIC" if magic_ok is False else "")
    manifest["files"] = sorted(entries.values(), key=lambda e: e["path"])
    manifest.setdefault("generated_by", "scripts/acquire.py")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
