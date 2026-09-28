#!/usr/bin/env python3
"""Deterministically derive bandwidth/GPU-saving atlases from official roof atlases.

Run after the city-specific source builders. The full-resolution files remain
untouched and are still selected on capable devices. Pillow 11.x is required.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


DATA = Path(__file__).resolve().parents[1] / "public" / "data"
STEMS = (
    "munich-siemens-roof-dop20-v1",
    "munich-google-roof-dop20-v1",
    "berlin-library-roof-truedop20-v1",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


for stem in STEMS:
    full_path = DATA / f"{stem}.webp"
    full_metadata = json.loads((DATA / f"{stem}.json").read_text())
    assert sha256(full_path) == full_metadata["sha256"], f"{stem}: source atlas changed"
    reduced_path = DATA / f"{stem}-half.webp"
    with Image.open(full_path) as image:
        assert image.size == (full_metadata["width"], full_metadata["height"])
        assert image.width % 2 == 0 and image.height % 2 == 0
        half = image.convert("RGB").resize(
            (image.width // 2, image.height // 2), Image.Resampling.LANCZOS
        )
        half.save(reduced_path, "WEBP", quality=88, method=6)

    reduced_metadata = {
        "asset": reduced_path.name,
        "source_asset": full_path.name,
        "source_asset_sha256": full_metadata["sha256"],
        "source_metadata": f"{stem}.json",
        "source": full_metadata["source"],
        "source_url": full_metadata["source_url"],
        "source_tile_zoom": full_metadata["source_tile_zoom"],
        "source_tile_bounds_xyxy": full_metadata["source_tile_bounds_xyxy"],
        "origin_lonlat": full_metadata["origin_lonlat"],
        "width": half.width,
        "height": half.height,
        "derived_changes": "Lanczos 2× downsample of the official-data roof atlas for low-memory devices; original georeferencing and LoD2 geometry retained; no fabricated detail",
        "license": full_metadata["license"],
        "license_url": full_metadata["license_url"],
        "credit": full_metadata["credit"],
        "bytes": reduced_path.stat().st_size,
        "sha256": sha256(reduced_path),
    }
    (DATA / f"{stem}-half.json").write_text(
        json.dumps(reduced_metadata, indent=2, ensure_ascii=False) + "\n"
    )
    print(f"{reduced_path.name}: {half.width}×{half.height}, {reduced_metadata['bytes']:,} bytes")
