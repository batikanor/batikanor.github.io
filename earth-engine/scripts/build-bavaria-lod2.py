#!/usr/bin/env python3
"""Clip official Bavarian LoD2 CityGML to a small Garching venue mesh.

This is an OFFLINE authoring step, not a runtime dependency. It downloads only
the two 2 km CityGML sheets touching the venue, verifies the official SHA-256
hashes, triangulates the actual roof/wall polygons, and writes a compact binary
asset for the browser. No geometry is invented or extruded from footprints.

Dependencies: python3 -m pip install -r scripts/bavaria-lod2-requirements.txt
Run:          python3 scripts/build-bavaria-lod2.py
Offline rerun: python3 scripts/build-bavaria-lod2.py --offline
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import struct
import tempfile
import urllib.request
import xml.etree.ElementTree as ET

import mapbox_earcut
import numpy as np
from pyproj import Transformer
from shapely.geometry import Point, Polygon


ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "data"
CACHE_DIR = pathlib.Path(tempfile.gettempdir()) / "earth-engine-bavaria-lod2"
OUTPUT_STEM = "garching-lod2-v1"
ORIGIN_LON = 11.666954
ORIGIN_LAT = 48.262269
RADIUS_M = 700

# Bavaria's Garching-b.Muenchen municipality metalink, consulted 2026-09-27:
# https://geodaten.bayern.de/odd/a/lod2/citygml/meta/metalink/09184119.meta4
# These are its two sheets intersecting the 700 m venue circle. Pinning their
# digests makes the committed derivative reproducible if upstream later changes.
SOURCE_TILES = {
    "696_5348.gml": "115cf190ece5a6b401bff0a70c3d55162bf310b30c934eff429cf46206132d39",
    "698_5348.gml": "92ee03284c00a1c544c13169a0adf05a5bf3c7916afefe29113d2c3835539965",
}
SOURCE_ROOT = "https://download1.bayernwolke.de/a/lod2/citygml/"

NS = {
    "gml": "http://www.opengis.net/gml",
    "bldg": "http://www.opengis.net/citygml/building/1.0",
}
GML_ID = "{" + NS["gml"] + "}id"
EARTH_RADIUS_M = 6378137.0
EARTH_CIRCUMFERENCE_M = 2 * math.pi * EARTH_RADIUS_M
UTM_TO_WGS84 = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
WGS84_TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)
ORIGIN_E, ORIGIN_N = WGS84_TO_UTM.transform(ORIGIN_LON, ORIGIN_LAT)
MERCATOR_UNITS_PER_METRE = 1 / (EARTH_CIRCUMFERENCE_M * math.cos(math.radians(ORIGIN_LAT)))
ORIGIN_MX = (ORIGIN_LON + 180) / 360
ORIGIN_MY = (1 - math.asinh(math.tan(math.radians(ORIGIN_LAT))) / math.pi) / 2


def checked_source(filename: str, digest: str, offline: bool) -> pathlib.Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / filename
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == digest:
        return path
    if offline:
        raise RuntimeError(f"Missing/changed cached source {path}; --offline cannot fetch it")
    url = SOURCE_ROOT + filename
    print(f"Fetching official CityGML: {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "batikan-earth-engine-research/0.1"})
    with urllib.request.urlopen(request, timeout=120) as response:
        body = response.read()
    actual = hashlib.sha256(body).hexdigest()
    if actual != digest:
        raise RuntimeError(f"Official source {filename} SHA-256 changed: {actual}; review before updating the pin")
    path.write_bytes(body)
    return path


def points_from_pos_list(element: ET.Element | None) -> list[tuple[float, float, float]]:
    if element is None or not element.text:
        return []
    numbers = [float(value) for value in element.text.split()]
    if len(numbers) % 3:
        raise ValueError("CityGML posList is not a multiple of 3 coordinates")
    points = list(zip(numbers[::3], numbers[1::3], numbers[2::3]))
    # LinearRing is explicitly closed; earcut wants each corner only once.
    if len(points) >= 2 and points[0] == points[-1]:
        points.pop()
    return points


def all_ground_rings(building: ET.Element) -> list[list[tuple[float, float, float]]]:
    rings = []
    for pos in building.findall(".//bldg:GroundSurface//gml:exterior/gml:LinearRing/gml:posList", NS):
        points = points_from_pos_list(pos)
        if len(points) >= 3:
            rings.append(points)
    return rings


def is_in_venue(building: ET.Element, circle: Point) -> bool:
    for ring in all_ground_rings(building):
        polygon = Polygon([(x, y) for x, y, _ in ring])
        if not polygon.is_empty and polygon.distance(circle) <= RADIUS_M:
            return True
    return False


def projected_rings(polygon: ET.Element):
    exterior = points_from_pos_list(polygon.find("./gml:exterior/gml:LinearRing/gml:posList", NS))
    if len(exterior) < 3:
        return None
    rings = [exterior]
    for interior in polygon.findall("./gml:interior/gml:LinearRing/gml:posList", NS):
        hole = points_from_pos_list(interior)
        if len(hole) >= 3:
            rings.append(hole)

    # Project the 3D surface onto its least-distorted 2D plane. Roofs typically
    # use UTM E/N; vertical facades use E/Z or N/Z. The source vertices remain
    # untouched and are retrieved by the triangle indices after triangulation.
    vertices = np.asarray(exterior, dtype=np.float64)
    normal = None
    strongest = 0.0
    for index in range(1, len(vertices) - 1):
        candidate = np.cross(vertices[index] - vertices[0], vertices[index + 1] - vertices[0])
        strength = float(np.dot(candidate, candidate))
        if strength > strongest:
            normal, strongest = candidate, strength
    if normal is None or strongest < 1e-12:
        return None
    drop_axis = int(np.argmax(np.abs(normal)))
    keep_axes = [axis for axis in range(3) if axis != drop_axis]
    flat_vertices = [point for ring in rings for point in ring]
    xy = np.asarray([[point[keep_axes[0]], point[keep_axes[1]]] for point in flat_vertices], dtype=np.float64)
    ring_ends = np.cumsum([len(ring) for ring in rings], dtype=np.uint32)
    return flat_vertices, xy, ring_ends


def triangle_vertices(polygon: ET.Element):
    projected = projected_rings(polygon)
    if projected is None:
        return []
    vertices, xy, ring_ends = projected
    indices = mapbox_earcut.triangulate_float64(xy, ring_ends)
    return [vertices[int(index)] for index in indices]


def local_mercator_positions(vertices: list[tuple[float, float, float]]) -> np.ndarray:
    if not vertices:
        return np.empty((0, 3), dtype="<f4")
    source = np.asarray(vertices, dtype=np.float64)
    lon, lat = UTM_TO_WGS84.transform(source[:, 0], source[:, 1])
    radians = np.radians(lat)
    mx = (lon + 180) / 360
    my = (1 - np.arcsinh(np.tan(radians)) / math.pi) / 2
    east = (mx - ORIGIN_MX) / MERCATOR_UNITS_PER_METRE
    north = -(my - ORIGIN_MY) / MERCATOR_UNITS_PER_METRE
    # Three layer local convention: x east, y vertical, z north. DHHN2016 NH
    # altitude is retained rather than flattening roofs into artificial blocks.
    return np.column_stack([east, source[:, 2], north]).astype("<f4")


def build(offline: bool) -> None:
    roof_vertices: list[tuple[float, float, float]] = []
    wall_vertices: list[tuple[float, float, float]] = []
    source_ids = []
    surface_count = 0
    official_ground = []
    circle = Point(ORIGIN_E, ORIGIN_N)
    for filename, digest in SOURCE_TILES.items():
        root = ET.parse(checked_source(filename, digest, offline)).getroot()
        envelope = root.find("./gml:boundedBy/gml:Envelope", NS)
        assert envelope is not None and "ETRS89_UTM32" in envelope.attrib.get("srsName", ""), filename
        for building in root.findall(".//bldg:Building", NS):
            if not is_in_venue(building, circle):
                continue
            source_ids.append(building.get(GML_ID))
            for ring in all_ground_rings(building):
                official_ground.extend(point[2] for point in ring)
            for kind, target in (("RoofSurface", roof_vertices), ("WallSurface", wall_vertices)):
                for polygon in building.findall(f".//bldg:{kind}//gml:Polygon", NS):
                    before = len(target)
                    target.extend(triangle_vertices(polygon))
                    if len(target) > before:
                        surface_count += 1
    if len(source_ids) != len(set(source_ids)):
        raise RuntimeError("Duplicate building identifiers between source sheets")
    if not source_ids or not roof_vertices or not wall_vertices:
        raise RuntimeError("Official CityGML clip unexpectedly empty")
    if len(roof_vertices) % 3 or len(wall_vertices) % 3:
        raise RuntimeError("Triangulated geometry did not end on triangle boundary")

    roof = local_mercator_positions(roof_vertices)
    wall = local_mercator_positions(wall_vertices)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    binary = OUTPUT_DIR / f"{OUTPUT_STEM}.bin"
    header = struct.pack(
        "<4sIIIIIdd", b"BLD2", 1, len(roof), len(wall), len(source_ids), surface_count,
        ORIGIN_LON, ORIGIN_LAT,
    )
    binary.write_bytes(header + roof.tobytes() + wall.tobytes())
    meta = {
        "asset": binary.name,
        "source": "Bayerische Vermessungsverwaltung / LDBV, 3D-Gebäudemodell LoD2-BY",
        "source_metalink": "https://geodaten.bayern.de/odd/a/lod2/citygml/meta/metalink/09184119.meta4",
        "source_files_sha256": SOURCE_TILES,
        "license": "CC BY 4.0 — attribution and modification notice required",
        "credit": "Geobasisdaten: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de (Daten verändert), Lizenz: CC BY 4.0",
        "derived_changes": "Clipped Garching venue circle; roof and wall CityGML surfaces triangulated, reprojected to WGS84/Web Mercator-local coordinates, binary packed; original heights retained",
        "origin": [ORIGIN_LON, ORIGIN_LAT],
        "radius_m": RADIUS_M,
        "height_datum": "DHHN2016 NH (official source), not a photogrammetric textured mesh",
        "selected_buildings": len(source_ids),
        "triangulated_surfaces": surface_count,
        "roof_triangles": len(roof) // 3,
        "wall_triangles": len(wall) // 3,
        "ground_height_range_m": [round(min(official_ground), 2), round(max(official_ground), 2)],
        "bytes": binary.stat().st_size,
        "binary_sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
        "building_ids": source_ids,
    }
    metadata = OUTPUT_DIR / f"{OUTPUT_STEM}.json"
    metadata.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {binary}: {len(source_ids)} official buildings, {surface_count} roof/wall surfaces, "
          f"{len(roof)//3 + len(wall)//3} triangles, {binary.stat().st_size:,} bytes")
    print(f"Metadata: {metadata}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Use only verified CityGML already present in the system temp cache")
    arguments = parser.parse_args()
    build(arguments.offline)
