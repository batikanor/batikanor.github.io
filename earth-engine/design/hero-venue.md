# Garching hero venue: Protective Radar

The interactive installation in `src/heroVenueLayer.js` is a **prototype field object**, not a depiction of an actual structure at Unternehmertum. It translates the achievement into a calm, physically plausible sensing exhibit rather than a generic pin or weapon mechanic.

## Geographic placement

- Editorial achievement coordinate: `[11.6671, 48.2625]` (venue reference).
- Rendered installation coordinate: `[11.666695, 48.262270]` (visually checked open lawn in a georeferenced Bavarian DOP20 z19 mosaic, about 19 m from the paved curated car start). The previous anchor was only ~2 m from the east–west path, so its 5.4 m platform radius would overlap pavement. The corrected center is ~6.4 m north: the entire platform and contact shadow remain inside the lawn in the orthophoto, several metres from the pedestrian path, eastern access and pictured roof. This is an image-based siting check, not a survey.
- This is illustrative placement only, **not a surveyed or authorized real installation**. Before any production claim, verify against current site imagery, rights and site access.

## Object and interaction

- Circular 10.8 m platform, 4.1 m maximum structure height, 12 structural shelter ribs, alternating translucent glazing, machined 2.2 m dish, motor/feed supports, field console, and interpretive plaque.
- The user triggers a finite scan. The dish completes two rotations, an abstract contact appears, and a restrained Fresnel protective field rises around the shelter. It fades back to an idle, non-animated state.
- Reduced-motion mode skips continuous rotation and shortens the effect.
- No remote model or texture assets are fetched; the plaque and concrete aggregate are generated locally. Repeated drain channels and shelter footings are instanced, dome ribs are merged.

## Integration contract

```js
import {createHeroVenueLayer, HERO_VENUE_EVENT} from './heroVenueLayer.js';
const heroVenue = createHeroVenueLayer({onScan: ({phase}) => updateScanUI(phase)});
map.addLayer(heroVenue);
heroVenue.setActive(activeEvent?.slug === HERO_VENUE_EVENT);
heroVenue.triggerScan(); // requires active, zoom >= 19.5, camera center within 75 m
```

The MapLibre custom layer shares its WebGL context, owns no map camera or DOM elements, requests repaints only during a scan, and disposes its geometry/materials/textures on removal. The UI adds a stricter 35 m vehicle-distance gate while driving, so the selected installation cannot be activated after the car travels away. Browser QA at Garching confirmed the model renders on the open lawn, the scan finishes and replays, and no hero-specific console errors occur. A remaining MapLibre globe-fog warning is unrelated.

## What remains for production quality

The model is a detailed procedural **blockout** (~20,000 base triangles, 47 mesh objects before instancing), not a polished Blender master asset with authored UVs, normal maps and material variations. The base orthophoto is soft at the closest driving scale. A production version should establish art review, a licensed high-resolution ground-imagery solution, surveying/ground-truth validation, accessible interaction copy, close-range mobile QA, and LOD budgets for many installations. This single venue must not be presented as 32 finished sculptures.
