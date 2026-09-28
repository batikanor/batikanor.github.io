# Munich isometric-ready venue slices — local research build

This is an **uncommitted, undeployed pilot**, not a claim that central Munich
has been photogrammetrically reconstructed. It prepares two sharply detailed,
georeferenced city-block pockets for an orthographic/isometric camera. The
geometry is original Bavarian generalized LoD2 roof and wall surfaces, and
the roof imagery is the Bavarian DOP20 RGB orthophoto at Web Mercator zoom 19
(approximately 20 cm per ground pixel at Munich). No buildings, facade
textures, trees, or street furniture were invented. The surrounding Earth map
can continue to be a much larger, lower-LOD globe.

## Exact achievement anchors and coverage

The centers are copied from the portfolio's authored achievement data. A
building is selected if its official ground footprint intersects a **250 m
radius** around its anchor. The rectangular photo atlas includes whole source
tiles around all selected roof vertices, not an artificial square 3D city.

| Pocket | Authored achievement / venue | Center (lon, lat) | Official buildings | Roof + wall triangles | Geometry | Roof atlas |
|---|---|---|---:|---:|---:|---|
| `siemens` | `masters-thesis` / Siemens AG Munich Headquarters, Wittelsbacherplatz | `11.5758, 48.1453` | 240 | 16,082 | 578,992 B | 3328 × 3072 WebP, 2,082,744 B |
| `google` | `bayer-ai-2024` / Google Office Munich | `11.5802, 48.1392` | 336 | 25,343 | 912,388 B | 3328 × 3328 WebP, 2,274,830 B |

The `siemens` atlas spans approximately **11.571350–11.580276° E,
48.142723–48.148221° N**. The `google` atlas spans approximately
**11.576157–11.585083° E, 48.136308–48.142265° N**. The two selected
footprint circles are separate; these are two project *neighborhoods*, not a
continuous 3D model for all of Munich. Their authored center coordinates may
still need a venue-entrance-level editorial check before labeling any single
roof as the achievement's exact room or door.

### Source verification and rights

The [Bavarian LoD2-BY product](https://lvg.bayern.de/produkte/liegenschaftsinformationen/gebaeudemodell.html)
provides the official CityGML model. The
[City of Munich municipality metalink](https://geodaten.bayern.de/odd/a/lod2/citygml/meta/metalink/09162000.meta4)
published the two 2 km source sheets that touch these clips. Their SHA-256
checksums were verified before triangulation:

| CityGML sheet | Bytes | Official SHA-256 |
|---|---:|---|
| [`690_5334.gml`](https://download1.bayernwolke.de/a/lod2/citygml/690_5334.gml) | 161,627,079 | `fa05d2a15ae676f2906cc1d0ff2f9889bd2d6c77b9bd0af38852e848a588ab23` |
| [`692_5334.gml`](https://download1.bayernwolke.de/a/lod2/citygml/692_5334.gml) | 120,981,419 | `1193453ab2dd07455649840bc7ea3fb624f354bde0c7d02b4ae75824b770b489` |

The [DOP20 RGB OpenData product](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=dop20rgb)
and the [Bavarian OpenData terms](https://www.geodaten.bayern.de/odd/m/3/html/nutzungsbedingungen.html)
identify the imagery and model as **CC BY 4.0**. Copying, modification, and
commercial use are allowed with attribution, a license link, and change
notice. The required visible credit on any eventual public view is:

> Geobasisdaten: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de
> (Daten verändert), Lizenz: CC BY 4.0

The output JSON includes the license URL and modification notes. The source
GML and JPEG tiles stay in the system temporary cache; only clipped, derived
assets live under `public/data/`. The DOP20 service updates periodically. Its
URLs do not identify a fixed acquisition year, so the builder also pins the
ordered SHA-256 of every JPEG tile used in each atlas:

* Siemens: `74bd12cf2c6be30bfd023e5aaf218d7b835884a8ccc52992a43540acf3526c8c` (156 source tiles)
* Google: `f30da3d9f016bde16478adad24a4284311dd9b94a9672ffbf0b9d604fb457536` (169 source tiles)

Source images were accessed **2026-09-28 UTC**. A future changed service
response fails the ordinary rebuild until consciously reviewed and repinned.

### Asset contract for the renderer

The two `munich-*-lod2-v1.bin` files intentionally retain the existing
`BLD2` version-1 binary layout used for Garching: a 40-byte header, counts,
`Float64` lon/lat at offsets 24/32, followed by roof and wall vertices as
little-endian `Float32` XYZ triplets. X is local east, Y is original
DHHN2016-NH altitude, and Z is local north, in Web Mercator-local metres.
The matching `munich-*-roof-dop20-v1.json` gives
`source_tile_zoom`, `source_tile_bounds_xyxy`, `width`, `height`, and
`origin_lonlat` for exact UV alignment of the WebP to the roof vertices.
SHA-256, source credits, clip origin, and event slug live in the metadata.

The roof-edge QA overlays generated locally from the binary triangles visually
tracked the corresponding real DOP20 roof shapes for both pockets. This is a
horizontal/georeferencing check, not proof of facade accuracy, capture-date
agreement, or photogrammetric completeness. LoD2 generalized roof heights
have the source's approximately metre-scale limits. Facades have no source
texture. Trees and roads are still seen in the DOP20 *ground image*, not 3D.

## Rebuild and intended runtime budget

Run from `experiments/earth-engine`, with the existing Bavaria pipeline
requirements **plus `lxml`** installed:

```sh
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/experiments/earth-engine
python3 -m pip install -r scripts/bavaria-lod2-requirements.txt lxml
python3 scripts/build-munich-isometric.py --offline
```

The offline command works on this machine because its checked GML and DOP20
JPEG sources have already been cached. On a fresh machine, omit `--offline`;
the script downloads approximately 283 MB of CityGML once, validates both
official hashes, then fetches only 325 z19 JPEG tiles. It streams GML
building-by-building rather than loading either 160 MB sheet into a browser
or embedding original GML in the website. Binary + atlas transfer for each
pocket is approximately **2.66 MB** or **3.19 MB**, before HTTP compression.
Both atlases fit the 4096-pixel GPU texture-dimension ceiling; however, each
3.3k image expands to roughly 40–44 MB of RGBA texture memory. A future
renderer must lazy-load only the active pocket, dispose it on departure,
respect low-memory/mobile limits, preserve the broad satellite map as a
fallback, and show the visible credit. Do **not** load both atlases at page
startup or include them in the JavaScript bundle.

The closer in the camera goes, the more obvious LoD2's untextured facades and
the orthophoto's fixed sun/shadow become. Before calling this a production
“isometric Munich” view, verify the actual runtime camera, terrain height,
roof occlusion, marker interaction, frame time, accessibility, and mobile
fallback. An official 3D mesh or additional licensed facade material would
be a separate art/data investigation, not something this pilot fabricates.
