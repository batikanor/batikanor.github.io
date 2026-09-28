#!/usr/bin/env python3
"""Build a *real-data* Berlin State Library isometric venue pocket.

The source is Berlin's official LoD2 CityGML sheet and 2026 TrueDOP20 WMS,
both published under Datenlizenz Deutschland – Zero – Version 2.0. Only a
250 m circle around the portfolio's existing Real Coin Map venue coordinate
is kept. Original roof and wall surfaces are triangulated, not extruded or
invented. The official aerial image is requested in EPSG:3857 at Web-Mercator
z19 so that the runtime's roof UVs align exactly with the basemap.

Run from earth-engine:
  python3 scripts/build-berlin-library-isometric.py --accept-imagery
After visually checking the first imagery acquisition, pin the printed
ordered-WMS SHA-256 below; normal/--offline rebuilds then reject changes.
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
import zipfile

from lxml import etree
import numpy as np
from PIL import Image
from pyproj import Transformer
import requests
from shapely.geometry import Point, Polygon


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
CACHE = Path(tempfile.gettempdir()) / "earth-engine-berlin-library-isometric"
FEED = "https://gdi.berlin.de/data/a_lod2/atom/0.atom"
SOURCE_URL = "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip"
SOURCE_SHA256 = "827a94eda224f55ec638b1b4de8c440c80405ea6797068efe7558c83a4fd30c1"
SOURCE_XML = "LoD2_33_389_5818_1_BE.xml"
WMS_URL = "https://gdi.berlin.de/services/wms/truedop_2026"
WMS_DATASET = "https://daten.berlin.de/datensaetze/digitale-farbige-trueorthophotos-2026-dop20rgbi-wms-3801a94c"
LOD2_DATASET = "https://daten.berlin.de/datensaetze/3d-gebaudemodelle-im-level-of-detail-2-lod-2-3c7c49af"
LICENSE_URL = "https://www.govdata.de/dl-de/zero-2-0"
ORIGIN = [13.3708, 52.5074]  # Existing authored Real Coin Map / State Library pin.
RADIUS_M = 250
EVENT_SLUG = "real-coin-map-2025"
VENUE = "Staatsbibliothek zu Berlin, Potsdamer Straße"
SOURCE_CRS = "EPSG:25833"
WMS_CRS = "EPSG:3857"
ZOOM = 19
TILE_PX = 256
EARTH_CIRCUMFERENCE_M = 40075016.68557849
GML = "http://www.opengis.net/gml"
BLDG = "http://www.opengis.net/citygml/building/1.0"
GML_ID = f"{{{GML}}}id"
CREDIT = "Geoportal Berlin / Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin (Daten verändert), dl-de-zero-2.0"

# Pinned only after the first acquisition and visual QA. A changed source is
# never silently accepted into the derivative image.
PINNED_WMS_ORDERED_SHA256 = "1958ba2c9fa89619b2c71dd1d6c323ef57c0f8858ab31833bf8d2183c7af7ae5"

UTM_TO_WGS84 = Transformer.from_crs(SOURCE_CRS, "EPSG:4326", always_xy=True)
WGS84_TO_UTM = Transformer.from_crs("EPSG:4326", SOURCE_CRS, always_xy=True)

# Reuse the existing reviewed earcut polygon triangulator, including holes and
# non-horizontal wall/roof planes. It accepts lxml elements too.
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


def checked_source(offline: bool) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / "LoD2_389_5818.zip"
    if path.is_file() and sha256_file(path) == SOURCE_SHA256:
        return path
    if offline:
        raise RuntimeError(f"Missing/changed official LoD2 cache {path}")
    # Verify this sheet is still advertised by the official Atom dataset feed.
    feed = requests.get(FEED, timeout=20)
    feed.raise_for_status()
    if SOURCE_URL not in feed.text or "Zero - Version 2.0" not in feed.text:
        raise RuntimeError("Official Berlin LoD2 feed/link/license changed")
    print(f"Downloading official Berlin LoD2 sheet {SOURCE_URL} …", flush=True)
    partial = path.with_suffix(".zip.part")
    with requests.get(SOURCE_URL, timeout=(20, 120), stream=True) as response:
        response.raise_for_status()
        with partial.open("wb") as target:
            for chunk in response.iter_content(1024 * 1024):
                if chunk:
                    target.write(chunk)
    actual = sha256_file(partial)
    if actual != SOURCE_SHA256:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Official LoD2 ZIP changed: {actual}; review the source before updating its pin")
    with zipfile.ZipFile(partial) as archive:
        if archive.namelist() != [SOURCE_XML]:
            raise RuntimeError(f"Unexpected official CityGML ZIP members: {archive.namelist()}")
    partial.replace(path)
    return path


def local_positions(vertices: list[tuple[float, float, float]]) -> np.ndarray:
    if not vertices:
        return np.empty((0, 3), dtype="<f4")
    source = np.asarray(vertices, dtype=np.float64)
    lon, lat = UTM_TO_WGS84.transform(source[:, 0], source[:, 1])
    mx = (lon + 180) / 360
    my = (1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2
    ox = (ORIGIN[0] + 180) / 360
    oy = (1 - math.asinh(math.tan(math.radians(ORIGIN[1]))) / math.pi) / 2
    units_per_metre = 1 / (EARTH_CIRCUMFERENCE_M * math.cos(math.radians(ORIGIN[1])))
    east = (mx - ox) / units_per_metre
    north = -(my - oy) / units_per_metre
    return np.column_stack([east, source[:, 2], north]).astype("<f4")


def build_geometry(offline: bool) -> None:
    source = checked_source(offline)
    circle = Point(*WGS84_TO_UTM.transform(*ORIGIN))
    roofs: list[tuple[float, float, float]] = []
    walls: list[tuple[float, float, float]] = []
    ids: list[str] = []
    ground_heights: list[float] = []
    surface_count = 0
    nearest_building_m = math.inf
    inspected = 0
    envelope_verified = False
    with zipfile.ZipFile(source) as archive, archive.open(SOURCE_XML) as stream:
        for _, element in etree.iterparse(stream, events=("end",)):
            if element.tag == f"{{{GML}}}Envelope":
                if "ETRS89_UTM33" not in element.get("srsName", ""):
                    raise RuntimeError("Official LoD2 source CRS unexpectedly changed")
                envelope_verified = True
            elif element.tag == f"{{{BLDG}}}Building":
                inspected += 1
                distances = []
                rings = base.all_ground_rings(element)
                for ring in rings:
                    footprint = Polygon([(x, y) for x, y, _ in ring])
                    if not footprint.is_empty:
                        distances.append(footprint.distance(circle))
                if distances:
                    nearest_building_m = min(nearest_building_m, min(distances))
                if distances and min(distances) <= RADIUS_M:
                    ids.append(element.get(GML_ID))
                    for ring in rings:
                        ground_heights.extend(vertex[2] for vertex in ring)
                    for kind, target in (("RoofSurface", roofs), ("WallSurface", walls)):
                        for polygon in element.findall(f".//{{{BLDG}}}{kind}//{{{GML}}}Polygon"):
                            triangles = base.triangle_vertices(polygon)
                            if triangles:
                                target.extend(triangles)
                                surface_count += 1
                parent = element.getparent()
                if parent is not None:
                    parent.remove(element)
                element.clear()
    if not envelope_verified or not ids or len(ids) != len(set(ids)) or not roofs or not walls:
        raise RuntimeError("Berlin LoD2 clip empty, duplicate, or not in expected reference system")
    roof = local_positions(roofs)
    wall = local_positions(walls)
    name = "berlin-library-lod2-v1.bin"
    binary = DATA / name
    binary.write_bytes(
        struct.pack("<4sIIIIIdd", b"BLD2", 1, len(roof), len(wall), len(ids), surface_count, *ORIGIN)
        + roof.tobytes() + wall.tobytes()
    )
    metadata = {
        "asset": name,
        "source": "Geoportal Berlin / Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin, 3D-Gebäudemodell LoD2",
        "source_dataset": LOD2_DATASET,
        "source_atom_feed": FEED,
        "source_zip": SOURCE_URL,
        "source_zip_sha256": SOURCE_SHA256,
        "source_crs": "ETRS89_UTM33*DE_DHHN2016_NH",
        "license": "Datenlizenz Deutschland – Zero – Version 2.0",
        "license_url": LICENSE_URL,
        "credit": CREDIT,
        "derived_changes": "250 m venue clip; original CityGML roof/wall surfaces triangulated and reprojected to local Web Mercator metres; original heights retained",
        "event_slug": EVENT_SLUG,
        "venue": VENUE,
        "origin": ORIGIN,
        "radius_m": RADIUS_M,
        "height_datum": "DHHN2016 NH (official source)",
        "source_buildings_inspected": inspected,
        "selected_buildings": len(ids),
        "nearest_official_building_footprint_m": round(nearest_building_m, 2),
        "triangulated_surfaces": surface_count,
        "roof_triangles": len(roof) // 3,
        "wall_triangles": len(wall) // 3,
        "ground_height_range_m": [round(min(ground_heights), 2), round(max(ground_heights), 2)],
        "bytes": binary.stat().st_size,
        "binary_sha256": sha256_file(binary),
        "building_ids": ids,
    }
    (DATA / "berlin-library-lod2-v1.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
    print(f"Berlin: {len(ids)} buildings / {len(roof)//3 + len(wall)//3:,} triangles / {binary.stat().st_size:,} bytes; nearest footprint {nearest_building_m:.1f} m", flush=True)


def atlas_bounds() -> tuple[int, int, int, int]:
    binary = (DATA / "berlin-library-lod2-v1.bin").read_bytes()
    if binary[:4] != b"BLD2" or struct.unpack_from("<I", binary, 4)[0] != 1:
        raise RuntimeError("Invalid Berlin BLD2 geometry")
    roofs, walls = struct.unpack_from("<II", binary, 8)
    if len(binary) != 40 + (roofs + walls) * 12:
        raise RuntimeError("Truncated Berlin BLD2 geometry")
    lon, lat = struct.unpack_from("<dd", binary, 24)
    if [lon, lat] != ORIGIN:
        raise RuntimeError("Berlin BLD2 origin does not match authored venue")
    local = np.frombuffer(binary, dtype="<f4", offset=40, count=roofs * 3).reshape(-1, 3)
    tile_m = EARTH_CIRCUMFERENCE_M * math.cos(math.radians(lat)) / 2**ZOOM
    ox = (lon + 180) / 360 * 2**ZOOM
    oy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**ZOOM
    # Two metres around roof extrema for bilinear filtering and reprojection.
    min_x = math.floor(ox + (float(local[:, 0].min()) - 2) / tile_m)
    max_x = math.floor(ox + (float(local[:, 0].max()) + 2) / tile_m)
    min_y = math.floor(oy - (float(local[:, 2].max()) + 2) / tile_m)
    max_y = math.floor(oy - (float(local[:, 2].min()) - 2) / tile_m)
    if max_x - min_x + 1 > 16 or max_y - min_y + 1 > 16:
        raise RuntimeError("Berlin roof atlas exceeds a conservative 4096-pixel texture dimension")
    return min_x, min_y, max_x, max_y


def tile_bbox_mercator(x: int, y: int) -> tuple[float, float, float, float]:
    span = EARTH_CIRCUMFERENCE_M / 2**ZOOM
    left = -EARTH_CIRCUMFERENCE_M / 2 + x * span
    top = EARTH_CIRCUMFERENCE_M / 2 - y * span
    return left, top - span, left + span, top


def get_wms_tile(xy: tuple[int, int], offline: bool) -> tuple[tuple[int, int], bytes]:
    x, y = xy
    cache = CACHE / "truedop2026-wms-z19" / f"{x}-{y}.jpg"
    if cache.is_file():
        body = cache.read_bytes()
        if body[:3] == b"\xff\xd8\xff":
            return xy, body
    if offline:
        raise RuntimeError(f"Missing official Berlin TrueDOP WMS cache {cache}")
    params = {
        "service": "WMS", "version": "1.3.0", "request": "GetMap",
        "layers": "truedop_2026", "styles": "", "CRS": WMS_CRS,
        "bbox": ",".join(str(value) for value in tile_bbox_mercator(x, y)),
        "width": TILE_PX, "height": TILE_PX, "format": "image/jpeg",
    }
    response = requests.get(WMS_URL, params=params, headers={"User-Agent": "batikan-earth-engine-local-isometric/0.1"}, timeout=45)
    response.raise_for_status()
    body = response.content
    if response.headers.get("Content-Type", "").split(";")[0] != "image/jpeg" or body[:3] != b"\xff\xd8\xff":
        raise RuntimeError(f"Unexpected Berlin WMS response for {ZOOM}/{x}/{y}")
    with Image.open(BytesIO(body)) as image:
        if image.size != (TILE_PX, TILE_PX):
            raise RuntimeError(f"Unexpected Berlin WMS image dimensions for {ZOOM}/{x}/{y}")
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(body)
    return xy, body


def build_atlas(offline: bool, accept_imagery: bool) -> None:
    min_x, min_y, max_x, max_y = atlas_bounds()
    coords = [(x, y) for y in range(min_y, max_y + 1) for x in range(min_x, max_x + 1)]
    print(f"Berlin: acquiring {len(coords)} official 2026 TrueDOP WMS tiles in EPSG:3857 …", flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        fetched = dict(pool.map(lambda xy: get_wms_tile(xy, offline), coords))
    digest = hashlib.sha256()
    atlas = Image.new("RGB", ((max_x - min_x + 1) * TILE_PX, (max_y - min_y + 1) * TILE_PX))
    for x, y in coords:
        body = fetched[x, y]
        digest.update(struct.pack("<II", x, y))
        digest.update(body)
        with Image.open(BytesIO(body)) as image:
            atlas.paste(image.convert("RGB"), ((x - min_x) * TILE_PX, (y - min_y) * TILE_PX))
    ordered_digest = digest.hexdigest()
    if ordered_digest != PINNED_WMS_ORDERED_SHA256 and not accept_imagery:
        raise RuntimeError(f"Berlin TrueDOP source unpinned/changed: {ordered_digest}; review then consciously pin")
    output = DATA / "berlin-library-roof-truedop20-v1.webp"
    atlas.save(output, "WEBP", quality=90, method=6)
    metadata = {
        "asset": output.name,
        "source": "Geoportal Berlin / Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin, Digitale farbige TrueOrthophotos 2026 DOP20RGBI",
        "source_dataset": WMS_DATASET,
        "source_url": WMS_URL,
        "source_grid": "Official WMS reprojected server-side to EPSG:3857 XYZ z19",
        "source_tile_zoom": ZOOM,
        "source_tile_bounds_xyxy": [min_x, min_y, max_x, max_y],
        "source_tile_count": len(coords),
        "source_ordered_jpeg_sha256": ordered_digest,
        "source_accessed_utc_date": datetime.now(timezone.utc).date().isoformat(),
        "width": atlas.width,
        "height": atlas.height,
        "event_slug": EVENT_SLUG,
        "origin_lonlat": ORIGIN,
        "derived_changes": "Official 2026 TrueDOP20 JPEG WMS images requested in EPSG:3857, stitched into a roof-only WebP atlas; no fabricated roof or facade features",
        "license": "Datenlizenz Deutschland – Zero – Version 2.0",
        "license_url": LICENSE_URL,
        "credit": CREDIT,
        "bytes": output.stat().st_size,
        "sha256": sha256_file(output),
    }
    (DATA / "berlin-library-roof-truedop20-v1.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
    print(f"Berlin: {atlas.width}×{atlas.height} roof atlas / {output.stat().st_size:,} bytes; ordered WMS SHA-256 {ordered_digest}", flush=True)

    # The same official WMS can supply locally bounded *ground* imagery at
    # contextual zoom without shipping hundreds of extra duplicate tile files.
    # MapLibre's bbox-epsg-3857 token is documented for WMS raster sources.
    left = min_x / 2**ZOOM * 360 - 180
    right = (max_x + 1) / 2**ZOOM * 360 - 180
    north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * min_y / 2**ZOOM))))
    south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (max_y + 1) / 2**ZOOM))))
    ground = {
        "source_id": "berlin-library-truedop20-2026",
        "type": "raster",
        "tiles": [
            WMS_URL + "?service=WMS&version=1.3.0&request=GetMap&layers=truedop_2026&styles=&CRS=EPSG%3A3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image%2Fjpeg"
        ],
        "tileSize": 256,
        "minzoom": 16,
        "maxzoom": 19,
        "bounds": [left, south, right, north],
        "source_dataset": WMS_DATASET,
        "license": "Datenlizenz Deutschland – Zero – Version 2.0",
        "license_url": LICENSE_URL,
        "credit": CREDIT,
        "notes": "Official WMS is CORS-enabled and delivers RGB imagery at z16–19. Add this source/layer only near the State Library and do not use it as a global basemap; z19 requests approximate 18 cm ground pixels at Berlin."
    }
    (DATA / "berlin-library-ground-truedop20-v1.json").write_text(json.dumps(ground, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="rebuild only from checksum-verified cached sources")
    parser.add_argument("--accept-imagery", action="store_true", help="initial/reviewed acquisition of changing WMS imagery")
    parser.add_argument("--skip-geometry", action="store_true", help="reuse already built CityGML geometry")
    args = parser.parse_args()
    DATA.mkdir(parents=True, exist_ok=True)
    if not args.skip_geometry:
        build_geometry(args.offline)
    build_atlas(args.offline, args.accept_imagery)


if __name__ == "__main__":
    main()
