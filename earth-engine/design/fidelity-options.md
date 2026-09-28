# Three viable visual directions, after the first Earth slice

This is a decision document, not a claim that all three have been built. The
current local slice implements **A** around one venue. No production source,
credit, cost, or account choice should be inferred from this experiment.

## A — Open photographic Earth + authored story venues (implemented slice)

**Look.** A real Earth from orbit, high-resolution regional orthophotos where
permitted, official 3D roof volumes, and one distinct 3D field object for each
achievement. The current Garching slice is the proof: streamed global imagery
and terrain, Bavaria DOP20 and roof-textured LoD2, a metre-scale car, and a
user-triggered radar installation.

**Strength.** The world is as geographically large as Earth, with real
separations and no huge initial texture. The renderer requests only relevant
tiles/venue art. Unique sculptural storytelling remains fully under our art
direction, without licensing the generic 3D vehicle/installation from a
third party.

**Limit.** There is no single free global photo layer sharp enough for a car.
Even Bavaria's 20 cm DOP20 becomes soft at an intimate camera distance;
scattered regional imagery, textured city/ground assets, road geometry,
collision, art, and audio are required for more local chapters. Generated
speckle is **not** a substitute for a genuine higher-resolution source: the
matched [ground-material experiment](ground-detail-study.md) was rejected.

**Source/rights gate.** The default EOX mosaic is a beautiful local research
source but [its 2018–2025 free layers are non-commercial
CC BY-NC-SA 4.0](https://cloudless.eox.at/license-non-commercial). The UI also
offers [ESA WorldCover's 2021 RGB annual composite](https://esa-worldcover.org/en/data-access/)
under CC BY 4.0, with NASA overview and official [Bavarian DOP20
OpenData](https://geodaten.bayern.de/opengeodata/) locally. Resolve imagery
terms before ever putting this on the public homepage.

## B — Licensed higher-detail satellite + authored 3D chapters

**Look.** Same Earth/venue design, but replace the global land mosaic with a
commercial satellite product such as [Mapbox
Satellite](https://docs.mapbox.com/data/tilesets/reference/mapbox-satellite/).
Coverage and native sharpness improve materially at country/city scales;
selected chapter grounds/buildings still need authored or independently
licensed higher-detail content for a genuinely drivable scene.

**Strength.** Easier worldwide visual consistency than stitching many public
services. The provider-neutral tile adapter and the personal achievement
manifest can remain separate.

**Limit.** Access token, [metered
pricing](https://www.mapbox.com/pricing), terms, logo/credit rules and an
ongoing operating cost. Paid satellite pixels are not generally assets to
ship inside an npm package. A token-backed, measured comparison is needed
before choosing B.

## C — Photorealistic 3D city backdrop + bespoke exhibits

**Look.** Use [Google Photorealistic 3D
Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles) in
CesiumJS at covered cities and place bespoke achievement pieces over them.
This is the strongest turnkey visual benchmark for textured urban massing and
vegetation at oblique angles.

**Strength.** Potentially a much more convincing high-altitude urban arrival
than LoD2's untextured facades, without ourselves photogrammetrically scanning
every venue.

**Limit.** Billing/API key, coverage variance, per-tile attribution and
[content-use restrictions](https://developers.google.com/maps/documentation/tile/policies),
including no unauthorized offline extraction/caching. It is not a
self-hostable dataset or an acceptable route to bypass rights by moving to a
Hetzner server. Interactive road driving would still need route/collision
assets and separately authored ground for convincing close-ups. Build this as
an isolated, token-backed comparison only if the owner wants to evaluate
ongoing service costs and product terms. Google also flags [EEA-specific terms
and missing content](https://developers.google.com/maps/documentation/tile/3d-tiles)
for EEA billing addresses; verify the German result with an actual account
before planning the production look around this source.

## Selection recommendation

Continue **A** for the reusable engineering spine and one excellent vertical
slice; evaluate **B/C** visually before committing every city to costly custom
art. Do not mistake image detail alone for game quality. The biggest remaining
quality gates are road/ground contact, textured facades/vegetation, art-directed
sculptures for the other 31 achievements, and validated performance on real
devices. The next larger map iteration should add **regional high-detail
chapters on demand**, not bake a fictitious monolithic 3D planet.

## Potential npm boundary

The valuable generic package would provide WGS84 metre-scale navigation,
semantic geographic LOD, camera transitions, source/credit adapters, streamed
venue asset lifecycle, object interaction hooks and quality budgets. MapLibre
already provides globe and tiled terrain rendering; we should not pretend to
have invented that. Keep personal achievements and third-party imagery outside
the package. See [package boundary and release gates](package-boundary.md).
