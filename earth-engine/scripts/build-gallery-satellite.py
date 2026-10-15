#!/usr/bin/env python3
"""Fetch the CC BY 4.0 *2016* EOX mosaic at build time; never proxy live tiles.

No newer EOX layer is interchangeable: those carry non-commercial restrictions.
The bounded export is one global JPEG and two LODs for each authored city.
Requires Pillow. Existing verified files are reused unless --refresh is given.
"""
import concurrent.futures
import datetime
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/gallery/satellite'
EVIDENCE = ROOT.parents[2] / 'release-handoffs/gallery-single-wall-20261013'
SOURCE = 'https://tiles.maps.eox.at/wms'
LICENSE = 'https://creativecommons.org/licenses/by/4.0/'
ATTRIBUTION = ('Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH '
               '(Contains modified Copernicus Sentinel data 2016 & 2017)')
LICENSE_EVIDENCE = ['https://eox.at/2025/03/sentinel-2-cloudless-2024/',
                    'https://cloudless.eox.at/pricing', LICENSE]


def build():
    from PIL import Image
    OUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    previous_path = OUT / 'attribution.json'
    previous = json.loads(previous_path.read_text()) if previous_path.exists() else {}
    verified_cache = {record['url']: record for record in previous.get('files', [])}
    projects = json.loads((ROOT / 'src/data/achievements.json').read_text())
    groups = {}
    for project in projects:
        groups.setdefault((project['city'], project['country']), []).append(project)
    regions, jobs = [], []
    for index, ((city, country), members) in enumerate(groups.items()):
        latitude = (min(p['coordinates']['lat'] for p in members) + max(p['coordinates']['lat'] for p in members)) / 2
        longitude = (min(p['coordinates']['lng'] for p in members) + max(p['coordinates']['lng'] for p in members)) / 2
        region = {'id': f'city-{index:02d}', 'city': city, 'country': country,
                  'latitude': latitude, 'longitude': longitude,
                  'slugs': [p['slug'] for p in members], 'levels': []}
        for level, span, size, minimum_zoom in [('region', 4, 1024, 44), ('city', .8, 2048, 190)]:
            half = span / 2
            lng_half = half / math.cos(math.radians(latitude))
            bounds = [longitude-lng_half, latitude-half, longitude+lng_half, latitude+half]
            record = {'id': f'{region["id"]}-{level}', 'level': level, 'bounds': bounds,
                      'width': size, 'height': size, 'minimumZoom': minimum_zoom,
                      'url': f'/assets/gallery/satellite/{region["id"]}-{level}.jpg'}
            region['levels'].append(record)
            jobs.append(record)
        regions.append(region)
    global_map = {'id': 'world', 'level': 'world', 'bounds': [-180, -90, 180, 90],
                  'width': 4096, 'height': 2048, 'url': '/assets/gallery/satellite/world.jpg'}
    small_map = {'id': 'world-small', 'level': 'world', 'bounds': [-180, -90, 180, 90],
                 'width': 2048, 'height': 1024, 'url': '/assets/gallery/satellite/world-small.jpg'}
    jobs.insert(0, global_map)
    jobs.insert(1, small_map)

    def fetch(record):
        params = {'service': 'WMS', 'request': 'GetMap', 'version': '1.1.1',
                  'layers': 's2cloudless', 'styles': '', 'format': 'image/jpeg',
                  'srs': 'EPSG:4326', 'bbox': ','.join(f'{v:.9f}' for v in record['bounds']),
                  'width': record['width'], 'height': record['height']}
        url = SOURCE + '?' + urllib.parse.urlencode(params)
        target = OUT / Path(record['url']).name
        cached = verified_cache.get(record['url'], {})
        reusable = target.exists() and cached.get('sourceUrl') == url and cached.get('sha256') == hashlib.sha256(target.read_bytes()).hexdigest()
        if not reusable or '--refresh' in sys.argv:
            for attempt in range(3):
                try:
                    request = urllib.request.Request(url, headers={'User-Agent': 'BatikanPortfolioImageryBuild/1.0'})
                    with urllib.request.urlopen(request, timeout=120) as response:
                        data = response.read()
                        if response.headers.get_content_type() != 'image/jpeg':
                            raise ValueError('WMS did not return JPEG satellite imagery')
                    image = Image.open(io.BytesIO(data))
                    if image.size != (record['width'], record['height']):
                        raise ValueError('Unexpected WMS image dimensions')
                    target.write_bytes(data)
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    time.sleep(2 * (attempt + 1))
        data = target.read_bytes()
        with Image.open(target) as image:
            if image.size != (record['width'], record['height']):
                raise ValueError(f'Unexpected cached dimensions: {target}')
        digest = hashlib.sha256(data).hexdigest()
        # Version browser caches by actual bytes, including changes to bounds.
        record['revision'] = digest[:12]
        return {**record, 'sourceUrl': url, 'bytes': len(data),
                'sha256': digest, 'mime': 'image/jpeg'}

    # Three requests at a time: the complete finite export is under 40 images.
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        fetched = list(pool.map(fetch, jobs))
    inventory = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                 'provider': 'EOX IT Services GmbH', 'sourceLayer': 's2cloudless',
                 'acquisitionYears': [2016, 2017], 'license': LICENSE,
                 'licenseEvidence': LICENSE_EVIDENCE, 'attribution': ATTRIBUTION,
                 'processing': 'Bounded WMS EPSG:4326 exports; original JPEG bytes retained.',
                 'global': global_map, 'smallGlobal': small_map, 'regions': regions, 'files': fetched,
                 'totalBytes': sum(r['bytes'] for r in fetched),
                 'runtimeDelivery': 'Same-origin self-hosted assets only; no external imagery requests.'}
    (OUT / 'attribution.json').write_text(json.dumps(inventory, indent=2) + '\n')
    (EVIDENCE / 'satellite-imagery-inventory.json').write_text(json.dumps(inventory, indent=2) + '\n')
    metadata = {'global': global_map, 'smallGlobal': small_map, 'regions': regions, 'attribution': ATTRIBUTION,
                'license': LICENSE, 'sourceYears': [2016, 2017]}
    (ROOT / 'src/galleryRoomSatelliteData.js').write_text(
        '// Generated by scripts/build-gallery-satellite.py from CC BY 4.0 EOX 2016 imagery.\n'
        'export const GALLERY_SATELLITE_DATA = ' + json.dumps(metadata, ensure_ascii=False, indent=2) + ';\n')
    print(json.dumps({'images': len(fetched), 'cities': len(regions), 'totalBytes': inventory['totalBytes']}))


if __name__ == '__main__':
    build()
