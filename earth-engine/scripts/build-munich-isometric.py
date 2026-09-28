#!/usr/bin/env python3
"""Build two small *real-data* Munich 3D venue pockets for a local isometric trial.

The official CityGML source sheets are large; they are downloaded to the system
temporary directory, SHA-256 checked against the Munich municipal metalink,
and streamed one building at a time. Only buildings intersecting 250 m of the
two authored achievement coordinates become browser assets. The official
DOP20 WMTS is sampled at z19 (about 20 cm/px), but only around those buildings.

Run from earth-engine: python3 scripts/build-munich-isometric.py --accept-imagery
After reviewing the first imagery acquisition, pin the printed DOP hashes in
PINNED_DOP_SHA256 and rerun without --accept-imagery. --offline then rebuilds
from checked local source/cache without network access.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import importlib.util
import json
import math
from pathlib import Path
import struct
import tempfile

from lxml import etree
import numpy as np
from PIL import Image
from pyproj import Transformer
import requests
from shapely.geometry import Point, Polygon


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
CACHE = Path(tempfile.gettempdir()) / "earth-engine-munich-isometric"
CITYGML_ROOT = "https://download1.bayernwolke.de/a/lod2/citygml/"
METALINK = "https://geodaten.bayern.de/odd/a/lod2/citygml/meta/metalink/09162000.meta4"
DOP_URL = "https://wmtsod1.bayernwolke.de/wmts/by_dop/smerc/{z}/{x}/{y}"
DOP_ZOOM = 19
TILE_SIZE = 256
EARTH_CIRCUMFERENCE_M = 40075016.68557849
GML_NAMESPACE = "http://www.opengis.net/gml"
BUILDING_NAMESPACE = "http://www.opengis.net/citygml/building/1.0"
GML_ID = "{" + GML_NAMESPACE + "}id"
CREDIT = (
    "Geobasisdaten: Bayerische Vermessungsverwaltung – "
    "www.geodaten.bayern.de (Daten verändert), Lizenz: CC BY 4.0"
)

# Published SHA-256 values from the City of Munich municipal metalink,
# fetched 2026-09-28. Only these two 2 km sheets touch the selected clips.
SOURCE_TILES = {
    "690_5334.gml": "fa05d2a15ae676f2906cc1d0ff2f9889bd2d6c77b9bd0af38852e848a588ab23",
    "692_5334.gml": "1193453ab2dd07455649840bc7ea3fb624f354bde0c7d02b4ae75824b770b489",
}

# First run's ordered JPEG source digests are pinned after visual review. The
# service updates periodically; a changed source must be consciously reviewed.
PINNED_DOP_SHA256 = {
    "siemens": "74bd12cf2c6be30bfd023e5aaf218d7b835884a8ccc52992a43540acf3526c8c",
    "google": "f30da3d9f016bde16478adad24a4284311dd9b94a9672ffbf0b9d604fb457536",
}

# These are the exact coordinates and identifiers in the authored portfolio,
# not geocoded or invented approximation points.
POCKETS = {
    "siemens": {
        "event_slug": "masters-thesis",
        "venue": "Siemens AG Munich Headquarters – Wittelsbacherplatz",
        "origin": [11.5758, 48.1453],
        "radius_m": 250,
    },
    "google": {
        "event_slug": "bayer-ai-2024",
        "venue": "Google Office Munich",
        "origin": [11.5802, 48.1392],
        "radius_m": 250,
    },
}

UTM_TO_WGS84 = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
WGS84_TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)

# Reuse the already-reviewed polygon triangulator; its source vertices are
# retained and it accounts for roof holes and vertical wall polygons.
spec = importlib.util.spec_from_file_location("bavaria_lod2", ROOT / "scripts" / "build-bavaria-lod2.py")
assert spec and spec.loader
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def checked_citygml(name: str, digest: str, offline: bool) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if path.is_file() and sha256_file(path) == digest:
        return path
    if offline:
        raise RuntimeError(f"Missing or changed official source {path}")
    partial = path.with_suffix(path.suffix + ".part")
    print(f"Downloading verified Bavarian CityGML {name} …", flush=True)
    with requests.get(
        CITYGML_ROOT + name,
        headers={"User-Agent": "batikan-earth-engine-local-isometric/0.1"},
        timeout=(20, 120),
        stream=True,
    ) as response:
        response.raise_for_status()
        with partial.open("wb") as target:
            for chunk in response.iter_content(1024 * 1024):
                if chunk:
                    target.write(chunk)
    actual = sha256_file(partial)
    if actual != digest:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"CityGML {name} digest changed: {actual}; inspect the official metalink")
    partial.replace(path)
    return path


def local_positions(vertices: list[tuple[float, float, float]], origin: list[float]) -> np.ndarray:
    if not vertices:
        return np.empty((0, 3), dtype="<f4")
    source = np.asarray(vertices, dtype=np.float64)
    lon, lat = UTM_TO_WGS84.transform(source[:, 0], source[:, 1])
    mx = (lon + 180) / 360
    my = (1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2
    origin_mx = (origin[0] + 180) / 360
    origin_my = (1 - math.asinh(math.tan(math.radians(origin[1]))) / math.pi) / 2
    units_per_metre = 1 / (EARTH_CIRCUMFERENCE_M * math.cos(math.radians(origin[1])))
    east = (mx - origin_mx) / units_per_metre
    north = -(my - origin_my) / units_per_metre
    return np.column_stack([east, source[:, 2], north]).astype("<f4")


def building_within(building, point: Point, radius_m: float) -> bool:
    for ring in base.all_ground_rings(building):
        footprint = Polygon([(e, n) for e, n, _ in ring])
        if not footprint.is_empty and footprint.distance(point) <= radius_m:
            return True
    return False


def select_geometry(offline: bool) -> dict:
    results = {}
    for key, pocket in POCKETS.items():
        e, n = WGS84_TO_UTM.transform(*pocket["origin"])
        results[key] = {
            "circle": Point(e, n),
            "ids": [],
            "roofs": [],
            "walls": [],
            "surfaces": 0,
            "ground_heights": [],
        }

    for filename, digest in SOURCE_TILES.items():
        source = checked_citygml(filename, digest, offline)
        print(f"Streaming {filename} ({source.stat().st_size:,} bytes) …", flush=True)
        envelope_verified = False
        building_count = 0
        for _, element in etree.iterparse(str(source), events=("end",)):
            if element.tag == "{" + GML_NAMESPACE + "}Envelope":
                if "ETRS89_UTM32" not in element.get("srsName", ""):
                    raise RuntimeError(f"Unexpected official coordinate system in {filename}")
                envelope_verified = True
            elif element.tag == "{" + BUILDING_NAMESPACE + "}Building":
                building_count += 1
                matches = [
                    key for key, pocket in POCKETS.items()
                    if building_within(element, results[key]["circle"], pocket["radius_m"])
                ]
                for key in matches:
                    result = results[key]
                    result["ids"].append(element.get(GML_ID))
                    for ring in base.all_ground_rings(element):
                        result["ground_heights"].extend(vertex[2] for vertex in ring)
                    for kind, field in (("RoofSurface", "roofs"), ("WallSurface", "walls")):
                        polygons = element.findall(f".//{{{BUILDING_NAMESPACE}}}{kind}//{{{GML_NAMESPACE}}}Polygon")
                        for polygon in polygons:
                            triangles = base.triangle_vertices(polygon)
                            if triangles:
                                result[field].extend(triangles)
                                result["surfaces"] += 1
                # lxml removes the fully parsed building from its parent; a
                # 160 MB CityGML sheet never becomes a huge in-memory DOM.
                parent = element.getparent()
                if parent is not None:
                    parent.remove(element)
                element.clear()
        if not envelope_verified:
            raise RuntimeError(f"Missing official ETRS89/UTM32 envelope in {filename}")
        print(f"  Inspected {building_count:,} official buildings", flush=True)

    for key, pocket in POCKETS.items():
        result = results[key]
        ids = result["ids"]
        if not ids or len(ids) != len(set(ids)) or not result["roofs"] or not result["walls"]:
            raise RuntimeError(f"Munich {key}: empty/duplicate/corrupt official building selection")
        roof = local_positions(result["roofs"], pocket["origin"])
        wall = local_positions(result["walls"], pocket["origin"])
        name = f"munich-{key}-lod2-v1.bin"
        binary = DATA / name
        binary.write_bytes(
            struct.pack("<4sIIIIIdd", b"BLD2", 1, len(roof), len(wall), len(ids), result["surfaces"], *pocket["origin"])
            + roof.tobytes() + wall.tobytes()
        )
        metadata = {
            "asset": name,
            "source": "Bayerische Vermessungsverwaltung / LDBV, 3D-Gebäudemodell LoD2-BY",
            "source_metalink": METALINK,
            "source_files_sha256": SOURCE_TILES,
            "license": "CC BY 4.0 — attribution and modification notice required",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "credit": CREDIT,
            "derived_changes": "250 m venue clip; original CityGML roof and wall surfaces triangulated and reprojected to local Web Mercator metres; original heights retained",
            "event_slug": pocket["event_slug"],
            "venue": pocket["venue"],
            "origin": pocket["origin"],
            "radius_m": pocket["radius_m"],
            "height_datum": "DHHN2016 NH (official source)",
            "selected_buildings": len(ids),
            "triangulated_surfaces": result["surfaces"],
            "roof_triangles": len(roof) // 3,
            "wall_triangles": len(wall) // 3,
            "ground_height_range_m": [round(min(result["ground_heights"]), 2), round(max(result["ground_heights"]), 2)],
            "bytes": binary.stat().st_size,
            "binary_sha256": sha256_file(binary),
            "building_ids": ids,
        }
        (DATA / f"munich-{key}-lod2-v1.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
        print(f"  {key}: {len(ids)} buildings, {len(roof)//3 + len(wall)//3:,} triangles, {binary.stat().st_size:,} bytes", flush=True)
    return results


def atlas_tile_bounds(key: str) -> tuple[int, int, int, int]:
    name = DATA / f"munich-{key}-lod2-v1.bin"
    blob = name.read_bytes()
    if blob[:4] != b"BLD2" or struct.unpack_from("<I", blob, 4)[0] != 1:
        raise RuntimeError(f"Invalid {name}")
    roof_count, wall_count = struct.unpack_from("<II", blob, 8)
    lon, lat = struct.unpack_from("<dd", blob, 24)
    if len(blob) != 40 + (roof_count + wall_count) * 12:
        raise RuntimeError(f"Truncated {name}")
    local = np.frombuffer(blob, dtype="<f4", offset=40, count=roof_count * 3).reshape(-1, 3)
    tile_m = EARTH_CIRCUMFERENCE_M * math.cos(math.radians(lat)) / 2**DOP_ZOOM
    ox = (lon + 180) / 360 * 2**DOP_ZOOM
    oy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**DOP_ZOOM
    # Two metres of UV/filtering margin beyond the extrema of all roof vertices.
    min_x = math.floor(ox + (float(local[:, 0].min()) - 2) / tile_m)
    max_x = math.floor(ox + (float(local[:, 0].max()) + 2) / tile_m)
    min_y = math.floor(oy - (float(local[:, 2].max()) + 2) / tile_m)
    max_y = math.floor(oy - (float(local[:, 2].min()) - 2) / tile_m)
    if max_x - min_x + 1 > 16 or max_y - min_y + 1 > 16:
        raise RuntimeError(f"{key} atlas would exceed a 4096-pixel GPU texture dimension")
    return min_x, min_y, max_x, max_y


def get_dop_tile(xy: tuple[int, int], offline: bool) -> tuple[tuple[int, int], bytes]:
    x, y = xy
    cache = CACHE / "dop20-z19" / f"{x}-{y}.jpg"
    if cache.exists():
        body = cache.read_bytes()
        if body[:3] == b"\xff\xd8\xff":
            return xy, body
    if offline:
        raise RuntimeError(f"Missing cached official DOP20 tile {cache}")
    response = requests.get(
        DOP_URL.format(z=DOP_ZOOM, x=x, y=y),
        headers={"User-Agent": "batikan-earth-engine-local-isometric/0.1"},
        timeout=30,
    )
    response.raise_for_status()
    body = response.content
    if response.headers.get("Content-Type", "").split(";")[0] != "image/jpeg" or body[:3] != b"\xff\xd8\xff":
        raise RuntimeError(f"Unexpected official DOP20 response for {DOP_ZOOM}/{x}/{y}")
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(body)
    return xy, body


def build_atlas(key: str, offline: bool, accept_imagery: bool) -> None:
    min_x, min_y, max_x, max_y = atlas_tile_bounds(key)
    coords = [(x, y) for y in range(min_y, max_y + 1) for x in range(min_x, max_x + 1)]
    print(f"  {key}: acquiring {len(coords)} official DOP20 z19 tiles …", flush=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        fetched = dict(pool.map(lambda xy: get_dop_tile(xy, offline), coords))
    digest = hashlib.sha256()
    atlas = Image.new("RGB", ((max_x - min_x + 1) * TILE_SIZE, (max_y - min_y + 1) * TILE_SIZE))
    for x, y in coords:
        body = fetched[x, y]
        digest.update(struct.pack("<II", x, y))
        digest.update(body)
        with Image.open(BytesIO(body)) as image:
            if image.size != (TILE_SIZE, TILE_SIZE):
                raise RuntimeError(f"Unexpected official DOP20 tile dimensions at {x}/{y}")
            atlas.paste(image.convert("RGB"), ((x - min_x) * TILE_SIZE, (y - min_y) * TILE_SIZE))
    source_digest = digest.hexdigest()
    pinned = PINNED_DOP_SHA256[key]
    if source_digest != pinned and not accept_imagery:
        raise RuntimeError(f"{key} DOP20 source changed/unpinned: {source_digest}; review and consciously pin")
    output = DATA / f"munich-{key}-roof-dop20-v1.webp"
    atlas.save(output, "WEBP", quality=90, method=6)
    pocket = POCKETS[key]
    metadata = {
        "asset": output.name,
        "source": "Bayerische Vermessungsverwaltung / LDBV, Digitales Orthophoto DOP20 RGB",
        "source_url": DOP_URL,
        "source_grid": "smerc / EPSG:3857 XYZ",
        "source_tile_zoom": DOP_ZOOM,
        "source_tile_bounds_xyxy": [min_x, min_y, max_x, max_y],
        "source_tile_count": len(coords),
        "source_ordered_jpeg_sha256": source_digest,
        "source_accessed_utc_date": datetime.now(timezone.utc).date().isoformat(),
        "width": atlas.width,
        "height": atlas.height,
        "event_slug": pocket["event_slug"],
        "origin_lonlat": pocket["origin"],
        "derived_changes": "Stitched official z19 RGB DOP20 JPEGs into a 20 cm/px roof-only WebP atlas; georeferenced to original LoD2 roof surfaces; no fabricated roof or facade features",
        "license": "CC BY 4.0 — attribution and modification notice required",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "credit": CREDIT,
        "bytes": output.stat().st_size,
        "sha256": sha256_file(output),
    }
    (DATA / f"munich-{key}-roof-dop20-v1.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
    print(f"  {key}: {atlas.width}×{atlas.height} WebP, {output.stat().st_size:,} bytes, ordered source SHA-256 {source_digest}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="rebuild only from checksum-verified cached sources")
    parser.add_argument("--accept-imagery", action="store_true", help="initial/reviewed acquisition of changing WMTS imagery")
    parser.add_argument("--skip-geometry", action="store_true", help="reuse already built CityGML geometry")
    args = parser.parse_args()
    DATA.mkdir(parents=True, exist_ok=True)
    if not args.skip_geometry:
        select_geometry(args.offline)
    for key in POCKETS:
        build_atlas(key, args.offline, args.accept_imagery)


if __name__ == "__main__":
    main()
