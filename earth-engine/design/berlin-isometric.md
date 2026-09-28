# Berlin State Library — true-data isometric pocket (local experiment)

This is a **local-only, not-deployed** visual-detail chapter for the existing
`real-coin-map-2025` achievement. Its origin is the portfolio's authored
`[13.3708, 52.5074]` coordinate. That point lies on the State Library's
Potsdamer Straße building in the official data. The Stabi Lab's
[original hackathon page](https://lab.sbb.berlin/culture-exploredata-an-open-cultural-data-hackathon/?lang=en)
specifies the event venue as Potsdamer Str. 33, and lists the “Real” Coin Map
among its resulting projects. The building choice is therefore venue-backed,
not inferred only from the map pin; this still does not identify the exact
room. No portfolio title, description, or media was changed.

## Provenance and rights

| Layer | Official source | License |
|---|---|---|
| Roof and wall volume | [Geoportal Berlin LoD2 dataset](https://daten.berlin.de/datensaetze/3d-gebaudemodelle-im-level-of-detail-2-lod-2-3c7c49af) and its [Atom feed](https://gdi.berlin.de/data/a_lod2/atom/0.atom); [`LoD2_389_5818.zip`](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip) | [Datenlizenz Deutschland – Zero – Version 2.0](https://www.govdata.de/dl-de/zero-2-0) |
| Ground and projected roof photograph | [Berlin 2026 TrueDOP20 WMS dataset](https://daten.berlin.de/datensaetze/digitale-farbige-trueorthophotos-2026-dop20rgbi-wms-3801a94c) and its [WMS endpoint](https://gdi.berlin.de/services/wms/truedop_2026?service=WMS&request=GetCapabilities) | [Datenlizenz Deutschland – Zero – Version 2.0](https://www.govdata.de/dl-de/zero-2-0) |

The official LoD2 ZIP is 4,550,140 bytes, SHA-256
`827a94eda224f55ec638b1b4de8c440c80405ea6797068efe7558c83a4fd30c1`.
It contains the 38.6 MB `LoD2_33_389_5818_1_BE.xml`, in
`ETRS89_UTM33*DE_DHHN2016_NH`. The script pins the ZIP hash and checks the
sheet is still in Berlin's live Atom feed. The source is downloaded to the
system temporary cache only; it is **not** sent to the browser.

Visible attribution is still appropriate for transparency even though this
zero license imposes no attribution condition:

> Geoportal Berlin / Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen
> Berlin (Daten verändert), dl-de-zero-2.0.

The changes are clipping to the authored 250 m venue circle, triangulating
official CityGML surface polygons, reprojection to local Web Mercator metres,
requesting the official TrueDOP WMS in EPSG:3857, stitching its imagery, and
WebP compression. Original vertical heights are retained. No geometry, roofs,
windows, façades, cars, trees, or event buildings were invented. The LoD2
source itself **generalizes** roof form, as Berlin's dataset description says;
it is not an exact photogrammetric mesh. 2026 imagery is a later snapshot than
the 2025 achievement. Do not imply it shows the hackathon day.

## Built assets and alignment

| Browser asset | Size | Purpose |
|---|---:|---|
| [`berlin-library-lod2-v1.bin`](../public/data/berlin-library-lod2-v1.bin) | 375,808 B | 55 selected official buildings; 10,438 triangles; BLD2 v1 roof/wall buffers |
| [`berlin-library-roof-truedop20-v1.webp`](../public/data/berlin-library-roof-truedop20-v1.webp) | 3,104,330 B | 3584 × 3584 image; z19 RGB TrueDOP atlas for the actual roof planes |
| [`berlin-library-ground-truedop20-v1.json`](../public/data/berlin-library-ground-truedop20-v1.json) | ~1 KB | Bounded, CORS-enabled official WMS ground-image MapLibre template |

The `.bin` and WebP are fetched only for this local chapter, not in the
homepage's initial bundle. Their respective `.json` files pin the derivative
hashes, source references, venue origin, tile bounds, and license. The script
selected buildings whose actual **ground footprint touches the 250 m circle**;
the pin itself lies inside an official footprint (minimum distance 0 m).
It preserves 55 unique building IDs, not a merged invented city block.

The 196 official WMS JPEG responses were acquired in deterministic XYZ z19
row-major order and pinned with ordered SHA-256
`1958ba2c9fa89619b2c71dd1d6c323ef57c0f8858ab31833bf8d2183c7af7ae5`.
They are requested as EPSG:3857 256 px tiles because the Berlin WMTS offers
only EPSG:25833 and cannot be fed directly to a Web-Mercator MapLibre raster
source. z19 corresponds to about **18 cm ground sampling per pixel** here,
close to TrueDOP20 native 20 cm. The atlas is 3584 px on each side, below a
conservative 4096 px texture limit. A manual red-edge overlay of the LoD2
triangles over the stitched aerial image showed the selected roof boundaries
following the actual photographs and the pin on the library roof. The overlay
was QA only, not a site asset; it does **not** prove roof height or façade
texture accuracy.

For the *ground* underneath these volumes, the JSON supplies a MapLibre raster
source using the official WMS. The `{bbox-epsg-3857}` placeholder is supported
in the [MapLibre WMS example](https://maplibre.org/maplibre-gl-js/docs/examples/wms/).
We tested live z16, z17, z18, and z19 requests: each returned a 256 px JPEG
with `Access-Control-Allow-Origin: *`. The source is bounded to
`[13.366241455078125, 52.504937490853756, 13.3758544921875, 52.51078849036717]`
and should be enabled **only when approaching this pocket**. It is not a new
world basemap. The official WMS responds with no-store caching; repeated
ground pans generate requests, so a future release may prefer a local tiled
image pyramid if server load or mobile latency proves high.

The integrated local app uses that same official WMS in a **wider central
Berlin corridor** `[13.30, 52.48, 13.50, 52.54]` at z16–19, so the three
existing Berlin achievements do not fall off a sharp imagery edge. Only
viewport-visible tiles are fetched; the 3D LoD2/roof-atlas chapter remains
the small 250 m State Library pocket. This wider runtime bounds choice is
not encoded in the narrow `berlin-library-ground-truedop20-v1.json` pilot
manifest. Reassess WMS latency and tile count before any public release.

## Rebuild and verification

From this directory (dependencies are the existing
[`bavaria-lod2-requirements.txt`](../scripts/bavaria-lod2-requirements.txt)):

```sh
python3 scripts/build-berlin-library-isometric.py --offline
```

The first network build used `--accept-imagery` solely to review the 2026
TrueDOP snapshot. After visually checking the real State Library roof and
LoD2/aerial edge overlay, the ordered image hash was pinned. A subsequent
`--offline` rebuild passed. The builder refuses a changed LoD2 ZIP or WMS
image order unless an author explicitly reviews and updates the pins.

Verified locally on 2026-09-28: BLD2 signature/version/counts and exact
40-byte header; payload byte length; event origin; building and triangle
counts; geometry and WebP hashes; 3584 px GPU limit; and 14×14 WMS atlas grid.

**Remaining visual limits:** officially generalized facades have no texture
and may look plain at street-level pitch. A false atmospheric skyline or
invented architectural detail would be a regression, not an upgrade. Compare
the interactive isometric camera with the original orthophoto on desktop and
mobile before deciding whether this local chapter should ever be released.
