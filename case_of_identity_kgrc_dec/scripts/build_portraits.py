#!/usr/bin/env python3
"""Web versions of the character portraits (needs Pillow).

For every edition/portraits/<id>.png|jpg|webp it writes:
  edition/portraits/web/<id>.webp       the oval, cropped to its drawn frame (height 640): Cast cards, person pages
  edition/portraits/web/<id>-face.webp  a square crop on the face (192 px), flattened on the paper tone: round thumbnails
  edition/portraits/web/<id>-reveal.webp  for a persona (crops.json "reveals"): the same oval with the face of the person
                                        behind the mask pasted in (feathered), for the spyglass; same size as <id>.webp
Face crops come from edition/portraits/crops.json (default: the upper middle of the oval).
Usage: python3 scripts/build_portraits.py [edition/portraits]
"""
import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "edition" / "portraits"
OUT = SRC / "web"


def paper_tone(im: Image.Image) -> tuple[int, int, int]:
    """Most frequent light, opaque colour: the paper inside the oval."""
    small = im.resize((128, 128))
    c = Counter((r // 4 * 4, g // 4 * 4, b // 4 * 4) for r, g, b, a in getattr(small, "get_flattened_data", small.getdata)() if a > 250 and r + g + b > 600)
    return c.most_common(1)[0][0] if c else (240, 238, 232)


def main() -> None:
    conf = json.loads((SRC / "crops.json").read_text()) if (SRC / "crops.json").exists() else {}
    crops, reveals = conf.get("faces", {}), conf.get("reveals", {})
    OUT.mkdir(exist_ok=True)
    for f in sorted(p for p in SRC.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and p.is_file()):
        pid = f.stem
        im = Image.open(f).convert("RGBA")
        bbox = im.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox() or (0, 0, *im.size)
        oval = im.crop(bbox)
        h = 640
        oval = oval.resize((round(oval.width * h / oval.height), h), Image.LANCZOS)
        oval.save(OUT / f"{pid}.webp", "WEBP", quality=84, method=6)
        x0, y0, x1, y1 = bbox
        default = [x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.05, (x1 - x0) * 0.6]
        x, y, side = crops.get(pid, default)
        face = im.crop((round(x), round(y), round(x + side), round(y + side)))
        ground = Image.new("RGBA", face.size, (*paper_tone(im), 255))
        face = Image.alpha_composite(ground, face).convert("RGB").resize((192, 192), Image.LANCZOS)
        face.save(OUT / f"{pid}-face.webp", "WEBP", quality=86, method=6)
        rv = reveals.get(pid)
        if rv and (SRC / f"{rv['other']}.png").exists():
            other = Image.open(SRC / f"{rv['other']}.png").convert("RGBA")
            shifted = Image.new("RGBA", other.size, (0, 0, 0, 0))
            shifted.paste(other, tuple(rv.get("shift", [0, 0])))
            mask = Image.new("L", im.size, 0)
            dr = ImageDraw.Draw(mask)
            for cx, cy, rx, ry in rv["mask"]:
                dr.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(rv.get("feather", 16)))
            comp = im.copy()
            comp.paste(shifted, (0, 0), ImageChops.multiply(mask, shifted.getchannel("A")))
            comp = comp.crop(bbox).resize(oval.size, Image.LANCZOS)
            comp.save(OUT / f"{pid}-reveal.webp", "WEBP", quality=84, method=6)
            print(f"{pid}: reveal with the face of {rv['other']}")
        print(f"{pid}: oval {oval.size}, face from {[round(v) for v in (x, y, side)]}")


if __name__ == "__main__":
    main()
