#!/usr/bin/env python3
"""AUTOMATIC candidate alignment KGRC scene -> Doyle sentence/paragraph (to be verified manually).

Method (declared, heuristic):
  * scenes ordered by numeric ID (suffix 'a' right after its number): the audit shows kgc:then
    never points to a lower ID, so ID order approximates discourse order;
  * target units = the 389 normalised sentences (data/text/sentences.csv);
  * score = cosine similarity of TF-IDF vectors (content words, lower-cased, crude suffix
    stripping, English stop-words removed; IDF over sentences). Length-normalised, so long
    paragraphs are not favoured. Scenes whose kgc:source is only a speech frame ("X said the
    following") or empty get score 0 everywhere and are placed by interpolation;
  * monotone dynamic programming: sentence index non-decreasing along scene order; jumps of
    more than 6 sentences are penalised linearly.
Output: data/kgrc/alignment_auto.csv  (status='auto'; NOT a verified alignment)
Usage: python -I scripts/align_candidates.py <project_root>
"""
import collections
import csv
import math
import os
import re
import sys

STOP = set("""a an the and or but if of to in on at by for from with as is are was were be been being have has had do does did
not no it its he she they them his her their him i me my we us our you your this that these those there here which who whom
what when where why how so than then too very can could would should will shall may might must said say says following one
about into over upon out up down all any some such only own same other also just more most much many s t""".split())


def toks(s):
    out = []
    for w in re.findall(r"[a-z]+", s.lower().replace("’", "'")):
        if w in STOP or len(w) < 3:
            continue
        for suf in ("ings", "ing", "edly", "ed", "es", "s"):
            if w.endswith(suf) and len(w) - len(suf) >= 3:
                w = w[: -len(suf)]
                break
        out.append(w)
    return out


def key(sid):
    m = re.match(r"d:(\d+)([a-z]?)$", sid)
    return (int(m.group(1)), m.group(2)) if m else (10**6, sid)


def main(root):
    scenes = [r for r in csv.DictReader(open(os.path.join(root, "data/kgrc/scenes.csv"), encoding="utf-8")) if re.match(r"d:\d+[a-z]?$", r["scene"])]
    scenes.sort(key=lambda r: key(r["scene"]))
    sents = list(csv.DictReader(open(os.path.join(root, "data/text/sentences.csv"), encoding="utf-8")))
    df = collections.Counter()
    sent_toks = [toks(s["text"]) for s in sents]
    for t in sent_toks:
        df.update(set(t))
    N = len(sents)
    idf = {w: math.log((N + 1) / (c + 1)) + 1 for w, c in df.items()}

    def vec(t):
        c = collections.Counter(t)
        v = {w: (1 + math.log(n)) * idf.get(w, math.log(N + 1) + 1) for w, n in c.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {w: x / norm for w, x in v.items()}

    svec = [vec(t) for t in sent_toks]
    frame = re.compile(r"(?i)^\s*\S+(\s\S+){0,4}\s(said|says|tell|told|asked)\b.*(following|:)?\s*$")
    texts = []
    for r in scenes:
        src = r["source_en"]
        if not src or (frame.match(src) and len(toks(src)) <= 2):
            src = ""
        texts.append(src)
    qvec = [vec(toks(t)) if t else {} for t in texts]
    n, m = len(scenes), len(sents)
    S = [[sum(q.get(w, 0.0) * x for w, x in sv.items()) for sv in svec] for q in qvec]
    NEG = -1e18
    best = [[NEG] * m for _ in range(n)]
    back = [[-1] * m for _ in range(n)]
    for j in range(m):
        best[0][j] = S[0][j] - 0.05 * j
    for i in range(1, n):
        prefix_best, prefix_arg = NEG, -1
        for j in range(m):
            # best predecessor among k <= j with penalty for jumps > 6
            if best[i - 1][j] > prefix_best:
                prefix_best, prefix_arg = best[i - 1][j], j
            cand_v, cand_k = NEG, -1
            for k in range(max(0, j - 6), j + 1):
                if best[i - 1][k] > cand_v:
                    cand_v, cand_k = best[i - 1][k], k
            far = prefix_best - 0.02 * (j - prefix_arg - 6) if prefix_arg < j - 6 else NEG
            if far > cand_v:
                cand_v, cand_k = far, prefix_arg
            best[i][j] = cand_v + S[i][j]
            back[i][j] = cand_k
    j = max(range(m), key=lambda x: best[n - 1][x])
    assign = [0] * n
    for i in range(n - 1, -1, -1):
        assign[i] = j
        j = back[i][j]
    out = []
    for i, r in enumerate(scenes):
        s = sents[assign[i]]
        out.append({"scene": r["scene"], "types": r["types"], "infoSource": r["infoSource"], "source_en": r["source_en"],
                    "sent_id": s["sent_id"], "para_id": s["para_id"], "cosine": round(S[i][assign[i]], 3),
                    "placed_by": "score" if texts[i] and S[i][assign[i]] > 0 else "interpolation", "status": "auto"})
    with open(os.path.join(root, "data/kgrc/alignment_auto.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    paras_cov = collections.Counter(o["para_id"] for o in out)
    print("scenes aligned:", len(out), "| paragraphs with >=1 scene:", len(paras_cov), "of 138",
          "| placed by interpolation:", sum(o["placed_by"] == "interpolation" for o in out))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
