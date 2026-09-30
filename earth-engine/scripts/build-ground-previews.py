#!/usr/bin/env python3
"""Reuse existing audited official atlases as fast georeferenced ground images.
No new provider calls. Same-source Lanczos resampling, explicit extent/receipt.
"""
import hashlib
import json
import math
import pathlib
from PIL import Image, ImageDraw

ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'public/data'
for stem in ['munich-siemens-roof-dop20','munich-google-roof-dop20','berlin-library-roof-truedop20']:
    source_name=stem+'-v1.webp'
    metadata=json.loads((DATA/(stem+'-v1.json')).read_text())
    raw=(DATA/source_name).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==metadata['sha256']
    image=Image.open(DATA/source_name).convert('RGBA')
    image.thumbnail((1536,1536),Image.Resampling.LANCZOS)
    # Feather only the source rectangle's outer edge, not fabricated detail.
    alpha=Image.new('L',image.size)
    draw=ImageDraw.Draw(alpha)
    for inset in range(55):
        draw.rectangle([inset,inset,image.width-1-inset,image.height-1-inset],fill=round(255*min(1,inset/54)))
    image.putalpha(alpha)
    name=stem.split('-roof-')[0]+'-ground-preview-v1.webp'
    image.save(DATA/name,'WEBP',quality=90,method=6)
    x0,y0,x1,y1=metadata['source_tile_bounds_xyxy']; n=2**metadata['source_tile_zoom']
    lon=lambda x:x/n*360-180
    lat=lambda y:math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n))))
    corners=[[lon(x0),lat(y0)],[lon(x1+1),lat(y0)],[lon(x1+1),lat(y1+1)],[lon(x0),lat(y1+1)]]
    derived=(DATA/name).read_bytes()
    receipt={**metadata,'asset':name,'width':image.width,'height':image.height,
             'coordinates':corners,'bytes':len(derived),'sha256':hashlib.sha256(derived).hexdigest(),
             'source_asset':source_name,'source_asset_sha256':metadata['sha256'],
             'derived_changes':'Same official atlas, Lanczos <=1536px ground preview with outer alpha feather; no invented or upscaled geographic detail.'}
    (DATA/name.replace('.webp','.json')).write_text(json.dumps(receipt,indent=2)+'\n')
    print(name,len(derived),image.size)
