#!/usr/bin/env python3
"""Raw text extraction from the chosen witness (sources/text/iden.pdf).

Outputs (data/text/):
  raw_pdftotext_layout.txt  poppler `pdftotext -layout` (pages separated by \f); kept only as a
                            comparison witness: in this 2-column layout it interleaves columns.
  raw_pdftotext.txt         poppler `pdftotext` default reading order (pages separated by \f).
  raw_lines.jsonl           PyMuPDF line records in column reading order, one per line:
                            {pdf_page, printed_page, column, line_no, x0, y0, x1, size, text, role}
                            role in {front_matter, body, page_number, drop_cap}
  raw_pages/page_NN.txt     column-ordered raw lines per PDF page (no normalisation at all)

No character is altered here (no dehyphenation, no ligature folding): that is normalise.py.
Usage: python -I scripts/extract_text.py <project_root>
"""
import json
import os
import subprocess
import sys

import pymupdf

# Column split is computed per page: the PDF is "2-sided", so recto/verso margins are mirrored
# (odd PDF pages: columns at x0~44/299; even pages: x0~87/342).
FOOTER_Y = 700.0       # printed page numbers sit at y ~712


def main(root):
    pdf = os.path.join(root, "sources/text/iden.pdf")
    out = os.path.join(root, "data/text")
    os.makedirs(os.path.join(out, "raw_pages"), exist_ok=True)
    for args, name in ((["-layout"], "raw_pdftotext_layout.txt"), ([], "raw_pdftotext.txt")):
        txt = subprocess.run(["pdftotext", *args, pdf, "-"], capture_output=True, check=True, text=True).stdout
        with open(os.path.join(out, name), "w", encoding="utf-8") as f:
            f.write(txt)

    doc = pymupdf.open(pdf)
    records = []
    for pno in range(doc.page_count):
        page = doc[pno]
        seen = set()
        lines = []
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                text = "".join(s["text"] for s in l["spans"])
                if not text.strip():
                    continue
                x0, y0, x1, y1 = (round(v, 1) for v in l["bbox"])
                key = (x0, y0, text)
                if key in seen:          # PyMuPDF reports some lines twice (duplicated text objects)
                    continue
                seen.add(key)
                size = round(max(s["size"] for s in l["spans"]), 1)
                lines.append({"x0": x0, "y0": y0, "x1": x1, "size": size, "text": text})
        right_x = [round(l["x0"]) for l in lines if l["x0"] > 200]
        rx = max(set(right_x), key=right_x.count) if right_x else 10_000
        split = rx - 8.0
        if pno < 2:
            col_of = lambda l: 0
        else:
            col_of = lambda l, split=split: 1 if l["x0"] < split else 2
        printed = None
        for l in lines:
            if l["y0"] > FOOTER_Y and l["text"].strip().isdigit():
                printed = int(l["text"].strip())
        ordered = sorted(lines, key=lambda l: (col_of(l), l["y0"], l["x0"]))
        page_txt = []
        for i, l in enumerate(ordered, 1):
            if pno < 2:
                role = "front_matter"
            elif l["y0"] > FOOTER_Y and l["text"].strip().isdigit():
                role = "page_number"
            elif l["size"] > 20 and len(l["text"].strip()) == 1:
                role = "drop_cap"
            else:
                role = "front_matter" if (l["size"] <= 8.5) else "body"
            rec = {"pdf_page": pno + 1, "printed_page": printed, "column": col_of(l), "line_no": i, **l, "role": role}
            records.append(rec)
            page_txt.append(f'{rec["column"]}\t{role}\t{l["text"]}')
        with open(os.path.join(out, "raw_pages", f"page_{pno + 1:02d}.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(page_txt) + "\n")
    with open(os.path.join(out, "raw_lines.jsonl"), "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    roles = {}
    for r in records:
        roles[r["role"]] = roles.get(r["role"], 0) + 1
    print("lines:", len(records), roles, "pymupdf", pymupdf.VersionBind)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
