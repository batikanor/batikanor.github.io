# Tesla: photographed, surveyed whole factory — not an entrance placeholder

The Tesla achievement previously entered at its actual south gate, zoomed
around a tiny illustrative court on a 10 m/pixel 2021 Sentinel composite. The
new factory did not exist in much of that old imagery, and a large untextured
OSM extrusion could obscure its photographic roof. Faster placeholder arrival
was not equivalent to a complete, high-quality arrival.

The fix is a **small owned-source official chapter of the entire factory**:
real 2023 aerial photography of its completed halls, roads, HVAC, parking and
forest, with the surveyed LoD2 roof and wall geometry. Existing authored
project text, images, videos, dates and event coordinates are untouched.

## Actual coverage and quality

| Derivative | Dimensions / geometry | Source sampling or payload | Transfer |
|---|---:|---:|---:|
| Official LoD2 mesh | 23 surveyed buildings, 3,435 triangles | Original roof/wall vertices and absolute heights | 123,700 B |
| Full photographic roof atlas | 2,560 × 2,816 | ~0.3644 m/pixel | 1,493,968 B |
| Same-source constrained-device roof atlas | 1,280 × 1,408 | ~0.7288 m/pixel | 508,236 B |
| Full factory ground | 2,048² | ~0.6377 m/pixel over ~1.3 km | 1,149,590 B |
| Same-source reduced ground | 1,024² | ~1.2754 m/pixel, identical bounds | 364,256 B |

Source TrueDOP is **native 20 cm**. The transmitted textures are carefully
resampled to fit the pixel density of a whole-factory view; they do not claim
invented 20 cm detail in every transmitted pixel. The entry frame should show
the full real campus at roughly zoom 16.6, pitch 52°, bearing 25°, rather than
pushing into a south-gate exhibit at zoom 17.8. Further zoom can use the
0.3644 m photographic roof atlas, not the global ESA preview.

The largest official main hall has **144,673 m²** of ground footprint. The
builder requires it and the three other major hall identifiers. It does not
silently accept a clip of only tiny guard houses. A complete main hall that
crosses a 1 km source-sheet boundary retains its entire source polygon.

Model/image origin: **[13.79215, 52.3951]**, middle of the factory. The event
marker remains **[13.79215, 52.391331]**, the authored south entry. Ground WGS84
corners, clockwise from northwest:

1. [13.7823486328, 52.4015810051]
2. [13.8015747070, 52.4015810051]
3. [13.8015747070, 52.3898491698]
4. [13.7823486328, 52.3898491698]

Only the outside 3% of the ground image is alpha-feathered into the world
basemap. All source model roofs lie inside its opaque interior; the broad
factory is not faded into the blurry placeholder.

## Authoritative source and licensing

- [Brandenburg LGB 3D building product](https://geobasis-bb.de/lgb/de/geodaten/3d-produkte/3d-gebaeudemodelle/): cadastral-aligned LoD2 ground footprints, generalised roof shapes, measured model heights. Official ZIP metadata update is **2026-01-06**; source CRS is **ETRS89 / UTM33**, source elevation **DHHN2016 NH**.
- [Brandenburg LGB current aerial product](https://geobasis-bb.de/lgb/de/geodaten/luftbilder/luftbilder-aktuell/) and [official RGB JPEG download](https://data.geobasis-bb.de/geobasis/daten/dop/rgb_jpg/): **20 cm RGB TrueDOP**, source flight **2023-05-04**, publication **2023-12-19** for these exact Tesla sheets. This is an actual dated aerial image, not a claim to live/event-day imagery.
- [Datenlizenz Deutschland — Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0) permits these derivatives. Display **© GeoBasis-DE/LGB, dl-de/by-2-0 (Daten geändert)** whenever the chapter or its imagery is visible.
- Model source sheets: `33417-5805`, `33418-5805`, `33417-5806`. The adjacent `33418-5806` LoD2 URL is absent (404), not substituted with a fabricated model. All required factory halls are fully present in the published sheets; the missing northern sheet does not intersect a required hall.
- Image sheets: `33417-5805`, `33418-5805`, `33417-5806`, `33418-5806`. Every sampled output pixel must come from one of these exact, checksum-pinned official RGB JPEGs and their verified 20 cm pixel-centre JGW grids.

All exact official source URLs, dates, SHA-256 ZIP hashes, derivative hashes,
byte counts, dimensions and effective sampling are written in the asset JSONs.
The Cottbus source reprojection and reviewed polygon-hole-aware earcut
triangulator are reused, not reimplemented with synthetic roof shapes.

**Honest limits:** this is surveyed architectural LoD2 massing with
photographic *roof* color, not full photogrammetry. No façade/window texture
has been invented; vertical walls remain a neutral material. Trees in the
orthophoto are not a surveyed individual-tree mesh. Source aerial 2023 and
model update 2026 are different acquisition periods, so future building
changes must be refreshed from official data rather than patched visually.

## Runtime contract and bounded resources

Use the existing `isometricRegionLayer` descriptor:

```js
{
  id: 'tesla-gigafactory',
  eventSlugs: ['tesla-gigathon-2026'],
  origin: [13.79215, 52.3951],
  radiusM: 500,
  minZoom: 15.5,
  maxZoom: 20.25,
  meshUrl: '/assets/isometric/tesla-gigafactory-lod2-v1.bin',
  roofAtlas: {
    metadataUrl: '/assets/isometric/tesla-gigafactory-roof-truedop20-v1.json',
    imageUrl: '/assets/isometric/tesla-gigafactory-roof-truedop20-v1.webp',
  },
  groundImage: {
    metadataUrl: '/assets/isometric/tesla-gigafactory-ground-truedop20-v1.json',
    imageUrl: '/assets/isometric/tesla-gigafactory-ground-truedop20-v1.webp',
  },
  attribution: '© GeoBasis-DE/LGB, dl-de/by-2-0 (Daten geändert)',
}
```

The existing roof loader validates/chooses the `-half` roof variant for
constrained GPUs. Full roof decoded RGBA + mipmaps is ~38.4 MB; reduced is
~9.6 MB. Ground is separately bounded to 16 MiB full / 4 MiB reduced.
**Keep terrain on** while rendering the official model: absolute DHHN2016
heights (~38–40 m ground) must not be treated as zero-based extrusions.
Only one active chapter is decoded; inactive preloading is encoded bytes.
The independent arrival image source can reuse the real ground photo while
the small mesh/roof texture is decoded, avoiding a black screen or a final
10 m placeholder. Never label arrival complete based on the old ESA image.

## Rebuild / validate

```bash
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/batikanor-earth-release/earth-engine
python3 scripts/build-tesla-isometric.py --offline
python3 scripts/build-tesla-isometric.py --verify-only
node --test scripts/tesla-isometric.test.mjs
```

Source archives are retained in `/tmp/batikan-tesla-official/{lod2,dop}`, not
published. A normal build can recover only the exact pinned official ZIPs;
a changed hash, date, license, pixel grid, missing required factory hall or
oversized derivative fails explicitly. New source imagery is never accepted
silently under the existing `v1` asset names.
