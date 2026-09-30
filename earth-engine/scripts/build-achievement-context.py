#!/usr/bin/env python3
"""Offline, bounded OSM snapshot. No third-party geography request at runtime.

OSM ways retain their actual mapped footprint; roofs/heights are illustrative
massing unless OSM provides height or building:levels. Clipping is explicit.
Raw response SHA-256, bounding box and IDs make every feature traceable.
"""
import argparse, datetime, gzip, hashlib, json, math, pathlib, re, time, urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'design' / 'sources' / 'achievement-context'
OUT = ROOT / 'public' / 'data' / 'achievement-context-v2.json'
R = 6_371_008.8
RADIUS = 185
CLIP = 260
MAX_BUILDINGS = 100
MAX_TREES = 70

def metres(lon, lat, origin):
    return [(lon-origin[0])*math.pi/180*R*math.cos(origin[1]*math.pi/180),
            (lat-origin[1])*math.pi/180*R]

def clipped(ring):
    # Actual OSM footprint clipped to the local asset envelope, not recreated.
    points=ring
    for axis, bound, sign in [(0,-CLIP,1),(0,CLIP,-1),(1,-CLIP,1),(1,CLIP,-1)]:
        if not points:return []
        result=[]
        for i,a in enumerate(points):
            b=points[(i+1)%len(points)]
            ia=sign*(a[axis]-bound)>=0;ib=sign*(b[axis]-bound)>=0
            if ia:result.append(a)
            if ia != ib:
                ratio=(bound-a[axis])/(b[axis]-a[axis])
                result.append([a[0]+ratio*(b[0]-a[0]),a[1]+ratio*(b[1]-a[1])])
        points=result
    return points

def number(value):
    if not value:return None
    m=re.match(r'^\s*(\d+(?:\.\d+)?)',value)
    if not m:return None
    n=float(m[1]);return n*.3048 if 'ft' in value.lower() or "'" in value else n

def height(tags):
    h=number(tags.get('height'))
    if h and .5<=h<=400:return round(h,2),'osm-height'
    levels=number(tags.get('building:levels'))
    if levels and 1<=levels<=100:return round(levels*3.0,2),'osm-levels-3m-estimate'
    industrial=tags.get('building') in ('industrial','warehouse','hangar')
    return (6.0 if industrial else 9.0),'illustrative-height'

def area(ring):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]+ring[:1])))/2

def matches_bbox(raw, bbox):
    """A slug is not a geographic cache key: the authored venue may move."""
    bounds=ET.fromstring(raw).find('bounds')
    if bounds is None:return False
    actual=[float(bounds.attrib[k]) for k in ('minlon','minlat','maxlon','maxlat')]
    return all(abs(a-round(b,7))<1e-7 for a,b in zip(actual,bbox))

def snapshot(events):
    event=events[0];origin=[event['coordinates']['lng'],event['coordinates']['lat']]
    lat_delta=RADIUS/R*180/math.pi;lon_delta=lat_delta/math.cos(origin[1]*math.pi/180)
    bbox=[origin[0]-lon_delta,origin[1]-lat_delta,origin[0]+lon_delta,origin[1]+lat_delta]
    name=event['slug']+'.osm.gz';path=SOURCES/name
    url='https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(f'{x:.7f}' for x in bbox)
    raw=gzip.decompress(path.read_bytes()) if path.exists() else None
    if raw is not None and not matches_bbox(raw,bbox):
        # Preserve the old pinned response as historical evidence, but never
        # project its geometry onto a newly corrected venue coordinate.
        key=hashlib.sha256(','.join(f'{x:.7f}' for x in bbox).encode()).hexdigest()[:12]
        name=event['slug']+'-'+key+'.osm.gz';path=SOURCES/name
        raw=gzip.decompress(path.read_bytes()) if path.exists() else None
    if raw is None or not matches_bbox(raw,bbox):
        for attempt in range(3):
            try:
                req=urllib.request.Request(url,headers={'User-Agent':'BatikanPortfolio/1.0 (offline local venue massing)'});
                raw=urllib.request.urlopen(req,timeout=40).read();break
            except Exception:
                if attempt==2:raise
                time.sleep(3*(attempt+1))
        if not matches_bbox(raw,bbox):raise ValueError('OSM returned an unexpected geographic bounding box')
        path.write_bytes(gzip.compress(raw,mtime=0));time.sleep(.6)
    xml=ET.fromstring(raw)
    nodes={a.attrib['id']:a for a in xml.findall('node')}
    buildings=[];trees=[]
    for way in xml.findall('way'):
        tags={a.attrib['k']:a.attrib['v'] for a in way.findall('tag')}
        if not tags.get('building') or tags['building']=='no':continue
        refs=[a.attrib['ref'] for a in way.findall('nd')]
        if len(refs)<4 or refs[0]!=refs[-1] or any(ref not in nodes for ref in refs):continue
        ring=[metres(float(nodes[ref].attrib['lon']),float(nodes[ref].attrib['lat']),origin) for ref in refs[:-1]]
        if len(ring)>512:continue
        ring=clipped(ring)
        if len(ring)<3 or area(ring)<5:continue
        h,basis=height(tags)
        base=number(tags.get('min_height')) or 0
        if base<0 or base>=h:base=0
        dist=min(math.hypot(*p) for p in ring)
        buildings.append({'id':int(way.attrib['id']),'height':h,'base':round(base,2),'basis':basis,
                          'ring':[[round(a,2),round(b,2)] for a,b in ring], '_d':dist})
    for nid,node in nodes.items():
        tags={a.attrib['k']:a.attrib['v'] for a in node.findall('tag')}
        if tags.get('natural')!='tree':continue
        xy=metres(float(node.attrib['lon']),float(node.attrib['lat']),origin)
        if math.hypot(*xy)>CLIP:continue
        h=number(tags.get('height')) or 7
        if not 1<=h<=40:h=7
        trees.append({'id':int(nid),'xy':[round(a,2) for a in xy],'height':round(h,2),
                      'basis':'osm-height' if number(tags.get('height')) else 'illustrative-height',
                      'evergreen':tags.get('leaf_type')=='needleleaved'})
    buildings.sort(key=lambda b:b.pop('_d'))
    buildings=buildings[:MAX_BUILDINGS];trees=trees[:MAX_TREES]
    record={'origin':origin,'slugs':[a['slug'] for a in events],'bbox':bbox,'radiusM':CLIP,
            'source':{'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'snapshot':name},
            'buildings':buildings,'trees':trees}
    print(event['slug'],len(buildings),'buildings',len(trees),'trees',flush=True)
    return record

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only',metavar='EVENT_SLUG',help='Refresh only this venue pocket; preserve all other pinned geometry and metadata')
    args=parser.parse_args()
    SOURCES.mkdir(parents=True,exist_ok=True)
    events=json.loads((ROOT/'src/data/achievements.json').read_text())
    groups={}
    for event in events:
        pair=(event['coordinates']['lng'],event['coordinates']['lat'])
        groups.setdefault(pair,[]).append(event)
    if args.only:
        selected=next((group for group in groups.values() if any(event['slug']==args.only for event in group)),None)
        if selected is None:parser.error('Unknown achievement slug: '+args.only)
        data=json.loads(OUT.read_text())
        indices=[i for i,chapter in enumerate(data['chapters']) if args.only in chapter['slugs']]
        if len(indices)!=1:parser.error('Partial refresh requires exactly one existing venue pocket')
        if set(data['chapters'][indices[0]]['slugs']) != {event['slug'] for event in selected}:
            parser.error('Coordinate grouping changed; a complete rebuild is required')
        data['chapters'][indices[0]]=snapshot(selected)
    else:
        data={'version':1,'retrieved':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'license':'ODbL 1.0',
              'attribution':'© OpenStreetMap contributors',
              'provenance':'Actual mapped footprints/trees. Flat roofs and absent heights are illustrative massing; no photogrammetry or surveyed height claim.',
              'extentM':CLIP,'chapters':[snapshot(group) for group in groups.values()]}
    OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    print('Wrote',OUT,OUT.stat().st_size,'bytes')

if __name__=='__main__':main()
