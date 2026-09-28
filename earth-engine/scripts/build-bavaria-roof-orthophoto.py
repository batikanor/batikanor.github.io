#!/usr/bin/env python3
"""Build a small, georeferenced roof-photo atlas for the Garching LoD2 slice.

The official Bavarian DOP20 WMTS is 20 cm native imagery. Zoom 18 samples it
at about 40 cm/pixel at Garching, which is appropriate for the contextual
building LOD (zoom 15.5–18.5) and fits every selected roof in one 3840² WebP.
The source service is updated periodically: this script records the SHA-256
of the exact ordered JPEG tile bytes and output asset, rather than pretending
that an unversioned WMTS URL is an immutable historic source.

Dependencies: Pillow and requests (see scripts/bavaria-lod2-requirements.txt)
Run:          python3 scripts/build-bavaria-roof-orthophoto.py
Offline rerun: python3 scripts/build-bavaria-roof-orthophoto.py --offline
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
import json
import math
from pathlib import Path
import struct
from tempfile import gettempdir

from PIL import Image
import requests


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
BUILDINGS = DATA / "garching-lod2-v1.bin"
OUTPUT = DATA / "garching-roof-orthophoto-v1.webp"
METADATA = DATA / "garching-roof-orthophoto-v1.json"
CACHE = Path(gettempdir()) / "earth-engine-bavaria-dop20-roofs-z18"
URL = "https://wmtsod1.bayernwolke.de/wmts/by_dop/smerc/{z}/{x}/{y}"
ZOOM = 18
TILE_SIZE = 256
EARTH_CIRCUMFERENCE_M = 40075016.68557849
# This is the ordered SHA-256 of (tile x, tile y, official JPEG body) for the
# exact 225 tiles used in the first reviewed local build. The public WMTS is
# updated; source changes must be consciously rechecked, not silently shipped.
PINNED_SOURCE_SHA256 = "be9232b4ca72fab686bea064a950fab53db76541844f941e830ebc9d7397b867"


def bounds_from_buildings() -> tuple[float, float, list[tuple[int, int]]]:
    with BUILDINGS.open("rb") as handle:
        blob = handle.read()
    if blob[:4] != b"BLD2" or struct.unpack_from("<I", blob, 4)[0] != 1:
        raise ValueError("Unknown official LoD2 geometry asset")
    roof_count, wall_count = struct.unpack_from("<II", blob, 8)
    origin_lon, origin_lat = struct.unpack_from("<dd", blob, 24)
    if len(blob) != 40 + (roof_count + wall_count) * 12:
        raise ValueError("Truncated official LoD2 geometry asset")
    roof_coords = struct.iter_unpack("<fff", memoryview(blob)[40 : 40 + roof_count * 12])
    xvals, nvals = [], []
    for east, _, north in roof_coords:
        xvals.append(east)
        nvals.append(north)
    tile_m = EARTH_CIRCUMFERENCE_M * math.cos(math.radians(origin_lat)) / 2**ZOOM
    origin_x = (origin_lon + 180) / 360 * 2**ZOOM
    origin_y = (1 - math.asinh(math.tan(math.radians(origin_lat))) / math.pi) / 2 * 2**ZOOM
    # One 2 m safety margin prevents bilinear filtering from sampling outside
    # an atlas whose boundary would otherwise coincide with a roof vertex.
    min_x = math.floor(origin_x + (min(xvals) - 2) / tile_m)
    max_x = math.floor(origin_x + (max(xvals) + 2) / tile_m)
    min_y = math.floor(origin_y - (max(nvals) + 2) / tile_m)
    max_y = math.floor(origin_y - (min(nvals) - 2) / tile_m)
    coordinates = [(x, y) for y in range(min_y, max_y + 1) for x in range(min_x, max_x + 1)]
    return origin_lon, origin_lat, coordinates


def get_tile(coordinate: tuple[int, int], offline: bool) -> tuple[tuple[int, int], bytes]:
    x, y = coordinate
    path = CACHE / f"{x}-{y}.jpg"
    if path.exists():
        body = path.read_bytes()
        if body[:3] == b"\xff\xd8\xff":
            return coordinate, body
    if offline:
        raise FileNotFoundError(f"No cached official DOP20 tile: {path}")
    response = requests.get(
        URL.format(z=ZOOM, x=x, y=y),
        headers={"User-Agent": "batikan-earth-engine-research/0.1"},
        timeout=30,
    )
    response.raise_for_status()
    body = response.content
    if response.headers.get("Content-Type", "").split(";")[0] != "image/jpeg" or body[:3] != b"\xff\xd8\xff":
        raise ValueError(f"Official DOP20 returned a non-JPEG tile at {ZOOM}/{x}/{y}")
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return coordinate, body


def build(offline: bool) -> None:
    origin_lon, origin_lat, coordinates = bounds_from_buildings()
    xs = [x for x, _ in coordinates]
    ys = [y for _, y in coordinates]
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
    cols, rows = max_x - min_x + 1, max_y - min_y + 1
    if cols > 16 or rows > 16:
        raise ValueError(f"Roof atlas {cols}×{rows} tiles exceeds 4096-pixel GPU budget")
    print(f"Fetching {len(coordinates)} DOP20 WMTS tiles at z{ZOOM}, grid {cols}×{rows} …", flush=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        fetched = dict(pool.map(lambda position: get_tile(position, offline), coordinates))
    combined = sha256()
    atlas = Image.new("RGB", (cols * TILE_SIZE, rows * TILE_SIZE))
    for x, y in coordinates:
        body = fetched[x, y]
        combined.update(struct.pack("<II", x, y))
        combined.update(body)
        with Image.open(BytesIO(body)) as image:
            if image.size != (TILE_SIZE, TILE_SIZE):
                raise ValueError(f"Unexpected official DOP20 tile size at {x}/{y}: {image.size}")
            atlas.paste(image.convert("RGB"), ((x - min_x) * TILE_SIZE, (y - min_y) * TILE_SIZE))
    source_digest = combined.hexdigest()
    if source_digest != PINNED_SOURCE_SHA256:
        raise RuntimeError(
            f"Official DOP20 WMTS source changed: {source_digest}. Review imagery and "
            "LoD2 alignment before intentionally updating the pinned digest."
        )
    # Lossy WebP is the only lossy step in this derived local asset. Quality 88
    # preserves actual roof detail while avoiding 225 individual network calls.
    atlas.save(OUTPUT, "WEBP", quality=88, method=6)
    output_digest = sha256(OUTPUT.read_bytes()).hexdigest()
    metadata = {
        "asset": OUTPUT.name,
        "source": "Bayerische Vermessungsverwaltung, Digitales Orthophoto DOP20 / WMTS Luftbild Bayern",
        "source_url": URL,
        "source_grid": "smerc / EPSG:3857",
        "source_tile_zoom": ZOOM,
        "source_tile_bounds_xyxy": [min_x, min_y, max_x, max_y],
        "source_tile_count": len(coordinates),
        "source_ordered_jpeg_sha256": source_digest,
        "source_accessed_utc_date": datetime.now(timezone.utc).date().isoformat(),
        "width": atlas.width,
        "height": atlas.height,
        "origin_lonlat": [origin_lon, origin_lat],
        "derived_changes": "Stitched source DOP20 WMTS JPEG tiles into one roof-only WebP atlas at z18 (about 40 cm/pixel); mapped onto separately licensed official LoD2 roof geometry. No artificial roof features added.",
        "license": "CC BY 4.0 — attribution and modification notice required",
        "credit": "Geobasisdaten: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de (Daten verändert), Lizenz: CC BY 4.0",
        "bytes": OUTPUT.stat().st_size,
        "sha256": output_digest,
    }
    METADATA.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {OUTPUT}: {atlas.width}×{atlas.height}, {OUTPUT.stat().st_size:,} bytes, sha256 {output_digest}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="use cached verified JPEG tiles only")
    arguments = parser.parse_args()
    build(arguments.offline)
