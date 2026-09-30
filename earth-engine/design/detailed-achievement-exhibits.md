# Detailed achievement exhibits

These are **illustrative explanatory models inside a museum-style plinth**,
not surveyed geography or claims that an exhibit exists at a real venue. Venue
positions and OSM buildings remain unchanged. No AI images, invented titles,
new project descriptions, clinical measurements or confidential implementation
reconstructions are introduced. The host signs/reader use the original authored
portfolio text; this geometry module does not render text.

## Integration API

```js
import {buildDetailedExhibit, EXHIBIT_MODELS} from './achievementExhibits.js';

const handled = buildDetailedExhibit(subject, p, {slug, project});
```

- `subject` is an existing `ACHIEVEMENT_SCENE_SUBJECTS[slug].subject`.
- `p` submits material-keyed geometry to the host's static batch:
  - `box(material, [x,y,z], [width,height,depth], rotation?)`
  - `sphere(material, [x,y,z], [radiusX,radiusY,radiusZ])`
  - `cylinder(material, [x,y,z], radius, height, rotation?)`
  - `ring(material, [x,y,z], radius, tube, rotation?)`; horizontal default.
  - `rod(material, from, to, radius?)`
  - `cone(material, [x,y,z], radius, height, rotation?)`; optional fallback.
- `context.project` is the authored project object and is never mutated.
- Return value is `true` when a known subject is fully handled, otherwise
  `false` so the host can handle a future subject. Missing required primitives
  throw before drawing a known subject.
- Optional `context.onParts(metadata)` exposes the corresponding
  `EXHIBIT_MODELS[slug]` descriptor for instrumentation. These part names and
  `kind` identifiers are internal completeness metadata, not new UI copy.
- Coordinates use X=east, Y=up, Z=north. Actual geometry remains inside a
  12×8 m central footprint; it does not obstruct the outer authored signs.

The host owns Three geometries/materials, material batching, GPU upload and
complete disposal. This module has no Three import, network calls, images,
textures, timers, animation loop or renderer. Repeated visits produce exactly
the same primitive commands. All 32 source slugs are covered across 22 subjects.

## Meaningful coverage

| Authored event/project | Recognizable model components |
| --- | --- |
| Tesla Gigathon | Cargo pallets on roller conveyor, warehouse rack, logistics terminal; a generic supply-chain cell, not confidential factory processes |
| Hong Kong health-tech | Eye/conjunctiva study, camera, hemoglobin-estimation display; no clinical values |
| Decarbon Days 2025/2026 | Jury desk row, pitch display, miniature factory energy blocks |
| pdm search/discovery | Directory/discovery cards, comparison kiosk; no invented confidential product UI |
| Zero One / Infineon | Patterned silicon wafer, fabrication process cell, actuator, process-sequence terminal |
| Gralobe | Gridded globe next to flattened map table and transition frames |
| Real Coin Map | Coin specimen trays, optical-inspection lamp, mint-location map display |
| SecSanta | Wrapped parcels, pooled contribution console, privacy lock |
| NASA Space Apps mentorship | Satellite bus/solar wings, ground-station dish, geography terminal |
| Sui / Move | Word-composition tiles, resulting minted object cards, Move contract terminal |
| Slai | Headset, tracked pen, physical frequency-band equalizer console and speakers |
| European Defense Tech | Radar antenna, instrument rack, detection console; the host's dedicated radar may additionally remain |
| Tech Berlin finance | Portfolio dashboard and causal news/scenario cards |
| Huawei HRTF | Pinna/ear-form study, multi-view camera arc and audio display |
| Master's thesis / TEA | Recorded trajectories, latent encoder, shared-policy connections and three environment test boards; follows original RL description, not the stale HRTF tag |
| MX Focus | VR/EEG headband, tracked pen, desk-aligned writing paper, classroom/teacher display |
| Salzburg tourism | Muse-like EEG headband/mannequin, recommendation kiosk, route miniature with generic mountain, town, bridge and water |
| Zurich Climathon | Anonymous survey kiosks and sustainability feedback cards |
| Bayer platform | Molecular study, image-inspection instrument and computer-vision display; no proprietary assay claim |
| DSAG / HippoSAP | Transaction documents, inspection gate and time-series monitor |
| Circular BSH | Washer/fridge, X-ray inspection portal, sorting conveyor/actuator and recovery bins |
| Thüga / Bright Grid | Households, PV panels, battery storage and grid controller |
| Solana microbetting | Agreement records, liquidity pool and oracle terminal |
| SIX / BizzWizz | Reporting binder, framework document trays and KPI dashboard |
| HackUPC travel | Interest-comparison kiosk, city-route miniature and aircraft/flight paths |
| MDSI football | Real pitch markings/goals, player-position spheres and defensive-line analysis monitor; spheres were explicitly the authored visualization |
| Dräger | Patient sensor console, illustrative ECG-style trace, sensor channels and prediction display |
| ETH Munich NFT | Paired image cards, feature-embedding racks and comparison display |
| MSG / Navigo | Road-route miniature, vehicle, alternative route and efficiency kiosk |
| Bachelor's thesis | Cat face/nose, capture camera, paired Siamese encoder racks and identification display |
| Perfect GPA / TGU | Open book, graduation cap and course-record display |

Tourism buildings/landmarks are explicitly **generic scale models on a table**,
not guessed real Salzburg landmarks. EEG/ECG traces are illustrative static
traces, never patient data or measured results. Displays use bounded geometric
patterns rather than fabricating numerical output or generating interface text.

## Verified performance bounds

`node --test scripts/achievementExhibits.test.mjs` checks each model using the
same actual Three geometries and transformation order as the host, including
rotations and optional cone fallback. It does not estimate the visible geometry
using primitive counts alone.

- All 32 models build deterministically and preserve the original project data.
- Maximum primary-model triangle count: **4,912** (coin specimen scene).
- Actual integrated complete court + signs maximum: **6,744 triangles**,
  **415,112 geometry bytes**, and **15 draw calls** (32 models audited).
- Whole-model tests reserve 3,000 further triangles for the plinth, shelter,
  planters, instanced trees and signs; every complete model remains under 12,000.
- All geometry fits X[-6,6], Z[-4,4], Y[0.69,6) metres.
- At most 10 base-material/tree draw calls, including the host court palette and
  two existing instanced-tree calls. Original explanation signs are accounted
  separately in the host's complete-scene integration test (≤15 total calls).
- Flattened position/normal geometry for the primary model is below 500 KB.
- No inactive model is uploaded by this module; one active GPU scene, on-demand
  rendering and disposal are enforced by the existing host lifecycle.

The tests also prevent Salzburg reverting to a sphere/rod graph and require
geometry/metadata differences across shared subjects (EEG tourism vs flights vs
CO₂ road routes, conjunctiva vs sensors, HRTF vs Slai, and the three ledger
projects). The host's batch budget must throw on overflow, never silently omit
parts of a model.
