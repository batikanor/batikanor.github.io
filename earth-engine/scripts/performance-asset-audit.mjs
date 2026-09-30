#!/usr/bin/env node
/** Offline, reproducible transfer/GPU budget audit; never contacts providers. */
import {readFile, readdir, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync, brotliCompressSync} from 'node:zlib';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {earthStyle} from '../src/sources.js';
import {destinationAssetBudget,destinationLandingManifest} from '../src/destinationImagery.js';
import {validateArrivalLandings} from '../src/arrivalLandingLayer.js';

const engine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(engine, '..');
const publicRoot = join(engine, 'public');
const check = process.argv.includes('--check');
const problems = [];
const sum = values => values.reduce((total, value) => total + value, 0);
const sha = value => createHash('sha256').update(value).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const exists = async path => !!(await stat(path).catch(() => null));
async function filesIn(path) {
  if (!await exists(path)) return [];
  const entries = await readdir(path, {withFileTypes: true});
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(join(path, entry.name)) : [join(path, entry.name)]))).flat();
}

const achievements = await json(join(engine, 'src/data/achievements.json'));
const media = contestsAndActivities.flatMap(project => [
  ...project.gdrive_embed ?? [], ...project.images ?? [],
].map(item => ({slug: project.slug, url: typeof item === 'string' ? item : item.url})));
const mediaByOrigin = {};
const localMedia = [];
for (const item of media) {
  const origin = new URL(item.url, 'https://batikanor.com/').hostname;
  mediaByOrigin[origin] = (mediaByOrigin[origin] ?? 0) + 1;
  if (!item.url.startsWith('/')) continue;
  const path = join(root, 'public', item.url);
  const size = (await stat(path).catch(() => null))?.size;
  if (size === undefined) problems.push(`Missing authored media: ${item.url}`);
  localMedia.push({...item, bytes: size ?? 0});
}

const regionalFiles = [
  ...await filesIn(join(publicRoot, 'data')),
  ...await filesIn(join(publicRoot, 'assets/isometric')),
];
const meshAssets = [];
const textureAssets = [];
for (const path of regionalFiles) {
  if (path.endsWith('.bin')) {
    const body = await readFile(path);
    const header = new DataView(body.buffer, body.byteOffset, body.byteLength);
    const roofVertices = header.getUint32(8, true);
    const wallVertices = header.getUint32(12, true);
    if (body.toString('ascii', 0, 4) !== 'BLD2'
      || body.length !== 40 + (roofVertices + wallVertices) * 12
      || body.length > 8_000_000) problems.push(`Invalid or oversized BLD2: ${path}`);
    meshAssets.push({url: `/${relative(publicRoot, path)}`, bytes: body.length,
      triangles: (roofVertices + wallVertices) / 3});
  }
  if (!path.endsWith('.json')) continue;
  const metadata = await json(path);
  if (!metadata.asset?.endsWith('.webp') || !metadata.width || !metadata.height) continue;
  const image = join(dirname(path), metadata.asset);
  if (!await exists(image)) {
    // Some optional ground metadata documents a future adapter without an
    // image; report only atlases that are shipped, rather than a fake size.
    if (path.includes('-roof-')) problems.push(`Missing roof texture: ${image}`);
    continue;
  }
  const body = await readFile(image);
  if (metadata.bytes !== body.length) problems.push(`Texture metadata bytes differ: ${image}`);
  if (metadata.sha256 && metadata.sha256 !== sha(body)) problems.push(`Texture checksum differs: ${image}`);
  if (metadata.width > 4096 || metadata.height > 4096
    || body.length > 10_000_000) problems.push(`Texture exceeds dimension/transfer budget: ${image}`);
  textureAssets.push({url: `/${relative(publicRoot, image)}`, bytes: body.length,
    width: metadata.width, height: metadata.height,
    decodedRgbaBytes: metadata.width * metadata.height * 4,
    decodedWithMipmapsBytes: Math.ceil(metadata.width * metadata.height * 4 * 4 / 3),
    reduced: metadata.asset.includes('-half'),
  });
}

let arrival = null;
const arrivalPath = join(engine, 'src/data/arrivalTiles.json');
if (await exists(arrivalPath)) {
  const manifest = await json(arrivalPath);
  const items = Object.entries(manifest.tiles);
  const perZoom = {};
  for (const [key, item] of items) {
    const body = await readFile(join(publicRoot, item.url));
    if (body.length !== item.bytes || sha(body) !== item.sha256) problems.push(`Arrival mismatch: ${key}`);
    const z = key.split('/')[0];
    perZoom[z] ??= {tiles: 0, bytes: 0, sourceBytes: 0};
    perZoom[z].tiles++;
    perZoom[z].bytes += item.bytes;
    perZoom[z].sourceBytes += item.sourceBytes;
  }
  const missingEvents = achievements.filter(event => !manifest.events[event.slug]).map(event => event.slug);
  const badReferences = Object.entries(manifest.events).flatMap(([slug, event]) =>
    [...event.overview, ...event.detail].filter(key => !manifest.tiles[key]).map(key => `${slug}:${key}`));
  if (missingEvents.length || badReferences.length) problems.push('Arrival manifest has missing events/tiles');
  const bytes = sum(items.map(([, item]) => item.bytes));
  const sourceBytes = sum(items.map(([, item]) => item.sourceBytes));
  arrival = {events: Object.keys(manifest.events).length, tiles: items.length,
    bytes, sourceBytes, savedBytes: sourceBytes - bytes,
    reductionPercent: Number(((1 - bytes / sourceBytes) * 100).toFixed(1)),
    perZoom, missingEvents, badReferences};
}

let context = null;
let landing = null;
const landingPath = join(engine,'src/data/arrivalLandings.json');
if (await exists(landingPath)) {
  const manifest = await json(landingPath);
  try {validateArrivalLandings(manifest);} catch(error) {problems.push(error.message);}
  const sourceManifest = await json(arrivalPath);
  if (manifest.sourceManifestSha256 !== sha(await readFile(arrivalPath)))
    problems.push('Arrival landing source manifest checksum differs');
  const assets = [];
  for (const [key,item] of Object.entries(manifest.landings)) {
    const body = await readFile(join(publicRoot,item.url));
    if (body.length !== item.bytes || sha(body) !== item.sha256)
      problems.push(`Arrival landing checksum/bytes differ: ${key}`);
    if (item.sourceKeys?.length !== 9 || item.sourceKeys.some(sourceKey =>
      !sourceManifest.tiles[sourceKey] || item.sourceSha256[sourceKey] !== sourceManifest.tiles[sourceKey].sourceSha256))
      problems.push(`Arrival landing source provenance differs: ${key}`);
    assets.push({url:item.url,bytes:body.length,width:item.width,height:item.height,
      estimatedDecodedRgbaBytes:item.width*item.height*4});
  }
  const missingEvents = achievements.filter(event => !manifest.events[event.slug]).map(event => event.slug);
  if (missingEvents.length) problems.push('Arrival landing manifest lacks achievements');
  landing = {events:Object.keys(manifest.events).length,images:assets.length,
    bytes:sum(assets.map(item=>item.bytes)),maxBytes:Math.max(...assets.map(item=>item.bytes)),
    estimatedActiveDecodedRgbaBytes:Math.max(...assets.map(item=>item.estimatedDecodedRgbaBytes)),
    note:'Native 3×3 z14 ESA mosaics. Only one owned image/source is decoded at a time; this RGBA value is an estimate, not measured GPU allocation.',
    missingEvents,assets};
}

const contextPath = join(publicRoot, 'data/achievement-context-v2.json');
if (await exists(contextPath)) {
  const body = await readFile(contextPath);
  const data = JSON.parse(body);
  const covered = new Set(data.chapters.flatMap(chapter => chapter.slugs));
  const missingEvents = achievements.filter(event => !covered.has(event.slug)).map(event => event.slug);
  if (missingEvents.length) problems.push('Context manifest does not cover every achievement');
  context = {chapters: data.chapters.length, coveredEvents: covered.size,
    buildings: sum(data.chapters.map(chapter => chapter.buildings.length)),
    trees: sum(data.chapters.map(chapter => chapter.trees.length)),
    bytes: body.length, gzipBytes: gzipSync(body).length,
    brotliBytes: brotliCompressSync(body).length, missingEvents};
}

const style = earthStyle();
const sourceSettings = Object.fromEntries(Object.entries(style.sources).map(([name, source]) => [name, {
  type: source.type, tileSize: source.tileSize ?? null,
  minzoom: source.minzoom ?? null, maxzoom: source.maxzoom ?? null,
}]));
const destination=destinationAssetBudget();
for(const [id,patch] of Object.entries(destinationLandingManifest().landings)) {
  for(const variant of [patch,{...patch,...patch.mobile}]) {
    const body=await readFile(join(publicRoot,variant.url));
    if(body.length!==variant.bytes||sha(body)!==variant.sha256)
      problems.push(`Native destination photograph differs from manifest: ${id}`);
  }
}
const report = {
  achievementCount: achievements.length,
  authoredMedia: {count: media.length, byOrigin: mediaByOrigin,
    localBytes: sum(localMedia.map(item => item.bytes)), localMedia,
    note: 'External viewers stay deferred; their transfer and latency are not under this origin’s control.'},
  meshes: {count: meshAssets.length, bytes: sum(meshAssets.map(item => item.bytes)), assets: meshAssets},
  textures: {count: textureAssets.length, bytes: sum(textureAssets.map(item => item.bytes)),
    note: 'These are alternatives, not simultaneous GPU residency. Mipmap figures are estimates, not measured allocation.',
    assets: textureAssets},
  destination, arrival, landing, context, sourceSettings,
  hillshade: style.layers.find(layer => layer.id === 'terrain-hillshade'),
  problems,
};
console.log(JSON.stringify(report, null, 2));
if (check && problems.length) process.exitCode = 1;
