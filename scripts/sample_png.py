"""Sample 4200 dots from each titan PNG (icon _s and banner _b).

Output: src/assets/titan_dots.json with structure
    { "legion": { "s": {"w":..,"h":..,"pts":[[x,y],...]},
                  "b": {"w":..,"h":..,"pts":[[x,y],...]} },
      "ronin":  {...}, ... }

Usage: python scripts/sample_png.py
Dependencies: Pillow, numpy
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError as e:
    sys.exit(f"Missing dep: {e}. Install with: pip install Pillow numpy")

TITANS = ["legion", "ronin", "northstar", "scorch", "tone", "monarch", "ion"]
POINTS = 4200
LUM_THRESHOLD = 30  # banner: pixels brighter than this count as shape

HERE = Path(__file__).resolve().parent.parent
PNG_DIR = HERE / "public" / "titans"
OUT_PATH = HERE / "src" / "assets" / "titan_dots.json"


def mask_from_image(img: Image.Image, variant: str) -> np.ndarray:
    """Return bool mask of shape (H, W) where True = sample-eligible pixel."""
    arr = np.asarray(img.convert("RGBA"))
    alpha = arr[..., 3]
    if variant == "s":
        # icon: alpha channel is the silhouette
        mask = alpha > 128
        if mask.sum() < POINTS // 2:
            # fallback to luminance if icon has no alpha channel
            lum = arr[..., :3].mean(axis=-1)
            mask = lum > LUM_THRESHOLD
    else:
        # banner: luminance threshold to drop near-black background
        lum = arr[..., :3].astype(np.float32).mean(axis=-1)
        mask = (lum > LUM_THRESHOLD) & (alpha > 64)
    return mask


def sample_points(mask: np.ndarray, n: int) -> list[list[float]]:
    """Random-sample n points inside mask, return normalized [x,y] in 0..1.

    Uses weighted random pick of mask cells. Adds sub-pixel jitter for a
    softer look.
    """
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        raise ValueError("mask empty")

    rng = np.random.default_rng(42)
    idx = rng.integers(0, len(xs), size=n)
    px = xs[idx].astype(np.float32) + rng.random(n)
    py = ys[idx].astype(np.float32) + rng.random(n)

    h, w = mask.shape
    pts = np.stack([px / w, py / h], axis=-1)
    # Round to 4 decimals to shrink JSON
    return [[round(float(p[0]), 4), round(float(p[1]), 4)] for p in pts]


def process(titan: str, variant: str) -> dict:
    fp = PNG_DIR / f"{titan}_{variant}.png"
    if not fp.exists():
        raise FileNotFoundError(fp)
    img = Image.open(fp)
    w, h = img.size
    mask = mask_from_image(img, variant)
    hits = int(mask.sum())
    pts = sample_points(mask, POINTS)
    print(f"  {titan}_{variant}.png  {w}x{h}  mask_hits={hits}")
    return {"w": w, "h": h, "pts": pts}


def main() -> None:
    if not PNG_DIR.exists():
        sys.exit(f"Not found: {PNG_DIR}")

    out: dict = {}
    for t in TITANS:
        out[t] = {}
        for v in ("s", "b"):
            out[t][v] = process(t, v)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"\nWrote {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
