# Procedural touring vehicle

`src/carLayer.js` replaces the boxy prototype with a **stylized-realistic**, 4.34 m touring vehicle. It is original procedural geometry, not a branded or photoreal scanned car.

- A curved cubic-loft body shell follows the wheel openings, with tapered hood, rear haunches and a separately crowned roof.
- Individually shaped windshield, rear and side glass, inset frames, pillars, mirrors, small wipers, lamps, grille and bumper trim give the vehicle a recognizable touring silhouette.
- Four radial tires have sidewalls and ten-spoke metal rims. Front wheels visibly steer and all wheels rotate according to signed vehicle speed. The existing geographic heading and driving API remain unchanged.
- Ground placement was lowered from an obvious 20 cm hover to roughly 4 cm wheel-ground clearance, with a soft contact shadow to absorb DEM uncertainty.
- Static details with shared materials are merged to limit draw calls. A small, procedural reflection probe adds no network model or texture download; see the [follow-up art pass](car-art-pass.md). The prior mesh/triangle counts should not be used as final budgets after that pass without a fresh trace.

The result was visually checked in the Garching local-drive view. It is a strong procedural prototype, **not production photorealism**: detailed authored materials/UVs, terrain-aware suspension, tire contact physics, body reflections, close-range road assets and real-device performance testing remain future work.
