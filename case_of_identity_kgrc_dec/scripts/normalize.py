#!/usr/bin/env python3
"""Build normalised paragraphs from data/text/raw_lines.jsonl (PDF witness).

Transformations (each one logged in data/text/normalization_log.jsonl and summarised in
data/text/normalization_log.md):
  N1 front matter, title page, disclaimer and printed page numbers excluded from the body
  N2 drop cap: the scaled initial "M" (page 3) is prefixed to the first body line; the opening
     quotation mark omitted by drop-cap typography is restored (evidence: HTML witness)
  N3 justified-line fragments on the same baseline and column are merged in x order
  N4 paragraph boundaries from geometry: first-line indent (~15pt) or block indent (>=22pt);
     a column/page that starts without indent continues the previous paragraph
  N5 line-end hyphen: joined without hyphen unless the hyphenated form occurs in the HTML witness
     (decision and evidence logged per case); line-end em dash joined without space
  N6 typographic ligatures folded (U+FB00..U+FB04 -> ff, fi, fl, ffi, ffl); other characters kept
     (curly quotes, apostrophes, dashes) ; Unicode NFC
  N7 TeX-style accents: a spacing accent glyph followed by its base letter (e.g. "outr´e",
     "Voil`a") is composed into the precomposed letter (é, à); each case logged
  N8 stacked fraction extracted as "41/2" restored as "4½" (evidence: HTML witness)
Output: data/text/normalized.txt (paragraphs separated by one blank line),
        data/text/paragraphs.jsonl (text + page provenance + kind).
Usage: python -I scripts/normalize.py <project_root>
"""
import collections
import html as htmlmod
import json
import os
import re
import sys
import unicodedata

LIGS = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl"}


def html_words(root):
    t = open(os.path.join(root, "sources/text/iden.html"), encoding="utf-8").read()
    t = htmlmod.unescape(re.sub(r"<[^>]+>", " ", t))
    return collections.Counter(re.findall(r"[\w’'-]+", t))


def main(root):
    out = os.path.join(root, "data/text")
    recs = [json.loads(l) for l in open(os.path.join(out, "raw_lines.jsonl"), encoding="utf-8")]
    hw = html_words(root)
    log = []
    excluded = [r for r in recs if r["role"] in ("front_matter", "page_number")]
    for r in excluded:
        log.append({"rule": "N1", "pdf_page": r["pdf_page"], "text": r["text"], "action": "excluded:" + r["role"]})

    body = [r for r in recs if r["role"] == "body"]
    # drop cap detection: single capital letter with a tall bbox (scaled glyph)
    dropcaps = [r for r in body if len(r["text"].strip()) == 1 and r["text"].strip().isupper()
                and r["pdf_page"] == 3 and r["y0"] < 80]
    lines = []
    for page in sorted({r["pdf_page"] for r in body}):
        prs = [r for r in body if r["pdf_page"] == page and r not in dropcaps]
        printed = next((r["printed_page"] for r in recs if r["pdf_page"] == page), None)
        for col in (1, 2):
            cl = [r for r in prs if r["column"] == col]
            if not cl:
                continue
            base = collections.Counter(round(r["x0"]) for r in cl).most_common(1)[0][0]
            # N3 merge fragments sharing a baseline
            cl.sort(key=lambda r: (r["y0"], r["x0"]))
            merged = []
            for r in cl:
                if merged and abs(r["y0"] - merged[-1]["y0"]) < 2.0:
                    m = merged[-1]
                    log.append({"rule": "N3", "pdf_page": page, "text": m["text"] + " | " + r["text"], "action": "merged"})
                    m["text"] = m["text"].rstrip() + " " + r["text"].lstrip()
                    m["x1"] = max(m["x1"], r["x1"])
                else:
                    merged.append(dict(r))
            for i, r in enumerate(merged):
                lines.append({"pdf_page": page, "printed_page": printed, "column": col, "y0": r["y0"],
                              "indent": round(r["x0"] - base, 1), "x1": r["x1"], "text": r["text"],
                              "first_in_column": i == 0})
    # N2 drop cap
    if dropcaps:
        dc = dropcaps[0]["text"].strip()
        first = lines[0]
        new = "“" + dc + first["text"]
        log.append({"rule": "N2", "pdf_page": first["pdf_page"], "text": dc + " + " + first["text"],
                    "action": "prefixed drop cap and restored opening quotation mark", "result": new})
        first["text"] = new
        first["indent"] = 15.0  # paragraph start
        # lines wrapped around the drop cap are indented by the glyph, not by a block quote
        dc_bottom = dropcaps[0]["y0"] + 45.0
        for ln in lines[1:]:
            if ln["pdf_page"] == first["pdf_page"] and ln["column"] == first["column"] and ln["y0"] < dc_bottom:
                log.append({"rule": "N2", "pdf_page": ln["pdf_page"], "text": ln["text"],
                            "action": f"indent {ln['indent']} caused by drop cap reset to 0 (continuation line)"})
                ln["indent"] = 0.0

    # N4 paragraphs
    paras = []
    for ln in lines:
        ind = ln["indent"]
        kind = "letter" if ind >= 22 else "prose"
        starts = False
        if not paras:
            starts = True
        elif kind == "letter" and paras[-1]["kind"] != "letter":
            starts = True
        elif kind == "prose" and paras[-1]["kind"] == "letter":
            starts = True
        elif kind == "prose" and 8 <= ind < 22:
            starts = True
        if starts:
            paras.append({"kind": kind, "lines": [ln]})
        else:
            paras[-1]["lines"].append(ln)

    # N5 join lines
    out_paras = []
    for p in paras:
        text = ""
        for ln in p["lines"]:
            t = ln["text"].strip()
            if not text:
                text = t
                continue
            if text.endswith("-") and not text.endswith("--"):
                left = re.search(r"([\w’'-]+)-$", text)
                right = re.match(r"([\w’']+)", t)
                lw = left.group(1) if left else ""
                rw = right.group(1) if right else ""
                hyph = f"{lw}-{rw}"
                joined = f"{lw}{rw}"
                if hw.get(hyph, 0) > 0 and hw.get(joined, 0) == 0:
                    text = text + t
                    decision = "kept_hyphen"
                else:
                    text = text[:-1] + t
                    decision = "removed_hyphen"
                log.append({"rule": "N5", "pdf_page": ln["pdf_page"], "left": lw, "right": rw, "decision": decision,
                            "html_count_hyphenated": hw.get(hyph, 0), "html_count_joined": hw.get(joined, 0)})
            elif text.endswith("—"):
                text = text + t
            else:
                text = text + " " + t
        before = text
        for k, v in LIGS.items():
            n = text.count(k)
            if n:
                log.append({"rule": "N6", "pdf_page": p["lines"][0]["pdf_page"], "char": f"U+{ord(k):04X}", "count": n})
                text = text.replace(k, v)
        for m in list(re.finditer(r"([´`¨ˆ˜¸])([A-Za-z])", text)):
            comb = {"´": "\u0301", "`": "\u0300", "¨": "\u0308", "ˆ": "\u0302", "˜": "\u0303", "¸": "\u0327"}[m.group(1)]
            rep = unicodedata.normalize("NFC", m.group(2) + comb)
            log.append({"rule": "N7", "pdf_page": p["lines"][0]["pdf_page"], "text": m.group(0), "result": rep})
        text = re.sub(r"([´`¨ˆ˜¸])([A-Za-z])", lambda m: unicodedata.normalize("NFC", m.group(2) + {"´": "\u0301", "`": "\u0300", "¨": "\u0308", "ˆ": "\u0302", "˜": "\u0303", "¸": "\u0327"}[m.group(1)]), text)
        # N8 stacked vulgar fraction typeset as digit + "1/2" (PDF text layer) -> "½"
        for m in list(re.finditer(r"(\d)1/2\b", text)):
            log.append({"rule": "N8", "pdf_page": p["lines"][0]["pdf_page"], "text": m.group(0), "result": m.group(1) + "½",
                        "evidence": "HTML witness has 4½; PDF typesets a stacked fraction"})
        text = re.sub(r"(\d)1/2\b", lambda m: m.group(1) + "½", text)
        text = unicodedata.normalize("NFC", text)
        out_paras.append({"kind": p["kind"], "text": text,
                          "pdf_page_start": p["lines"][0]["pdf_page"], "pdf_page_end": p["lines"][-1]["pdf_page"],
                          "printed_page_start": p["lines"][0]["printed_page"],
                          "printed_page_end": p["lines"][-1]["printed_page"],
                          "n_lines": len(p["lines"])})
    with open(os.path.join(out, "normalized.txt"), "w", encoding="utf-8") as f:
        f.write("\n\n".join(p["text"] for p in out_paras) + "\n")
    with open(os.path.join(out, "paragraphs.jsonl"), "w", encoding="utf-8") as f:
        for p in out_paras:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    with open(os.path.join(out, "normalization_log.jsonl"), "w", encoding="utf-8") as f:
        for e in log:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    c = collections.Counter(e["rule"] + ("/" + e.get("decision", "") if e["rule"] == "N5" else "") for e in log)
    print("paragraphs", len(out_paras), collections.Counter(p["kind"] for p in out_paras), dict(c))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
