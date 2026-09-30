import manifest from './data/arrivalTiles.json' with {type:'json'};
import landings from './data/arrivalLandings.json' with {type:'json'};

/** Tiny real-data pockets, not a second global imagery pyramid. */
export const arrivalManifest = manifest;
export const arrivalLandingManifest = landings;
export function landingPlanForEvent(slug) {
  const id=landings.events[slug], item=landings.landings[id];
  return item?[{key:`landing/${id}`,url:item.url,bytes:item.bytes}]:[];
}
export function arrivalResourceUrl(tile) {
  return tile.url?`${import.meta.env?.BASE_URL ?? '/'}${tile.url.slice(1)}`:arrivalTileUrl(tile);
}

/** One independent sharp patch at every stop; phones need not fetch its nine
 * individual sharp tiles as well. Keep all inactive images encoded only. */
export function allArrivalPreparationPlan(events,{mobile=false}={}) {
  const first=events.slice(0,mobile?1:3);
  const plan=[...first.flatMap(event=>[...landingPlanForEvent(event.slug),...arrivalPlanForEvent(event.slug,{overviewOnly:true})]),
    ...events.flatMap(event=>landingPlanForEvent(event.slug)),
    ...events.flatMap(event=>arrivalPlanForEvent(event.slug,{overviewOnly:true})),
    ...(!mobile?allArrivalPlan(events):[])];
  const seen=new Set();
  return plan.filter(item=>{const key=item.key??`${item.z}/${item.x}/${item.y}`;if(seen.has(key))return false;seen.add(key);return true;});
}
export function arrivalPreparationPlanForEvent(slug,{mobile=false}={}) {
  return [...landingPlanForEvent(slug),...arrivalPlanForEvent(slug,{overviewOnly:mobile})];
}
export function arrivalTileUrl(tile) {
  const item = manifest.tiles[`${tile.z}/${tile.x}/${tile.y}`];
  return item ? `${import.meta.env?.BASE_URL ?? '/'}${item.url.slice(1)}` : null;
}

/** Keep tile grid/attribution identical; only change the delivery origin. */
export function resolveArrivalRequest(url) {
  if (!url.startsWith('https://wmts.terrascope.be/')) return url;
  try {
    const parsed = new URL(url);
    const parameters = new Map([...parsed.searchParams].map(([key,value]) => [key.toUpperCase(),value]));
    if (parameters.get('LAYER') !== 'esa-worldcover-s2rgbnir-10m-2021-v2_tcc') return url;
    const local = arrivalTileUrl({z:parameters.get('TILEMATRIX'),x:parameters.get('TILECOL'),y:parameters.get('TILEROW')});
    return local ?? url;
  } catch { return url; }
}

function tilesFor(keys) {
  return keys.map(key => {
    const [z,x,y] = key.split('/').map(Number);
    return {z,x,y,bytes:manifest.tiles[key].bytes};
  });
}
export function arrivalPlanForEvent(slug, {overviewOnly = false} = {}) {
  const event = manifest.events[slug];
  if (!event) return [];
  return tilesFor([...event.overview, ...(!overviewOnly ? event.detail : [])]);
}

/** All 32 get coverage. Prioritize likely first stops, then broad, then sharp. */
export function allArrivalPlan(events, {mobile = false} = {}) {
  const groups = events.map(event => manifest.events[event.slug]).filter(Boolean);
  const keys = [
    ...groups.slice(0,mobile ? 1 : 3).flatMap(group => [...group.overview, ...group.detail]),
    ...groups.flatMap(group => group.overview),
    ...groups.flatMap(group => group.detail)
  ];
  return tilesFor([...new Set(keys)]);
}

export function arrivalAssetBudget() {
  const tiles = Object.values(manifest.tiles);
  return {destinations:Object.keys(manifest.events).length, tiles:tiles.length,
    bytes:tiles.reduce((sum,tile) => sum+tile.bytes,0),
    sourceBytes:tiles.reduce((sum,tile) => sum+tile.sourceBytes,0)};
}
