# Semantic markers and geographic placement

The map should reveal **places before countries become too coarse to be useful**. At the user's central-Europe view with a 100 km scale bar, Berlin and Munich are hundreds of pixels apart; a single `GERMANY` marker is not meaningful.

| Zoom interval | Level | Rationale |
| --- | --- | --- |
| `< 3.8` | Region | Earth overview. |
| `3.8–5.0` | Country | Country labels can still describe the visible scale. |
| `5.0–9.8` | City | Munich, Berlin and other cities separate well before the ~100 km scale view; country-click fits its city bounds above the bottom navigator. |
| `≥ 9.8` | Achievement | Real venue coordinates; avoid layering city DOM labels over event points. |

`src/markerPolicy.js` is intentionally renderer-independent. It provides `markerLevelForZoom`, spherical `geographicCentroid`, and a deterministic `declutterMarkers` helper for the DOM marker layer (which does not benefit from MapLibre's built-in symbol collision detection). Decluttering should run on each viewport/camera change using projected pixel positions and measured/estimated label sizes. Prioritise the currently selected city and then its achievement count; skipped markers reappear when the camera separates them.

For a region marker, use **one coordinate per distinct city**, not the achievement-weighted average. The East Asia cities are Hong Kong (about `114.17°E, 22.27°N`) and Nara (about `135.67°E, 34.61°N`), so their equal-city spherical centre is near `125°E, 29°N`. The previous marker at `114.2°E, 22.3°N` was essentially pinned to Hong Kong; its click destination at `119°E, 28°N` also disagreed with the marker. Use the computed centroid for both marker and camera. A centroid over water is expected here: it is a navigation label representing two distant places, not a claim that an achievement happened at that location.

Marker counts remain achievement counts, not city counts; the label should make this intelligible visually. All venue markers remain at their actual WGS84 positions.
