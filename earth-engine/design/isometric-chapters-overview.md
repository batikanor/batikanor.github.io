# Isometric city chapters — source and fidelity

**Public release, 28 September 2026.** These three venue-scale LoD2
chapters are part of the Earth portfolio. Rome is a separate illustrative
fallback, documented in `design/rome-venue-pilot.md`.

## What is real now

Three authored achievements open into a more detailed, tilted district view:

| Achievement slug | Geography | Geometry | Roof photograph |
|---|---|---|---|
| `masters-thesis` | Siemens AG, central Munich | 240 Bavarian official LoD2 buildings | 3328 × 3072 Bavarian DOP20, about 20 cm/pixel |
| `bayer-ai-2024` | Google Office, central Munich | 336 Bavarian official LoD2 buildings | 3328 × 3328 Bavarian DOP20, about 20 cm/pixel |
| `real-coin-map-2025` | Berlin State Library | 55 Berlin official LoD2 buildings | 3584 × 3584 TrueDOP 2026, about 18–20 cm/pixel |

The event titles, descriptions, videos, images, and existing author content
were not changed. These are small, truthful **250 m building pockets**, not
claims of complete 3D Munich or Berlin. Bavaria's official DOP20 raster
already covers the surrounding Munich area. The Berlin app also
streams official TrueDOP 2026 *ground* imagery for the inner-city corridor,
which contains all three Berlin project pins; building geometry is currently
limited to the State Library pocket.

The reusable `src/isometricRegionLayer.js` accepts local-data descriptors,
validates the binary origin and atlas projection, then loads only the one
eligible chapter after the map settles. Its photographic texture is applied
only to the official source roof polygons; façades are neutral generalized
LoD2 geometry, without invented windows. The settings wheel contains
**3D city detail** ON/OFF. OFF releases the 3D GPU assets while keeping
imagery and project content. On low-memory devices the model can fall back to
untextured LoD2 or the ground map. Source credits remain visible.

## Performance and QA

The world view downloads **none** of the new chapter meshes or atlases.
Per-chapter compressed geometry plus atlas: Siemens 2.66 MB, Google
3.19 MB, Berlin 3.48 MB. Texture RAM is substantially larger than transfer
size (roughly 40–51 MB), hence one-active-chapter disposal and GPU-dimension
checks. The z16 Mapterhorn DEM is overzoomed at higher map zooms: z17+
provider requests returned 404 in both cities, whereas z16 was available.
This removes a visible delay and avoids repeated missing-tile requests.

The release suite passes 52 tests, including actual-source BLD2 parsing,
projection/roof-UV checks for all three chapters, chronology, exports, and
the existing portfolio-content invariants. The Vite build passes.
Independent desktop and mobile browser checks found textured roofs in all
three chapters, working detail and settings controls, and no JavaScript page
errors or missing local assets. Focused chapter views had no DEM 404s after
the z16 cap. A separate Rome → Berlin chronology flight can still request
Mapterhorn z14–15 tiles around Rome that the provider returns as 404; the
available z13 parent and the base map keep navigation usable. This is a
provider coverage gap outside the three city chapters, not a reason to lower
regional DEM detail globally. Representative checked previews:
`/tmp/isometric-focused-desktop-bayer-ai-2024.png`,
`/tmp/isometric-focused-mobile-real-coin-map-2025.png`, and
`/tmp/isometric-mobile-berlin-detail-on.png`.

## Important limits and later expansion

The source LoD2 models are generalized, not photogrammetric façades. The
2026 Berlin aerial image is **not** a photo of the 2025 hackathon day.
The official Berlin WMS sets no-store; repeat pans can refetch visible tiles.
The current pilot does not cover most portfolio sites in 3D. Further
expansion should use independently licensed city data, bounded multi-atlas
streaming, and a deliberate coverage/venue review; it should not fill gaps
with invented architecture. For exact source hashes, licenses, build steps,
and alignment checks see `design/munich-isometric.md` and
`design/berlin-isometric.md`.
