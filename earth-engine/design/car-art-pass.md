# Vehicle art pass: compact grand tourer

This pass refines the original, metre-scale procedural car in `src/carLayer.js`; it does **not** rescale the vehicle or replace its steering/physics API. The car remains 4.34 m long and is not a branded scan or licensed third-party model.

## What changed

- Cubic loft interpolation and a denser 16-point cross-section soften the bonnet, shoulders, rear haunches, and wheel-arch silhouette.
- A curved roof skin, inset windshield/rear glass, deeper side-window frames, lower-profile mirrors, and small wipers give the cabin more coherent volume.
- Cooler silver-teal clearcoat and a generated 128×64 reflection probe give painted and glazed surfaces definition without an HDRI/model download. The probe is procedural art direction, **not** geolocated lighting.
- Ten-spoke rims and slimmer trim improve the visible wheels and lower body.
- All rigid meshes still merge by material. Moving wheels, steering pivots, and the shadow remain independent. The reflection probe adds only a tiny generated texture and no network dependency.

## Browser comparison and limits

At the then-default wide chase view (zoom 20.15, pitch 68°, camera centred 8 m ahead), compare [the earlier car](04-garching-drive-final.png) with [the refined car in overview](drive-site-overview.png). The new cabin/body reads more like a compact road car and less like a single box, but a 4.34 m car remains small in that composition. Many details are necessarily invisible there. Making the mesh physically larger would break geographic scale.

The [subsequent camera pass](drive-camera-modes.md) implemented close chase as the new default (zoom 21.05, pitch 60°, look-ahead 3.8 m), retaining that wide framing as a toggle. This makes the vehicle larger without changing physical scale but exposes the overzoomed 20 cm orthophoto's softness. At present the model is still **stylized-realistic, not photoreal**; production quality needs authored PBR textures/normal maps, a proper reflection/lighting solution, street-level environmental assets, and a licensed car asset or dedicated Blender modelling/UV pass.

`npm run build && npm run verify` passed after the art pass. Browser console had no new car-renderer error; the unrelated MapLibre globe-fog warning persists.
