# Offline universal achievement scenes

## Coverage and truthfulness

All **32 authored achievement points** are covered by **30 distinct coordinate
pockets** (two pairs of achievements share an existing point). Every pocket has
actual OpenStreetMap building footprints; all event coordinates are preserved except the independently verified Hong Kong Revenue Tower correction.
The offline snapshot contains **1,696 mapped buildings and 1,235 mapped trees**.
It is not a photogrammetry dataset or surveyed venue model.

- Exact mapped footprint topology is retained, then explicitly clipped to a
  local 520m × 520m envelope. Per-pocket caps are 100 buildings and 70 trees.
- OSM `height` is used when valid. OSM `building:levels` becomes a clearly
  estimated 3m per level. When absent, neutral 9m massing (6m for industrial
  buildings) is used. Flat roofs are illustrative, not surveyed roof geometry.
- Tree locations come from actual `natural=tree` nodes. Missing tree height is
  an explicitly illustrative 7m estimate. No forest is invented on the imagery.
- A clearly designed architectural **exhibition court**, four planter trees and
  a subject-specific model ensure immediate 3D even if geography has not arrived.
  This is illustrative portfolio art, not a claim that an installation is real.
  The subject labels come only from the author's existing project descriptions;
  they are internal scene metadata, not new UI titles or new project copy.
- A court prefers the camera-facing side about50m from the event, outside
  mapped footprints within100m. This reduces venue occlusion and keeps the
  unchanged achievement marker from obscuring the small subject. Full
  polygon/rectangle intersection checks handle slender crossing footprints and
  buildings inside a court. If dense geometry leaves no such location, the
  illustrative exhibit is elevated over the intersected massing rather than
  silently disappearing inside a building.
- Coordinates that were coarse in the existing portfolio remain coarse. This
  coverage does not assert that the existing point is a ground-surveyed address.

The source OSM snapshots and SHA-256 hashes are stored under
`design/sources/achievement-context/`. OSM is © OpenStreetMap contributors,
[ODbL 1.0](https://www.openstreetmap.org/copyright). The downloadable derived
active snapshot is `/data/achievement-context-v2.json` (immutable v1 is retained for previously cached clients) and retains attribution, licence,
provenance, bounding boxes and feature IDs. Do not remove the source credit.

## Geographic priority

Official Munich/Berlin/Cottbus LoD2 and Garching radar remain the preferred
chapters; Rome retains its existing actual-footprint chapter. **Do not** infer
success from a city name or slug: call `setOfficialContext(true)` only after the
actual selected chapter geometry AND photographic roof atlas are available. It hides duplicate OSM massing
and reduces generic court architecture to the small subject plinth. Untextured
OSM context preserves the actual aerial photograph with restrained ground
footprint outlines, not opaque featureless gray blocks. When that
chapter fails or becomes inactive, call `setOfficialContext(false)` so OSM stays
available. The no-network model is never dependent on a remote map API.

## Integration API

```js
const scenes = createAchievementSceneLayer({
  achievements,
  baseUrl: import.meta.env.BASE_URL,
  onChange: stats => { /* update source credit/diagnostics, not camera */ }
});
// Start while the intro/main map is still initializing; no GPU is allocated.
void scenes.prepareAll();
// Custom layer registration only after the style is ready.
map.addLayer(scenes);
scenes.setFocus(event.slug); // synchronously prepares exactly one local model
scenes.setEnabled(cityDetailOn);
scenes.setOfficialContext(selectedOfficialGeometryIsReallyLoaded);
// Borrow the ONE active decoded official orthophoto; never decode another city.
scenes.setRoofImagery(event.slug, {image: activeDecodedImage, metadata: patch});
// Before the image owner closes its bitmap, synchronously release our GPU wrapper.
scenes.setRoofImagery(null, null);
```

- `setFocus(null)` releases the scene when returning to the world/home.
- `prepareAll()` / `prefetch()` deduplicate one same-origin geographic request.
  They warm every CPU descriptor, not every GPU model or map tile.
- `getStats()` reports event, factual subject, ready state, geographic instance
  counts and actual rendered triangles **including multiplied tree instances**.
- `getActiveAttribution()` supplies a concise truthful credit for the host.
- `getExhibitFocus()` returns a fresh `[longitude,latitude]` pair for the current
  illustrative court, or`null` without a focused event. It works beforeonAdd
  and reflects updated geographic context when preparation completes. It is
  a camera suggestion **only**; keep the achievement marker and every mapped
  footprint at its original authored WGS84 coordinate. A camera centre midway
  between event and court preserves both; a zoom17.8–18.05 closeup makes the
  small subject legible without enlarging any mesh.
- `onRemove()` aborts in-flight data, frees all geometries, shared/unused
  materials, instance buffers and renderer references. No retained GPU LRU.
- Construction can be tested without WebGL using `rendererFactory`.

Arrival framing follows native photograph resolution via `destinationCamera`. Manual **Inspect 3D exhibit** deliberately frames the model independently; it does not claim finer aerial sampling. The scene is eligible from zoom15 to street scale and remains in range
within 950m of the selected point; a 300m pan does not hide it. Preserve existing
surveyed chapter and close-radar cameras. The local court is not suitable for a
z13.8 arrival; it is intentionally real metre scale, not a giant map symbol.

## Performance contract

- **No runtime OSM/Overpass calls**, no asset decoder, no extra photograph download,
  no canvas text, no transmissive materials and no permanent animation loop.
- One active event model only. Empty overview/entry state has no scene geometry.
- All subject geometry is batched by material (≤10 draws incl. planter trees).
  Textured geographic buildings are merged into two draws; mapped trees use two
  instanced draws. Partial source coverage can add one footprint-outline draw.
  The largest selected scene is ≤15 draw calls. Without suitable photography,
  large opaque roofs are absent, so they cannot mask native map detail.
- Coarse-pointer/≤4GB devices use at most 35 mapped trees, desktop at most 70.
  The three crown clusters of each tree share a low-cost 80-face primitive.
- Model build and geography preparation occur on selection/data completion,
  never inside `render`. Render does not call `triggerRepaint` or start network
  work; MapLibre's normal camera/source events produce frames.
- The source-context JSON is 576,252 bytes raw / 143,829 bytes gzip. Maximum
  selected-scene geometry is 26,439 triangles desktop / 16,919 on the conservative
  mobile tree budget (includes actual instance multiplication).
- The compressed source-context payload is shared by all 32 events; version the
  filename when changing the snapshot instead of overriding a long-cached v1.
- Official BLD2 uses absolute source heights; this layer's OSM/court geometry
  is terrain-relative. It queries the current origin DEM as tiles settle.
  Neither layer should alter the other's terrain policy.

## Shared-WebGL illumination

MapLibre supplies a projection with reversed screen winding relative to a
normal Three camera. Leaving Three's world determinant positive caused roofs
to be treated as backfaces: its `DoubleSide` shader inverted their normals and
produced near-black roofs and foliage. The layer reflects the Three world Y
basis, mirrors the hemisphere/sun positions, and applies the inverse reflection
in the projection model. The two position reflections cancel exactly; actual
OSM positions, height, scale and exhibition geometry are unchanged. Three can
now select the correct GL front-face state and produce natural material
illumination. This is not an emissive-brightness workaround. A regression test
checks source roof normals, world determinant, light directions and unchanged
Mercator vertex projection.

## Verification

`node --test scripts/achievementSceneLayer.test.mjs` checks all 32 subjects,
coverage/provenance, every raw snapshot hash, strict bounds/height validation,
geometry/draw budgets, truthful instance-count diagnostics, robust court siting,
correct disposal, rapid navigation/one-active lifetime, disabled detail mode,
intro prefetch deduplication, missing/oversized context graceful fallback, and
no self-scheduling render loop.

Regenerate geography with `python3 scripts/build-achievement-context.py`; this
is an **offline authoring tool**, not part of client initialization. It retains
pinned raw responses and performs small bounded public OSM API queries only
when a cached source snapshot does not already exist.


## Quality floor for shared aerial roof texture

`setRoofImagery(slug, {image, metadata})` accepts only the active event and a
borrowed, already-decoded image. The metadata is the destination orthophoto
manifest patch: `width`, `height`, `resolutionM`, rectangular WGS84 corners
(NW, NE, SE, SW), and genuine source `url`, `license`, and `attribution`.
Both declared and computed geographic pixel sampling must be ≤1 metre.
10m Sentinel imagery is deliberately refused as a roof atlas. No upscaling,
AI detail, recoloured roof photographs, or invented facade photography.

Roofs receive exact Mercator-local UVs into that active photograph. A white,
unlit, non-tone-mapped material preserves its source colour rather than
turning the roof gray or underlit. UVs use top-down `v` and `flipY=false` for
both native HTML images and ImageBitmap (whose GL flip setting is ignored).
Only entirely covered footprints become opaque roofs; the rest stay fine
photography-preserving outlines. Actual mapped trees and illustrative subject
objects remain 3D immediately, independently of photo availability.

The scene owns only one Three GPU texture, with ≤8× anisotropy. It does not
close borrowed pixels, copy them into a canvas, or keep inactive decoded cities.
The orthophoto host must call `setRoofImagery(null, null)` before bitmap disposal.
Focus changes, detail opt-out, official chapter activation and layer teardown
all release the GPU wrapper synchronously. `getStats()` exposes
`texturedContext`, `texturedBuildings`, `outlinedBuildings`,
`activeRoofTextures` (0/1), and `roofResolutionM`.

The 20 scene tests include photography-preserving fallback, real source
validation, source-aligned UV orientation, partial atlas coverage, one-active
texture lifetime, synchronous borrowed-image release, and no second decode.


## Detailed project exhibits and authored signs — 1 October 2026

Each of the32achievements has a topic-specific model, not just a generic
network. The existing Garching radar is reused rather than duplicated. The
other31courts submit geometry via `achievementExhibits.js` using actual project
descriptions. Salzburg shows an EEG headband, recommendation kiosk and tourism
miniature; Tesla shows conveyors/racks/pallets; health imaging, VR/music, finance,
satellites and recycling each have their own recognizable instruments. These
are illustrative miniatures, not claimed replicas of a confidential prototype.

Two native-font1024×640physical panels use literal excerpts of existing
`shortDescription`/`longDescription` only. The original title remains in the
project popup and chronology; signs/readers retain it only as metadata and accessible
labels, not repeated visible headings. Detail excerpts use the same 190-character
budget regardless of title length. Word-boundary truncation is visibly marked
with an ellipsis; source strings are never rewritten.
Only the active exhibit receives the two canvases (5,242,880decodedbytes).
They fade in nearzoom17and within220m; camera-facing heads move without
redrawing canvases, whilst poles remainfixed. Sign geometry is92triangles
and5draws. Complete ordinary court/sign peak:6,744triangles,415,112geometry
bytes,15draws. Overflow throws instead of silently omitting props.

The **Inspect 3D exhibit** button provides responsive manual framing. Close-range
reader targets are44px on phones and expose original prose in a high-contrast
popup with **Open full project**. All original images/videos/links remain in
the full project. Changing achievement, world/home, 3D off or removal releases
all sign textures/instancebuffers. Native canvas failure preserves the model
and accessible prose reader. No remote fonts, generated copy/assets, model
decoders, extra idle animation loops or GPU caches are introduced.

Desktop and390×844portrait browser QA cover Salzburg and Garching signs,
U orientation, proximity readers, full-story access and viewport framing.
Unit/resource tests cover all32models and actual geometry/texture disposal.
