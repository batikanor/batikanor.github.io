#!/usr/bin/env python3
"""Prepare bounded, real ESA imagery at all authored destinations.

One-time release preparation, NOT a visitor-side downloader. Downloads only
3x3 z11 + z14 pockets, reuses an on-disk source cache, preserves source hashes,
and converts PNG to WebP without changing dimensions or claiming more detail.
ESA WorldCover 2021 / modified Copernicus Sentinel data, CC BY 4.0.
"""
import concurrent.futures
import hashlib
import io
import json
import math
import pathlib
import time
import urllib.request
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = pathlib.Path('/tmp/batikan-esa-arrival-source-v1')
OUTPUT = ROOT / 'public/assets/arrival'
TEMPLATE = ('https://wmts.terrascope.be/?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
            '&LAYER=esa-worldcover-s2rgbnir-10m-2021-v2_tcc&STYLE=default&FORMAT=image/png'
            '&TILEMATRIXSET=EPSG:3857&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&TIME=2021-01-01')

def cover(lng, lat, z):
    n = 2 ** z
    x = math.floor((lng + 180) / 360 * n)
    y = math.floor((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    # Centre first, then the immediate ring. Sorted by distance for preloading.
    offsets = [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)]
    return [f'{z}/{(x+dx)%n}/{min(n-1,max(0,y+dy))}' for dx, dy in offsets]

def build(key):
    z, x, y = map(int, key.split('/'))
    raw_path = CACHE / (key.replace('/', '-') + '.png')
    if not raw_path.exists():
        for attempt in range(3):
            try:
                req = urllib.request.Request(TEMPLATE.format(z=z,x=x,y=y), headers={'User-Agent': 'BatikanPortfolioArrivalPreparation/1.0'})
                with urllib.request.urlopen(req, timeout=35) as response:
                    assert response.headers.get_content_type() == 'image/png', 'Expected real ESA PNG'
                    raw = response.read(500_001)
                    assert len(raw) <= 500_000, 'Unexpected tile size'
                Image.open(io.BytesIO(raw)).verify()
                raw_path.write_bytes(raw)
                break
            except Exception:
                if attempt == 2: raise
                time.sleep(1 + attempt * 2)
    raw = raw_path.read_bytes()
    image = Image.open(io.BytesIO(raw)).convert('RGB')
    assert image.size == (256, 256), 'Do not rescale source tiles'
    stream = io.BytesIO()
    image.save(stream, 'WEBP', quality=90, method=6)
    derived = stream.getvalue()
    sha = hashlib.sha256(derived).hexdigest()
    filename = f'esa-{z}-{x}-{y}-{sha[:12]}.webp'
    (OUTPUT / filename).write_bytes(derived)
    return key, {'url':f'/assets/arrival/{filename}', 'bytes':len(derived),
                 'sha256':sha, 'sourceBytes':len(raw), 'sourceSha256':hashlib.sha256(raw).hexdigest()}

def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    achievements = json.loads((ROOT / 'src/data/achievements.json').read_text())
    events = {event['slug']: {'overview':cover(event['coordinates']['lng'],event['coordinates']['lat'],11),
                              'detail':cover(event['coordinates']['lng'],event['coordinates']['lat'],14)} for event in achievements}
    keys = list(dict.fromkeys(key for event in events.values() for tier in event.values() for key in tier))
    tiles = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for index, (key, tile) in enumerate(pool.map(build, keys), 1):
            tiles[key] = tile
            if index % 20 == 0: print(f'{index}/{len(keys)} source tiles prepared', flush=True)
    manifest = {'schema':1, 'source':'ESA WorldCover 2021 Sentinel-2 RGB annual composite',
                'license':'CC-BY-4.0', 'sourceUrl':'https://esa-worldcover.org/en/data-access',
                'attribution':'© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
                'derivation':'256px PNG → WebP quality90. Same tile grid and source resolution; not upscaled.',
                'events':events, 'tiles':tiles}
    (ROOT / 'src/data/arrivalTiles.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    print(f'{len(events)} destinations, {len(tiles)} tiles, {sum(t["bytes"] for t in tiles.values()):,} WebP bytes', flush=True)

if __name__ == '__main__': main()
