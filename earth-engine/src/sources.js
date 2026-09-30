// URLs are intentionally provider adapters. Imagery/DEM are streamed at runtime, never bundled.
// EOxCloudless 2024 is non-commercial with attribution: see README before any publication.
// A public build removes its source and switch entirely until separate rights
// are available; the local research build can still compare it with ESA.
export const PUBLIC_RELEASE = import.meta.env?.VITE_PUBLIC_RELEASE === 'true';
export const EOX_TILE = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg';
// ESA WorldCover annual Sentinel-2 RGB median composite (2021), a keyless,
// attribution-required CC BY 4.0 alternative to EOX's non-commercial layer.
// Terrascope WMTS supplies z6–14 within approx. 60°S–83°N; NASA fills gaps.
export const ESA_TILE = 'https://wmts.terrascope.be/?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=esa-worldcover-s2rgbnir-10m-2021-v2_tcc&STYLE=default&FORMAT=image/png&TILEMATRIXSET=EPSG:3857&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&TIME=2021-01-01';
export const NASA_TILE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/2004-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg';
export const BAVARIA_TILE = 'https://wmtsod1.bayernwolke.de/wmts/by_dop/smerc/{z}/{x}/{y}';
export const BAVARIA_TRIAL_BOUNDS = [11.1, 48.0, 11.9, 48.45];
export const BAVARIA_ATTRIBUTION = '<a href="https://geodatenonline.bayern.de/geodatenonline/seiten/wmts_BA">© Bayerische Vermessungsverwaltung (DOP20)</a> · CC BY 4.0';
// Official 2026 Berlin TrueDOP WMS across the inner-city corridor containing
// all three authored Berlin achievements. Only visible tiles stream at
// street zoom; the source is 20 cm real imagery, not upscaled ESA pixels.
// This is dl-de-zero-2.0; the *building* chapter is much smaller and documented
// separately in design/berlin-isometric.md.
export const BERLIN_TRUEDOP_BOUNDS = [13.30, 52.48, 13.50, 52.54];
export const BERLIN_TRUEDOP_WMS = 'https://gdi.berlin.de/services/wms/truedop_2026?service=WMS&version=1.3.0&request=GetMap&layers=truedop_2026&styles=&CRS=EPSG%3A3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image%2Fjpeg';
export const BERLIN_ATTRIBUTION = '<a href="https://daten.berlin.de/datensaetze/digitale-farbige-trueorthophotos-2026-dop20rgbi-wms-3801a94c">© Geoportal Berlin / TrueDOP 2026</a> · dl-de-zero-2.0';
export const MAPTERHORN_TILEJSON = 'https://tiles.mapterhorn.com/tilejson.json';
export const EOX_ATTRIBUTION = '<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)';
export const ESA_ATTRIBUTION = '<a href="https://esa-worldcover.org/en/data-access">© ESA WorldCover project 2021</a> / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium';
export const NASA_ATTRIBUTION = '<a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/">NASA Earth Observatory</a>';
export const TERRAIN_ATTRIBUTION = '<a href="https://mapterhorn.com/attribution/">© Mapterhorn</a>';

export function earthStyle() {
  return {
    version: 8,
    name: 'Earth Engine imagery + terrain prototype',
    sources: {
      ...(!PUBLIC_RELEASE ? {sentinel: {type: 'raster', tiles: [EOX_TILE], tileSize: 256, minzoom: 0, maxzoom: 14, attribution: EOX_ATTRIBUTION}} : {}),
      // Keep a small, cacheable overview pyramid resident beneath the detailed
      // tiles. NASA's global mosaic is intentionally retained for the poles,
      // but its no-store response cannot warm the next destination. Without a
      // separate overview source a cross-continent jump waits for dozens of
      // z14 PNGs and briefly shows an empty/patchwork map.
      'esa-overview': {type: 'raster', tiles: [ESA_TILE], tileSize: 256, minzoom: 6, maxzoom: 11, attribution: ESA_ATTRIBUTION},
      esa: {type: 'raster', tiles: [ESA_TILE], tileSize: 256, minzoom: 12, maxzoom: 14, attribution: ESA_ATTRIBUTION},
      nasa: {type: 'raster', tiles: [NASA_TILE], tileSize: 256, minzoom: 0, maxzoom: 8, attribution: NASA_ATTRIBUTION},
      bavaria: {type: 'raster', tiles: [BAVARIA_TILE], tileSize: 256, minzoom: 12, maxzoom: 19, bounds: BAVARIA_TRIAL_BOUNDS, attribution: BAVARIA_ATTRIBUTION},
      berlin: {type: 'raster', tiles: [BERLIN_TRUEDOP_WMS], tileSize: 256, minzoom: 16, maxzoom: 19, bounds: BERLIN_TRUEDOP_BOUNDS, attribution: BERLIN_ATTRIBUTION},
      // Mapterhorn has real z16 DEM tiles here but z17+ returns 404. Overzoom
      // its 1 m-class z16 sample instead of making dozens of missing requests.
      terrain: {type: 'raster-dem', url: MAPTERHORN_TILEJSON, encoding: 'terrarium', maxzoom: 16, attribution: TERRAIN_ATTRIBUTION},
      'terrain-coarse': {type: 'raster-dem', url: MAPTERHORN_TILEJSON, encoding: 'terrarium', maxzoom: 12, attribution: TERRAIN_ATTRIBUTION},
      // MapLibre recommends independent DEM source instances for hillshade
      // and the 3D terrain mesh to preserve visual quality while zooming.
      hillshade: {type: 'raster-dem', url: MAPTERHORN_TILEJSON, encoding: 'terrarium', maxzoom: 16, attribution: TERRAIN_ATTRIBUTION}
    },
    layers: [
      {id: 'nasa-imagery', type: 'raster', source: 'nasa', layout: {visibility: PUBLIC_RELEASE ? 'visible' : 'none'}, paint: {'raster-fade-duration': 400}},
      ...(!PUBLIC_RELEASE ? [{id: 'sentinel-imagery', type: 'raster', source: 'sentinel', paint: {'raster-fade-duration': 400, 'raster-saturation': -0.04, 'raster-contrast': 0.035}}] : []),
      {id: 'esa-overview-imagery', type: 'raster', source: 'esa-overview', layout: {visibility: PUBLIC_RELEASE ? 'visible' : 'none'}, minzoom: 6, paint: {'raster-fade-duration': 180, 'raster-saturation': 0.06, 'raster-contrast': 0.075, 'raster-brightness-max': 1}},
      {id: 'esa-imagery', type: 'raster', source: 'esa', layout: {visibility: PUBLIC_RELEASE ? 'visible' : 'none'}, minzoom: 12, paint: {'raster-fade-duration': 180, 'raster-saturation': 0.06, 'raster-contrast': 0.075, 'raster-brightness-max': 1}},
      {id: 'bavaria-imagery', type: 'raster', source: 'bavaria', minzoom: 12, paint: {'raster-fade-duration': 250}},
      {id: 'berlin-imagery', type: 'raster', source: 'berlin', minzoom: 16, paint: {'raster-fade-duration': 250}},
      {id: 'terrain-hillshade', type: 'hillshade', source: 'hillshade', minzoom: 5, maxzoom: 12, paint: {'hillshade-exaggeration': 0.23, 'hillshade-shadow-color': '#10222b', 'hillshade-highlight-color': '#f4f0e1', 'hillshade-accent-color': '#879891'}}
    ],
    terrain: {source: 'terrain', exaggeration: 1},
    sky: {'sky-color': '#b2d3de', 'horizon-color': '#e8d9c6', 'fog-color': '#b2d3de', 'sky-horizon-blend': 0.4, 'horizon-fog-blend': 0.25, 'fog-ground-blend': 0.25}
  };
}
