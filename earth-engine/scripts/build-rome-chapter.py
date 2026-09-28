#!/usr/bin/env python3
"""Rebuild the small, source-audited Rome venue pilot from pinned inputs.

Nothing in design/sources is shipped by Vite. Runtime only requests the
selected chapter's 800/1600 px WebP and a clipped ODbL GeoJSON extract.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw, ImageStat
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "design" / "sources"
OUTPUT = ROOT / "public" / "data"
ORTHO = SOURCES / "rome-agea2020-wms-raw.png"
OSM = SOURCES / "rome-osm-20260928.osm.gz"
ORTHO_SHA256 = "24f32f2d67b9a1dbadf343da83d5febce18f66735de06dc0bd1550adb88a4a9d"
OSM_SHA256 = "1c2c4c98b25196dea4d8abf7ed18ba8ad399d9ce15696b26ff11306ad4b81ea6"
UTM_BOUNDS = [290532.57579051994, 4637929.377485718,
              291012.57579051994, 4638409.377485718]
VENUE = [12.4791336, 41.8678291]  # OSM Talent Garden POI, within owner-addressed venue
VENUE_WAY = "390787504"  # OSM footprint containing the Talent Garden POI


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def check_sources() -> tuple[bytes, bytes]:
    image = ORTHO.read_bytes()
    osm = gzip.decompress(OSM.read_bytes())
    assert sha256(image) == ORTHO_SHA256, "Pinned Lazio WMS source has changed"
    assert sha256(osm) == OSM_SHA256, "Pinned OSM source has changed"
    return image, osm


def image_corners() -> list[list[float]]:
    x0, y0, x1, y1 = UTM_BOUNDS
    transformer = Transformer.from_crs("EPSG:25833", "EPSG:4326", always_xy=True)
    return [[round(v, 9) for v in transformer.transform(x, y)]
            for x, y in [(x0, y1), (x1, y1), (x1, y0), (x0, y0)]]


def build_images(image: bytes) -> dict:
    from io import BytesIO

    source = Image.open(BytesIO(image)).convert("RGBA")
    assert source.size == (1600, 1600), "WMS crop must be the audited 1600px square"
    size = source.width
    fade = 155  # 46.5 m transparent edge, blending with the globe's base map
    alpha = Image.new("L", source.size)
    pixels = alpha.load()
    for y in range(size):
        for x in range(size):
            fraction = min(1.0, min(x, y, size - 1 - x, size - 1 - y) / fade)
            pixels[x, y] = round(255 * fraction * fraction * (3 - 2 * fraction))
    source.putalpha(alpha)
    products = {}
    for edge, quality in [(800, 77), (1600, 83)]:
        target = source if edge == size else source.resize((edge, edge), Image.Resampling.LANCZOS)
        name = f"rome-ostiense-agea2020-{edge}-v1.webp"
        path = OUTPUT / name
        target.save(path, "WEBP", quality=quality, method=6)
        data = path.read_bytes()
        products[str(edge)] = {"asset": name, "bytes": len(data), "sha256": sha256(data),
                               "decoded_rgba_bytes": edge * edge * 4}
        assert len(data) < (250_000 if edge == 800 else 850_000)
    return products


def tags(element: ET.Element) -> dict[str, str]:
    return {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}


def distance_m(lon: float, lat: float) -> float:
    return math.hypot((lon - VENUE[0]) * 82_800, (lat - VENUE[1]) * 111_000)


def sample_roof_tone(image: Image.Image, coordinates: list[list[float]],
                     transformer: Transformer) -> str:
    """Mean *source* orthophoto colour inside a mapped roof outline.

    This is a muted material swatch, not a photographic roof projection or an
    invented roof texture. A generic mass is still labelled illustrative.
    """
    x0, y0, x1, y1 = UTM_BOUNDS
    points = []
    for lon, lat in coordinates:
        x, y = transformer.transform(lon, lat)
        points.append(((x - x0) / (x1 - x0) * image.width,
                       (y1 - y) / (y1 - y0) * image.height))
    left, top = max(0, math.floor(min(p[0] for p in points))), max(0, math.floor(min(p[1] for p in points)))
    right = min(image.width, math.ceil(max(p[0] for p in points)))
    bottom = min(image.height, math.ceil(max(p[1] for p in points)))
    if right - left < 2 or bottom - top < 2:
        return "#aaa9a1"
    mask = Image.new("L", (right - left, bottom - top), 0)
    ImageDraw.Draw(mask).polygon([(x - left, y - top) for x, y in points], fill=255)
    means = ImageStat.Stat(image.crop((left, top, right, bottom)), mask).mean[:3]
    if not all(math.isfinite(value) for value in means):
        return "#aaa9a1"
    # Raise only very dark shadows; preserve the roof-to-roof variance that
    # makes the miniature read as this *actual* neighbourhood.
    tone = [max(88, min(204, round(value * .82 + 32))) for value in means]
    return "#" + "".join(f"{value:02x}" for value in tone)


def build_buildings(osm: bytes, image: bytes) -> dict:
    from io import BytesIO

    root = ET.fromstring(osm)
    photo = Image.open(BytesIO(image)).convert("RGB")
    to_utm = Transformer.from_crs("EPSG:4326", "EPSG:25833", always_xy=True)
    nodes = {node.attrib["id"]: [float(node.attrib["lon"]), float(node.attrib["lat"])]
             for node in root.findall("node")}
    features = []
    venue_found = False
    for way in root.findall("way"):
        properties = tags(way)
        if properties.get("building", "no") == "no":
            continue
        refs = [ref.attrib["ref"] for ref in way.findall("nd")]
        if len(refs) < 4 or refs[0] != refs[-1] or any(ref not in nodes for ref in refs):
            continue
        coordinates = [nodes[ref] for ref in refs]
        if min(distance_m(*point) for point in coordinates) > 325:
            continue
        osm_id = way.attrib["id"]
        p = {"osm_id": osm_id, "height_basis": "footprint-only", "height_m": 0,
             "material_color": sample_roof_tone(photo, coordinates, to_utm)}
        raw_height = properties.get("height", "")
        if re.fullmatch(r"\d+(?:\.\d+)?\s*(?:m)?", raw_height):
            p.update(height_m=min(float(raw_height.rstrip("m ")), 60.0),
                     height_basis="OSM height tag")
        elif re.fullmatch(r"\d+(?:\.\d+)?", properties.get("building:levels", "")):
            levels = float(properties["building:levels"])
            if 0 < levels <= 20:
                p.update(height_m=round(levels * 3.0, 1), levels=levels,
                         height_basis="illustrative 3m per OSM-mapped floor")
        if osm_id == VENUE_WAY:
            # The owner's safety report describes four above-ground floors;
            # this is an *estimated mass*, never a surveyed roof model.
            p.update(height_m=12.0, levels=4, venue=True,
                     height_basis="illustrative 3m × 4 owner-reported floors")
            venue_found = True
        features.append({"type": "Feature", "id": int(osm_id),
                         "geometry": {"type": "Polygon", "coordinates": [coordinates]},
                         "properties": p})
    assert venue_found, "Audited Talent Garden footprint not in OSM extract"
    assert 20 <= len(features) <= 250, "Unexpected building coverage"
    data = {"type": "FeatureCollection", "features": features}
    path = OUTPUT / "rome-ostiense-buildings-v1.geojson"
    payload = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode()
    assert len(payload) < 110_000, "Rome mapped massing exceeds 110 kB"
    path.write_bytes(payload)
    return {"asset": path.name, "bytes": len(payload), "sha256": sha256(payload),
            "features": len(features),
            "raised_features": sum(f["properties"]["height_m"] > 0 for f in features)}


def main() -> None:
    image, osm = check_sources()
    products = build_images(image)
    buildings = build_buildings(osm, image)
    metadata = {
        "id": "rome-ostiense-v1", "image_corners_lonlat": image_corners(),
        "venue_lonlat": VENUE,
        "ground": {"source": "Regione Lazio Ortofoto AGEA v. 2020", "license": "CC BY 4.0",
                   "capture_year": 2020, "source_sha256": ORTHO_SHA256,
                   "utm_epsg": 25833, "utm_bounds": UTM_BOUNDS, "products": products},
        "buildings": {**buildings, "source": "OpenStreetMap contributors",
                      "license": "ODbL 1.0", "source_sha256": OSM_SHA256,
                      "unknown_height_policy": "planar footprint only"},
        "truth_label": "2020 official orthophoto; OSM outlines; illustrative massing, not surveyed 3D",
    }
    path = OUTPUT / "rome-ostiense-v1.json"
    path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
    print(f"{buildings['features']} footprints, {buildings['raised_features']} mapped/estimated volumes")
    print(f"800px {products['800']['bytes']} B; 1600px {products['1600']['bytes']} B; "
          f"geometry {buildings['bytes']} B")


if __name__ == "__main__":
    main()
