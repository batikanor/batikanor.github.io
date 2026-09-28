# Local drive camera study

The touring car remains exactly **4.34 m** in the Three.js scene. The new two-mode camera changes only the MapLibre map view:

| Mode | Zoom | Pitch | Center ahead of vehicle | Intent |
|---|---:|---:|---:|---|
| Close chase (default) | 21.05 | 60° | 3.8 m | Make the car readable while still keeping the nearby installation on screen. |
| Site overview | 20.15 | 68° | 8 m | Show the radar, paths, and real site relationship together. |

When the viewport is **short and landscape** (height ≤ 500 px, width > 1.3× height), the camera uses a responsive framing: close chase zoom 20.45 / pitch 60° / 0.5 m look-ahead, site overview zoom 19.95 / pitch 62° / 4 m look-ahead. The car remains 4.34 m. The shorter chase keeps the whole vehicle and ground visible above the attribution on 667×375 phones. A negative look-ahead was rejected because it put MapLibre's terrain camera below the DEM and made the background black. Rotation while driving automatically eases between camera presets.

On fresh short-screen entry, MapLibre's 3D terrain could still render a black ground despite a safe camera. Drive therefore pauses the DEM and hillshade while active (settings indicates **PAUSED**) and restores the user's ON/OFF preference when exiting. This was verified in Chrome at 667×375 and 390×844, including immediate entry from the Garching deep link. The flat orthophoto and scene objects remain visible; this is a prototype stability trade-off, not a final terrain/drivability solution.

The fixed maximum detailed-map zoom is 21.35. NASA Blue Marble mode remains capped at zoom 8; selecting a destination or event automatically switches it to open ESA/Bavarian detail before a close drive. The same detailed-map cap is restored when imagery changes, so the close camera does not silently clamp after NASA→ESA.

The HUD has a labelled, `aria-pressed` camera toggle and the **C** shortcut. Pressing C while typing in a text field or with copy-command modifiers does not toggle it. Camera center, zoom, pitch, and heading ease toward the chosen framing during driving; steering, speed, geofence, and the physical car are unchanged. Each new drive starts in close chase; exiting restores normal map navigation.

## Browser QA

- [Settled close chase](drive-close-chase.png): at 1512×828, the car is materially larger than in the former 20.15 view, with the radar still visible.
- [Settled site overview](drive-site-overview.png): wider geography and installation context; screenshot taken after clicking the camera button.
- [390×844 phone](drive-mobile-close.png): compact HUD no longer occludes the car and sits above the complete attribution lane.
- The button's accessible state and label changed correctly in both modes; pressing C switched back. The NASA→ESA→event→DRIVE path rendered the close camera. No new browser JavaScript error occurred.

This solves **presentation scale**, not close-ground texture quality. The 20 cm Bavarian orthophoto still becomes soft when overzoomed; authored street-level assets or a licensed higher-resolution capture are needed for a photoreal game.
