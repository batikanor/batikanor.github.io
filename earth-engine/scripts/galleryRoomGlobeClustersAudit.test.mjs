import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';

// Exercise the shipped grouping helper with the complete achievement geography.
// Projection inputs model the fixed circular viewport, rather than synthetic grids.
const source = (await readFile(new URL('../src/galleryRoomGlobe.js', import.meta.url), 'utf8'))
  .replace("import './galleryRoomGlobe.css';", '')
  .replace("'./galleryRoomSatellite.js'", JSON.stringify(new URL('../src/galleryRoomSatellite.js', import.meta.url).href))
  .replace("from 'three';", `from '${import.meta.resolve('three')}';`);
const {clusterGalleryGlobeMarkers, galleryGlobeClusterTarget, GALLERY_GLOBE_MAX_ZOOM} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const projects = JSON.parse(await readFile(new URL('../src/data/achievements.json', import.meta.url), 'utf8'));
const radians = Math.PI / 180;
const centers = [[52.39, 13.79], [48.14, 11.58], [22.28, 114.17], [34.61, 135.67], [41.14, 29.10], [0, 179]];
const zooms = [1, 1.9, 3.61, 6.859, 13.0321, GALLERY_GLOBE_MAX_ZOOM];
const responsiveViewports = [112, 144, 168, 180, 188, 220, 280, 336]
  .map(size => ({width: size, height: size}));
const viewports = [...responsiveViewports, {width: 336, height: 188}, {width: 168, height: 280}];
const clickCenters = [...centers, [.4 / radians, 0], ...projects.map(project =>
  [project.coordinates.lat, project.coordinates.lng])];
const clickZooms = [...zooms.slice(0, -1), 32, 128, 320, GALLERY_GLOBE_MAX_ZOOM];
const projectBySlug = new Map(projects.map(project => [project.slug, project]));
const viewportFor = size => typeof size === 'number' ? {width: size, height: size} : size;
const radiusFor = size => viewportFor(size).width <= 170 ? 21 : 25;

function project(center, size, zoom) {
  const {width, height} = viewportFor(size), diameter = Math.min(width, height);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    center[0] * radians, -Math.PI / 2 - center[1] * radians, 0, 'XYZ'));
  // resize() extends the longer camera axis, so both axes use this same scale.
  const scale = diameter * zoom / (2 * 1.23);
  return projects.map((project, index) => {
    const latitude = project.coordinates.lat * radians, longitude = project.coordinates.lng * radians;
    const position = new THREE.Vector3(
      Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude),
      -Math.cos(latitude) * Math.sin(longitude)).multiplyScalar(1.018).applyQuaternion(rotation);
    const x = width / 2 + position.x * scale, y = height / 2 - position.y * scale;
    return {slug: project.slug, x, y, active: index === 0,
      front: position.z > .015,
      visible: position.z > .015 && Math.hypot(x - width / 2, y - height / 2) <= diameter / 2 - 15};
  });
}

const signature = groups => groups.map(group => group.members.map(member => member.slug).sort().join('|')).sort();

function groupsFor(center, size, zoom) {
  const markers = project(center, size, zoom);
  const groups = clusterGalleryGlobeMarkers(markers, {radius: radiusFor(size)});
  return {markers, groups};
}

test('all real front-facing achievements are accounted for once at every phone and desktop zoom', () => {
  for (const size of [150, 252]) for (const center of centers) for (const zoom of zooms) {
    const {markers, groups} = groupsFor(center, size, zoom);
    const visible = markers.filter(marker => marker.visible).map(marker => marker.slug).sort();
    const grouped = groups.flatMap(group => group.members.map(member => member.slug)).sort();
    assert.deepEqual(grouped, visible, `${size}px / ${center} / ${zoom}× lost or duplicated an achievement`);
    assert.equal(new Set(grouped).size, grouped.length);
    for (const group of groups) {
      assert.equal(group.count, group.members.length);
      assert.equal(group.active, group.members.some(member => member.active));
      assert.ok(group.members.every(member => member.visible));
      assert.ok(Math.hypot(group.x - size / 2, group.y - size / 2) <= size / 2 - 15 + 1e-8,
        'a count badge lies outside the fixed circular globe');
    }
  }
});

test('zooming into actual geography only splits existing groups, never merges separate groups', () => {
  for (const size of [150, 252]) for (const center of centers) {
    let previous = groupsFor(center, size, zooms[0]);
    for (const zoom of zooms.slice(1)) {
      const current = groupsFor(center, size, zoom);
      const parentOf = new Map(previous.groups.flatMap(group => group.members.map(member => [member.slug, group.id])));
      for (const group of current.groups) {
        const parents = new Set(group.members.map(member => parentOf.get(member.slug)));
        assert.equal(parents.size, 1, `${size}px / ${center} / ${zoom}× merged distinct geographic groups`);
        assert.ok(!parents.has(undefined), 'zoom unexpectedly introduced an off-disc achievement');
      }
      previous = current;
    }
  }
});

test('chronological ordering does not change geographic group membership or cluster identity', () => {
  for (const size of [150, 252]) for (const center of centers) for (const zoom of zooms) {
    const {markers, groups} = groupsFor(center, size, zoom);
    const reverse = clusterGalleryGlobeMarkers([...markers].reverse(), {radius: size <= 170 ? 21 : 25});
    assert.deepEqual(signature(reverse), signature(groups));
    assert.deepEqual(reverse.map(group => group.id).sort(), groups.map(group => group.id).sort());
  }
});


function assertClusterClick(cluster, zoom, viewport) {
  const {width, height} = viewport, radius = radiusFor(viewport);
  const members = cluster.members.map(member => projectBySlug.get(member.slug));
  const slugs = new Set(members.map(member => member.slug));
  const target = galleryGlobeClusterTarget(members, zoom, {...viewport, radius, allLocations: projects});
  const center = [target.latitude, target.longitude];
  const label = `${width}×${height}px / ${zoom}× / ${cluster.id}`;
  assert.ok(Number.isFinite(target.zoom) && target.zoom >= zoom && target.zoom <= GALLERY_GLOBE_MAX_ZOOM,
    `${label}: click zoom must remain bounded`);
  const childrenAt = candidate => {
    const state = groupsFor(center, viewport, candidate);
    return {...state, children: state.groups.filter(group => group.members.some(member => slugs.has(member.slug)))};
  };
  if (target.expand) {
    // For this fixed geographic center, projected distances grow linearly with
    // zoom. The greatest zoom that retains every clicked member is therefore
    // the strongest possible split, including other achievements in the scene.
    const base = project(center, viewport, 1).filter(marker => slugs.has(marker.slug));
    const extent = Math.max(...base.map(marker => Math.hypot(marker.x - width / 2, marker.y - height / 2)));
    const fitZoom = Math.min(GALLERY_GLOBE_MAX_ZOOM,
      (Math.min(width, height) / 2 - 15 - .25) / extent);
    if (zoom < GALLERY_GLOBE_MAX_ZOOM && fitZoom >= zoom && base.every(marker => marker.front)) {
      const fitted = childrenAt(fitZoom);
      assert.ok(fitted.children.some(group => group.count >= cluster.count),
        `${label}: chooser opened even though all clicked members can split visibly`);
    }
    return {target, children: []};
  }
  assert.ok(target.zoom > zoom, `${label}: a split must move beyond the current zoom`);
  const {markers, children} = childrenAt(target.zoom);
  assert.deepEqual(markers.filter(marker => slugs.has(marker.slug) && marker.visible)
    .map(marker => marker.slug).sort(), [...slugs].sort(),
  `${label}: clipping a clicked achievement is not a cluster split`);
  assert.ok(children.length > 1, `${label}: the clicked cluster remains a single group`);
  assert.ok(children.every(group => group.count < cluster.count),
    `${label}: every resulting badge must have fewer members, including neighboring achievements`);
  const unClipped = clusterGalleryGlobeMarkers(markers.filter(marker => slugs.has(marker.slug))
    .map(marker => ({...marker, visible: true})), {radius});
  assert.ok(unClipped.every(group => group.count < cluster.count),
    `${label}: the complete original membership must split without relying on visibility filtering`);
  return {target, children};
}

test('every real cluster click splits its badge or opens a necessary chooser at every responsive size', () => {
  let checks = 0;
  for (const viewport of viewports) for (const center of clickCenters) for (const zoom of clickZooms) {
    for (const cluster of groupsFor(center, viewport, zoom).groups.filter(group => group.count > 1)) {
      assertClusterClick(cluster, zoom, viewport);checks++;
    }
  }
  assert.ok(checks > 1000, 'the regression covers complete real geography across mobile and desktop');
});

test('all branches from the actual entry and reset views resolve without repeated unchanged counts', () => {
  const latest = projects[0], reset = [latest.coordinates.lat, latest.coordinates.lng];
  for (const viewport of responsiveViewports) for (const center of [[.4 / radians, 0], reset]) {
    const pending = groupsFor(center, viewport, 1).groups.filter(group => group.count > 1)
      .map(cluster => ({cluster, zoom: 1, depth: 0}));
    while (pending.length) {
      const {cluster, zoom, depth} = pending.pop();
      assert.ok(depth < projects.length, 'strictly decreasing membership bounds the number of clicks');
      const {target, children} = assertClusterClick(cluster, zoom, viewport);
      for (const child of children.filter(group => group.count > 1)) {
        pending.push({cluster: child, zoom: target.zoom, depth: depth + 1});
      }
    }
  }
});

test('the actual nine Munich achievements split on their first click at phone and desktop sizes', () => {
  const munich = projects.filter(project => project.city === 'Munich' && project.country === 'Germany');
  assert.equal(munich.length, 9, 'retain the reported nine-achievement regression');
  const cluster = {id: munich.map(project => project.slug).sort().join('|'), count: munich.length,
    members: munich.map(project => ({slug: project.slug}))};
  for (const viewport of responsiveViewports) {
    assert.equal(assertClusterClick(cluster, 32, viewport).target.expand, false,
      `${viewport.width}px: the actual Munich group has a visible split before maximum zoom`);
  }
});
