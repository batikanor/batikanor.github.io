# A real-world achievement engine: extraction boundary

This prototype is deliberately `private: true`. A future npm package should
publish **map/game primitives**, not a bundled planet image, a provider token,
or the owner's achievement stories. The physical world can be arbitrarily
large because the renderer loads visible tiles and small local assets on demand.

## Candidate public packages

| Layer | Reusable responsibility | Current proof |
| --- | --- | --- |
| `@batikan/earth-core` | WGS84 metre stepping, distance, camera/LOD rules, quality budgets, geographic content schema and validation | `src/geo.js`, `src/drivingPhysics.js`, `scripts/verify.mjs` |
| `@batikan/earth-maplibre` | MapLibre custom-layer adapter, provider registry, source-bounds and credits, city/event clustering, terrain sampling, venue-anchor transform | `src/sources.js`, parts of `src/main.js`, `src/buildingLayer.js` |
| `@batikan/earth-game` (only if a second use case justifies it) | Local vehicle controller, safe-start registry, scene lifecycle, input and interaction state | `src/drivingPhysics.js`, `src/carLayer.js`, `src/heroVenueLayer.js` |

The current `src/data/achievements.json`, radar story, car art, local Garching
geometry, and third-party raster/DEM URLs must remain app data or optional
adapters. The library must not imply rights to rehost imagery or distribute
commercial use of non-commercial sources.

An eventual provider-neutral host API might accept `imageryProviders`,
`terrainProvider`, `localSceneResolvers`, `attributionRenderer`,
`destinationManifest`, and a `qualityPolicy`, then expose a camera/interaction
controller. Do **not** publish that speculative API as stable today: it has
only one consumer and no real low-end/mobile performance results.

## Rendering/content contract

1. Globe: low-cost overview image and semantic region markers; no 32 full 3D
   installations in memory.
2. Continent/city: native-resolution satellite, terrain, honest WGS84 location
   disclosure. Co-located achievements stay co-located and become a venue
   list/exhibition, not artificially displaced pins.
3. Venue: licensed regional orthophoto or textured 3D city; load only nearby
   roof meshes, road/ground detail, the vehicle, and the selected installation.
4. Each new achievement requires an editorial brief, checked coordinates,
   safe ground anchor, unique icon/far-LOD, authored close-LOD mesh/materials,
   interaction, accessible fallback, collision footprint, credit record,
   memory/triangle budget and acceptance screenshot.
5. Leave close range at a source's **native detail ceiling** unless a local
   ground/photogrammetry asset takes over. Magnifying a 10 m pixel cannot
   produce a plausible street scene.

## Release gates

- Prove a second independent content set and extract only APIs it actually
  shares; document semver, TypeScript types, no-key fixtures, unit/integration
  tests, map-context cleanup and WebGL context-loss recovery.
- Verify imagery/terrain/asset use rights for a public professional portfolio.
  The local EOX 2024 mode is non-commercial; the ESA/NASA/Bavaria combination
  provides an open-data route with attribution, but availability and exact
  source credits still need a release audit.
- Test on low/mid/high GPUs and phones. Today the production bundle includes
  roughly 434 KB gzipped main JS plus a separately emitted ~510 KB MapLibre
  worker *before* network tiles. Dynamic loading of Three/venue art and
  quality-tier LOD are necessary before claiming a lightweight client.
- Build one genuinely finished, surveyed/licensed driving chapter with
  textured buildings, road constraints, collisions, suspension, authored sound
  and a mastered installation before scaling the 31 remaining briefs.

## Hosting

No server is required to run this prototype: Vite serves the app and the map
streams tiles from providers. A static host can serve the code and small
authored assets. Hetzner becomes relevant if we **legally** self-host large
preprocessed regional tile/3D assets, need authenticated licensed providers,
or build a multiplayer/editor backend. Hosting choice does not override source
licenses or magically add world-wide street-level imagery.
