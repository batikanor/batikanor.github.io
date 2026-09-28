# Cottbus LoD2 / TrueDOP venue chapters

The 2025 and 2026 Decarbon Days achievements now have **two separate,
source-backed venue clips** centered on their final portfolio coordinates.
These are rotatable 3D roof/wall models, not screenshots or the
fixed-camera 9 × 9 raster served by [cottbus.maptheory.org](https://cottbus.maptheory.org/).
That project supplied the locally cached official data and an example of
source-audited map production; the Earth runtime only receives small, bounded
derivative assets. The existing project text, photos, and media are unrelated
to this map-data transformation and are not modified here.

| Event slug | Origin `[lon, lat]` | Official LoD2 buildings | Triangles | BLD2 | Full roof atlas | Ground image |
|---|---:|---:|---:|---:|---:|---:|
| `decarbon-days-climathon-2025` | `[14.301040317339991, 51.775269384379186]` | 42 | 1,312 | 47,272 B | 2,816² / 1,637,720 B | 1,792² / 913,768 B |
| `decarbon-days-climathon-2026` | `[14.326165, 51.767384]` | 55 | 3,396 | 122,296 B | 3,328 × 3,072 / 1,943,962 B | 1,536² / 836,236 B |

Half-resolution roof atlases (1,408² and 1,664 × 1,536 respectively)
are also written for low-memory GPUs. Each **mesh** is a 250 m radius, not
all of Cottbus; the ground photo covers a wider ~1.1–1.3 km context. The
site must request only the active clip, with the normal satellite view still
available if the additional data cannot load.
The 2025 pin is the centroid of official LGB LoD2 GroundSurface
`DEBBAL5200008nZo`. It is ~6 m from the route marker linked on the
[Hangar 1 venue page](https://www.lausitz-festival.eu/de/lausitz-festival/spielorte/hangar-1-cottbus/89)
for Burger Chaussee 1. The route marker lies **inside** that official footprint
and inside the matching local OSM way `179996652`, tagged `name=1` and
`building=commercial`. The 2025 TrueDOP visibly shows an intact wide-roof
hall there. A different OSM `building=hangar` ~420 m southwest was considered
but rejected for this chapter: it has no Hangar 1 identifier and the organizer
geocode does not point to it. Thus the chapter is anchored to the best
cross-checked building, not merely an access road or a generic airfield.

## Data, rights, and geometry

- **Building roofs/walls:** official Brandenburg GeoBasis-DE/LGB CityGML
  LoD2 sheets in EPSG:25833, DHHN2016 NH heights. The used ZIP metadata
  reports 2026-01-13 as its update date. Roof/wall polygons are triangulated
  with the already-reviewed Earth `build-bavaria-lod2.py` earcut routine,
  preserving original 3D vertices and polygon holes. Buildings are selected
  when an official ground footprint intersects the 250 m pin radius.
- **Ground and roof color:** official Brandenburg GeoBasis-DE/LGB 20 cm RGB
  TrueDOP, flight date 2025-04-26, publication date 2025-07-31. The ZIP JPEG
  plus its pixel-centre JGW georeference is reprojected offline to an exact
  Web-Mercator z19 image grid. The atlas gives source-aligned UVs to the
  LoD2 roof planes. Ground is separately projected on a z18 grid and uses an
  independently wider ≤2,048-pixel RGBA
  WebP and four exact WGS84 corners ordered top-left, top-right,
  bottom-right, bottom-left for MapLibre `image` source registration. Its
  outer 12% is alpha-feathered to blend the **unaltered official pixels** into
  the world basemap without a hard rectangle. The photograph is not
  event-day/live imagery and an ortho drape is not façade photography.
- **Source ZIPs:** 2025 geometry uses `33451-5736`, `33452-5736`; its
  wider ground also uses `33451-5735`, `33452-5735`. 2026 geometry uses
  `33453-5735`; its wider ground additionally uses `33452-5734`,
  `33452-5735`, `33452-5736`, `33453-5734`, `33453-5736`. The builder pins
  each ZIP SHA-256 and refuses missing/changed source archives. The official links and exact ZIP
  hashes are in each generated JSON metadata file and in the builder.
- **License and visible credit:** official ZIP metadata permits reuse under
  [Datenlizenz Deutschland – Namensnennung – Version 2.0](https://www.govdata.de/dl-de/by-2-0).
  Display **© GeoBasis-DE/LGB, dl-de/by-2-0 (Daten geändert)** when either
  image/model is visible. No MapTheory user-interface artwork or third-party
  tile-service content is copied.

This is LoD2 architectural massing with photographic roof color, **not**
photogrammetry. Façades have no source-textured windows, trees are in the
photograph rather than individual 3D objects, and vertical agreement with
third-party terrain is limited by each elevation model's datum and accuracy.
No building is guessed where the official model lacks a polygon.

## Regenerate and verify

The input cache is the sibling `isometric-cottbus/data/lod2` and `data/dop`
directories. It is not published as part of this site. On another machine,
retrieve the exact official ZIPs using their URLs and pinned hashes, then set
`--source-root` to a checkout with the same `data/` structure.

```bash
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/batikanor-earth-release/earth-engine
python3 -m pip install -r scripts/cottbus-requirements.txt
python3 scripts/build-cottbus-isometric.py
python3 scripts/build-cottbus-isometric.py --verify-only
```

The verifier checks the BLD2 signature/version/origin and exact payload
length; building/surface counts; finite, bounded source positions; every
asset's byte count, SHA-256 and dimensions; full/half atlas relationship;
ground corner alignment; and that all real roof UVs lie inside their atlas.
The generated files are under `public/assets/isometric/cottbus-climathon-*`.
The browser imposes an 8 MB geometry and 10 MB compressed / 4,096 px roof
atlas limit; both clips are comfortably under these thresholds.
