#!/usr/bin/env python3
"""Build two small, source-backed Cottbus 3D venue chapters offline.

The input is the checksum-pinned Brandenburg LGB LoD2 CityGML and 20 cm
TrueDOP RGB already cached by the sibling isometric-cottbus project. The
output uses the same BLD2 v1 geometry and XYZ-aligned roof atlas understood by
the Earth site's isometricRegionLayer. A separate, lighter image has exact
WGS84 corners for a MapLibre image source underneath the buildings.

No public runtime request is made to the source server and no estimated
building geometry, façade detail, or missing ortho pixels are fabricated.

Run from earth-engine:
  python3 scripts/build-cottbus-isometric.py
  python3 scripts/build-cottbus-isometric.py --verify-only

Set --source-root if isometric-cottbus is not beside the portfolio workspace.
"""

from __future__ import annotations

import argparse
from functools import lru_cache
import hashlib
import html
from io import BytesIO
import importlib.util
import json
import math
import os
from pathlib import Path
import struct
from zipfile import ZipFile

import cv2
from lxml import etree
import numpy as np
from PIL import Image
from pyproj import Transformer
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "assets" / "isometric"
DEFAULT_SOURCE_ROOT = ROOT.parents[2] / "isometric-cottbus"
SOURCE_ROOT = Path(os.environ.get("COTTBUS_SOURCE_ROOT", DEFAULT_SOURCE_ROOT))
LICENSE_URL = "https://www.govdata.de/dl-de/by-2-0"
CREDIT = "© GeoBasis-DE/LGB, dl-de/by-2-0 (Daten geändert)"
SOURCE_CRS = "EPSG:25833"
ZOOM = 19
TILE_PX = 256
EARTH_CIRCUMFERENCE_M = 40_075_016.68557849
MAX_MESH_BYTES = 8_000_000
MAX_ATLAS_BYTES = 10_000_000
MAX_ATLAS_DIMENSION = 4096
MAX_GROUND_DIMENSION = 2048
RADIUS_M = 250
GML = "http://www.opengis.net/gml"
BLDG = "http://www.opengis.net/citygml/building/1.0"
GML_ID = f"{{{GML}}}id"
WGS84_TO_UTM = Transformer.from_crs("EPSG:4326", SOURCE_CRS, always_xy=True)
UTM_TO_WGS84 = Transformer.from_crs(SOURCE_CRS, "EPSG:4326", always_xy=True)
MERCATOR_TO_UTM = Transformer.from_crs("EPSG:3857", SOURCE_CRS, always_xy=True)

# The 2025 origin is the official LGB GroundSurface centroid of the venue
# building, cross-checked against the organizer's Hangar 1 route marker.
# The 2026 origin is the author's existing BTU-campus achievement pin.
# Keep distinct local geometry/imagery assets rather than one oversized texture.
CHAPTERS = {
    "2025": {"stem": "cottbus-climathon-2025", "event_slug": "decarbon-days-climathon-2025",
             "origin": [14.301040317339991, 51.775269384379186],
             "venue": "Hangar 1, Burger Chaussee 1, former Cottbus-Nord airfield",
             "venue_source": "https://www.lausitz-festival.eu/de/lausitz-festival/spielorte/hangar-1-cottbus/89",
             "venue_route_lonlat": [14.301094065999557, 51.77531657968506],
             "source_ground_gml_id": "DEBBAL5200008nZo",
             "osm_cross_check_way": 179996652,
             "tiles": ["33451-5736", "33452-5736"],
             "ground_tiles": ["33451-5735", "33451-5736", "33452-5735", "33452-5736"],
             "ground_grid": {"zoom": 18, "tiles_per_axis": 14}},
    "2026": {"stem": "cottbus-climathon-2026", "event_slug": "decarbon-days-climathon-2026",
             "origin": [14.326165, 51.767384], "tiles": ["33453-5735"],
             "ground_tiles": ["33452-5734", "33452-5735", "33452-5736",
                              "33453-5734", "33453-5735", "33453-5736"],
             "ground_grid": {"zoom": 18, "tiles_per_axis": 12}},
}

# Source ZIPs from the official URLs below, retrieved 2026-09-27 by the
# isometric-cottbus project. Reject any changed cache rather than silently
# republishing a different model or flight as the same versioned asset.
SOURCE_SHA256 = {
    "lod2": {
        "33450-5735": "ccc9b52578fabe5a8cf4bc2a8601fb92812ad68797edafdfea6157c29ed78e8c",
        "33450-5736": "4187b29ade1010802d70375d64040357910e7a370d220b45027b1188c4e83a48",
        "33451-5735": "fd2ad479a745951aa1d7aab3a9b1691c6c6ef3e206e015fa35c6df0196123755",
        "33451-5736": "f4a19f6a6f0d2c7ea7d25cb1d38ae80d4a01ec464cd8135e3b0e7781ec9df76a",
        "33452-5735": "2eddca62660320b78076c9bb4fdcbe237694fb965e1881705a518a11e304c3b4",
        "33452-5736": "c4195ebcd7dcdff4371da223880124aa8e5a93abfd77f79b8d0b658c925d708c",
        "33453-5735": "004723d3be1cd98746ba1f7245bf370b86f6e1709739823b0a2e245d3248a1b0",
        "33453-5736": "c4a8f384bb6d3e7aa735ba61bb1f5706e5a1b250debfa97eb7560bafc1d210c5",
        "33454-5735": "bd13e6978f322ab2ea13fce0ff19326d7b73521af6e1989c420eddcd46c5417c",
        "33454-5736": "e9b99e3eb27f64a9257245e94a0e1144c994821ba12ed58c6da90df50678578c",
    },
    "dop": {
        "33450-5735": "42f2564e2bf1d171406e5ca331539e478a47750013fe967224303bfbbc5429e5",
        "33450-5736": "f3e4b859052c1473186c583ec0cf1aa832ae8a98cbb9c7b61369367464249e25",
        "33451-5735": "caccd919aebc8a05507c13d65c19ae53ad7d60f34a367f5f8e906c642f7ea9c5",
        "33451-5736": "31290f001deb1fe1b56bfbd0d21dafe6a9d107f1cb1c9198be4217830363a00b",
        "33452-5735": "6ff9ad0e087b714af2df6683df91b4ad3bd0e4c9859ae2e254237e81cfa73098",
        "33452-5734": "cdc9ba812775c39971a53a55027cdb8b9f3629e4d2f14ce5c5d070d659437aed",
        "33452-5736": "7234971616b7a9f3fde9000ee915235d0548111b741449155452bb0c505f8601",
        "33453-5734": "7f307a0da2ec9c4ca4d56d1f6129950d504c270003ae7315fab5040f3e16ee62",
        "33453-5735": "71ab298ee04c83d662a67885904144d0ac3a51a79fcf92b809e0e4804956d0f4",
        "33453-5736": "8e27897b521844b2cad74227091b294d26a71ce8d9415e03b890808f2bcd9e78",
        "33454-5735": "eebac6dba64ccf494ece1947d965d3684c686cc9c9babf12e2155e250a1a034d",
        "33454-5736": "f04d5fcd985122f054904f2bc8a18b8cff0ad941142113b60934361db8ae7f47",
    },
}

spec = importlib.util.spec_from_file_location("bavaria_lod2", ROOT / "scripts" / "build-bavaria-lod2.py")
assert spec and spec.loader
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def source_url(kind: str, tile: str) -> str:
    directory = "3d_gebaeude/lod2_gml" if kind == "lod2" else "dop/rgb_jpg"
    return f"https://data.geobasis-bb.de/geobasis/daten/{directory}/{kind}_{tile}.zip"


@lru_cache(maxsize=None)
def checked_archive(kind: str, tile: str) -> Path:
    expected = SOURCE_SHA256[kind].get(tile)
    if not expected:
        raise RuntimeError(f"Unreviewed {kind} source tile {tile}; do not fill its pixels by interpolation")
    path = SOURCE_ROOT / "data" / kind / f"{kind}_{tile}.zip"
    if not path.is_file() or sha256(path) != expected:
        raise RuntimeError(f"Missing or changed official source {path}; expected SHA-256 {expected}")
    with ZipFile(path) as archive:
        suffix = "_geb.gml" if kind == "lod2" else ".jpg"
        member = f"{kind}_{tile}{suffix}"
        if member not in archive.namelist():
            raise RuntimeError(f"Official ZIP missing {member}: {path}")
        html_members = [name for name in archive.namelist() if name.endswith(".html")]
        if len(html_members) != 1:
            raise RuntimeError(f"Official ZIP metadata changed: {path}")
        metadata = html.unescape(archive.read(html_members[0]).decode("utf-8", errors="replace"))
        if "Datenlizenz Deutschland - Namensnennung - Version 2.0" not in metadata:
            raise RuntimeError(f"Official ZIP license changed: {path}")
        expected_date = "2026-01-13" if kind == "lod2" else "2025-04-26"
        if expected_date not in metadata:
            raise RuntimeError(f"Official ZIP metadata date changed: {path}")
    return path


def local_positions(vertices: list[tuple[float, float, float]], origin: list[float]) -> np.ndarray:
    source = np.asarray(vertices, dtype=np.float64)
    lon, lat = UTM_TO_WGS84.transform(source[:, 0], source[:, 1])
    mx = (lon + 180) / 360
    my = (1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2
    ox = (origin[0] + 180) / 360
    oy = (1 - math.asinh(math.tan(math.radians(origin[1]))) / math.pi) / 2
    units_per_metre = 1 / (EARTH_CIRCUMFERENCE_M * math.cos(math.radians(origin[1])))
    east = (mx - ox) / units_per_metre
    north = -(my - oy) / units_per_metre
    return np.column_stack([east, source[:, 2], north]).astype("<f4")


def build_geometry(chapter: dict) -> tuple[np.ndarray, dict]:
    origin = chapter["origin"]
    centre = Point(*WGS84_TO_UTM.transform(*origin))
    roofs: list[tuple[float, float, float]] = []
    walls: list[tuple[float, float, float]] = []
    ids: list[str] = []
    ground_heights: list[float] = []
    source_count = 0
    surfaces = 0
    nearest = math.inf
    reference_ground_centroid = None
    for tile in chapter["tiles"]:
        source = checked_archive("lod2", tile)
        with ZipFile(source) as archive, archive.open(f"lod2_{tile}_geb.gml") as stream:
            envelope_verified = False
            for _, element in etree.iterparse(stream, events=("end",)):
                if element.tag == f"{{{GML}}}Envelope":
                    if "ETRS89_UTM33" not in element.get("srsName", ""):
                        raise RuntimeError(f"Unexpected official CityGML CRS in {source}")
                    envelope_verified = True
                elif element.tag == f"{{{BLDG}}}Building":
                    source_count += 1
                    rings = base.all_ground_rings(element)
                    footprints = [Polygon([(x, y) for x, y, _ in ring]) for ring in rings]
                    distances = [footprint.distance(centre) for footprint in footprints if not footprint.is_empty]
                    if distances:
                        nearest = min(nearest, *distances)
                    if distances and min(distances) <= RADIUS_M:
                        building_id = element.get(GML_ID)
                        if not building_id:
                            raise RuntimeError(f"Official LoD2 building without GML identifier in {source}")
                        ids.append(building_id)
                        if building_id == chapter.get("source_ground_gml_id"):
                            centroid = unary_union([p for p in footprints if not p.is_empty]).centroid
                            reference_ground_centroid = [centroid.x, centroid.y]
                        for ring in rings:
                            ground_heights.extend(point[2] for point in ring)
                        for kind, target in (("RoofSurface", roofs), ("WallSurface", walls)):
                            for polygon in element.findall(f".//{{{BLDG}}}{kind}//{{{GML}}}Polygon"):
                                triangles = base.triangle_vertices(polygon)
                                if triangles:
                                    target.extend(triangles)
                                    surfaces += 1
                    parent = element.getparent()
                    if parent is not None:
                        parent.remove(element)
                    element.clear()
            if not envelope_verified:
                raise RuntimeError(f"Official CityGML has no verified source CRS: {source}")
    if not ids or len(ids) != len(set(ids)) or not roofs or not walls or not ground_heights:
        raise RuntimeError(f"Empty, duplicate, or incomplete official LoD2 clip for {chapter['stem']}")
    if chapter.get("source_ground_gml_id"):
        if reference_ground_centroid is None or centre.distance(Point(*reference_ground_centroid)) > 0.02:
            raise RuntimeError(f"The pinned Hangar model origin no longer matches its official LGB ground footprint centroid")
    roof, wall = local_positions(roofs, origin), local_positions(walls, origin)
    name = f"{chapter['stem']}-lod2-v1.bin"
    binary = OUTPUT / name
    binary.write_bytes(struct.pack("<4sIIIIIdd", b"BLD2", 1, len(roof), len(wall), len(ids), surfaces, *origin)
                       + roof.tobytes() + wall.tobytes())
    if binary.stat().st_size > MAX_MESH_BYTES:
        raise RuntimeError(f"Cottbus mesh exceeds the browser's 8 MB BLD2 limit: {binary}")
    metadata = {
        "asset": name,
        "source": "GeoBasis-DE/LGB Brandenburg, 3D-Gebäudemodell LoD2 CityGML",
        "source_urls": [source_url("lod2", tile) for tile in chapter["tiles"]],
        "source_zip_sha256": {tile: SOURCE_SHA256["lod2"][tile] for tile in chapter["tiles"]},
        "source_crs": "ETRS89_UTM33*DE_DHHN2016_NH",
        "source_update_date": "2026-01-13",
        "license": "Datenlizenz Deutschland – Namensnennung – Version 2.0",
        "license_url": LICENSE_URL,
        "credit": CREDIT,
        "derived_changes": "250 m venue clip; official CityGML roof and wall polygons triangulated and reprojected to local Web-Mercator metres; original DHHN2016 heights retained; no invented buildings or façades",
        "event_slug": chapter["event_slug"],
        "venue": chapter.get("venue"),
        "venue_source": chapter.get("venue_source"),
        "venue_route_lonlat": chapter.get("venue_route_lonlat"),
        "origin_basis": "centroid of official GeoBasis-DE/LGB LoD2 GroundSurface" if reference_ground_centroid else "existing portfolio achievement pin",
        "source_ground_gml_id": chapter.get("source_ground_gml_id"),
        "source_ground_centroid_utm": reference_ground_centroid,
        "osm_cross_check_way": chapter.get("osm_cross_check_way"),
        "venue_route_distance_m": round(centre.distance(Point(*WGS84_TO_UTM.transform(*chapter["venue_route_lonlat"]))), 2) if chapter.get("venue_route_lonlat") else None,
        "origin": origin,
        "radius_m": RADIUS_M,
        "height_datum": "DHHN2016 NH (official source)",
        "source_buildings_inspected": source_count,
        "selected_buildings": len(ids),
        "nearest_official_building_footprint_m": round(nearest, 2),
        "triangulated_surfaces": surfaces,
        "roof_triangles": len(roof) // 3,
        "wall_triangles": len(wall) // 3,
        "ground_height_range_m": [round(min(ground_heights), 2), round(max(ground_heights), 2)],
        "bytes": binary.stat().st_size,
        "binary_sha256": sha256(binary),
        "building_ids": ids,
    }
    (OUTPUT / f"{chapter['stem']}-lod2-v1.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
    print(f"{chapter['stem']}: {len(ids)} buildings / {len(roof)//3 + len(wall)//3:,} triangles / {binary.stat().st_size:,} BLD2 bytes", flush=True)
    return roof, metadata


def atlas_bounds(roof: np.ndarray, origin: list[float]) -> tuple[int, int, int, int]:
    local = roof.reshape(-1, 3)
    tile_m = EARTH_CIRCUMFERENCE_M * math.cos(math.radians(origin[1])) / 2**ZOOM
    ox = (origin[0] + 180) / 360 * 2**ZOOM
    oy = (1 - math.asinh(math.tan(math.radians(origin[1]))) / math.pi) / 2 * 2**ZOOM
    min_x = math.floor(ox + (float(local[:, 0].min()) - 2) / tile_m)
    max_x = math.floor(ox + (float(local[:, 0].max()) + 2) / tile_m)
    min_y = math.floor(oy - (float(local[:, 2].max()) + 2) / tile_m)
    max_y = math.floor(oy - (float(local[:, 2].min()) - 2) / tile_m)
    width, height = (max_x-min_x+1)*TILE_PX, (max_y-min_y+1)*TILE_PX
    if width > MAX_ATLAS_DIMENSION or height > MAX_ATLAS_DIMENSION:
        raise RuntimeError(f"Cottbus roof atlas exceeds browser 4096 px texture limit: {width}x{height}")
    return min_x, min_y, max_x, max_y


@lru_cache(maxsize=4)
def dop_rgb(tile: str) -> np.ndarray:
    source = checked_archive("dop", tile)
    with ZipFile(source) as archive:
        world = [float(value) for value in archive.read(f"dop_{tile}.jgw").decode("ascii").split()]
        east_base = int(tile[2:5]) * 1000
        north_base = int(tile[6:]) * 1000
        expected = [0.2, 0.0, 0.0, -0.2, east_base + 0.1, north_base + 999.9]
        if any(abs(actual-want) > 1e-5 for actual, want in zip(world, expected)):
            raise RuntimeError(f"Unexpected official DOP pixel registration for {tile}: {world}")
        with Image.open(BytesIO(archive.read(f"dop_{tile}.jpg"))) as image:
            if image.size != (5000, 5000):
                raise RuntimeError(f"Unexpected official 20 cm DOP dimensions for {tile}: {image.size}")
            return np.asarray(image.convert("RGB"))


def render_mercator_tile(x: int, y: int, zoom: int) -> Image.Image:
    # Compute target pixel centres in EPSG:3857, then reproject them into the
    # official UTM33 20 cm image grid. Sampling each 256² piece avoids ever
    # constructing a 10,000² source mosaic or an unbounded decoded map.
    columns = x * TILE_PX + np.arange(TILE_PX, dtype=np.float64) + 0.5
    rows = y * TILE_PX + np.arange(TILE_PX, dtype=np.float64) + 0.5
    px, py = np.meshgrid(columns, rows)
    world_pixels = 2**zoom * TILE_PX
    merc_x = EARTH_CIRCUMFERENCE_M * (px / world_pixels - 0.5)
    merc_y = EARTH_CIRCUMFERENCE_M * (0.5 - py / world_pixels)
    east, north = MERCATOR_TO_UTM.transform(merc_x, merc_y)
    east_tile = np.floor(east / 1000).astype(np.int32)
    north_tile = np.floor(north / 1000).astype(np.int32)
    output = np.zeros((TILE_PX, TILE_PX, 3), dtype=np.uint8)
    for e, n in zip(*np.unique(np.stack([east_tile.ravel(), north_tile.ravel()], axis=1), axis=0).T):
        tile = f"33{e:03d}-{n:04d}"
        mask = (east_tile == e) & (north_tile == n)
        image = dop_rgb(tile)
        xmap = ((east - e * 1000) / 0.2 - 0.5).astype(np.float32)
        ymap = (((n + 1) * 1000 - north) / 0.2 - 0.5).astype(np.float32)
        sampled = cv2.remap(image, xmap, ymap, cv2.INTER_LINEAR,
                            borderMode=cv2.BORDER_REPLICATE)
        output[mask] = sampled[mask]
    if not np.any(output):
        raise RuntimeError(f"No official DOP pixels for XYZ {zoom}/{x}/{y}")
    return Image.fromarray(output)


def xyz_to_wgs84(x: float, y: float, zoom: int = ZOOM) -> list[float]:
    lon = x / 2**zoom * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2*y / 2**zoom))))
    return [round(lon, 10), round(lat, 10)]


def render_atlas(bounds: tuple[int, int, int, int], zoom: int) -> Image.Image:
    min_x, min_y, max_x, max_y = bounds
    width, height = (max_x-min_x+1)*TILE_PX, (max_y-min_y+1)*TILE_PX
    atlas = Image.new("RGB", (width, height))
    for y in range(min_y, max_y+1):
        for x in range(min_x, max_x+1):
            atlas.paste(render_mercator_tile(x, y, zoom), ((x-min_x)*TILE_PX, (y-min_y)*TILE_PX))
    return atlas


def ground_bounds(chapter: dict) -> tuple[int, tuple[int, int, int, int]]:
    grid = chapter["ground_grid"]
    zoom, count = grid["zoom"], grid["tiles_per_axis"]
    lon, lat = chapter["origin"]
    x = (lon+180)/360 * 2**zoom
    y = (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2 * 2**zoom
    min_x, min_y = math.floor(x)-count//2, math.floor(y)-count//2
    return zoom, (min_x, min_y, min_x+count-1, min_y+count-1)


def feather_ground(image: Image.Image) -> Image.Image:
    """Fade only the outer 12% to avoid a hard aerial rectangle on ESA imagery."""
    width, height = image.size
    x = np.arange(width, dtype=np.float32)
    y = np.arange(height, dtype=np.float32)
    edge_x = np.minimum(x, width-1-x) / max(1, width*0.12)
    edge_y = np.minimum(y, height-1-y) / max(1, height*0.12)
    ramp = np.minimum(np.minimum(edge_x[None, :], edge_y[:, None]), 1)
    ramp = ramp*ramp*(3-2*ramp)  # Smoothstep, zero slope at both ends.
    rgba = np.asarray(image.convert("RGBA")).copy()
    rgba[:, :, 3] = np.rint(ramp*255).astype(np.uint8)
    return Image.fromarray(rgba)


def write_images(chapter: dict, roof: np.ndarray) -> None:
    stem, origin = chapter["stem"], chapter["origin"]
    min_x, min_y, max_x, max_y = atlas_bounds(roof, origin)
    width, height = (max_x-min_x+1)*TILE_PX, (max_y-min_y+1)*TILE_PX
    atlas = render_atlas((min_x, min_y, max_x, max_y), ZOOM)
    roof_stem = f"{stem}-roof-truedop20-v1"
    roof_path = OUTPUT / f"{roof_stem}.webp"
    atlas.save(roof_path, "WEBP", quality=90, method=6)
    if roof_path.stat().st_size > MAX_ATLAS_BYTES:
        raise RuntimeError(f"Cottbus roof atlas exceeds browser 10 MB transfer limit: {roof_path}")
    full_metadata = {
        "asset": roof_path.name,
        "source": "GeoBasis-DE/LGB Brandenburg, 20 cm RGB TrueDOP",
        "source_urls": [source_url("dop", tile) for tile in chapter["tiles"]],
        "source_zip_sha256": {tile: SOURCE_SHA256["dop"][tile] for tile in chapter["tiles"]},
        "source_crs": SOURCE_CRS,
        "source_grid": "Official 20 cm UTM33 RGB JPEG reprojected offline to EPSG:3857 XYZ z19",
        "source_tile_zoom": ZOOM,
        "source_tile_bounds_xyxy": [min_x, min_y, max_x, max_y],
        "source_flight_date": "2025-04-26",
        "source_publication_date": "2025-07-31",
        "width": width, "height": height,
        "event_slug": chapter["event_slug"],
        "origin_lonlat": origin,
        "derived_changes": "Official TrueDOP RGB samples reprojected to a Mercator-aligned WebP atlas; roof UVs use original LoD2 vertices; no invented roof or façade detail",
        "license": "Datenlizenz Deutschland – Namensnennung – Version 2.0",
        "license_url": LICENSE_URL,
        "credit": CREDIT,
        "bytes": roof_path.stat().st_size,
        "sha256": sha256(roof_path),
    }
    (OUTPUT / f"{roof_stem}.json").write_text(json.dumps(full_metadata, indent=2, ensure_ascii=False) + "\n")
    half = atlas.resize((width//2, height//2), Image.Resampling.LANCZOS)
    half_path = OUTPUT / f"{roof_stem}-half.webp"
    half.save(half_path, "WEBP", quality=88, method=6)
    half_metadata = {
        "asset": half_path.name,
        "source_asset": roof_path.name,
        "source_asset_sha256": full_metadata["sha256"],
        "source_metadata": f"{roof_stem}.json",
        "source": full_metadata["source"],
        "source_urls": full_metadata["source_urls"],
        "source_tile_zoom": ZOOM,
        "source_tile_bounds_xyxy": full_metadata["source_tile_bounds_xyxy"],
        "origin_lonlat": origin,
        "width": half.width, "height": half.height,
        "derived_changes": "Lanczos 2× reduction of the checksum-pinned official TrueDOP atlas for low-memory devices",
        "license": full_metadata["license"], "license_url": LICENSE_URL, "credit": CREDIT,
        "bytes": half_path.stat().st_size, "sha256": sha256(half_path),
    }
    (OUTPUT / f"{roof_stem}-half.json").write_text(json.dumps(half_metadata, indent=2, ensure_ascii=False) + "\n")
    # A separate ~1.1–1.3 km source-aligned context delays its edge until
    # well outside the immediate LoD2 venue. The lower-resolution RGBA decode
    # is capped at 2048 px, with a broad transparent edge onto the ESA map.
    ground_zoom, ground_grid = ground_bounds(chapter)
    ground_full = render_atlas(ground_grid, ground_zoom)
    divisor = max(1, math.ceil(max(ground_full.size) / MAX_GROUND_DIMENSION))
    ground = feather_ground(ground_full.resize((ground_full.width//divisor,
        ground_full.height//divisor), Image.Resampling.LANCZOS))
    ground_path = OUTPUT / f"{stem}-ground-truedop20-v1.webp"
    ground.save(ground_path, "WEBP", quality=86, method=6, exact=True)
    if ground_path.stat().st_size > 4_000_000:
        raise RuntimeError(f"Cottbus ground patch exceeds 4 MB transfer budget: {ground_path}")
    ground_tiles = chapter["ground_tiles"]
    gmin_x, gmin_y, gmax_x, gmax_y = ground_grid
    ground_metadata = {
        "asset": ground_path.name,
        "source": full_metadata["source"],
        "source_urls": [source_url("dop", tile) for tile in ground_tiles],
        "source_zip_sha256": {tile: SOURCE_SHA256["dop"][tile] for tile in ground_tiles},
        "source_tile_zoom": ground_zoom,
        "source_tile_bounds_xyxy": list(ground_grid),
        "origin_lonlat": origin,
        "event_slug": chapter["event_slug"],
        "source_flight_date": full_metadata["source_flight_date"],
        "width": ground.width, "height": ground.height,
        "coordinates": [xyz_to_wgs84(gmin_x, gmin_y, ground_zoom), xyz_to_wgs84(gmax_x+1, gmin_y, ground_zoom),
                        xyz_to_wgs84(gmax_x+1, gmax_y+1, ground_zoom), xyz_to_wgs84(gmin_x, gmax_y+1, ground_zoom)],
        "derived_changes": "1.1–1.3 km, lower-resolution Mercator-aligned TrueDOP image for a MapLibre image source; 12% outer alpha feather to blend into global imagery; no fabricated map pixels",
        "license": full_metadata["license"], "license_url": LICENSE_URL, "credit": CREDIT,
        "bytes": ground_path.stat().st_size, "sha256": sha256(ground_path),
    }
    (OUTPUT / f"{stem}-ground-truedop20-v1.json").write_text(json.dumps(ground_metadata, indent=2, ensure_ascii=False) + "\n")
    print(f"{stem}: roof {width}x{height} / {roof_path.stat().st_size:,} B, "
          f"half {half.width}x{half.height} / {half_path.stat().st_size:,} B, "
          f"ground {ground.width}x{ground.height} / {ground_path.stat().st_size:,} B", flush=True)


def verify(chapter: dict) -> None:
    stem, origin = chapter["stem"], chapter["origin"]
    mesh_path = OUTPUT / f"{stem}-lod2-v1.bin"
    mesh = mesh_path.read_bytes()
    if len(mesh) > MAX_MESH_BYTES or mesh[:4] != b"BLD2":
        raise RuntimeError(f"Invalid or oversized BLD2 mesh for {stem}")
    magic, version, roof_count, wall_count, building_count, surface_count, lon, lat = struct.unpack_from("<4sIIIIIdd", mesh)
    if magic != b"BLD2" or version != 1 or [lon, lat] != origin or len(mesh) != 40 + 12*(roof_count+wall_count):
        raise RuntimeError(f"Malformed BLD2 header, origin, or length for {stem}")
    if not all(value > 0 for value in (roof_count, wall_count, building_count, surface_count)):
        raise RuntimeError(f"Missing official roof/wall triangles in {stem}")
    positions = np.frombuffer(mesh, dtype="<f4", offset=40).reshape(-1, 3)
    if not np.isfinite(positions).all() or np.max(np.abs(positions[:, [0, 2]])) > 2500:
        raise RuntimeError(f"Invalid local Cottbus geometry coordinates in {stem}")
    mesh_meta = json.loads((OUTPUT / f"{stem}-lod2-v1.json").read_text())
    if mesh_meta["binary_sha256"] != sha256(mesh_path) or mesh_meta["selected_buildings"] != building_count:
        raise RuntimeError(f"Cottbus mesh provenance failed for {stem}")
    roof_name = f"{stem}-roof-truedop20-v1"
    full = json.loads((OUTPUT / f"{roof_name}.json").read_text())
    half = json.loads((OUTPUT / f"{roof_name}-half.json").read_text())
    ground = json.loads((OUTPUT / f"{stem}-ground-truedop20-v1.json").read_text())
    for metadata in (full, half, ground):
        path = OUTPUT / metadata["asset"]
        if metadata["bytes"] != path.stat().st_size or metadata["sha256"] != sha256(path):
            raise RuntimeError(f"Cottbus image byte/hash mismatch: {path}")
        with Image.open(path) as image:
            if image.size != (metadata["width"], metadata["height"]):
                raise RuntimeError(f"Cottbus image size mismatch: {path}")
    if full["origin_lonlat"] != origin or half["origin_lonlat"] != origin or ground["origin_lonlat"] != origin:
        raise RuntimeError(f"Cottbus asset origin mismatch for {stem}")
    if full["width"] > MAX_ATLAS_DIMENSION or full["height"] > MAX_ATLAS_DIMENSION or full["bytes"] > MAX_ATLAS_BYTES:
        raise RuntimeError(f"Cottbus atlas exceeds runtime resource limits for {stem}")
    if ground["width"] > MAX_GROUND_DIMENSION or ground["height"] > MAX_GROUND_DIMENSION:
        raise RuntimeError(f"Cottbus ground patch exceeds 2048 px for {stem}")
    if half["width"]*2 != full["width"] or half["height"]*2 != full["height"]:
        raise RuntimeError(f"Cottbus low-memory image does not match full atlas for {stem}")
    if half["source_asset_sha256"] != full["sha256"]:
        raise RuntimeError(f"Cottbus low-memory provenance does not match full atlas for {stem}")
    min_x, min_y, max_x, max_y = full["source_tile_bounds_xyxy"]
    ground_zoom = ground["source_tile_zoom"]
    gmin_x, gmin_y, gmax_x, gmax_y = ground["source_tile_bounds_xyxy"]
    expected_corners = [xyz_to_wgs84(gmin_x, gmin_y, ground_zoom),
                        xyz_to_wgs84(gmax_x+1, gmin_y, ground_zoom),
                        xyz_to_wgs84(gmax_x+1, gmax_y+1, ground_zoom),
                        xyz_to_wgs84(gmin_x, gmax_y+1, ground_zoom)]
    if ground["coordinates"] != expected_corners:
        raise RuntimeError(f"Cottbus ground image corners do not align with its official roof atlas for {stem}")
    with Image.open(OUTPUT / ground["asset"]) as ground_image:
        if ground_image.mode != "RGBA":
            raise RuntimeError(f"Cottbus ground image has no transparency for {stem}")
        alpha = np.asarray(ground_image.getchannel("A"))
        if np.max(alpha[0, :]) != 0 or np.max(alpha[-1, :]) != 0 or np.max(alpha[:, 0]) != 0 \
                or np.max(alpha[:, -1]) != 0 or np.min(alpha[alpha.shape[0]//3:2*alpha.shape[0]//3,
                                                       alpha.shape[1]//3:2*alpha.shape[1]//3]) < 250:
            raise RuntimeError(f"Cottbus ground-image feather is missing for {stem}")
    # The actual source roof vertices must fall entirely within the claimed
    # XYZ atlas, using the same UV equation as the browser custom layer.
    roof = positions[:roof_count]
    tile_m = EARTH_CIRCUMFERENCE_M * math.cos(math.radians(lat)) / 2**ZOOM
    ox = (lon+180)/360 * 2**ZOOM
    oy = (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2 * 2**ZOOM
    us = ((ox-min_x) + roof[:, 0]/tile_m) / (max_x-min_x+1)
    vs = 1 - ((oy-min_y) - roof[:, 2]/tile_m) / (max_y-min_y+1)
    if np.min(us) < 0 or np.max(us) > 1 or np.min(vs) < 0 or np.max(vs) > 1:
        raise RuntimeError(f"Official Cottbus roof vertices fall outside their DOP atlas for {stem}")
    print(f"Verified {stem}: {building_count} source buildings, {roof_count//3} roof and {wall_count//3} wall triangles; UV bounds {np.min(us):.3f}..{np.max(us):.3f} / {np.min(vs):.3f}..{np.max(vs):.3f}")


def main() -> None:
    global SOURCE_ROOT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=SOURCE_ROOT,
                        help="Checkout containing checksum-pinned official LGB ZIPs under data/")
    parser.add_argument("--chapter", choices=["2025", "2026", "all"], default="all")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    SOURCE_ROOT = args.source_root
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for key in ([args.chapter] if args.chapter != "all" else CHAPTERS):
        chapter = CHAPTERS[key]
        if not args.verify_only:
            roof, _ = build_geometry(chapter)
            write_images(chapter, roof)
            dop_rgb.cache_clear()
        verify(chapter)


if __name__ == "__main__":
    main()
