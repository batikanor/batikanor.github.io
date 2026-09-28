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
      esa: {type: 'raster', tiles: [ESA_TILE], tileSize: 256, minzoom: 6, maxzoom: 14, attribution: ESA_ATTRIBUTION},
      nasa: {type: 'raster', tiles: [NASA_TILE], tileSize: 256, minzoom: 0, maxzoom: 8, attribution: NASA_ATTRIBUTION},
      bavaria: {type: 'raster', tiles: [BAVARIA_TILE], tileSize: 256, minzoom: 12, maxzoom: 19, bounds: BAVARIA_TRIAL_BOUNDS, attribution: BAVARIA_ATTRIBUTION},
      terrain: {type: 'raster-dem', url: MAPTERHORN_TILEJSON, encoding: 'terrarium', attribution: TERRAIN_ATTRIBUTION},
      // MapLibre recommends independent DEM source instances for hillshade
      // and the 3D terrain mesh to preserve visual quality while zooming.
      hillshade: {type: 'raster-dem', url: MAPTERHORN_TILEJSON, encoding: 'terrarium', attribution: TERRAIN_ATTRIBUTION}
    },
    layers: [
      {id: 'nasa-imagery', type: 'raster', source: 'nasa', layout: {visibility: PUBLIC_RELEASE ? 'visible' : 'none'}, paint: {'raster-fade-duration': 400}},
      ...(!PUBLIC_RELEASE ? [{id: 'sentinel-imagery', type: 'raster', source: 'sentinel', paint: {'raster-fade-duration': 400, 'raster-saturation': -0.04, 'raster-contrast': 0.035}}] : []),
      {id: 'esa-imagery', type: 'raster', source: 'esa', layout: {visibility: PUBLIC_RELEASE ? 'visible' : 'none'}, minzoom: 6, paint: {'raster-fade-duration': 400, 'raster-saturation': 0.06, 'raster-contrast': 0.075, 'raster-brightness-max': 1}},
      {id: 'bavaria-imagery', type: 'raster', source: 'bavaria', minzoom: 12, paint: {'raster-fade-duration': 250}},
      {id: 'terrain-hillshade', type: 'hillshade', source: 'hillshade', minzoom: 5, paint: {'hillshade-exaggeration': 0.23, 'hillshade-shadow-color': '#10222b', 'hillshade-highlight-color': '#f4f0e1', 'hillshade-accent-color': '#879891'}}
    ],
    terrain: {source: 'terrain', exaggeration: 1},
    sky: {'sky-color': '#b2d3de', 'horizon-color': '#e8d9c6', 'fog-color': '#b2d3de', 'sky-horizon-blend': 0.4, 'horizon-fog-blend': 0.25, 'fog-ground-blend': 0.25}
  };
}
