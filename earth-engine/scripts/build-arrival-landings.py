#!/usr/bin/env python3
"""Native source-pixel landing mosaics; no client-side tile stitching.

Reads the existing pinned ESA source PNGs and unchanged arrivalTiles manifest.
Stitches 3x3 256px z14 originals at their exact pixel boundaries (768x768), then
encodes WebP q90. There is no resampling, upscaling or new source-detail claim.
The command is offline; missing source files fail instead of silently fetching.
"""
import argparse
import hashlib
import io
import json
import math
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = pathlib.Path('/tmp/batikan-esa-arrival-source-v1')
OUTPUT = ROOT / 'public/assets/arrival'
MANIFEST = ROOT / 'src/data/arrivalLandings.json'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def lon(tile_x, zoom):
    return tile_x / (2**zoom) * 360 - 180


def lat(tile_y, zoom):
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * tile_y / (2**zoom)))))


def corners(zoom, x, y):
    west, east = lon(x-1, zoom), lon(x+2, zoom)
    north, south = lat(y-1, zoom), lat(y+2, zoom)
    return [[west,north],[east,north],[east,south],[west,south]]


def build(key, tiles, cache, check=False):
    zoom,x,y = map(int,key.split('/'))
    assert zoom == 14 and 1 <= x < 2**zoom-1 and 1 <= y < 2**zoom-1, 'Only bounded authored z14 pockets are supported'
    keys = [f'{zoom}/{tile_x}/{tile_y}' for tile_y in range(y-1,y+2) for tile_x in range(x-1,x+2)]
    mosaic = Image.new('RGB',(768,768))
    source_hashes = {}
    source_bytes = 0
    for i,source_key in enumerate(keys):
        assert source_key in tiles, f'Unpinned source tile {source_key}'
        path = cache/(source_key.replace('/','-')+'.png')
        raw = path.read_bytes()
        assert sha(raw) == tiles[source_key]['sourceSha256'], f'Source hash changed: {source_key}'
        assert len(raw) == tiles[source_key]['sourceBytes'], f'Source byte count changed: {source_key}'
        image = Image.open(io.BytesIO(raw)).convert('RGB')
        assert image.size == (256,256), f'Do not resample source tile {source_key}'
        # Integer paste preserves source RGB pixels exactly before encoding.
        mosaic.paste(image,((i%3)*256,(i//3)*256))
        source_hashes[source_key] = sha(raw)
        source_bytes += len(raw)
    stream = io.BytesIO()
    mosaic.save(stream,'WEBP',quality=90,method=6)
    derived = stream.getvalue()
    digest = sha(derived)
    name = f'landing-{zoom}-{x}-{y}-{digest[:12]}.webp'
    path = OUTPUT/name
    if check:
        assert path.read_bytes() == derived, f'Landing encoding differs: {key}'
    else:
        path.write_bytes(derived)
    return {'url':f'/assets/arrival/{name}', 'bytes':len(derived), 'sha256':digest,
            'width':768,'height':768,'coordinates':corners(zoom,x,y),
            'sourceKeys':keys,'sourceSha256':source_hashes,'sourceBytes':source_bytes,
            'stitchedRgbSha256':sha(mosaic.tobytes())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-cache',type=pathlib.Path,default=CACHE)
    parser.add_argument('--check',action='store_true',help='Verify existing exact stitching and encoding without modifying assets')
    args = parser.parse_args()
    original_path = ROOT/'src/data/arrivalTiles.json'
    original_bytes = original_path.read_bytes()
    original = json.loads(original_bytes)
    events = {slug:group['detail'][0] for slug,group in original['events'].items()}
    assert len(events) == 32 and all(key.startswith('14/') for key in events.values())
    OUTPUT.mkdir(parents=True,exist_ok=True)
    landings = {}
    for key in dict.fromkeys(events.values()):
        landings[key] = build(key,original['tiles'],args.source_cache,check=args.check)
        print(key,landings[key]['bytes'],'bytes',flush=True)
    manifest = {'schema':1,'source':original['source'],'license':original['license'],
                'sourceUrl':original['sourceUrl'],'attribution':original['attribution'],
                'derivation':'3x3 original 256px PNG source tiles stitched at native 768x768 pixels, then WebP quality90. No resampling or upscaling.',
                'sourceManifestSha256':sha(original_bytes),'events':events,'landings':landings}
    encoded = json.dumps(manifest,separators=(',',':'))+'\n'
    if args.check:
        assert MANIFEST.read_text() == encoded, 'Landing manifest is not reproducible from pinned sources'
    else:
        MANIFEST.write_text(encoded)
    assert original_path.read_bytes() == original_bytes, 'Existing arrivalTiles manifest must remain untouched'
    print(f'{len(events)} events; {len(landings)} deduped native landing mosaics; {sum(item["bytes"] for item in landings.values()):,} WebP bytes',flush=True)


if __name__ == '__main__':
    main()
