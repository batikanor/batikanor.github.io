#!/usr/bin/env python3
"""Author Tesla's *actual full factory* chapter from pinned public LGB data.

Uses the reviewed Cottbus reprojection and CityGML polygon triangulation,
not synthetic OSM extrusions. Downloads are offline-authoring only. Native
20 cm 2023 RGB TrueDOP becomes a ≤4096 px roof atlas and a separately bounded
2048 px ground image (~64 cm samples) with exact Mercator/WGS84 registration.
Source cadastral polygons and DHHN2016 heights remain unmodified.

Run from earth-engine: python3 scripts/build-tesla-isometric.py --offline
The initial source acquisition lives in /tmp/batikan-tesla-official, not the
public site; a normal run can recover only these exact checksum-pinned ZIPs.
"""
from __future__ import annotations

import argparse
from functools import lru_cache
import hashlib
import html
import importlib.util
import json
import math
from pathlib import Path
import struct
from urllib.request import Request, urlopen
from zipfile import ZipFile

from lxml import etree
import numpy as np
from PIL import Image
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'assets' / 'isometric'
CACHE = Path('/tmp/batikan-tesla-official')
STEM = 'tesla-gigafactory'
EVENT_SLUG = 'tesla-gigathon-2026'
# Camera/model origin: middle of the actual factory campus. The event marker
# stays at the authored south entrance [13.79215, 52.391331]. A 250 m entrance
# clip would miss most of the 145,000 m² main hall and is deliberately avoided.
ORIGIN = [13.79215, 52.3951]
EVENT_COORDINATES = [13.79215, 52.391331]
RADIUS_M = 500
ROOF_ZOOM = 18  # ~36.44 cm ground samples; no invented higher resolution.
GROUND_TILE_COUNT = 14
GROUND_SIZE = 2048
CREDIT = '© GeoBasis-DE/LGB, dl-de/by-2-0 (Daten geändert)'
LICENSE = 'Datenlizenz Deutschland – Namensnennung – Version 2.0'
LICENSE_URL = 'https://www.govdata.de/dl-de/by-2-0'
SOURCE_DATES = {'lod2': '2026-01-06', 'dop': '2023-05-04'}
SOURCE_SHA256 = {
    'lod2': {
        '33417-5805': '94c2bd68fb2db3f2a323d8d301ed2278f088921cb6433dfdb90e8bc4f255cf7b',
        '33418-5805': '7fe15c2ae8b87d22638bb535c7a098674cf0a62db4785f4dc45b3f411f0180a3',
        '33417-5806': 'd55f4f34234bab004b1ae86bfe0aeb25ee3be3b099e2691861e952d2b29c40fb',
    },
    'dop': {
        '33417-5805': '21c472b2d05096246ce93492305c3b3ac59fc12f729c724e3bf0be58e5a5aca5',
        '33418-5805': 'd3c9ddf5ba899efdbcab80ab232f127c27a706191894c2cff700fcd588465e99',
        '33417-5806': '2c7643a7abdbbdc9c806da58fc04295d847c1fda688ba7f4b04932b6ac63c35a',
        '33418-5806': '92d6e49278dcd362938f0141b8773adf7a7412356abc9e64603fe95fd7497f23',
    },
}
# The complete main assembly hall MUST be present; exclude accidental source
# gaps and prevent replacing the factory by a few tiny entrance buildings.
MAIN_HALL_ID = 'DEBBAL01000cy6Wk'
FACTORY_HALL_IDS = ['DEBBAL01000cy6Wk', 'DEBBAL01000cy6Wi',
                    'DEBBAL01000cy6Vt', 'DEBBAL01000cy6Vn']

spec = importlib.util.spec_from_file_location('cottbus', ROOT / 'scripts' / 'build-cottbus-isometric.py')
assert spec and spec.loader
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
source.ZOOM = ROOF_ZOOM
source.OUTPUT = OUTPUT


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_url(kind: str, tile: str) -> str:
    directory = '3d_gebaeude/lod2_gml' if kind == 'lod2' else 'dop/rgb_jpg'
    return f'https://data.geobasis-bb.de/geobasis/daten/{directory}/{kind}_{tile}.zip'


@lru_cache(maxsize=None)
def checked_archive(kind: str, tile: str) -> Path:
    expected = SOURCE_SHA256[kind].get(tile)
    if not expected or len(expected) != 64:
        raise RuntimeError(f'Missing reviewed source checksum for {kind}/{tile}')
    path = CACHE / kind / f'{kind}_{tile}.zip'
    if not path.is_file() or sha256(path) != expected:
        if OFFLINE:
            raise RuntimeError(f'Missing/changed exact source archive: {path}')
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix('.zip.part')
        with urlopen(Request(source_url(kind, tile), headers={'User-Agent': 'batikan-earth-source-authoring/1'}), timeout=180) as response, partial.open('wb') as target:
            while chunk := response.read(262144):
                target.write(chunk)
        if sha256(partial) != expected:
            partial.unlink(missing_ok=True)
            raise RuntimeError(f'Official {kind}/{tile} changed; review before updating pinned source')
        partial.replace(path)
    with ZipFile(path) as archive:
        members = archive.namelist()
        expected_member = f'{kind}_{tile}_geb.gml' if kind == 'lod2' else f'{kind}_{tile}.jpg'
        if expected_member not in members:
            raise RuntimeError(f'Official archive member changed: {path}')
        meta_members = [member for member in members if member.endswith('.html')]
        if len(meta_members) != 1:
            raise RuntimeError(f'Official archive metadata missing: {path}')
        metadata = html.unescape(archive.read(meta_members[0]).decode('utf-8'))
        if 'Datenlizenz Deutschland - Namensnennung - Version 2.0' not in metadata or SOURCE_DATES[kind] not in metadata:
            raise RuntimeError(f'Official archive license/date changed: {path}')
    return path


source.checked_archive = checked_archive  # Reuse validated Cottbus pixel registration/reprojection.


def common_metadata(kind: str, tiles: list[str]) -> dict:
    return {
        'source': 'GeoBasis-DE/LGB Brandenburg, 3D-Gebäudemodell LoD2 CityGML' if kind == 'lod2' else 'GeoBasis-DE/LGB Brandenburg, 20 cm RGB TrueDOP',
        'source_urls': [source_url(kind, tile) for tile in tiles],
        'source_zip_sha256': {tile: SOURCE_SHA256[kind][tile] for tile in tiles},
        'source_crs': 'ETRS89_UTM33*DE_DHHN2016_NH' if kind == 'lod2' else 'EPSG:25833',
        'source_update_date': SOURCE_DATES[kind] if kind == 'lod2' else None,
        'source_flight_date': SOURCE_DATES[kind] if kind == 'dop' else None,
        'source_publication_date': '2023-12-19' if kind == 'dop' else None,
        'license': LICENSE, 'license_url': LICENSE_URL, 'credit': CREDIT,
        'event_slug': EVENT_SLUG,
        'origin_lonlat': ORIGIN,
        'event_coordinates_lonlat': EVENT_COORDINATES,
        'venue': 'Tesla Gigafactory Berlin-Brandenburg',
    }


def write_json(name: str, metadata: dict) -> None:
    (OUTPUT / name).write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + '\n')


def build_geometry() -> np.ndarray:
    centre = Point(*source.WGS84_TO_UTM.transform(*ORIGIN))
    roofs, walls, ids, heights = [], [], [], []
    surfaces = 0
    main_hall_area = 0
    for tile in SOURCE_SHA256['lod2']:
        with ZipFile(checked_archive('lod2', tile)) as archive, archive.open(f'lod2_{tile}_geb.gml') as stream:
            verified_crs = False
            for _, element in etree.iterparse(stream, events=('end',)):
                if element.tag == f'{{{source.GML}}}Envelope':
                    if 'ETRS89_UTM33' not in element.get('srsName', ''):
                        raise RuntimeError('Official Tesla CityGML CRS changed')
                    verified_crs = True
                elif element.tag == f'{{{source.BLDG}}}Building':
                    rings = source.base.all_ground_rings(element)
                    footprints = [Polygon([(x, y) for x, y, _ in ring]) for ring in rings]
                    if footprints and min(p.distance(centre) for p in footprints) <= RADIUS_M:
                        identifier = element.get(source.GML_ID)
                        if not identifier or identifier in ids:
                            raise RuntimeError('Missing/duplicate official factory building ID')
                        ids.append(identifier)
                        heights.extend(z for ring in rings for x, y, z in ring)
                        if identifier == MAIN_HALL_ID:
                            main_hall_area = sum(p.area for p in footprints)
                        for kind, vertices in [('RoofSurface', roofs), ('WallSurface', walls)]:
                            for polygon in element.findall(f'.//{{{source.BLDG}}}{kind}//{{{source.GML}}}Polygon'):
                                triangles = source.base.triangle_vertices(polygon)
                                if triangles:
                                    surfaces += 1
                                    vertices.extend(triangles)
                    parent = element.getparent()
                    if parent is not None:
                        parent.remove(element)
                    element.clear()
            if not verified_crs:
                raise RuntimeError('Missing official source CRS')
    if not roofs or not walls or not set(FACTORY_HALL_IDS).issubset(ids) or main_hall_area < 140000:
        raise RuntimeError('Factory clip lacks complete real main halls')
    roof = source.local_positions(roofs, ORIGIN)
    wall = source.local_positions(walls, ORIGIN)
    asset = OUTPUT / f'{STEM}-lod2-v1.bin'
    asset.write_bytes(struct.pack('<4sIIIIIdd', b'BLD2', 1, len(roof), len(wall), len(ids), surfaces, *ORIGIN) + roof.tobytes() + wall.tobytes())
    if asset.stat().st_size > 8_000_000:
        raise RuntimeError('Factory mesh exceeds local 8 MB budget')
    write_json(f'{STEM}-lod2-v1.json', {
        **common_metadata('lod2', list(SOURCE_SHA256['lod2'])),
        'asset': asset.name, 'origin': ORIGIN, 'radius_m': RADIUS_M,
        'selected_buildings': len(ids), 'building_ids': ids,
        'required_factory_hall_ids': FACTORY_HALL_IDS,
        'main_hall_ground_area_m2': round(main_hall_area, 2),
        'roof_triangles': len(roof)//3, 'wall_triangles': len(wall)//3,
        'triangulated_surfaces': surfaces,
        'ground_height_range_m': [min(heights), max(heights)],
        'height_datum': 'DHHN2016 NH (official source)',
        'derived_changes': 'Full source factory halls plus 500 m campus clip; original CityGML roof/wall vertices triangulated and reprojected to Mercator-local metres; absolute official heights retained; no synthetic facade photography or guessed buildings',
        'bytes': asset.stat().st_size, 'binary_sha256': sha256(asset),
    })
    print(f'Tesla: {len(ids)} surveyed buildings, {(len(roof)+len(wall))//3:,} triangles, {asset.stat().st_size:,} B mesh', flush=True)
    return roof


def save_image(name: str, image: Image.Image, metadata: dict, quality: int = 92) -> dict:
    asset = OUTPUT / f'{name}.webp'
    image.save(asset, 'WEBP', quality=quality, method=6, exact=image.mode == 'RGBA')
    complete = {**metadata, 'asset': asset.name, 'width': image.width, 'height': image.height,
                'bytes': asset.stat().st_size, 'sha256': sha256(asset)}
    write_json(f'{name}.json', complete)
    print(f'{name}: {image.width}×{image.height}, {asset.stat().st_size:,} B', flush=True)
    return complete


def build_images(roof: np.ndarray) -> None:
    tiles = list(SOURCE_SHA256['dop'])
    bounds = source.atlas_bounds(roof, ORIGIN)
    atlas = source.render_atlas(bounds, ROOF_ZOOM)
    mpp = source.EARTH_CIRCUMFERENCE_M * math.cos(math.radians(ORIGIN[1])) / 2**ROOF_ZOOM / 256
    roof_name = f'{STEM}-roof-truedop20-v1'
    full = save_image(roof_name, atlas, {
        **common_metadata('dop', tiles),
        'source_grid': 'Official 20 cm RGB TrueDOP reprojected offline to EPSG:3857 z18',
        'source_native_metres_per_pixel': 0.2,
        'effective_metres_per_pixel': mpp,
        'source_tile_zoom': ROOF_ZOOM, 'source_tile_bounds_xyxy': list(bounds),
        'derived_changes': 'Source-aligned Mercator roof atlas sampled at native z18 (~36 cm); no upscaling/invented roof detail; true orthophoto is not facade photography',
    })
    half = atlas.resize((atlas.width//2, atlas.height//2), Image.Resampling.LANCZOS)
    save_image(f'{roof_name}-half', half, {
        **common_metadata('dop', tiles), 'source_asset': full['asset'],
        'source_asset_sha256': full['sha256'], 'source_metadata': f'{roof_name}.json',
        'source_tile_zoom': ROOF_ZOOM, 'source_tile_bounds_xyxy': list(bounds),
        'source_native_metres_per_pixel': 0.2, 'effective_metres_per_pixel': mpp*2,
        'derived_changes': 'Exact same-source Lanczos 2× roof atlas reduction for a bounded mobile GPU, not reduced source acquisition',
    })
    chapter = {'origin': ORIGIN, 'ground_grid': {'zoom': ROOF_ZOOM, 'tiles_per_axis': GROUND_TILE_COUNT}}
    zoom, grid = source.ground_bounds(chapter)
    ground_full = source.render_atlas(grid, zoom)
    ground = ground_full.resize((GROUND_SIZE, GROUND_SIZE), Image.Resampling.LANCZOS).convert('RGBA')
    # A narrow 3% outside feather leaves the entire giant factory unaltered.
    # The previous global 10 m ESA arrival mosaic is not a final venue texture.
    edge = np.minimum(np.minimum(np.arange(GROUND_SIZE)[None, :], (GROUND_SIZE-1-np.arange(GROUND_SIZE))[None, :]),
                      np.minimum(np.arange(GROUND_SIZE)[:, None], (GROUND_SIZE-1-np.arange(GROUND_SIZE))[:, None]))
    ramp = np.clip(edge/(GROUND_SIZE*0.03), 0, 1)
    rgba = np.asarray(ground).copy()
    rgba[:, :, 3] = np.rint((ramp*ramp*(3-2*ramp))*255).astype(np.uint8)
    ground = Image.fromarray(rgba)
    minx, miny, maxx, maxy = grid
    coordinates = [source.xyz_to_wgs84(minx,miny,zoom), source.xyz_to_wgs84(maxx+1,miny,zoom),
                   source.xyz_to_wgs84(maxx+1,maxy+1,zoom), source.xyz_to_wgs84(minx,maxy+1,zoom)]
    ground_meta = {
        **common_metadata('dop', tiles), 'source_native_metres_per_pixel': 0.2,
        'effective_metres_per_pixel': mpp * ground_full.width/GROUND_SIZE,
        'source_tile_zoom': zoom, 'source_tile_bounds_xyxy': list(grid),
        'coordinates': coordinates,
        'derived_changes': 'Full factory campus (~1.3 km) exact Mercator image; Lanczos resampled actual 20 cm TrueDOP to ~64 cm/pixel; outer 3% alpha edge only; no fabricated pixels',
        'camera': {'center': ORIGIN, 'zoom':16.6, 'pitch':52, 'bearing':25},
    }
    ground_meta = save_image(f'{STEM}-ground-truedop20-v1', ground, ground_meta, 92)
    save_image(f'{STEM}-ground-truedop20-v1-half', ground.resize((1024,1024),Image.Resampling.LANCZOS), {
        **ground_meta, 'source_asset': ground_meta['asset'], 'source_asset_sha256': ground_meta['sha256'],
        'effective_metres_per_pixel': ground_meta['effective_metres_per_pixel']*2,
        'derived_changes':'Same-source Lanczos 2× ground reduction for constrained devices; identical geographic corners; no fabricated pixels',
    }, 92)


def verify() -> None:
    mesh_meta=json.loads((OUTPUT/f'{STEM}-lod2-v1.json').read_text())
    mesh_path=OUTPUT/mesh_meta['asset'];raw=mesh_path.read_bytes()
    header=struct.unpack_from('<4sIIIIIdd',raw)
    assert header[:2]==(b'BLD2',1) and list(header[-2:])==ORIGIN
    assert len(raw)==40+12*(header[2]+header[3]) and sha256(mesh_path)==mesh_meta['binary_sha256']
    assert set(FACTORY_HALL_IDS).issubset(mesh_meta['building_ids'])
    assert mesh_meta['main_hall_ground_area_m2']>140000
    for suffix in ['roof-truedop20-v1','roof-truedop20-v1-half','ground-truedop20-v1','ground-truedop20-v1-half']:
        meta=json.loads((OUTPUT/f'{STEM}-{suffix}.json').read_text());path=OUTPUT/meta['asset']
        assert meta['bytes']==path.stat().st_size and meta['sha256']==sha256(path)
        with Image.open(path)as image:assert image.size==(meta['width'],meta['height'])
        assert meta['origin_lonlat']==ORIGIN and meta['source_flight_date']=='2023-05-04'
        assert 'dl-de/by-2-0' in meta['license_url']
        if suffix.startswith('ground'):assert meta['width']<=2048 and meta['height']<=2048 and meta['bytes']<=4000000
        else:assert meta['width']<=4096 and meta['height']<=4096 and meta['bytes']<=10000000
    roof=np.frombuffer(raw,dtype='<f4',offset=40).reshape(-1,3)[:header[2]]
    ground=json.loads((OUTPUT/f'{STEM}-ground-truedop20-v1.json').read_text())
    minx,miny,maxx,maxy=ground['source_tile_bounds_xyxy']
    tile_m=source.EARTH_CIRCUMFERENCE_M*math.cos(math.radians(ORIGIN[1]))/2**ROOF_ZOOM
    ox=(ORIGIN[0]+180)/360*2**ROOF_ZOOM
    oy=(1-math.asinh(math.tan(math.radians(ORIGIN[1])))/math.pi)/2*2**ROOF_ZOOM
    us=((ox-minx)+roof[:,0]/tile_m)/(maxx-minx+1)
    vs=((oy-miny)-roof[:,2]/tile_m)/(maxy-miny+1)
    assert min(us)>0.03 and max(us)<0.97 and min(vs)>0.03 and max(vs)<0.97, 'Factory roofs must not fade into blurry outside imagery'
    with Image.open(OUTPUT/ground['asset'])as image:
        assert image.mode=='RGBA'
        alpha=np.asarray(image.getchannel('A'))
        assert not alpha[0,:].any() and not alpha[-1,:].any() and not alpha[:,0].any() and not alpha[:,-1].any()
        xs=np.minimum((us*ground['width']).astype(int),ground['width']-1)
        ys=np.minimum((vs*ground['height']).astype(int),ground['height']-1)
        assert np.min(alpha[ys,xs])==255, 'Every real factory roof must have fully opaque ground context'
    print('Verified Tesla source model, complete main halls, image hashes/dimensions, opaque factory coverage and resource caps.',flush=True)


OFFLINE=False
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline',action='store_true')
    parser.add_argument('--verify-only',action='store_true')
    args=parser.parse_args();OFFLINE=args.offline
    OUTPUT.mkdir(parents=True,exist_ok=True)
    if not args.verify_only:build_images(build_geometry())
    verify()
