# Garching synthetic ground-detail study — no-go

**Decision: do not integrate into `main.js`.** The 80 m, metre-registered experiment in `src/groundDetailLayer.js` adds procedural high-frequency grass and paved-surface micrograin above the streamed DOP20 orthophoto. It uses a generated 256² three-channel region mask, a 16×16 DEM-draped mesh, one draw call, and no copied image, downloaded texture, or new runtime request. It is gated to Garching and z≥19.5 and inactive by default.

The DOP20 z19 tile mosaic was used only to trace conservative surface-region polygons. It is **not** packaged in the layer. Roofs and broad path geometry remain the underlying official imagery. This is image-based alignment, not a surveyed campus model.

## Matched browser evaluation

Both images use the corrected radar anchor `[11.666695,48.262270]`, camera z20.23 / pitch 68° / bearing 285°, and the same loaded DOP20 tiles:

- [Original orthophoto](ground-study-original.png)
- [Experimental overlay at visible intensity 2.0](ground-study-overlay.png)

The ground polygons mostly register and roof pixels stay untouched, but the visible setting produces **synthetic-looking speckle and a slight feathered patch transition on pavement**. A weaker setting was nearly imperceptible. Neither restores the actual image information missing when ~20 cm/pixel DOP20 is enlarged for a close driving camera. The high-frequency shader can also shimmer under movement; a static screenshot cannot clear that risk. A wider/lower-pitch camera at z19.7 / 55° reduced enlargement, but made the radar small and flat and exposed more roof, so it was not a clear improvement.

If a future authored ground pass is commissioned, it should use surveyed ground/path polygons, material-specific PBR tiling or higher-resolution rights-cleared imagery, robust shadow/vehicle contact and temporal antialiasing, then be judged in motion on low-end devices. Do not mistake synthesized detail for newly resolved reality.

## Dormant integration API (for future evaluation only)

```js
import {createGarchingGroundDetailLayer} from './groundDetailLayer.js';
const ground = createGarchingGroundDetailLayer();
map.addLayer(ground, 'earth-engine-car'); // below car and hero
ground.setActive(activeEvent?.slug === HERO_VENUE_EVENT);
```

This code is **not** in `main.js`; no release/deployment action occurred.
