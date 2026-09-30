# Achievement performance audit — 30 September 2026

This report distinguishes inspected source/asset budgets and HTTP probes from
browser UX measurements. The latter require separate desktop/mobile QA; do not
claim a first-visit or p95 navigation latency from asset sizes alone.

## Baseline bottlenecks

- Preparation started only after the world map `load`, and the first optional
  3D chapter waited for the whole ESA tile warm batch. Slow world tiles delayed
  unrelated destination preparation.
- Desktop introduction warmed 34 tiles: 26 z11 and eight z14. Only the latest
  two achievements received four-tile overview coverage. Most other locations
  received a centre tile, not their whole visible view; mobile capped at seven.
- Every old warm batch cancelled the previous batch. Explorer hover and
  chronology prediction could discard still-useful entry work.
- The few surveyed chapters did not cover the other achievements. Waiting
  longer cannot reveal a model that was never provided for that location.
- The Garching layer retained roughly 75 MiB of decoded roof texture after
  leaving. It also had no city-detail switch or pending-transfer cancellation.
- High-zoom DEM was assumed to exist globally, although the provider's
  TileJSON does not state per-region zoom coverage. Hillshade also requested
  high-zoom DEM behind aerial-photo closeups.

The old sharp-tile zoom was **not** itself wrong: MapLibre has a 512px transform
tile size, the raster source uses 256px tiles and rounds source zoom. Map zoom
13.8 therefore asks nominal z15 and is capped to source z14. A pitched viewport
also requests lower-zoom horizon coverage; a four-centre-tile warm plan cannot
be assumed to cover every viewport. Inspect the public `map.coveringTiles()`
API or actual requests when evaluating arrival coverage.

## Reproducible offline budget audit

Run `node earth-engine/scripts/performance-asset-audit.mjs --check` from the
release checkout. It contacts no providers, validates tile checksums/references,
media existence, BLD2 byte/count budgets, roof metadata/checksums/dimensions,
and shared context coverage. The JSON output follows the current assets.

Snapshot of the new prepared arrival package:

| Resource | Coverage | Bytes |
| --- | --- | ---: |
| Content-hashed local ESA WebP tiles | 389 unique / all 32 events | 9,247,840 |
| Source ESA PNGs for those same tiles | identical grid/resolution | 39,586,101 |
| z11 overview subset | 168 unique | 4,652,464 |
| z14 sharp subset | 221 unique | 4,595,376 |
| Owned native ESA landing mosaics | 27 unique / all 32 events | 5,061,162 |
| Shared mapped context | 30 chapters / all 32 events | 576,252 raw |
| Shared context compression | identical data | 143,829 gzip / 115,268 Brotli |
| Existing official LoD2 meshes | six | 2,794,992 |
| Authored local project photos | four | 4,160,594 |

The prepared tile package is **76.6% smaller** than its source PNGs without
upscaling or invented imagery. Context contains 1,718 mapped building footprints
and 1,223 mapped trees. This package is a background preparation opportunity,
not a prerequisite to Enter. Selected arrivals must outrank speculation.

Keep compressed bytes on disk, not all cities decoded on the GPU. Approximate
full roof RGBA+mipmap storage: Cottbus 2025 40.3 MiB; Cottbus 2026 and Siemens
52.0 MiB; Google 56.3 MiB; Berlin 65.3 MiB; Garching 75.0 MiB. Half-resolution
alternatives are roughly 10.1–16.3 MiB. These are theoretical texture-storage
figures, not measured total GPU allocations. One active detailed scene and
explicit geometry/material/texture disposal avoid universal GPU preloading.

The owned landing images are exact native **768×768**, 3×3 z14 mosaics built
from the pinned ESA PNGs, not resampled or generated scenery. Their separate
5,061,162 bytes remove dependence on global source/horizon readiness. One
landing decodes at a time (2,359,296 theoretical RGBA bytes for its pixels,
not total CPU+GPU allocation); current source generation, real image completion and a visible
z12+ post-load render establish readiness. Exact shared manifest keys can
reuse this one owned source or pending fetch for another achievement, never a
city-name/distance guess. Older object URLs, source textures and pending work
are released on different destinations, World, imagery disable and removal.
The root preparation plan totals **14,309,002 bytes desktop**, or **9,713,626
bytes mobile** (all landings/overview, avoiding duplicate individual sharp tiles),
within its 24/12 MB budgets. Save-Data still disables speculative image work.

## Shared image queue contention: prepared bytes must not wait behind WMS

Root's prepared-cache browser audit found Berlin landing outliers of roughly
3.2–3.7 s, while other sampled stops were roughly 0.36–1.17 s. Those are
individual local browser samples, not geographically representative percentiles.
Inspection confirmed that even a local `blob:` URL in ImageSource goes through
MapLibre 6.11.2's shared `ImageRequest.getImage` FIFO, capped at 16 simultaneous
image requests. Slow high-resolution Berlin WMS requests can therefore strand
the independently fetched arrival at the decode queue, after its bytes are
already prepared.

The landing now decodes directly with native `createImageBitmap`, then creates
a **URL-less public ImageSource** and supplies pixels with the documented
`source.updateImage({image})` API. This bypasses that FIFO without increasing
provider traffic or global image concurrency. The empty source's initial
synchronous completion is explicitly ignored until decoded pixels have been
provided. Native decode is serialized; obsolete queued generations skip work,
and late stale bitmaps close rather than installing old geography. The current
bitmap remains alive for the owned source until `removeSource`, then closes.
A legacy native HTML-image fallback owns its local blob URL outside MapLibre's
queue and clears/revokes it only on teardown. Public style/context restoration
reinjects the retained pixels because ImageSource serialization omits decoded
payloads. There is no extra canvas copy or animation loop.

**Local diagnostic only:** root's rebuilt warm-cache browser run recorded a
Berlin PDM landing at **427 ms**, versus **3,685 ms** in the earlier live run.
Other single local samples were Hong Kong 387 ms, Cottbus 1,091 ms and Vienna
340 ms, with scenes ready and one owned bitmap. Different runs/cache/provider
conditions mean these are not controlled A/B statistics or a p95 guarantee;
they support the queue-bypass diagnosis but do not replace live phone QA.

## Cross-city popup framing

Final phone QA exposed a separate functional regression: `jumpTo` ignores
`offset`, leaving a selected venue underneath the bottom-sheet popup despite
correct framing on `flyTo` deep links. The handoff now first makes the distant
destination local with `jumpTo`, then applies a finite nonzero offset through
public `easeTo({...target, duration:0, animate:false})`. Both camera changes
execute synchronously before its first arrival render, so there is no distant
terrain projection flight, extra animation or readiness on the unshifted view.
Zero/invalid offsets need no second camera operation; cancellation during
camera events cannot install stale offset/paint work. Phone and desktop
camera-call tests cover this behavior; actual unobscured framing remains a
browser visual check.

Garching now aborts transfers and releases CPU/GPU objects immediately outside
its z15.5–18.5 region, including the z20.23 installation view. Constrained
devices keep surveyed geometry plus official map imagery but skip the large
optional roof atlas. Seven controlled tests cover departure disposal, city
detail disable, ignored aborts, old decode/new arrival races, revisit and failure.

## Terrain: verified provider gaps and critical geometry constraint

HTTP GET centre-tile probes used staging Origin and a browser User-Agent.
Default Python User-Agent 403 responses were discarded, not interpreted as
missing coverage. A successful centre tile does not prove whole-view coverage.

| Venue | z12 | z13 | z14 | z16 |
| --- | --- | --- | --- | --- |
| Hong Kong Revenue Tower | 200 | 404 | 404 | 404 |
| Rome Ostiense | 200 | 200 | 404 | 404 |
| Helsinki Tech Arena | 200 | 200 | 200 | 404 |
| Beykoz campus (two events) | 200 | 404 | 404 | 404 |

The other 26 distinct event coordinates returned 200 for z16 centre tiles.
Several uncached responses took 0.8–1.3 s locally; these are samples, not browser
percentiles or geographically representative latency measurements.

`terrainPolicy.js` separates the user's preference from temporary rendering
state. New illustrative/OSM closeups may pause terrain at z15.5+. World/regional
exploration retains relief; known gaps use a conservative z12 source where
regional terrain remains enabled. Hillshade is unnecessary beyond z12.

**Never flatten existing surveyed LoD2 without normalizing its model/ground
together.** Its coordinates retain absolute elevations: Garching 471–522 m,
Munich 510–568 m, Cottbus 64–106 m, Berlin 28–116 m. Turning off terrain behind
those models can leave them floating or outside the camera framing. The new
illustrative/OSM scene and Rome massing are different, ground-relative assets.

## Remaining UX constraints and acceptance targets

- Cache the same URL the renderer consumes; content-hashed local arrivals
  remove curated-view provider latency while remote free roaming remains.
- Start shared context/preparation during the intro independently of world
  readiness. Cover all overviews before all sharp imagery, with selected and
  likely-next requests promoted above the background queue.
- Persistent caching needs explicit version/TTL/size eviction, response
  validation, Save-Data policy, quota/private-mode fallback and cancellation.
  The 389-tile set must fit record count as well as byte count.
- Keep every authored media item. Of 66 items, 46 are Drive viewers, 12 Docs,
  four YouTube and four local photos. Do not prefetch 62 remote viewer apps;
  defer until near visibility, retain the original-link escape hatch and do
  not guarantee latency controlled by third-party providers.
- Source/cache readiness is not a rendering metric. Retain the last frame
  during handoff, but release when a useful local arrival is visible rather
  than waiting indefinitely for unrelated horizon tiles.
- The new transition observes actual centre tile completions followed by a
  paint. MapLibre 6.11.2 emits `dataType: 'source'` and no `sourceDataType` on
  individual tile completion; `sourceDataType: 'content'` instead means a
  source update. Transition/capture observers and delayed cue timers now clean
  up on readiness, cancellation and bounded timeout (15 controlled tests).
- A decoded raster-cache revisit may emit no individual tile completion.
  Public `coveringTiles()` returns IDs,
  not residency, and feature queries cannot inspect raster pixels. Historical
  completion keys/two render frames cannot establish continued GPU residency:
  eviction can recycle the old texture while leaving its tile state loaded.
  The new bounded, locally owned landing source supersedes this caveat when
  its current image is ready: handoff observes an explicit post-jump paint and
  hides both approach/refining cues without waiting for global sources. It
  schedules one final paint for listener-ordering safety, not a render loop.
  Fifteen landing tests cover native bounds, one active source, world/visibility,
  rapid abort/stale completion, same-key pending/decoded reuse, cleanup and
  image failures, queue-free injection, bounded decode, legacy fallback and
  public style/context restoration. Image failure or disabled/non-ESA imagery still uses the
  conservative 2.8 s handoff fallback. No private cache access or fragile pixel
  heuristic was introduced; browser latency still must be measured.
- Suggested browser targets, **not reported results**: authored title/copy
  within 100 ms of selection; immediate selected-event 3D silhouette; prepared
  arrival reveal p95 below 500 ms desktop / 1 s on a tested midrange phone;
  no black frame across all 32 selections.
- Test cold entry, 5/20 s intro dwell, sequential/random/rapid clicks, revisit,
  reload, Home/Enter, mobile portrait, Save-Data, denied storage and offline
  after preparation. Track cache hit/miss, queue, bytes, source failures,
  rendered (instance-multiplied) triangles and reveal timing.

## Staging and primary references

Observed staging cache headers: `/data/*` one-hour TTL; `/assets/*` one-year
immutable except no-store current-release manifest. Content-hashed arrivals
fit that policy. Existing `v1` assets must change their version/name if their
bytes change, rather than overwrite a long-lived cached URL.

- [MapLibre MapOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/)
  documents per-source tile-cache and canvas/pixel-ratio tradeoffs.
- [MapLibre Map API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/)
  documents `coveringTiles` for inspecting actual coverage.
- [MapLibre source data event](https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/)
  distinguishes tile completion events from source metadata/content updates.
- [MapLibre ImageSource](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/)
  documents URL-less sources and `updateImage({image})` for decoded pixels.
- [MapLibre image request limit](https://maplibre.org/maplibre-gl-js/docs/API/functions/setMaxParallelImageRequests/)
  documents the shared default 16-request ceiling for raster-heavy maps.
- [MDN Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache) states
  that entries do not auto-expire, Cache API does not enforce HTTP headers,
  storage has quotas and versioned cleanup is the application's responsibility.
- [MDN Request cache](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)
  distinguishes normal HTTP cache behavior from persistent CacheStorage.
- [Mapterhorn TileJSON](https://tiles.mapterhorn.com/tilejson.json) describes
  global bounds/tile size/encoding, not a per-region high-zoom coverage map.

## Final published staging browser acceptance

Published release: `20260930T204102Z-9781da1c6e-8ec308`.
Runtime: `main-DEg9K2j0.js`, bootstrap: `index-oPc6bHgn.js`.
Production was not promoted (its manifest remains `index-Cydzy373.js`). No
commit was created. All 179 verification tests passed, alongside asset, SEO,
shell syntax and whitespace checks.

A single Chrome desktop traversal after entry-screen preparation visited all
32 achievements via the actual chronology controls. Records are saved in
`performance-qa-2026-09-30.json`. The selected independent landing was painted
and the camera settled in **275–1681 ms**, median **496 ms**. All 32 had a ready
3D scene (31 shared/context exhibits; Garching uses its existing radar
installation), zero landing failures, and exactly one owned decoded landing.
These are one-machine developer observations, **not** a cold-network, mobile
hardware or cross-device p95 promise. They exclude the 250 ms retained-frame
fade and external media-viewer load time. No new raster resolution was invented.

Phone-sized 390×844 touch verification prepared all 195 mobile resources
(9,713,626 bytes), with no warmup failures or horizontal overflow. Cross-city
Tesla framing placed its illustrative supply-chain court at y177 above the
project bottom sheet starting y254; desktop framing placed the court to the
left of its panel. The final HTML disables Enter until the bootstrap binds its
explicit activation handler, avoiding a lost very-early click. Immediate Enter,
Home and normal chronology navigation were exercised. Temporary profiling
observers and viewport/touch overrides were removed by reload/reset afterward.

The final upload initially encountered a full shared server filesystem.
Only that invocation's incomplete staging directory was removed. Identical
immutable bytes across nine existing staging snapshots were consolidated with
SHA-256-checked hard links, retaining all rollback snapshots and saving about
1.8 GB. Future staging uploads use checksum-verified captured link-dest reuse,
non-preserved build timestamps, a 1 GiB free-storage guard and failure cleanup;
no other project's data or Docker images/volumes were deleted by this task.
Unrelated server cleanup was observed concurrently; a subsequent read-only
probe reported about 42 GB free. The published symlink and all production
manifests were checked independently after upload.

## Quality correction after user review (30 September)

The previous all-32 arrival timing result is **not a quality acceptance result**.
Its readiness signal certified rendered geometry/coarse ESA pixels, not a sharp
photograph or an accepted roof atlas. The user correctly rejected Tesla's
z17.8 closeup on 10 m Sentinel imagery and plain gray roofs. Faster delivery did
not justify those changes.

The replacement keeps a single active native image and adds a verified,
licensed aerial-photo package for 30/32 events (29 geographic patches).
2048² sampling is 0.398–0.638 m/pixel; compressed full files total 45,624,644 B,
1024² preview alternatives 14,804,348 B. Typical phones select the **full**
2048² photo; cheap previews only prepare inactive locations. Explicit <=2 GB
hardware uses a reduced variant and a proportionately wider camera. No AI
textures, upscaling or invented photographic detail are involved.

Tesla now shows the whole real factory at z16.6: 23 surveyed LoD2 buildings,
3,435 triangles, a 2023-05-04 TrueDOP roof atlas (0.364 m/pixel delivered), and
an independent 0.638 m/pixel ground photograph. The author’s south-gate marker
is unchanged. Vertical facades are neutral survey geometry, not a claim of
photogrammetry or current event-day imagery. Native roof photographs remain
visible and cannot be replaced by an opaque gray placeholder during loading.

Official chapters and Garching hide opaque meshes until their native roof
atlas passes validation/decoding. Mapped fallback roofs borrow the active
image's pixels with correctly georeferenced UVs; no extra CPU decode is made.
Their estimated heights and illustrative exhibits remain disclosed. Adjacent
survey chapters no longer overlap differently estimated roofs at other events.
All inactive textures are disposed; only compressed bytes are prewarmed.

A quality-aware handoff waits for the selected native photo **and**, where
required, its genuine roof atlas after paint. An unrelated ESA/global-loaded
flag cannot release it. Eight-second exceptional failures fall back to an
honest wide camera, not an excessively magnified low-resolution map.

Encoded preparation budgets: desktop 64 MB, phone 28 MB; persistent encoded
cache desktop 96 MB / phone 48 MB, with speculative SW caps 64/24 MB. Concurrency
is bounded and Save Data still opts out of speculation. The corrected HK venue
and geometry use a fresh v2 context URL; original v1 bytes remain intact for
cached previous releases. Mandatory HK source logo is on the map face.

Two Beykoz events still lack verified redistributable sub-metre imagery. They
use wide source-appropriate framing; no proprietary viewer imagery is scraped.
High-quality prepared patches do not imply sub-metre imagery everywhere the
visitor can manually pan.

Verification: 225 offline tests pass, source/asset hashes match, and staging
SEO/artifact checks pass. Desktop photographic arrivals were observed for the
first 23 events, 22 timed navigation transitions (831/1476/537/... ms including
UI automation overhead), with photographed roofs rather than silhouette-only
readiness. Tesla was visually checked on desktop and a 390×844 touch viewport;
both had the same full ground-image bytes (1,149,590 B) and a genuine accepted
factory roof atlas. These are local warm-session observations, not cold-network
SLA promises or physical-phone thermal benchmarks. Further live staging QA
below supplements them; external document viewers can block CDP profiling,
so visual inspection is kept distinct from complete timing results.

Published staging release `20260930T215221Z-9781da1c6e-da1d01`.
All 58 full/preview images returned HTTP 200 with exact manifest sizes;
legacy v1 and corrected v2 context hashes matched the expected bytes remotely.
Live staging checks: Tesla z16.6 with accepted factory roof atlas, Cottbus 2026
with native photo/atlas, Helsinki with 42 photographed roofs, and Rome with 57
photographed roofs and the old gray massing disabled. Each had one owned active
2048² photograph, zero photo failures and one active scene/atlas as appropriate.
The live warmup completed 50,407,558 encoded bytes; the persistent cache stayed
below its 96 MB desktop cap (75.6 MB observed, 287 records; later cache hits
confirmed). Seven further destinations were inspected visually rather than
counted as CDP timing results after an external document viewer paused profiling.
Production manifest remained `/assets/index-Cydzy373.js`; no commit was made.
