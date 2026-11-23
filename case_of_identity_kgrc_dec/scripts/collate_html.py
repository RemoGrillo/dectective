#!/usr/bin/env python3
"""Collate the normalised PDF witness with the HTML variant of the same site.

The HTML is used only as a control (the PDF is the chosen witness). Units are aligned 1:1 in
order (HTML <p> and <div class="letter-block">, minus the trailing disclaimer); each pair is
compared at word level with difflib. Output: data/text/collation_pdf_html.md and .json
Usage: python -I scripts/collate_html.py <project_root>
"""
import difflib
import html as htmlmod
import json
import os
import re
import sys
import unicodedata


def words(s):
    return re.findall(r"\S+", s)


def main(root):
    t = open(os.path.join(root, "sources/text/iden.html"), encoding="utf-8").read()
    units = re.findall(r'(?s)<(p|div class="letter-block")[^>]*>(.*?)</(?:p|div)>', t)
    units = [(k, unicodedata.normalize("NFC", re.sub(r"\s+", " ", htmlmod.unescape(re.sub(r"<[^>]+>", "", x))).strip()))
             for k, x in units]
    units = [u for u in units if u[1]]
    disclaimer = [u for u in units if u[1].startswith(("This text is provided", "This text was formatted", "This text comes from"))]
    story = [u for u in units if u not in disclaimer]
    paras = [json.loads(l) for l in open(os.path.join(root, "data/text/paragraphs.jsonl"), encoding="utf-8")]
    report = {"html_units_total": len(units), "html_disclaimer_units": len(disclaimer), "html_story_units": len(story),
              "pdf_paragraphs": len(paras), "pairs": []}
    ndiff_pairs = 0
    for i, (p, (kind, h)) in enumerate(zip(paras, story), 1):
        a, b = words(p["text"]), words(h)
        sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
        ops = [(tag, " ".join(a[i1:i2]), " ".join(b[j1:j2])) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != "equal"]
        kind_ok = (p["kind"] == "letter") == (kind != "p")
        if ops or not kind_ok:
            ndiff_pairs += 1
            report["pairs"].append({"unit": i, "pdf_page": p["pdf_page_start"], "kind_pdf": p["kind"], "kind_html": kind,
                                    "ratio": round(sm.ratio(), 4), "ops": ops})
    report["units_with_differences"] = ndiff_pairs
    with open(os.path.join(root, "data/text/collation_pdf_html.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    md = ["# Collazione PDF (testimone) vs HTML (controllo)", "",
          f"- Unità HTML non vuote: {len(units)} (di cui disclaimer finale: {len(disclaimer)}; unità narrative: {len(story)})",
          f"- Paragrafi PDF normalizzati: {len(paras)}",
          f"- Coppie con differenze a livello di parola o di tipo di unità: {ndiff_pairs}", "",
          "Allineamento 1:1 per ordine; confronto per token separati da spazi (difflib, autojunk=False).", ""]
    for pr in report["pairs"]:
        md.append(f"## Unità {pr['unit']} (PDF p. {pr['pdf_page']}, tipo PDF {pr['kind_pdf']}, HTML {pr['kind_html']}, ratio {pr['ratio']})")
        for tag, x, y in pr["ops"]:
            md.append(f"- {tag}: PDF `{x}` → HTML `{y}`")
        md.append("")
    with open(os.path.join(root, "data/text/collation_pdf_html.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "pairs"}))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
