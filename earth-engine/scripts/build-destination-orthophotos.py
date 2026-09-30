#!/usr/bin/env python3
"""Build source-audited, native-detail destination imagery, not satellite upscales.

Only government imagery with explicit public reuse terms is included. Downloaded
inputs are pinned under design/sources (outside Vite public). WMS requests sample
1000 metres at 2048 pixels. XYZ mosaics concatenate 8x8 original z18 tiles with no
resampling. The 1024px alternative is a documented downsample, not a quality
substitute at the same camera zoom. --check verifies the release without network.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import math
from pathlib import Path
import threading
import time
from urllib.parse import urlencode

from PIL import Image, ImageStat
from pyproj import Transformer
import requests

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/assets/destination-orthophotos'
INPUTS = ROOT / 'design/sources/destination-orthophotos'
MANIFEST = ROOT / 'src/data/destinationOrthophotos.json'
MERCATOR = Transformer.from_crs(4326, 3857, always_xy=True)
LONLAT = Transformer.from_crs(3857, 4326, always_xy=True)
WORLD = 40075016.68557849
EDGE = 2048


def source(title, url, license, license_url, attribution, native, **adapter):
    return dict(title=title, url=url, license=license, licenseUrl=license_url,
                attribution=attribution, nativeResolutionM=native, **adapter)


SOURCES = {
    'bavaria': source('Bavarian DOP20',
        'https://geodatenonline.bayern.de/geodatenonline/seiten/wms_dop',
        'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/',
        '© Bayerische Vermessungsverwaltung · DOP20 (modified) · CC BY 4.0', .2,
        endpoint='https://geoservices.bayern.de/od/wms/dop/v1/dop20', layer='by_dop20c', version='1.1.1'),
    'berlin': source('Berlin TrueDOP 2026',
        'https://daten.berlin.de/datensaetze/digitale-farbige-trueorthophotos-2026-dop20rgbi-wms-3801a94c',
        'dl-de-zero-2.0', 'https://www.govdata.de/dl-de/zero-2-0',
        '© Geoportal Berlin · TrueDOP 2026 (modified) · dl-de-zero-2.0', .2,
        endpoint='https://gdi.berlin.de/services/wms/truedop_2026', layer='truedop_2026'),
    'brandenburg': source('Brandenburg DOP20',
        'https://isk.geobasis-bb.de/mapproxy/dop20c/service/wms?service=WMS&request=GetCapabilities',
        'dl-de/by-2-0', 'https://www.govdata.de/dl-de/by-2-0',
        '© GeoBasis-DE/LGB · DOP20 (modified) · dl-de/by-2-0', .2,
        endpoint='https://isk.geobasis-bb.de/mapproxy/dop20c/service/wms', layer='bebb_dop20c'),
    'austria': source('basemap.at Orthofoto', 'https://basemap.at/en/orthofoto/',
        'CC BY 4.0', 'https://basemap.at/',
        '© basemap.at · Orthofoto (modified) · CC BY 4.0', .3,
        xyz='https://maps.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg'),
    'switzerland': source('SWISSIMAGE', 'https://www.swisstopo.admin.ch/en/faq-free-geodata',
        'swisstopo OGD terms', 'https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices',
        '© swisstopo · SWISSIMAGE (modified)', .1,
        endpoint='https://wms.geo.admin.ch/', layer='ch.swisstopo.swissimage'),
    'helsinki': source('Helsinki orthophotographs 2025', 'https://hri.fi/data/en/dataset/helsingin-ortoilmakuvat',
        'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/',
        'Source: Orthophotographs of Helsinki · Helsingin kaupunkiympäristön toimiala / Kaupunkimittauspalvelut · HRI · CC BY 4.0 (modified)', .05,
        endpoint='https://kartta.hel.fi/ws/geoserver/avoindata/wms', layer='avoindata:Ortoilmakuva_2025_5cm'),
    'japan': source('GSI seamless aerial photographs', 'https://maps.gsi.go.jp/development/ichiran.html',
        'Public Data License 1.0', 'https://www.gsi.go.jp/ENGLISH/page_e30286.html',
        'Created by editing GSI Tiles (seamless aerial photographs) · Geospatial Information Authority of Japan · PDL 1.0', .5,
        xyz='https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'),
    'barcelona': source('ICGC Catalonia orthophoto 2025',
        'https://www.icgc.cat/en/Geoinformation-and-Maps/Online-services-Geoservices/WMS-Orthoimages/WMS-Territorial-Orthophoto',
        'CC BY 4.0', 'https://www.icgc.cat/en/ICGC/Public-Information/Transparency/Re-use-information',
        'Derived from the Orthophoto of Catalonia 2025 · Institut Cartogràfic i Geològic de Catalunya (ICGC) · CC BY 4.0', .25,
        endpoint='https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms', layer='ortofoto_color_2025'),
    'poland': source('GUGiK high-resolution orthophoto', 'https://www.geoportal.gov.pl/pl/dane/ortofotomapa-orto/',
        'Free reuse of Polish public geodata', 'https://www.geoportal.gov.pl/pl/dane/ortofotomapa-orto/',
        '© Główny Urząd Geodezji i Kartografii · Geoportal.gov.pl · orthophoto (modified)', .1,
        endpoint='https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/HighResolution', layer='Raster', crs='CRS:84'),
    'baden-wuerttemberg': source('LGL-BW DOP20', 'https://www.lgl-bw.de/Produkte/Open-Data/index.html',
        'dl-de/by-2-0', 'https://www.govdata.de/dl-de/by-2-0',
        'LGL-BW (2026) · DOP20 (modified) · dl-de/by-2-0 · www.lgl-bw.de', .2,
        endpoint='https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DOP_20_C', layer='IMAGES_DOP_20_RGB'),
    'saxony': source('GeoSN DOP20', 'https://www.landesvermessung.sachsen.de/luftbild-produkte-4982.html',
        'dl-de/by-2-0', 'https://www.geodaten.sachsen.de/rechtsgrundlagen-und-nutzungsbedingungen-4509.html',
        '© GeoSN · DOP20 (modified) · dl-de/by-2-0', .2,
        endpoint='https://geodienste.sachsen.de/wms_geosn_dop-rgb/guest', layer='sn_dop_020'),
    'schleswig-holstein': source('Schleswig-Holstein DOP20', 'https://www.govdata.de/suche/daten/digitale-orthophotos-dop2079a43',
        'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/',
        '© GeoBasis-DE/LVermGeo SH/CC BY 4.0 · DOP20 (modified)', .2,
        endpoint='https://dienste.gdi-sh.de/WMS_SH_DOP20col_OpenGBD', layer='sh_dop20_rgb'),
    'rome': source('Regione Lazio Ortofoto AGEA v. 2020',
        'https://geoportale.regione.lazio.it/catalogue/csw_to_extra_format/r_lazio:92b0f7e3-3b75-4feb-ac5e-2382/ortofoto-agea-v-2020.html',
        'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/',
        '© Regione Lazio · Ortofoto AGEA 2020 (modified) · CC BY 4.0', .2,
        endpoint='https://geoportale.regione.lazio.it/geoserver/ows', layer='geonode:2020_AGEA_25833_COG'),
    'hong-kong': source('Hong Kong Lands Department aerial imagery',
        'https://portal.csdi.gov.hk/csdi-webpage/apidoc/ImageryMapAPI',
        'CSDI Portal Terms of Use', 'https://portal.csdi.gov.hk/csdi-webpage/doc/TNC',
        'Aerial Photograph from Lands Department · © Government of the Hong Kong SAR · CSDI Portal (modified)', .2,
        xyz='https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/WGS84/{z}/{x}/{y}.png', requiresLogo=True,
        logoUrl='assets/destination-orthophotos/lands-department-logo-97fc83e2643b.jpg',
        logoSourceUrl='https://api.hkmapservice.gov.hk/mapapi/landsdlogo.jpg'),
}

CITY_SOURCE = {'Munich':'bavaria', 'Berlin':'berlin', 'Cottbus':'brandenburg',
    'Vienna':'austria', 'Salzburg':'austria', 'Zurich':'switzerland', 'Lausanne':'switzerland',
    'Helsinki':'helsinki', 'Nara':'japan', 'Barcelona':'barcelona', 'Wroclaw':'poland',
    'Karlsruhe':'baden-wuerttemberg', 'Leipzig':'saxony', 'Lübeck':'schleswig-holstein',
    'Rome':'rome', 'Hong Kong':'hong-kong'}
MISSING = {'tesla-gigathon-2026':'Dedicated Brandenburg factory chapter owns this image.',
    'bachelors-thesis':'No verified redistributable sub-metre Beykoz source; do not overzoom ESA 10m.',
    'tgu-perfect-gpa':'No verified redistributable sub-metre Beykoz source; do not overzoom ESA 10m.'}
HK_EVENT='hong-kong-talent-engage-eurotech-healthtech-2026'
HK_LOCATION_INPUT='revenue-tower-location-search.json'
LOCK = threading.Lock()
LAST_REQUEST = {}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def corrected_hong_kong(event):
    """Use authoritative venue coordinates, not the earlier forest city estimate.

    The portfolio's venue is already Revenue Tower. HKTE confirms its address;
    Lands Department's published location API provides the local grid point.
    This script does not edit authored achievements; root performs that change.
    """
    raw=(INPUTS/HK_LOCATION_INPUT).read_bytes()
    locations=json.loads(raw)
    location=next(value for value in locations if value['nameEN']=='Revenue Tower')
    assert location['addressEN'].strip()=='5 GLOUCESTER ROAD'
    lon,lat=Transformer.from_crs(2326,4326,always_xy=True).transform(location['x'],location['y'])
    corrected={**event,'coordinates':{'lng':lon,'lat':lat}}
    evidence=dict(
        contactUrl='https://www.hkengage.gov.hk/en/contact-us',
        confirmedAddress='12/F, Revenue Tower, 5 Gloucester Road, Wan Chai, Hong Kong',
        governmentLocationSearchUrl='https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=Revenue%20Tower',
        sourceCrs='EPSG:2326',sourcePoint=[location['x'],location['y']],
        sourceResponseSha256=sha(raw),sourceResponseInput=HK_LOCATION_INPUT,
        convertedWgs84Coordinates=[lon,lat],
        conversion='pyproj Transformer.from_crs(2326,4326,always_xy=True)',
        previousEstimatedCoordinates=[114.1698,22.2745],
        note='Original venue name preserved. Earlier geographic estimate was about 605m south of the government-confirmed venue; local-grid geocoding precision is metre-class, not survey GPS precision.')
    return corrected,evidence


def fetch(url, source_id):
    key = sha(url.encode())
    path = INPUTS / f'{source_id}-{key}.image'
    if path.exists():
        data = path.read_bytes()
    else:
        # Never turn this build into a bulk crawl. One WMS request per point;
        # at most four concurrent tile requests and four starts/sec per provider.
        with LOCK:
            wait = .25 - (time.monotonic() - LAST_REQUEST.get(source_id, 0))
            if wait > 0:
                time.sleep(wait)
            LAST_REQUEST[source_id] = time.monotonic()
        response = requests.get(url, timeout=90, headers={
            'User-Agent':'Mozilla/5.0 (compatible; BatikanPortfolioImageryBuild/1.0)',
            'Origin':'https://staging.batikanor.com'})
        response.raise_for_status()
        data = response.content
        # XML exceptions and empty/flat server error tiles are never packaged.
        image = Image.open(BytesIO(data))
        image.load()
        assert max(ImageStat.Stat(image.convert('RGB')).stddev) > 2, f'Blank image: {url}'
        path.write_bytes(data)
    return data, dict(url=url, sha256=sha(data), bytes=len(data), input=path.name)


def corners(bounds):
    west, south, east, north = bounds
    return [[west,north],[east,north],[east,south],[west,south]]


def wms_patch(event, source_id, cfg):
    lat, lng = event['coordinates']['lat'], event['coordinates']['lng']
    cx, cy = MERCATOR.transform(lng, lat)
    radius = 500 / math.cos(math.radians(lat))
    merc_bounds = [cx-radius, cy-radius, cx+radius, cy+radius]
    west, south = LONLAT.transform(merc_bounds[0],merc_bounds[1])
    east, north = LONLAT.transform(merc_bounds[2],merc_bounds[3])
    bounds = [west,south,east,north]
    crs = cfg.get('crs','EPSG:3857')
    version = cfg.get('version','1.3.0')
    params = dict(service='WMS',version=version,request='GetMap',layers=cfg['layer'],styles='',
                  bbox=','.join(f'{v:.9f}' for v in (bounds if crs=='CRS:84' else merc_bounds)),
                  width=EDGE,height=EDGE,format='image/jpeg')
    params['srs' if version=='1.1.1' else 'crs'] = crs
    url = cfg['endpoint'].rstrip('?')+'?'+urlencode(params)
    data, audit = fetch(url,source_id)
    image = Image.open(BytesIO(data)).convert('RGB')
    assert image.size == (EDGE,EDGE), (source_id,image.size)
    return image,bounds,1000/EDGE,[audit]


def xyz_patch(event, source_id, cfg):
    z = 18
    lng,lat = event['coordinates']['lng'],event['coordinates']['lat']
    tx = int((lng+180)/360*2**z)
    ty = int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
    x0,y0=tx-4,ty-4
    requests_by_tile=[(x,y,cfg['xyz'].format(z=z,x=x,y=y)) for y in range(y0,y0+8) for x in range(x0,x0+8)]
    def one(item):
        x,y,url=item
        data,audit=fetch(url,source_id)
        image=Image.open(BytesIO(data)).convert('RGB')
        assert image.size==(256,256),(source_id,image.size)
        audit.update(z=z,x=x,y=y)
        return x,y,image,audit
    image=Image.new('RGB',(EDGE,EDGE))
    audits=[]
    with ThreadPoolExecutor(max_workers=4) as executor:
        for x,y,tile,audit in executor.map(one,requests_by_tile):
            image.paste(tile,((x-x0)*256,(y-y0)*256));audits.append(audit)
    def coord(x,y):
        return x/2**z*360-180, math.degrees(math.atan(math.sinh(math.pi*(1-2*y/2**z))))
    west,north=coord(x0,y0);east,south=coord(x0+8,y0+8)
    return image,[west,south,east,north],WORLD*math.cos(math.radians(lat))/(2**z*256),audits


def encode(image,key,resolution):
    data=BytesIO();image.save(data,'WEBP',quality=94,method=6)
    encoded=data.getvalue();digest=sha(encoded)
    filename=f'ortho-{key}-{image.width}-{digest[:12]}.webp'
    (DEST/filename).write_bytes(encoded)
    return dict(url=f'assets/destination-orthophotos/{filename}',width=image.width,height=image.height,
                bytes=len(encoded),sha256=digest,resolutionM=round(resolution,6),
                decodedRgbaBytes=image.width*image.height*4)


def check(manifest):
    assert manifest['schema']==1
    seen=set()
    for key,patch in manifest['patches'].items():
        assert len(patch['coordinates'])==4 and patch['resolutionM']<=1
        for asset in [patch,patch['mobile']]:
            path=ROOT/'public'/asset['url'];data=path.read_bytes()
            assert sha(data)==asset['sha256'] and len(data)==asset['bytes'],path
            image=Image.open(BytesIO(data));assert image.size==(asset['width'],asset['height'])
            assert max(image.size)<=2048 and asset['decodedRgbaBytes']<=16_777_216
        for audit in patch['inputs']:
            data=(INPUTS/audit['input']).read_bytes()
            assert sha(data)==audit['sha256'] and len(data)==audit['bytes']
        if 'locationProvenance'in patch:
            proof=patch['locationProvenance']
            assert sha((INPUTS/proof['sourceResponseInput']).read_bytes())==proof['sourceResponseSha256']
        assert patch['mobile']['resolutionM']>=patch['resolutionM']*1.99
        seen.add(key)
    assert all(key in seen for key in manifest['events'].values())
    print(json.dumps(dict(events=len(manifest['events']),patches=len(seen),
        desktopBytes=sum(p['bytes']for p in manifest['patches'].values()),
        mobileBytes=sum(p['mobile']['bytes']for p in manifest['patches'].values())),indent=2))


def existing_tesla(manifest):
    """Reference the factory chapter's separately audited imagery without copies."""
    directory=ROOT/'public/assets/isometric'
    full_path=directory/'tesla-gigafactory-ground-truedop20-v1.json'
    half_path=directory/'tesla-gigafactory-ground-truedop20-v1-half.json'
    if not full_path.exists()or not half_path.exists():return
    full,half=json.loads(full_path.read_text()),json.loads(half_path.read_text())
    def descriptor(meta):
        return dict(url='assets/isometric/'+meta['asset'],width=meta['width'],height=meta['height'],
            bytes=meta['bytes'],sha256=meta['sha256'],resolutionM=meta['effective_metres_per_pixel'],
            decodedRgbaBytes=meta['width']*meta['height']*4)
    key='tesla-gigafactory-brandenburg'
    patch=descriptor(full);west,north=full['coordinates'][0];east,south=full['coordinates'][2]
    patch.update(id=key,bounds=[west,south,east,north],coordinates=full['coordinates'],
        footprintM=dict(width=full['effective_metres_per_pixel']*full['width'],
                        height=full['effective_metres_per_pixel']*full['height']),
        source=dict(title=full['source'],url=full['source_urls'][0],
            license=full['license'],licenseUrl=full['license_url'],attribution=full['credit'],
            nativeResolutionM=full['source_native_metres_per_pixel'],captureDate=full['source_flight_date']),
        camera=full['camera'],mobile=descriptor(half),inputs=[],
        provenance=dict(metadataUrl='assets/isometric/'+full_path.name,
            metadataSha256=sha(full_path.read_bytes()),sourceZipSha256=full['source_zip_sha256']))
    manifest['events']['tesla-gigathon-2026']=key;manifest['patches'][key]=patch
    manifest['missing'].pop('tesla-gigathon-2026',None)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true')
    parser.add_argument('--only',nargs='+');args=parser.parse_args()
    if args.check:
        check(json.loads(MANIFEST.read_text()));return
    INPUTS.mkdir(parents=True,exist_ok=True);DEST.mkdir(parents=True,exist_ok=True)
    previous=json.loads(MANIFEST.read_text())if MANIFEST.exists()else None
    manifest=previous or dict(schema=1,createdAt=datetime.now(timezone.utc).isoformat(),
        notes='Real official aerial imagery; no AI imagery, upscaling, or invented photographic detail. Mobile versions must use a resolution-aware camera.',
        events={},patches={},missing=MISSING)
    events=json.loads((ROOT/'src/data/achievements.json').read_text())
    for event in events:
        slug=event['slug'];source_id=CITY_SOURCE.get(event['city'])
        if not source_id or slug in MISSING or (args.only and source_id not in args.only and slug not in args.only):continue
        location_provenance=None
        if slug==HK_EVENT:event,location_provenance=corrected_hong_kong(event)
        point=event['coordinates'];key=f'{source_id}-{point["lng"]:.6f}-{point["lat"]:.6f}'.replace('.','p')
        manifest['events'][slug]=key
        if key in manifest['patches']:
            print('Reuse',slug,key,flush=True);continue
        cfg=SOURCES[source_id];print('Build',slug,source_id,flush=True)
        image,bounds,resolution,audits=(xyz_patch if 'xyz'in cfg else wms_patch)(event,source_id,cfg)
        patch=encode(image,key,resolution)
        patch.update(id=key,bounds=bounds,coordinates=corners(bounds),
            source={k:v for k,v in cfg.items()if k not in ['xyz','endpoint','layer','crs','version']},
            inputs=audits,footprintM=dict(width=round(resolution*EDGE,3),height=round(resolution*EDGE,3)),
            mobile=encode(image.resize((1024,1024),Image.Resampling.LANCZOS),key,resolution*2))
        if location_provenance:patch['locationProvenance']=location_provenance
        manifest['patches'][key]=patch
        MANIFEST.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
        print(slug,patch['bytes'],patch['resolutionM'],flush=True)
    existing_tesla(manifest)
    referenced=set(manifest['events'].values())
    for key in list(manifest['patches']):
        if key not in referenced:
            previous=manifest['patches'].pop(key)
            # Remove only our own newly generated, now-unreferenced assets.
            for descriptor in [previous,previous['mobile']]:
                path=ROOT/'public'/descriptor['url']
                if path.parent==DEST:path.unlink(missing_ok=True)
    # All repeated builds preserve the on-map logo requirement from its source.
    for patch in manifest['patches'].values():
        if patch['source'].get('requiresLogo'):
            patch['source'].update({k:SOURCES['hong-kong'][k] for k in ['logoUrl','logoSourceUrl']})
    MANIFEST.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    check(manifest)


if __name__=='__main__':
    main()
