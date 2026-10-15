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

function project(center, size, zoom) {
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    center[0] * radians, -Math.PI / 2 - center[1] * radians, 0, 'XYZ'));
  const scale = size * zoom / (2 * 1.23);
  return projects.map((project, index) => {
    const latitude = project.coordinates.lat * radians, longitude = project.coordinates.lng * radians;
    const position = new THREE.Vector3(
      Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude),
      -Math.cos(latitude) * Math.sin(longitude)).multiplyScalar(1.018).applyQuaternion(rotation);
    const x = size / 2 + position.x * scale, y = size / 2 - position.y * scale;
    return {slug: project.slug, x, y, active: index === 0,
      visible: position.z > .015 && Math.hypot(x - size / 2, y - size / 2) <= size / 2 - 15};
  });
}

const signature = groups => groups.map(group => group.members.map(member => member.slug).sort().join('|')).sort();

function groupsFor(center, size, zoom) {
  const markers = project(center, size, zoom);
  const groups = clusterGalleryGlobeMarkers(markers, {radius: size <= 170 ? 21 : 25});
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


test('following the default European cluster reaches a city-sized chooser on phones and desktop', () => {
  const latest = projects.find(project => project.slug === 'tesla-gigathon-2026');
  const munichCount = projects.filter(project => project.city === 'Munich' && project.country === 'Germany').length;
  for (const size of [150, 252]) {
    let center = [latest.coordinates.lat, latest.coordinates.lng], zoom = 1, terminal = null;
    for (let click = 0; click < 16; click++) {
      const {groups} = groupsFor(center, size, zoom);
      const cluster = groups.filter(group => group.count > 1).sort((a, b) => b.count - a.count)[0];
      assert.ok(cluster, 'the main European group stays reachable while narrowing geography');
      const members = cluster.members.map(member => projects.find(project => project.slug === member.slug));
      const target = galleryGlobeClusterTarget(members, zoom);
      assert.ok(target.zoom >= zoom && target.zoom <= GALLERY_GLOBE_MAX_ZOOM);
      if (target.expand) { terminal = members; break; }
      assert.ok(target.zoom > zoom, 'an unresolved cluster must make visible zoom progress');
      center = [target.latitude, target.longitude];zoom = target.zoom;
    }
    assert.ok(terminal, 'a bounded sequence of clicks must resolve the crowded European globe');
    assert.ok(terminal.length >= 2 && terminal.length <= munichCount,
      `${size}px chooser contains only a bounded local subset of Munich achievements`);
    assert.deepEqual([...new Set(terminal.map(project => `${project.city}|${project.country}`))], ['Munich|Germany'],
      'a terminal chooser should not still combine unrelated European cities');
  }
});
