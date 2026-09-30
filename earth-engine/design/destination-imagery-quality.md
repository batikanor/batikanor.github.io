# Native aerial detail is a quality gate, not a performance downgrade

The previous arrival optimization correctly removed tile-queue delays, but its
32-event street camera magnified the 10-metre ESA Sentinel composite far beyond
the source's actual resolution. Adding opaque, untextured OSM roof masses then
covered the remaining photographic roof detail. Neither result is acceptable as
a final high-quality view. Faster arrival must mean preparing the right pixels,
not declaring a blurry placeholder finished.

## Owned imagery delivered

`src/data/destinationOrthophotos.json` describes **30 events / 29 rectangles**.
Every point is preserved except the independently verified Hong Kong venue
correction described below. The only deduplication is an exact repeated Munich
coordinate. Native 2048px patches total **45,624,644 B**;
the optional 1024px versions total **14,804,348 B**. Only the active image should
be decoded/uploaded (16 MiB at 2048px), never 29 active GPU images.

The full images sample approximately **0.398–0.638 metres per pixel**. They are
actual government aerial pixels, not AI detail, a Sentinel upscale, a global
proprietary imagery screenshot, or photographs claimed to be taken on the event
day. Original capture dates are only specified where the source establishes
them. Storing WMS output with a public redistribution licence does not imply the
provider's live WMS response is browser-cacheable; runtime uses our separate,
fingerprinted, source-attributed derived publication.

For WMS providers the owned patch is a 1000m square represented at 2048px in Web
Mercator (Wroclaw uses the advertised CRS:84 service). Source spatial precision
and photographic accuracy still depend on the source. For Austria, Nara and Hong
Kong, 64 native z18 tiles are concatenated without resampling into a 2048px
rectangle. Source URLs, hashes and encoded bytes are recorded in `inputs`.
Pinned inputs are outside the deployment, in `design/sources/destination-orthophotos`.
The Tesla rectangle refers to its independently source-audited factory chapter;
the exact native source archive hashes and metadata hash are retained.

WebP quality 94 retains the original imagery's detail without fabricating
precision. The source provider's own JPEG compression remains. The 1024px
alternative is a Lanczos **downsample** with its doubled effective resolution
recorded; it is not a same-camera substitute for the full image.

## Source / legal coverage

| Places | Provider and actual imagery | Public terms and attribution |
|---|---|---|
| Munich/Garching, 9 events at 8 coordinates | Bayerische Vermessungsverwaltung, [DOP20](https://geodatenonline.bayern.de/geodatenonline/seiten/wms_dop), [Open Data WMS capabilities](https://geoservices.bayern.de/od/wms/dop/v1/dop20?service=WMS&request=GetCapabilities) | CC BY 4.0. `© Bayerische Vermessungsverwaltung · DOP20 (modified) · CC BY 4.0`. |
| Berlin, 3 events | Geoportal Berlin, [TrueDOP 2026](https://daten.berlin.de/datensaetze/digitale-farbige-trueorthophotos-2026-dop20rgbi-wms-3801a94c) | dl-de-zero-2.0. Provider attribution retained even though attribution is not mandatory under Zero. |
| Cottbus, 2 events | LGB, [DOP20 WMS](https://isk.geobasis-bb.de/mapproxy/dop20c/service/wms?service=WMS&request=GetCapabilities) | dl-de/by-2-0. `© GeoBasis-DE/LGB · DOP20 (modified) · dl-de/by-2-0`. |
| Tesla Grünheide | LGB, dedicated TrueDOP20 factory chapter from four source archives | dl-de/by-2-0; native 20cm, captured 2023-05-04, ~64cm ground patch and independent ~36cm roof atlas. Source original coordinates remain unchanged. |
| Vienna, Salzburg | [basemap.at Orthofoto](https://basemap.at/en/orthofoto/) | [basemap.at](https://basemap.at/) explicitly identifies its current OGD licence as CC BY 4.0. `© basemap.at · Orthofoto (modified) · CC BY 4.0`. The original tile's source-date watermark is not removed. |
| Zurich, Lausanne, 4 events | [SWISSIMAGE](https://www.swisstopo.admin.ch/en/faq-free-geodata), official WMS | swisstopo OGD terms: source-attributed publication and commercial use explicitly allowed. Not mislabelled CC BY. `© swisstopo · SWISSIMAGE (modified)`. |
| Helsinki | [HRI orthophotographs](https://hri.fi/data/en/dataset/helsingin-ortoilmakuvat), `Ortoilmakuva_2025_5cm` | CC BY 4.0. City surveying provider and HRI credited; downloaded on the actual build date. |
| Nara (Music & AI achievement) | GSI [seamless aerial photographs](https://maps.gsi.go.jp/development/ichiran.html), native z18 | [GSI terms](https://www.gsi.go.jp/ENGLISH/page_e30286.html), PDL 1.0. Edited-source credit retained. Photo tiles are listed as non-basic-survey-result content on [GSI's Survey Act guidance](https://www.gsi.go.jp/LAW/2930-index.html). The special GRUS geographic area is not this Nara rectangle. |
| Barcelona | ICGC [territorial orthophoto 2025](https://www.icgc.cat/en/Geoinformation-and-Maps/Online-services-Geoservices/WMS-Orthoimages/WMS-Territorial-Orthophoto) | [ICGC reuse terms](https://www.icgc.cat/en/ICGC/Public-Information/Transparency/Re-use-information), CC BY 4.0; modern colour orthophoto, not the excluded historic American flights. |
| Wroclaw | GUGiK, official high-resolution WMS | [Geoportal source page](https://www.geoportal.gov.pl/pl/dane/ortofotomapa-orto/) explicitly states free downloading and arbitrary reuse; provider/portal credited. |
| Leipzig | GeoSN, current DOP20 WMS | [GeoSN open-data terms](https://www.geodaten.sachsen.de/rechtsgrundlagen-und-nutzungsbedingungen-4509.html), dl-de/by-2-0. |
| Lübeck | LVermGeo SH, **OpenGBD** DOP20 WMS | [Current government dataset](https://www.govdata.de/suche/daten/digitale-orthophotos-dop2079a43) and service capabilities specify CC BY 4.0, `© GeoBasis-DE/LVermGeo SH/CC BY 4.0`. This is the newer OpenGBD endpoint, not the older individually licensed service. |
| Karlsruhe | LGL-BW, [Open GeoData DOP20](https://www.lgl-bw.de/Produkte/Open-Data/index.html) | Service capabilities explicitly specify dl-de/by-2-0; `LGL-BW (2026) · DOP20 (modified) · dl-de/by-2-0 · www.lgl-bw.de`. |
| Rome | Regione Lazio, [AGEA 2020](https://geoportale.regione.lazio.it/catalogue/csw_to_extra_format/r_lazio:92b0f7e3-3b75-4feb-ac5e-2382/ortofoto-agea-v-2020.html) | Dataset metadata explicitly specifies CC BY 4.0. 2020 capture is disclosed, not represented as 2025 photography. |
| Hong Kong | Lands Department [Imagery Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/ImageryMapAPI), native z18 | [CSDI terms](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC) allow source-attributed reproduction/distribution for commercial and non-commercial purposes. **Additional API terms require the Lands Department logo on the map face**, as well as Copyright Notice. `requiresLogo` and the original official logo asset are retained in the manifest. Do not enable this patch without satisfying both obligations. |

### Hong Kong venue-coordinate correction

The existing author-provided venue label is Revenue Tower. The previous estimated
coordinate `[114.1698,22.2745]` was about 605m south, in the forest hillside. The
[HKTE contact page](https://www.hkengage.gov.hk/en/contact-us) confirms the office
address as 12/F, Revenue Tower, 5 Gloucester Road, Wan Chai. The authoritative
[Lands Department location search](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=Revenue%20Tower)
returns local HK1980 grid point `[835749,815637]`, EPSG:2326. Transforming with
`pyproj.Transformer.from_crs(2326,4326,always_xy=True)` gives WGS84
`[114.17183837641731,22.27960209392446]`. That conversion does not imply GPS/survey
precision beyond the source's metre-class building-location point.

The regenerated Hong Kong image is centred on that actual venue. The government
JSON response is pinned in `design/sources/destination-orthophotos/revenue-tower-location-search.json`,
SHA-256 `846a5e1d76323ac396290de4be1ec9ffb7fb97bb5ed8b3a7953a1e3d99e6cd88`.
The manifest preserves the previous coordinate, source grid point, conversion,
official evidence links and response hash in `locationProvenance`. The imagery
generator does not write the shared achievements file; the application data
owner makes that independently verified correction.

The OSM venue pocket was subsequently refreshed **only for Hong Kong**, after
the authored coordinate correction: 78 mapped buildings, 13 mapped trees,
including Revenue Tower way `27087037` with its explicit OSM 180m height.
The new pinned response SHA-256 is
`a696616be9fded37c118065e104dafcf43caa5254d67ac89f3449b620f405a59`.
All other 29 pocket objects and source snapshots remain unchanged. The context
builder now verifies each cached response's `<bounds>` against its requested
venue bbox; a corrected coordinate gets a separate bbox-keyed snapshot, never
the obsolete slug-keyed geometry. `--only EVENT_SLUG` supports an isolated
refresh without changing unrelated geometry. An offline repeat was byte-identical.
This revised payload is published as `data/achievement-context-v2.json` (the
JSON schema is still version 1). The original v1 response is retained
byte-for-byte for previously cached JavaScript; never rewrite its immutable URL.

All tested source endpoints returned valid images with a browser user-agent and
staging origin. Most use permissive CORS; Polish/Saxon/Schleswig-Holstein WMS
echoed the staging Origin. Bundling authorised derived imagery eliminates those
CORS and remote-tile-queue dependencies during destination arrivals.

## Remaining honest gap

The two Beykoz university achievements share one point. I did not verify a
redistributable sub-metre municipal or national orthophoto licence for that
point. Public viewer access is not a redistribution licence. Do **not** scrape
Google, Bing, ArcGIS World Imagery, or an Istanbul 3D viewer and relabel it as open
data. The correct present view is a source-resolution-aware geographic overview
or a clearly designed vector/3D context without pretending 10m Sentinel pixels
are street photography. A separately licensed global satellite provider, campus
photography with permission, or municipal imagery permission can close the gap.

## Integration requirements

1. A final arrival is ready only after the appropriate quality image is decoded
   and rendered, not merely the old ESA landing. Keep the previous good frame
   during the quality handoff.
2. Use the same decoded active image for mapped roof UVs and the terrain/image
   layer; the scene borrows it and must not close the owner's ImageBitmap.
3. Photograph roof faces only. Do not project a roof into a façade or invent
   survey textures. Height estimates and OSM footprint limitations remain
   disclosed. Opaque gray fallback roofs must not erase the real photograph.
4. Prefetch full selected/adjacent patches with urgent priority; prepare encoded
   imagery on the intro screen. Existing 30MB speculative budget cannot hold
   all 45.6MB full images plus other chapter data at once. Keep an LRU budget and
   do not decode every point merely to make a benchmark fast.
5. Match camera resolution to actual pixels. MapLibre's Web Mercator world has
   512 pixels at zoom zero, so CSS metres/pixel are
   `40075016.6856 * cos(latitude) / (512 * 2**zoom)`. Default cameras must not
   stretch a pixel across tens of screen pixels. A ~0.49m patch around central
   Europe supports roughly z16.6–16.9 at 1 native photo pixel/CSS pixel, or a
   modestly closer camera if limited 1.5x image magnification is deliberate.
   A 1024px preview requires about one less zoom level over the same footprint.
6. Any freely roaming camera outside the patch needs source tiles, a larger
   prepared regional LOD, or a different honest framing; an owned 1km image is
   not magically worldwide sub-metre coverage.

Verification:

```sh
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/batikanor-earth-release
python3 earth-engine/scripts/build-destination-orthophotos.py --check
node --test earth-engine/scripts/destinationOrthophotos.test.mjs
```
