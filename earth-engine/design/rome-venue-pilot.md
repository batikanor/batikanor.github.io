# Rome / ETHRome venue miniature — provenance and limits

**Public venue pilot, 28 September 2026. Not surveyed 3D. Do not label it LoD2.**

The original portfolio identifies ETHRome 2025 as **Via Ostiense 92**. [Talent
Garden's own campus page](https://talentgarden.com/en/coworking/roma-ostiense)
and the [Rome tourism authority's venue record](https://www.turismoroma.it/it/luoghi/talent-garden-roma-ostiense)
confirm that address; the latter places it at **41.867780, 12.478939**. The
event's previous portfolio pin, **41.8719, 12.4802**, was roughly 470 m to
the north, on a different Via Ostiense block. The replacement pin is the
OpenStreetMap Talent Garden venue point, **41.8678291, 12.4791336**, within
the mapped site next to the mapped number-92 gate. It is not a surveyed door
coordinate. The mapped containing footprint is OSM way `390787504`. The
original event title, description, photos/video, links and popup are retained.

## Source record

| Input | Rights / source date | Locally pinned input | Use / uncertainty |
|---|---|---|---|
| [Regione Lazio, Ortofoto AGEA v. 2020](https://geoportale.regione.lazio.it/catalogue/csw_to_extra_format/r_lazio:92b0f7e3-3b75-4feb-ac5e-2382/ortofoto-agea-v-2020.html), WMS layer `geonode:2020_AGEA_25833_COG` | Metadata says **CC BY 4.0**; flown 2020, published 2023. | `design/sources/rome-agea2020-wms-raw.png`, SHA-256 `24f32f2d67b9a1dbadf343da83d5febce18f66735de06dc0bd1550adb88a4a9d` | Ground only. One 480×480 m WMS GetMap in EPSG:25833, bounding box `290532.57579051994,4637929.377485718,291012.57579051994,4638409.377485718`, 1600×1600 PNG. This is **2020**, not event-day 2025 photography. Source is attributed on-map. |
| [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), API 0.6 map export (2026-09-28) | **ODbL 1.0**; individual mapping varies in date/accuracy. | `design/sources/rome-osm-20260928.osm.gz`; uncompressed SHA-256 `1c2c4c98b25196dea4d8abf7ed18ba8ad399d9ce15696b26ff11306ad4b81ea6`. | Closed building ways around Via Ostiense 92; 115 footprints in the runtime [GeoJSON](../public/data/rome-ostiense-buildings-v1.geojson), preserved machine-readable under ODbL. OSM height tags are reproduced; level tags become **illustrative** 3m-per-floor masses. 41 footprint-only buildings stay flat, not guessed heights. |
| [Talent Garden 2023 site safety extract](https://cdn.talentgarden.com/uploads/dvr/%5BRMO%5D%20Estratto%20DVR%20-%202023.pdf) | Public owner document; factual reference **only**, not republished. | URL and 4-floor assertion in this note. | Page 6 describes four above-ground floors at Via Ostiense 92. Venue footprint is represented by a flat 12m **estimated** block (4×3m) to make it legible at isometric pitch; neither 12m nor the roof form is surveyed. |

No Google/Apple/Mapbox viewer imagery, unlicensed 3D model, AI-generated
buildings or invented roof silhouettes are used. Each abstract mass takes a
muted **mean colour sampled from the official orthophoto** inside its mapped
footprint, not a photographic roof projection or a claim of real roof shape.

`scripts/build-rome-chapter.py` verifies the pinned source hashes, makes an
alpha-feathered 800 px mobile and 1600 px desktop WebP crop, extracts the
ODbL building polygons, and writes a runtime manifest with bytes/hashes and
georeferenced image corners. The PNG and OSM XML are **build inputs, not
website downloads**. The derived WebP is modified from Regione Lazio source
data; credits should stay visible when its layer is active. The machine-
readable GeoJSON and rebuild script satisfy reproducibility and make the
footprint extraction available; assess ODbL obligations before any broader
redistribution or merging with a proprietary database.

## Runtime contract and measured static budgets

- No Rome asset is requested on the globe or another event. At close Rome
  camera idle (≥z16.5, center within 460m), the chapter fetches only its
  ~1.5 KB manifest, one chosen image tier, and 46 KB OSM geometry. A changed
  event aborts pending requests and removes sources/layers immediately.
- 800 px image **151,486 B / 2.56 MiB decoded RGBA** on low-memory, save-data
  or coarse-pointer devices. 1600 px image **626,114 B / 9.77 MiB decoded**
  elsewhere. Total Rome data transfer below 0.7 MB. This is an asset budget,
  **not** a real-device page-memory or frame-rate measurement; globe tiles and
  popup media remain additional.
- Source coverage is a **single local patch**, softly feathered to the normal
  Earth imagery. Elsewhere, and on failed downloads/WebGL, the existing map and
  full achievement detail popup remain. It is intentionally not a worldwide
  city model and should not be promoted to all Rome achievements.
- The fixed camera is still MapLibre's geographic camera, with normal pan/zoom
  and original achievement hotspot. The ortho is geo-referenced and pitched;
  the masses are 2.5D placeholders. This is **less geometrically rich than**
  the official LoD2 Munich/Berlin chapters. A premium rendition needs a
  rights-cleared surveyed venue model or owner-permitted architectural photos.

The source/geometric limitations remain visible in the site's credits.
Desktop and emulated 320/390 px browser QA passed, but physical Safari/Chrome
devices, 4G, reduced motion, GPU memory and frame pacing have not been
measured. A venue-aware human should review screenshot alignment and the
footprint before expanding this illustrated style to other locations.
