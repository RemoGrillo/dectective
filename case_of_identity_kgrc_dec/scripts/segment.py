#!/usr/bin/env python3
"""Segment data/text/normalized.txt into paragraphs and sentences with stable IDs.

IDs: paragraphs P001..P138 in reading order; sentences P001.S01.. within a paragraph.
Offsets: Unicode code points, 0-based, end-exclusive, on data/text/normalized.txt (UTF-8).
Pages: PDF page (1-10, story on 3-10) and printed page (1-8) of the first/last line.
Word count method: regex WORD below on the normalised body (front matter excluded).
Sentence split: rule-based (terminal . ! ? optionally followed by closing quotes/dash, then
whitespace and an opening quote or capital letter), with an abbreviation guard list.
Output: data/text/segments.csv, data/text/sentences.csv, data/text/text_stats.json
Usage: python -I scripts/segment.py <project_root>
"""
import csv
import json
import os
import re
import sys

WORD = re.compile(r"[A-Za-zÀ-ÿ0-9½]+(?:[’'\-][A-Za-zÀ-ÿ0-9]+)*")
ABBREV = ("Mr.", "Mrs.", "Dr.", "St.", "ft.", "in.", "Messrs.", "Co.", "i.e.", "e.g.", "No.")
SENT_END = re.compile(r"([.!?]+[”’]*|—[”’]+)(\s+)(?=[“‘(]?[A-Z0-9])")


def split_sentences(text):
    out, start = [], 0
    for m in SENT_END.finditer(text):
        end = m.end(1)
        chunk = text[start:end]
        last = chunk.split()[-1].lstrip("“‘(") if chunk.split() else ""
        if last in ABBREV:          # whole-token match (e.g. "Mr." but not "again.")
            continue
        out.append((start, end))
        start = m.end(2)
    if start < len(text):
        out.append((start, len(text)))
    return out


def main(root):
    d = os.path.join(root, "data/text")
    norm = open(os.path.join(d, "normalized.txt"), encoding="utf-8").read()
    paras = [json.loads(l) for l in open(os.path.join(d, "paragraphs.jsonl"), encoding="utf-8")]
    seg_rows, sent_rows = [], []
    pos = 0
    for i, p in enumerate(paras, 1):
        pid = f"P{i:03d}"
        start = norm.index(p["text"], pos)
        end = start + len(p["text"])
        assert norm[start:end] == p["text"]
        pos = end
        nw = len(WORD.findall(p["text"]))
        seg_rows.append({"para_id": pid, "start": start, "end": end, "kind": p["kind"],
                         "pdf_page_start": p["pdf_page_start"], "pdf_page_end": p["pdf_page_end"],
                         "printed_page_start": p["printed_page_start"], "printed_page_end": p["printed_page_end"],
                         "n_words": nw, "text": p["text"]})
        for j, (a, b) in enumerate(split_sentences(p["text"]), 1):
            st = p["text"][a:b]
            sent_rows.append({"sent_id": f"{pid}.S{j:02d}", "para_id": pid, "start": start + a, "end": start + b,
                              "n_words": len(WORD.findall(st)), "text": st})
    for name, rows in (("segments.csv", seg_rows), ("sentences.csv", sent_rows)):
        with open(os.path.join(d, name), "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    for s in sent_rows:
        assert norm[s["start"]:s["end"]] == s["text"]
    stats = {"paragraphs": len(seg_rows), "sentences": len(sent_rows),
             "words_body": sum(r["n_words"] for r in seg_rows),
             "word_method": "regex " + WORD.pattern + " over normalised paragraphs (front matter excluded)",
             "offset_base": "Unicode code points, 0-based, end-exclusive, data/text/normalized.txt",
             "first_words": seg_rows[0]["text"][:60], "last_words": seg_rows[-1]["text"][-80:],
             "characters_normalized": len(norm)}
    with open(os.path.join(d, "text_stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    print(json.dumps(stats, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
