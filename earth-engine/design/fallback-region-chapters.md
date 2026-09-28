# Beautiful venue chapters when the surveyed 3D data is incomplete

**Design research, 28 September 2026.** A source-audited Rome venue pilot is
implemented; Heguri and Beykoz remain proposed. This covers the three
originally unresolved destination areas in
[the all-city feasibility audit](./all-city-3d-feasibility.md): ETHRome at
Via Ostiense 92, Gyokuzoin on Mount Shigi in **Heguri Town** (the portfolio
labels the trip Nara), and the Turkish-German University in Beykoz. The two
Beykoz achievements should share one geographic asset, while retaining their
separate chronology entries and original project media.

## Recommendation

Build one **source-audited, 400–600 m-wide venue miniature** for each. Match the
appeal of the [Cottbus isometric map](https://cottbus.maptheory.org/)—a fixed
camera, crisp ground, legible roads, attractive massing, quiet shadows and
individual venue details—without claiming its illustrative façades or trees
are surveyed. Cottbus is a useful *rendering method*, not a reusable global
dataset: its 81 individually rendered 3072² cells form a 27,648²-pixel city
and roughly 500 MiB of delivered raster assets. Duplicating that citywide
footprint for every portfolio pin would be excessive. Instead, render one
small area per distinct venue, with several resolution tiers and only the
visible tiles fetched. The current local Munich/Berlin chapters already
prove the separate real-data 3D route where LoD2 and aerial imagery exist.

Use the **same visual design** across factual and less-complete chapters, but
never the same truth label. Detailed roof shape and measured height need a
measured model. A mapped footprint can establish *where* a building is, not
its roof shape, façade or height. If a feature lacks a defensible height,
render it as a restrained flat/low-relief mapped shape or omit it from 3D,
not a random three-storey block. If the actual venue needs a recognisable
building, hand-author it only from rights-cleared plans/photographs and mark
it `author-reconstructed`, with the evidence retained in a private source
manifest. Distinctive event artefacts can be artistic, but must not pose as
real permanent site features.

## Three local strategies

| Venue | Best defensible first pass | Path to premium fidelity | Explicit non-goal |
|---|---|---|---|
| **Rome / ETHRome** `ethrome-2025` | CC BY 4.0 [Lazio 2020 AGEA orthophoto](https://geoportale.regione.lazio.it/catalogue/csw_to_extra_format/r_lazio%3A92b0f7e3-3b75-4feb-ac5e-2382/ortofoto-agea-v-2020.html) for ground; Overture/OSM building footprints and only source-provided heights for massing; authored paving/planting colors outside photographic ground. Show 2020 photo date, not event-day imagery. | Verify the exact venue frontage, then reconstruct a small number of visible buildings from permitted plans/photos or procure an appropriately licensed model. Lazio's [geoportal describes public layers as CC BY 4.0](https://geoportale.regione.lazio.it/faq/servizi-wms-wfs-wcs-come-accedere-da-remoto-ai-livelli-del-geoportale/), but each selected layer still needs metadata review. | Scraping a photoreal viewer or inventing Roman roof silhouettes. |
| **Gyokuzoin / Heguri** `music-ai-osaka-2025` | Terrain-first, temple-garden miniature: official GSI elevation and **individually rights-checked** aerial layer where usable; accurately located paths/temple footprint if source supports them; original event images remain in the achievement panel. [GSI DEM documentation](https://maps.gsi.go.jp/development/hyokochi.html) distinguishes ground elevation from building heights. | Ask the temple or author for permitted architectural reference/photography, then manually model the main roofs, gate and stair geometry with a source checklist. Permission may be needed for local capture. | Treating the [Nara City PLATEAU model](https://www.mlit.go.jp/page/content/001906595.pdf) as Heguri coverage, or inferring temple roofs from a coarse aerial alone. |
| **Beykoz / Turkish-German University** `bachelors-thesis`, `tgu-perfect-gpa` | A deliberately cartographic campus miniature from audited Overture/OSM footprints, verified road/path geometry and geographic terrain. If a licensable high-resolution ortho cannot be found, use designed ground materials and contours rather than a blurry low-resolution satellite image. Keep the author's campus/event media prominent. | Request campus survey/site plan, rights-cleared photographs, or a reusable model from the university/municipality. Build a **small campus hero model** from those sources; share the rendered asset for both achievements. | Extracting Istanbul's public [3D viewer](https://cbsakademi.ibb.gov.tr/proje/3b-istanbul-uygulamasi) or [city-map](https://sehirharitasiapi.ibb.gov.tr/) content without an explicit reuse grant. A viewable model is not automatically a downloadable/rehostable asset. |

The three coordinates in `src/data/achievements.json` remain **pins to
verify against venue evidence before modeling**; they are not survey-control
points. `Via Ostiense 92`, Gyokuzoin and the university should each be checked
against an official address/site plan and the original event material. The
present image/video/content in the site must remain unchanged and available.

## Reusable input and art pipeline

1. **Rights/provenance manifest per venue.** Record URL, license, source date,
   retrieval date/hash, coordinate system, geographic coverage, feature IDs,
   precision, and whether height/roof/façade is measured, derived or authored.
   A CI gate refuses missing license or source assertions. Pin source versions;
   don't allow a live service's data to silently change the rendered chapter.
2. **Global fallback geometry.** [Overture Buildings](https://docs.overturemaps.org/guides/buildings/)
   provides globally distributed footprints and sometimes height/building
   parts; its own guide warns that ML-derived footprints may be imprecise and
   falsely detect structures. Extract an exact bounded Parquet subset,
   reconcile duplicate/overlapping features, QA against the permitted aerial
   or venue plan, and keep a human-edit log. It is **ODbL**, not freely
   interchangeable with a CC BY model: follow [Overture attribution](https://docs.overturemaps.org/attribution/)
   and [OSM's license requirements](https://www.openstreetmap.org/copyright).
   If our corrected footprints constitute a publicly used derived database,
   make that machine-readable subset/alteration method available under ODbL
   as required by the [license](https://opendatacommons.org/licenses/odbl/1-0/).
   Have counsel review mixing datasets before publication.
3. **Terrain and ground.** Use a legally reusable ortho only when it resolves
   the venue sharply enough and aligns at the chosen camera. Otherwise draw
   a designed map from licensed land-use/road/water geometry. Terrain is an
   elevation surface, not a reason to add imagined walls. At Heguri, GSI
   [terms](https://www.gsi.go.jp/ENGLISH/page_e30286.html) require source and
   edit notice and warn of third-party rights/Survey Act restrictions; the
   [tile list](https://maps.gsi.go.jp/development/ichiran.html) varies by
   layer. **Do not bulk-bake/rehost GSI imagery before identifying the exact
   permissible source and use.** If that cannot be cleared, use authored
   non-photographic ground and original photo/media in the project panel.
4. **Building fidelity classes.** A: official roof/wall geometry; B: verified
   footprint *and* height; C: verified footprint only (low-relief/planar);
   D: hand-modeled venue based on documented authorised reference; E:
   unknown (no building shown). Use an intentional color/material hierarchy
   rather than incorrectly painting aerial roof pixels onto generic flat
   roofs. Only A and a validated D can get landmark-level architectural
   detail. The visible credits should explain any illustration in a compact
   source panel, not compromise the lean map UI.
5. **Offline deterministic render.** For the illustrative chapter, use one
   consistent orthographic camera (roughly 45° azimuth / 35° elevation, tuned
   at pilot review), sun, ground classifications, source-ground color,
   height-safe buildings and manually vetted hero details. Render the whole
   geographic AOI with padded tile bleed; crop multiple independently
   rendered adjacent tiles and run seam/hash and map-to-pixel hotspot checks
   like Cottbus. No whole-image generative repaint or Google/Apple map
   screenshots: these break geometry, seams, rights or provenance.
6. **Runtime modes.** Keep the current MapLibre Earth for world/regional
   navigation. At a close selected venue, crossfade into a separate fixed-
   camera miniature renderer with its own georeferenced pan/zoom/hotspots;
   a baked orthographic image is **not** a Mercator raster tile that can be
   dropped into a pitched MapLibre layer without distortion. Share the same
   achievement selection, deep link and detail popup; return smoothly to the
   globe. Where true BLD2 geometry exists, desktop can still use the present
   3D layer; the fixed-camera raster is a fast mobile/reduced-motion option.

### Performance contract (release targets, not measurements)

- **Zero new chapter bytes on world/homepage load.** Start only after explicit
  achievement selection or camera idle in a sufficiently close radius; never
  fetch all 18 cities or 32 events. At most one active chapter; abort previous
  fetches on chronology flight and release image/mesh/GPU resources on exit.
- A mobile 512–768 px preview target of **≤250 KB**, and a desktop preview
  target of **≤500 KB**, should appear first. Stream only visible 512–1024 px
  WebP/AVIF resolution tiles. Target **≤1.5 MB extra on mobile** and
  **≤3.5 MB on desktop** for a typical fully detailed first venue view;
  permit exceptions only after device/network profiling and user-visible QA.
  Existing Munich/Berlin 3D pilots transfer about 2.7–3.5 MB *per selected
  chapter*, not at homepage load.
- Limit mobile chapter GPU texture allocation to roughly **32 MiB** (e.g.
  four 1024² RGBA tiles ≈16 MiB, allowing double-buffering) and desktop to
  roughly **64 MiB**. A 3072² RGBA atlas alone is about 36 MiB, regardless
  of compressed network size. Cap parallel decodes to 2 mobile / 4 desktop;
  evict nonvisible LODs and close `ImageBitmap`s. Existing WebGL/basemap
  memory is *additional*; benchmark total page memory, not just this layer.
- Prefer 3 quality tiers: mobile/save-data static preview with working
  hotspots; normal tiled isometric with subtle interaction; enhanced real
  mesh only when source quality, WebGL and memory permit. `prefers-reduced-
  motion`, low memory, WebGL failure or tile timeout must retain a usable
  geographic map and full project popup, not a blank scene.
- Gate release on 320/390/768 px and desktop, Safari iOS/Chrome Android and
  a low-end 4 GB device. Measure additional transfer, peak page/GPU memory,
  time-to-first-chapter, animation frame pacing/INP, tile error rate, and
  panorama-to-project-popup correctness on a throttled network. A page weight
  estimate from local assets is **not** proof of acceptable real-device
  performance. Use a staged rollout and real-user telemetry before expanding.

## Next executable increment after Rome

The Rome pilot now uses Lazio CC BY 4.0 orthophotography and OSM mapped
footprints with explicitly illustrative heights; its original achievement
popup and deep link are unchanged. It is not a surveyed roof model nor the
full fixed-camera tiled illustration proposed above. Next, evaluate Heguri
(legal aerial check plus temple reference outreach), then Beykoz (campus
rights outreach, two achievements sharing one asset). A
Google [Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/overview)
runtime could be evaluated for coverage as an **opt-in, billed, attributed
live layer**, but its [policies](https://developers.google.com/maps/documentation/tile/policies)
prohibit turning it into this offline-baked/rehosted pipeline and would add a
different loader/performance/cost profile. It is not the default fallback.
