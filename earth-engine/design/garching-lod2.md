# Garching official LoD2 building slice

This prototype uses **real Bavarian 3D building geometry**, not invented boxes
or OpenStreetMap height guesses, for the 700 m demonstration area around
`11.666954° E, 48.262269° N`. The source is the Bayerische
Vermessungsverwaltung's [LoD2-BY product](https://www.digitalisierung.bayern.de/produkte/liegenschaftsinformationen/gebaeudemodell.html), provided as CityGML 1.0 through the [Garching b.München municipality metalink](https://geodaten.bayern.de/odd/a/lod2/citygml/meta/metalink/09184119.meta4). The official [technical note](https://geodaten.bayern.de/odd/m/3/pdf/hinweise_daten_lod2_download.pdf) describes the CityGML representation and original height/reference system. The source file declares `ETRS89_UTM32*DE_DHHN2016_NH`.

Two source sheets intersect the demonstration circle. We downloaded and
verified their published SHA-256 checksums before conversion:

| Official source | Bytes | SHA-256 |
|---|---:|---|
| [`696_5348.gml`](https://download1.bayernwolke.de/a/lod2/citygml/696_5348.gml) | 11,919,832 | `115cf190ece5a6b401bff0a70c3d55162bf310b30c934eff429cf46206132d39` |
| [`698_5348.gml`](https://download1.bayernwolke.de/a/lod2/citygml/698_5348.gml) | 9,865,663 | `92ee03284c00a1c544c13169a0adf05a5bf3c7916afefe29113d2c3835539965` |

The offline geometry authoring script is [`scripts/build-bavaria-lod2.py`](../scripts/build-bavaria-lod2.py).
It clips **262 official buildings**, triangulates the original roof and wall
surfaces (including non-flat roof geometry) into 21,061 triangles, transforms
ETRS89/UTM32 to WGS84/Web-Mercator-local metres, and writes the 758,236-byte
[`garching-lod2-v1.bin`](../public/data/garching-lod2-v1.bin). Original
DHHN2016 heights are preserved. The [metadata JSON](../public/data/garching-lod2-v1.json)
contains source hashes, selected building IDs, counts, height datum, and
attribution. The browser only fetches this file after a camera move **ends**
near Garching in the contextual zoom band `15.5 ≤ z < 18.5`; it is not part of
the initial JavaScript bundle.

### Actual aerial-photo roof texture

The LoD2 roof triangles are now georeferenced to a local, optional texture
atlas made from the **official DOP20 RGB orthophoto**, not a procedural roof
pattern. [`scripts/build-bavaria-roof-orthophoto.py`](../scripts/build-bavaria-roof-orthophoto.py)
retrieves the 225 official Web Mercator WMTS tiles that cover every selected
roof, stitches them in deterministic tile order, and encodes a
[`3840 × 3840 WebP atlas`](../public/data/garching-roof-orthophoto-v1.webp)
of **2,393,350 bytes**. Source WMTS zoom 18 samples at approximately
**40 cm per pixel** at Garching, one level below the available native 20 cm
zoom 19 imagery. This is a deliberate contextual LOD tradeoff: the full 20 cm
atlas for the 700 m radius would exceed a conservative 4096-pixel GPU texture
limit and the intended client download budget. The ground itself continues to
request Bavaria's highest available native WMTS zoom 19 when approached.

At runtime, official LoD2 local east/north coordinates generate UVs against
the atlas's exact XYZ tile grid. The atlas loads **after** geometry and only
when the building chapter loads; a failed image request leaves the official
geometric model visible. If the device's maximum texture dimension is below
3840, the layer retains its neutral roof material instead. This one image
replaces 225 additional in-browser roof tile requests and is not shipped in
the initial JavaScript. The separate [atlas metadata](../public/data/garching-roof-orthophoto-v1.json)
pins the compiled asset hash, ordered-source JPEG hash, tile grid, dimensions,
source access date, credit, and modification notice. The official WMTS is
updated periodically; **the service URL alone does not pin an acquisition
year**. The authoring script rejects a changed ordered-source hash, so a
later rebuild must review imagery alignment before intentionally updating the
source pin and shipped asset.

The roof photo already includes its real aerial sun/shadows, so the roof is
rendered unlit rather than double-brightened by the mesh scene's lights. The
facades are still **untextured** generalized LoD2 walls; no synthetic windows
or false photogrammetry are claimed. At hero and driving zooms, those blank
facades are intentionally hidden so they cannot obscure the interactive radar
or car. DOP20 remains underneath. This is an explicit temporary LOD/art choice,
not a claim that the buildings disappear in reality. The [contextual QA view](garching-textured-lod2-qa.png)
shows the real photo roof texture on 3D official volumes, plus the remaining
facade-quality limitation.

Rebuild locally:

```sh
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/experiments/earth-engine
python3 -m pip install -r scripts/bavaria-lod2-requirements.txt
python3 scripts/build-bavaria-lod2.py
python3 scripts/build-bavaria-roof-orthophoto.py
node scripts/verify-bavaria-lod2.mjs
```

Once downloaded, add `--offline` for a checksum-verified rebuild from the
system temporary cache. The generated binary is deterministic for the pinned
source files (`SHA-256 aa1c14b11f09f363b139201e57ac88c87ea44e65ab7b5ebd41e67b5473d4c4ee`).
The atlas builder also accepts `--offline` once its WMTS JPEG cache exists.

**Attribution and rights.** The [Bavarian OpenData terms](https://www.geodaten.bayern.de/odd/m/3/html/nutzungsbedingungen.html)
allow sharing and modifications, including commercial use, under CC BY 4.0
with attribution, a license link, and change notice. Visible credit on any
published implementation should be:

> Geobasisdaten: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de
> (Daten verändert), Lizenz: CC BY 4.0.

Our modifications are clipping, triangulation, coordinate conversion,
stitching 225 DOP20 tiles into a WebP atlas, and mapping that photo onto
LoD2 roof planes. The [official WMTS service page](https://geodatenonline.bayern.de/geodatenonline/seiten/wmts_BA)
states that the aerial imagery is periodically updated and describes its
use in web applications. Both official datasets are credited visibly in the
Garching map UI. The original GML files and source DOP20 JPEG tiles are **not**
shipped in the browser build; only the clipped geometry and derived atlas are.

**Reality and limits.** These are official generalized LoD2 roof geometries
and cadastral building footprints with a real orthophoto roof projection,
*not* photogrammetry or textured facades. They lack windows, trees, road
meshes, and collision surfaces. The
product page gives approximately 1 m roof-height accuracy, with larger
exceptions for complex roofs. This layer adds true building volume to the
official DOP20 orthophoto chapter; it does not by itself complete a realistic
driveable environment. The source's 2026-09-22 metalink listing and an
independent Terrarium tile sample placed a nearby roof-ground elevation at
about 475.5 m and the DEM at about 475.75 m, but inspect all local alignment
visually and numerically before release. Daylight and texture/shadow matching
remain open art/engineering work.

The official Bavarian [DOM-Mesh product](https://www.geodaten.bayern.de/odd/m/3/html/datenhinweise/datenhinweise_dommesh.html)
would provide aerially textured buildings, trees, and ground at 20 cm-derived
detail, but its distributed SLPK scene packages are **50–200 GB per flight
lot** (8.3 TB statewide). That is not a sensible blind download for this
local prototype. A more tractable future investigation is a small crop of
official [DOM20 20 cm surface-model GeoTIFF](https://geodatenonline.bayern.de/geodatenonline/seiten/aktuell_vorjahre.html)
combined with DOP20; it is 2.5D and could show tree crowns but cannot create
true building facade detail. Such a model would need careful DEM/LoD2 blending,
occlusion, asset size, and visual validation before inclusion.

The [orthophoto/roof-edge alignment check](garching-lod2-alignment.jpg) draws
official LoD2 roof edges in red over official DOP20 orthophoto at Garching; the
yellow circle marks the prototype drive origin. The roof boundaries visibly
track the imagery. This checks horizontal georeferencing only, not façade
quality or full 3D occlusion. The image carries the mandated modified-data
credit in its footer.
