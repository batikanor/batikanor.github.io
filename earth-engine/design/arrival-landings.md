# Native source-pixel arrival landings

The landing manifest covers **32 achievements with 27 deduplicated mosaics**.
It is a same-origin delivery improvement, not a new geographic dataset or an
increase in underlying imagery resolution.

Each mosaic stitches the existing pinned **3 × 3 z14 original PNG tiles**,
256 × 256 pixels each, into **768 × 768 pixels** with integer pixel pastes.
There is no resize or resampling. The composed pixels are then encoded as
WebP quality90; that encoding is lossy, just like the existing arrival tiles.
The source remains ESA WorldCover2021 / modified Copernicus Sentinel data,
CC BY4.0, with the exact existing attribution.

## Data contract

`src/data/arrivalLandings.json`:

- `schema:1`
- `events: {eventSlug: '14/tileX/tileY'}` (the centre tile's stable key)
- `landings: {key: {url, bytes, sha256, width:768, height:768, coordinates,
  sourceKeys, sourceSha256, sourceBytes, stitchedRgbSha256}}`
- `coordinates` uses **NW, NE, SE, SW** order. These are exact WGS84 values of
  the WebMercator edges from `(x-1,y-1)` to `(x+2,y+2)`, not approximate event
  bounding boxes.
- `sourceKeys` is nine tiles in north-to-south row-major pixel-paste order.
- `sourceSha256` pins each original PNG; `stitchedRgbSha256` hashes the exact
  native RGB mosaic before lossy compression.
- `sourceManifestSha256` independently pins the unchanged `arrivalTiles.json`.
- Asset URLs include their encoded content hash:
  `/assets/arrival/landing-14-X-Y-HASH.webp`.

## Transfer and texture budgets

- All27 unique landings: **5,061,162 bytes**.
- Largest individual encoded image: **281,602 bytes**.
- Each decoded RGBA image: **2,359,296 bytes**; with a full mip chain roughly
  **3,145,728 bytes**. Keep only the active landing in the map/GPU, not all27.
- All32 landings + all existing z11 overview tiles: **9,713,626 bytes**,
  below the12MB mobile warm-transfer cap.
- Landings + every existing arrival tile: **14,309,002 bytes**. These duplicate
  the z14 imagery in different encodings; complete landing/overview coverage
  should take priority over redundant raster-detail speculation on phones.

The landing layer should remain below actual regional orthophotos and their
3D chapters. It is useful immediately during an arrival, not an excuse to
mask higher-quality genuine local imagery. A source-ready signal, rather than
an arbitrary timer, should determine when the preserved prior view is released.

## Reproduction and verification

`python3 scripts/build-arrival-landings.py` is an offline authoring command.
It reads the pinned PNG cache at `/tmp/batikan-esa-arrival-source-v1` (override
with `--source-cache`), validates every source hash/byte count and source image
size, then writes only new hashed landing assets and the separate manifest.
Missing source data fails explicitly; it never starts an unbounded downloader.

`python3 scripts/build-arrival-landings.py --check` rebuilds all mosaics and
verifies exact stitched source pixels, encoded output bytes and manifest
reproducibility without modifying files. Reproduction uses the same Pillow /
libwebp encoder as the saved release assets.

`node --test scripts/arrivalLandings.test.mjs` verifies complete/deduplicated
coverage, unchanged source manifest hash, source/attribution provenance,
row-major source keys, exact georeferencing, actual768px WebP dimensions,
encoded content hashes/filenames and transfer budgets. The optional local
source-cache check independently verifies every used original PNG hash and
256px image header; CI without that authoring cache still checks every shipped
asset and its pinned provenance.
