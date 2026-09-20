# Builds the small image tiers the site loads instead of the full-size photos.
#
#   thumbs/s/<path>.webp   max 320 px — gadget screens, cartridge labels, the phone's grid, modal filmstrip
#   thumbs/m/<path>.webp   max 960 px — work cards, the photography grid, hero windows, profile strip
#
# The originals in images/ are mirrored from ../Portfolio by sync.ps1 (with /MIR, which deletes anything extra),
# so the tiers live in thumbs/ instead. sync.ps1 runs this afterwards. Up-to-date files are skipped, and tiers
# whose original has gone are pruned, so a rebuild is cheap.
#
#   python tools/thumbs.py            build what changed
#   python tools/thumbs.py --force    rebuild everything
import os
import sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "images")
OUT = os.path.join(ROOT, "thumbs")
TIERS = {"s": (320, 72), "m": (960, 80)}
EXTS = (".jpg", ".jpeg", ".png", ".webp")
force = "--force" in sys.argv


def originals():
    for folder, _, files in os.walk(SRC):
        for name in files:
            if name.lower().endswith(EXTS):
                full = os.path.join(folder, name)
                yield full, os.path.relpath(full, SRC).replace("\\", "/")


def build(full, rel, tier, size, quality):
    dest = os.path.join(OUT, tier, os.path.splitext(rel)[0] + ".webp")
    if not force and os.path.exists(dest) and os.path.getmtime(dest) >= os.path.getmtime(full):
        return 0, os.path.getsize(dest)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with Image.open(full) as im:
        # honour the camera's EXIF orientation: browsers rotate the original, so the tier must match it
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") and "A" in im.getbands() else "RGB")
        im.thumbnail((size, size), Image.LANCZOS)
        im.save(dest, "WEBP", quality=quality, method=6)
    return 1, os.path.getsize(dest)


def prune(keep):
    for tier in TIERS:
        base = os.path.join(OUT, tier)
        for folder, _, files in os.walk(base, topdown=False):
            for name in files:
                rel = os.path.relpath(os.path.join(folder, name), base).replace("\\", "/")
                if rel not in keep:
                    os.remove(os.path.join(folder, name))
            if not os.listdir(folder):
                os.rmdir(folder)


def main():
    made = skipped = src_bytes = out_bytes = 0
    keep = set()
    for full, rel in originals():
        src_bytes += os.path.getsize(full)
        keep.add(os.path.splitext(rel)[0] + ".webp")
        for tier, (size, quality) in TIERS.items():
            built, size_on_disk = build(full, rel, tier, size, quality)
            made += built
            skipped += 1 - built
            out_bytes += size_on_disk
    if os.path.isdir(OUT):
        prune(keep)
    print(f"thumbs: {made} built, {skipped} up to date")
    print(f"originals {src_bytes / 1048576:.1f} MB -> tiers {out_bytes / 1048576:.1f} MB")


main()
