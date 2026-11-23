#!/usr/bin/env python3
"""Add git pins, licence notes and tool versions to sources/manifest.json (idempotent).
Licence notes report only what was actually found in the acquired files; a public web page alone
is not taken as a redistribution licence.
Usage: python -I scripts/record_provenance.py <project_root>
"""
import hashlib
import json
import os
import subprocess
import sys


def sh(cmd, cwd=None):
    try:
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()
    except Exception as e:  # recorded, not hidden
        return f"ERROR: {e}"


def main(root):
    mpath = os.path.join(root, "sources/manifest.json")
    m = json.load(open(mpath, encoding="utf-8"))
    kg = os.path.join(root, "vendor/KGRC-RDF")
    dr = os.path.join(root, "vendor/dec-reasoner")
    m["git"] = {
        "KGRC-RDF": {
            "url": "https://github.com/KnowledgeGraphJapan/KGRC-RDF.git", "clone": "partial (--filter=blob:none) + sparse (2023ikgrc)",
            "branch": "master", "head": sh(["git", "rev-parse", "HEAD"], kg),
            "last_commit_touching_2023ikgrc/ACaseOfIdentity.ttl": sh(["git", "log", "-1", "--format=%H %cI %s", "--", "2023ikgrc/ACaseOfIdentity.ttl"], kg),
            "blob_master_2023ikgrc": sh(["git", "rev-parse", "HEAD:2023ikgrc/ACaseOfIdentity.ttl"], kg),
            "blob_branch_ikgrc2023_root": sh(["git", "rev-parse", "origin/ikgrc2023:ACaseOfIdentity.ttl"], kg),
            "note": "raw downloads in sources/kgrc are byte-identical (SHA-256) to the clone at this HEAD; master is mutable, the commit pins the version",
        },
        "dec-reasoner": {
            "url": "https://github.com/fvitali/dec-reasoner.git", "branch": "main", "head": sh(["git", "rev-parse", "HEAD"], dr),
            "head_date_subject": sh(["git", "log", "-1", "--format=%cI %s"], dr),
            "working_tree_changes_after_build": sh(["git", "status", "--short"], dr),
            "note": "the Maven antrun plugin rewrites .build/build-info.properties (build counter) at every build; source code untouched",
        },
    }
    m["licences"] = {
        "text": {"files": ["text/iden.pdf", "text/iden.html"],
                 "found": "PDF/HTML disclaimer: provided 'as-is', 'formatted from various free ASCII and HTML variants', collection version 3.1; colophon: files built 'from the now copyright-free texts' (sources/text/sherlock-holm.es_colophon.html).",
                 "assessment": "Doyle's text of 'A Case of Identity' (1891) is out of copyright in most jurisdictions; no explicit licence is stated for the site's typeset files. Redistribution of the PDF itself is not authorised by an explicit licence: keep it as a local source and cite the URL."},
        "graph": {"files": ["kgrc/ACaseOfIdentity.ttl", "kgrc/kgc.owl", "kgrc/kgc.owl.root"],
                  "found": "CC BY 4.0: 2023ikgrc/README.md, 2023ikgrc/LICENSE (legal code), triples cc:license <https://creativecommons.org/licenses/by/4.0/> and cc:attributionName 'SIG-SWO, JSAI' in the TTL.",
                  "assessment": "Reuse and derivatives allowed with attribution (SIG-SWO, JSAI)."},
        "code": {"repo": "fvitali/dec-reasoner", "found": "MIT License (LICENSE file, GitHub API)."},
        "dec_paper": {"file": "papers/arxiv_2606.15246v1.pdf", "found": "arXiv preprint v1 (13 Jun 2026); the stored abstract page (papers/arxiv_2606.15246_abs.html) links the article to CC BY 4.0 (licenses/by/4.0, 'Rights to this article')."},
        "kgrc_paper": {"file": "papers/ESWC_2023_SEMMES_Mystery.pdf", "found": "CEUR-WS Vol-3443, '© 2023 Copyright for this paper by its authors. Use permitted under Creative Commons License Attribution 4.0 International (CC BY 4.0)' (page 1)."},
        "ontologies": {"files": ["ontologies/*"], "found": "CIDOC CRM 7.1.3 and CRMinf 1.2.1 official HTML/RDFS/OWL from cidoc-crm.org; no licence statement checked in the acquired files beyond the site; used for reference and extraction of a minimal module."},
    }
    def ver(cmd):
        out = sh(cmd)
        return out.splitlines()[0] if out else out
    m["tools"] = {
        "python": sys.version.split()[0],
        "requirements": "scripts/requirements.txt (pip freeze of .venv)",
        "poppler_pdftotext": ver(["sh", "-c", "pdftotext -v 2>&1 | head -1"]),
        "java": ver(["sh", "-c", "java -version 2>&1 | head -1"]),
        "maven": ver([os.path.join(root, "vendor/maven/bin/mvn"), "-v"]),
        "jena": "4.8.0 (Maven, vendor/m2) — DEC pom and runner pom",
        "maven_sha512_verified": "apache-maven-3.9.9-bin.tar.gz verified against the official .sha512",
    }
    json.dump(m, open(mpath, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(json.dumps({k: m[k] for k in ("git", "tools")}, indent=1)[:2500])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
