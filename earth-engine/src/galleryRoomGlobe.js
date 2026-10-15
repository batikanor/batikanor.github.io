import * as THREE from 'three';
import {GALLERY_SATELLITE_DATA, GALLERY_SATELLITE_CACHE_SIZE, gallerySatellitePatch,
  gallerySatelliteProjectLevels} from './galleryRoomSatellite.js';
import './galleryRoomGlobe.css';

const RADIANS = Math.PI / 180;
const GOLD = new THREE.Color('#f3bc62');
const DOT = new THREE.Color('#2b4f5f');
const HOVER = new THREE.Color('#fff0d3');
const satelliteUrl = record => `${record.url}?v=${record.revision}`;
const TEXTURE_URL = satelliteUrl(GALLERY_SATELLITE_DATA.global);
export const GALLERY_GLOBE_MAX_ZOOM = 1024;
export const GALLERY_GLOBE_PROJECT_ZOOM = 320;
let creditPanelId = 0;

/** Matches the unmodified Three SphereGeometry UVs of a -180..180 Earth map. */
export function galleryGlobeCoordinate(latitude, longitude, radius = 1) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || !Number.isFinite(radius) || radius <= 0) {
    throw new TypeError('Globe coordinates must be finite geographic coordinates');
  }
  const lat = latitude * RADIANS, lng = longitude * RADIANS;
  return [radius * Math.cos(lat) * Math.cos(lng), radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lng)];
}

/** Yaw, then pitch, centers the location and keeps geographic north above it. */
export function galleryGlobeRotation(latitude, longitude) {
  galleryGlobeCoordinate(latitude, longitude);
  return {pitch: latitude * RADIANS, yaw: -Math.PI / 2 - longitude * RADIANS};
}

export function galleryGlobeYawTarget(current, target) {
  return current + Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

/** Screen-space groups split naturally as the camera zooms, without moving geography. */
export function clusterGalleryGlobeMarkers(markers, {radius = 24} = {}) {
  const points = markers.filter(marker => marker.visible !== false
    && Number.isFinite(marker.x) && Number.isFinite(marker.y));
  const visited = new Set(), groups = [];
  for (let start = 0; start < points.length; start++) {
    if (visited.has(start)) continue;
    const pending = [start], members = [];visited.add(start);
    while (pending.length) {
      const index = pending.shift(), member = points[index];members.push(member);
      for (let next = 0; next < points.length; next++) {
        if (!visited.has(next) && Math.hypot(member.x - points[next].x, member.y - points[next].y) <= radius) {
          visited.add(next);pending.push(next);
        }
      }
    }
    groups.push({id: members.map(member => member.slug).sort().join('|'), members, count: members.length,
      x: members.reduce((sum, member) => sum + member.x, 0) / members.length,
      y: members.reduce((sum, member) => sum + member.y, 0) / members.length,
      active: members.some(member => member.active)});
  }
  return groups;
}

export function pickGalleryGlobeCluster(groups, point, {radius = 16} = {}) {
  return groups.filter(group => group.count > 1)
    .map(group => ({...group, distance: Math.hypot(group.x - point.x, group.y - point.y)}))
    .filter(group => group.distance <= radius).sort((a, b) => a.distance - b.distance)[0] ?? null;
}

/** Center real geography, then find a zoom that visibly splits the clicked group. */
export function galleryGlobeClusterTarget(locations, zoom = 1, {
  width = 336, height = width, radius = width <= 170 ? 21 : 25, allLocations = locations,
} = {}) {
  if (!locations.length) throw new TypeError('A globe cluster needs locations');
  if (![zoom, width, height, radius].every(value => Number.isFinite(value) && value > 0)) {
    throw new TypeError('A globe cluster needs a positive zoom and viewport');
  }
  const center = new THREE.Vector3();
  for (const location of locations) center.add(new THREE.Vector3(...galleryGlobeCoordinate(
    location.coordinates.lat, location.coordinates.lng)));
  if (center.lengthSq() < 1e-10) center.fromArray(galleryGlobeCoordinate(
    locations[0].coordinates.lat, locations[0].coordinates.lng));
  center.normalize();
  const latitude = Math.asin(center.y) / RADIANS, longitude = Math.atan2(-center.z, center.x) / RADIANS;
  const rotation = galleryGlobeRotation(latitude, longitude);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.pitch, rotation.yaw, 0, 'XYZ'));
  const memberKeys = new Set(locations.map(location => location.slug ?? location));
  const sceneLocations = [...new Map([...locations, ...allLocations].map(location => [location.slug ?? location, location])).values()];
  const points = sceneLocations.map((location, index) => {
    const position = new THREE.Vector3(...galleryGlobeCoordinate(location.coordinates.lat, location.coordinates.lng, 1.018))
      .applyQuaternion(quaternion);
    return {slug: location.slug ?? `cluster-point-${index}`, x: position.x, y: -position.y, z: position.z,
      member: memberKeys.has(location.slug ?? location)};
  });
  const members = points.filter(point => point.member), memberSlugs = new Set(members.map(point => point.slug));
  const scale = Math.min(width, height) / (2 * 1.23), disc = Math.min(width, height) / 2 - 15;
  const currentZoom = THREE.MathUtils.clamp(zoom, 1, GALLERY_GLOBE_MAX_ZOOM);
  const target = {...rotation, latitude, longitude, zoom: currentZoom, expand: true};
  if (members.some(point => point.z <= .015) || disc <= .25) return target;
  // Retain every clicked location: clipping a marker is not a successful split.
  const extent = Math.max(...members.map(point => Math.hypot(point.x, point.y)));
  const ceiling = Math.min(GALLERY_GLOBE_MAX_ZOOM, extent > 0 ? (disc - .25) / (scale * extent) : GALLERY_GLOBE_MAX_ZOOM);
  const splits = candidate => {
    const markers = points.map(point => ({slug: point.slug, x: point.x * scale * candidate, y: point.y * scale * candidate,
      visible: point.z > .015 && Math.hypot(point.x, point.y) * scale * candidate <= disc}));
    const groups = clusterGalleryGlobeMarkers(markers, {radius});
    const children = groups.filter(group => group.members.some(member => memberSlugs.has(member.slug)));
    const retained = children.reduce((count, group) => count
      + group.members.filter(member => memberSlugs.has(member.slug)).length, 0);
    return retained === members.length && children.length > 1
      && children.every(group => group.count < locations.length);
  };
  if (ceiling <= currentZoom || !splits(ceiling)) return target;
  let lower = currentZoom, upper = ceiling;
  if (!splits(lower)) {
    for (let step = 0; step < 24; step++) {
      const middle = (lower + upper) / 2;
      if (splits(middle)) upper = middle;else lower = middle;
    }
  } else upper = lower;
  // Leave a little separation beyond the exact graph threshold, avoiding edge flicker.
  return {...target, zoom: Math.min(ceiling, Math.max(currentZoom * 1.1, upper * 1.1)), expand: false};
}

/** Tiny shared locations remain at their real positions, with repeat-click cycling. */
export function pickGalleryGlobeMarker(markers, point, {radius = 12, previousSlug = null} = {}) {
  const nearby = markers.filter(marker => marker.visible !== false)
    .map(marker => ({...marker, distance: Math.hypot(marker.x - point.x, marker.y - point.y)}))
    .filter(marker => marker.distance <= radius).sort((a, b) => a.distance - b.distance);
  if (!nearby.length) return null;
  const nearest = nearby[0];
  const cluster = nearby.filter(marker => Math.hypot(marker.x - nearest.x, marker.y - nearest.y) <= 4);
  const previous = cluster.findIndex(marker => marker.slug === previousSlug);
  return cluster[(previous + 1) % cluster.length];
}

export function galleryGlobeIsTap(gesture, point) {
  return !!gesture && !gesture.dragged && !gesture.cancelled
    && Math.hypot(point.x - gesture.x, point.y - gesture.y) <= 5;
}

function graticule() {
  const positions = [];
  const segment = (lat, lng, nextLat, nextLng) => positions.push(
    ...galleryGlobeCoordinate(lat, lng, 1.003), ...galleryGlobeCoordinate(nextLat, nextLng, 1.003));
  for (let lat = -60; lat <= 60; lat += 30) for (let lng = -180; lng < 180; lng += 5) {
    segment(lat, lng, lat, lng + 5);
  }
  for (let lng = -180; lng < 180; lng += 30) for (let lat = -90; lat < 90; lat += 5) {
    segment(lat, lng, lat + 5, lng);
  }
  return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',
    new THREE.Float32BufferAttribute(positions, 3)), new THREE.LineBasicMaterial({
    color: '#d0e3eb', transparent: true, opacity: .08, depthWrite: false}));
}

/** Equirectangular WMS pixels stay geographically fixed on a curved local mesh. */
export function galleryGlobeSatelliteGeometry(bounds, segments = 32) {
  const [west, south, east, north] = bounds;
  const positions = [], uv = [], indices = [];
  for (let row = 0; row <= segments; row++) for (let column = 0; column <= segments; column++) {
    const u = column / segments, v = 1 - row / segments;
    positions.push(...galleryGlobeCoordinate(south + (north - south) * v, west + (east - west) * u, 1.0006));
    uv.push(u, v);
  }
  for (let row = 0; row < segments; row++) for (let column = 0; column < segments; column++) {
    const a = row * (segments + 1) + column, b = a + 1, c = a + segments + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}

/** A standalone geographic navigator; zoom always stays inside its original canvas. */
export function createGalleryRoomGlobe({container, achievements, onSelect = () => {}, textureUrl = TEXTURE_URL,
  initialSlug = achievements?.[0]?.slug}) {
  if (!container?.ownerDocument || !Array.isArray(achievements) || !achievements.length) {
    throw new TypeError('The gallery globe needs a container and project locations');
  }
  const document = container.ownerDocument, window = document.defaultView;
  const slugs = new Set();
  const locations = achievements.map(event => {
    if (typeof event.slug !== 'string' || !event.slug || slugs.has(event.slug)) {
      throw new TypeError('Globe project slugs must be unique');
    }
    slugs.add(event.slug);
    return {...event, point: new THREE.Vector3(...galleryGlobeCoordinate(
      event.coordinates?.lat, event.coordinates?.lng, 1.018))};
  });
  const originalClass = container.classList.contains('gallery-room-globe');
  container.classList.add('gallery-room-globe');
  const canvas = document.createElement('canvas');
  canvas.className = 'gallery-room-globe-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Project globe. Drag or use arrow keys to rotate. Explore numbered clusters to zoom or choose a project. Plus and minus zoom; Home resets. Tab reaches cluster controls and the location list.');
  const clusterLayer = document.createElement('div');clusterLayer.className = 'gallery-room-globe-clusters';
  const tools = document.createElement('div');tools.className = 'gallery-room-globe-tools';
  tools.setAttribute('role', 'group');tools.setAttribute('aria-label', 'Globe view controls');
  const tool = (label, symbol) => {
    const button = document.createElement('button');button.type = 'button';
    button.className = 'gallery-room-globe-tool';button.textContent = symbol;
    button.setAttribute('aria-label', label);button.title = label;tools.append(button);return button;
  };
  const zoomIn = tool('Zoom globe in', '+'), zoomOut = tool('Zoom globe out', '−'), reset = tool('Reset globe view', '↺');
  const creditToggle = tool('Map imagery credits', 'ⓘ');
  creditToggle.classList.add('gallery-room-globe-credit-toggle');
  creditToggle.setAttribute('aria-expanded', 'false');
  const clusterList = document.createElement('div');clusterList.className = 'gallery-room-globe-cluster-list';
  clusterList.hidden = true;clusterList.setAttribute('role', 'group');clusterList.setAttribute('aria-label', 'Projects at this location');
  const clusterHeading = document.createElement('span');clusterHeading.className = 'gallery-room-globe-cluster-heading';
  const closeList = document.createElement('button');closeList.type = 'button';closeList.className = 'gallery-room-globe-cluster-close';
  closeList.textContent = '×';closeList.setAttribute('aria-label', 'Close cluster projects');
  const clusterOptions = document.createElement('div');clusterOptions.className = 'gallery-room-globe-cluster-options';
  clusterList.append(clusterHeading, closeList, clusterOptions);
  const select = document.createElement('select');
  select.className = 'gallery-room-globe-locations';
  select.setAttribute('aria-label', 'Choose a project by geographic location');
  if (initialSlug === null) {
    const placeholder = document.createElement('option');placeholder.value = '';
    placeholder.textContent = 'Choose an achievement';placeholder.disabled = true;placeholder.selected = true;
    select.append(placeholder);
  }
  for (const location of locations) {
    const option = document.createElement('option');
    option.value = location.slug;
    option.textContent = `${location.title} · ${location.city || location.venue || ''}, ${location.country || ''}`
      + ` · ${location.coordinates.lat.toFixed(3)}°, ${location.coordinates.lng.toFixed(3)}°`;
    select.append(option);
  }
  const live = document.createElement('span');
  live.className = 'gallery-room-globe-status';
  live.setAttribute('aria-live', 'polite');
  const attribution = document.createElement('div');attribution.className = 'gallery-room-globe-credit';
  attribution.hidden = true;attribution.id = `gallery-room-globe-credit-${++creditPanelId}`;
  attribution.setAttribute('role', 'region');attribution.setAttribute('aria-label', 'Map imagery credits');
  creditToggle.setAttribute('aria-controls', attribution.id);
  attribution.title = `${GALLERY_SATELLITE_DATA.attribution}. Historical satellite basemap; no current event imagery.`;
  const creditLink = (text, url) => {
    const link = document.createElement('a');link.textContent = text;link.href = url;
    link.target = '_blank';link.rel = 'noopener noreferrer';attribution.append(link);
  };
  creditLink('Sentinel-2 cloudless', 'https://s2maps.eu');
  creditLink('EOX IT Services GmbH', 'https://eox.at');creditLink('CC BY 4.0', GALLERY_SATELLITE_DATA.license);
  const creditYears = document.createElement('span');creditYears.className = 'gallery-room-globe-credit-years';
  creditYears.textContent = 'Contains modified Copernicus Sentinel data 2016 & 2017.';
  const creditHistory = document.createElement('span');creditHistory.className = 'gallery-room-globe-credit-history';
  creditHistory.textContent = 'Historical imagery from 2016–17.';
  attribution.append(creditYears, creditHistory);
  container.append(canvas, clusterLayer, tools, attribution, clusterList, select, live);

  const scene = new THREE.Scene(), earth = new THREE.Group();
  const camera = new THREE.OrthographicCamera(-1.23, 1.23, 1.23, -1.23, .1, 10);
  camera.position.z = 4;
  scene.add(earth);
  // The natural map stays evenly lit, without a tinted or night-side hemisphere.
  const surface = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96),
    new THREE.MeshBasicMaterial({color: 0xffffff, toneMapped: false}));
  surface.name = 'gallery-globe-daylight-earth';
  const grid = graticule();earth.add(surface, grid);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.045, 40, 24), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {color: {value: new THREE.Color('#b7d8ed')}},
    vertexShader: 'varying vec3 n; varying vec3 eye; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader: 'uniform vec3 color; varying vec3 n; varying vec3 eye; void main(){float a=pow(1.-abs(dot(normalize(n),normalize(eye))),3.);gl_FragColor=vec4(color,a*.12);}',
  }));
  earth.add(atmosphere);
  const markers = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6),
    new THREE.MeshBasicMaterial({color: 0xffffff}), locations.length);
  markers.frustumCulled = false;earth.add(markers);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(.036, .049, 32),
    new THREE.MeshBasicMaterial({color: GOLD, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false}));
  earth.add(pulse);pulse.visible = false;
  const dummy = new THREE.Object3D(), normal = new THREE.Vector3(), north = new THREE.Vector3(0, 0, 1);
  const local = new THREE.Vector3(), projected = new THREE.Vector3();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer = null, texture = null, image = null, textureLoaded = false, disposed = false;
  let activeSlug = null, hoverSlug = null, gesture = null, previousPick = null;
  let pitch = .4, yaw = -Math.PI / 2, zoom = 1, flight = null, frame = 0, frames = 0, lastFrame = -Infinity;
  let width = 0, height = 0, intersecting = true, contextLost = false;
  let clusters = [], groupedSlugs = new Set();
  const imagery = new Map();let imageryClock = 0, activeImagery = null, desiredImagery = null;
  const clusterButtons = new Map();
  const listeners = [];
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);listeners.push(() => target.removeEventListener(type, fn, options));
  };
  const isVisible = () => !disposed && !contextLost && !document.hidden && intersecting
    && !container.closest('[hidden]') && container.isConnected
    && container.getBoundingClientRect().width > 0 && window.getComputedStyle(container).visibility !== 'hidden';
  const setRotation = () => earth.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'XYZ'));
  setRotation();

  function releaseImagery(entry) {
    entry.image.onload = entry.image.onerror = null;entry.image.removeAttribute('src');
    if (entry.mesh) {
      earth.remove(entry.mesh);entry.mesh.geometry.dispose();entry.mesh.material.dispose();
      entry.texture.dispose();entry.texture.image = null;
    }
    imagery.delete(entry.record.id);
  }
  function ensureImagery(record) {
    if (!record || disposed || !renderer || !isVisible()) return null;
    let entry = imagery.get(record.id);
    if (entry) {entry.used = ++imageryClock;return entry;}
    while (imagery.size >= GALLERY_SATELLITE_CACHE_SIZE) {
      const oldest = [...imagery.values()].filter(item => item.record.id !== activeImagery)
        .sort((a, b) => a.used - b.used)[0];
      if (!oldest) return null;releaseImagery(oldest);
    }
    const patchImage = new window.Image();patchImage.decoding = 'async';
    entry = {record, image: patchImage, mesh: null, texture: null, used: ++imageryClock};imagery.set(record.id, entry);
    patchImage.onload = () => {
      if (disposed || imagery.get(record.id) !== entry) return;
      entry.texture = new THREE.Texture(patchImage);entry.texture.colorSpace = THREE.SRGBColorSpace;
      entry.texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());entry.texture.needsUpdate = true;
      entry.mesh = new THREE.Mesh(galleryGlobeSatelliteGeometry(record.bounds),
        new THREE.MeshBasicMaterial({map: entry.texture, color: 0xffffff, toneMapped: false}));
      entry.mesh.name = `gallery-satellite-${record.id}`;entry.mesh.visible = false;earth.add(entry.mesh);
      requestRender();
    };
    patchImage.onerror = () => {if (!disposed && imagery.get(record.id) === entry) {entry.failed = true;requestRender();}};
    patchImage.src = satelliteUrl(record);return entry;
  }
  function updateImagery() {
    const latitude = pitch / RADIANS;
    const longitude = ((-yaw / RADIANS - 90 + 540) % 360 + 360) % 360 - 180;
    const record = gallerySatellitePatch(latitude, longitude, zoom, width / Math.max(1, height));
    desiredImagery = record?.id ?? null;
    const target = ensureImagery(record);
    // Retain a loaded lower LOD while the sharper city image is decoding.
    let shown = target?.mesh ? target : null;
    if (!shown && record) {
      shown = [...imagery.values()].filter(entry => entry.mesh && entry.record.level === 'region'
        && gallerySatellitePatch(latitude, longitude, Math.min(zoom, 189), width / Math.max(1, height))?.id === entry.record.id)[0];
    }
    activeImagery = shown?.record.id ?? null;
    for (const entry of imagery.values()) if (entry.mesh) entry.mesh.visible = entry === shown;
    grid.visible = zoom < 18;
    container.dataset.imagery = activeImagery ?? 'world';
  }

  function updateMarkers() {
    locations.forEach((location, index) => {
      dummy.position.copy(location.point);
      dummy.scale.setScalar(groupedSlugs.has(location.slug) ? 0
        : (location.slug === activeSlug ? .029 : location.slug === hoverSlug ? .025 : .017) / zoom);
      dummy.updateMatrix();markers.setMatrixAt(index, dummy.matrix);
      markers.setColorAt(index, location.slug === activeSlug ? GOLD : location.slug === hoverSlug ? HOVER : DOT);
    });
    markers.instanceMatrix.needsUpdate = true;
    if (markers.instanceColor) markers.instanceColor.needsUpdate = true;
    const active = locations.find(location => location.slug === activeSlug);
    pulse.visible = !!active && !groupedSlugs.has(activeSlug);
    if (active) {
      pulse.position.copy(active.point).multiplyScalar(1.012);
      pulse.quaternion.setFromUnitVectors(north, normal.copy(active.point).normalize());
    }
  }
  updateMarkers();

  function getMarkerPositions() {
    earth.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    return locations.map(location => {
      local.copy(location.point).applyMatrix4(earth.matrixWorld);
      projected.copy(local).project(camera);
      const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      return {slug: location.slug, x: (projected.x + 1) * width / 2,
        y: (1 - projected.y) * height / 2, visible: local.z > .015
          && Math.hypot(x - width / 2, y - height / 2) <= Math.min(width, height) / 2 - 15,
        active: location.slug === activeSlug};
    });
  }
  function updateClusters() {
    clusters = clusterGalleryGlobeMarkers(getMarkerPositions(), {radius: width <= 170 ? 21 : 25});
    groupedSlugs = new Set(clusters.filter(cluster => cluster.count > 1)
      .flatMap(cluster => cluster.members.map(member => member.slug)));
    const ids = new Set();
    for (const cluster of clusters) {
      if (cluster.count < 2) continue;
      ids.add(cluster.id);
      let button = clusterButtons.get(cluster.id);
      if (!button) {
        button = document.createElement('button');button.type = 'button';
        button.className = 'gallery-room-globe-cluster';button.dataset.clusterId = cluster.id;
        button.addEventListener('click', event => {
          event.preventDefault();event.stopPropagation();
          const current = clusters.find(item => item.id === button.dataset.clusterId);
          if (current) focusCluster(current);
        });
        button.addEventListener('pointerdown', event => event.stopPropagation());
        clusterButtons.set(cluster.id, button);clusterLayer.append(button);
      }
      if (button.textContent !== `${cluster.count}`) button.textContent = `${cluster.count}`;
      const cities = [...new Set(cluster.members.map(member => locations.find(item => item.slug === member.slug)?.city).filter(Boolean))];
      const label = `${cluster.count} projects near ${cities.slice(0, 2).join(' / ') || 'this location'}. Explore cluster`;
      const current = cluster.active ? 'location' : 'false', left = `${cluster.x}px`, top = `${cluster.y}px`;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      if (button.getAttribute('aria-current') !== current) button.setAttribute('aria-current', current);
      if (button.style.left !== left) button.style.left = left;
      if (button.style.top !== top) button.style.top = top;
    }
    for (const [id, button] of clusterButtons) if (!ids.has(id)) {
      if (document.activeElement === button) canvas.focus({preventScroll: true});
      button.remove();clusterButtons.delete(id);
    }
    zoomIn.disabled = zoom >= GALLERY_GLOBE_MAX_ZOOM - .01;zoomOut.disabled = zoom <= 1.01;
    container.dataset.zoom = zoom.toFixed(2);container.dataset.clusterCount = `${ids.size}`;
    updateMarkers();
  }
  function hideClusterList({focus = false} = {}) {
    const hadFocus = clusterList.contains(document.activeElement);
    clusterList.hidden = true;
    if (focus || hadFocus) canvas.focus({preventScroll: true});
  }
  function hideCredits({focus = false} = {}) {
    const hadFocus = attribution.contains(document.activeElement);
    attribution.hidden = true;creditToggle.setAttribute('aria-expanded', 'false');
    if (focus || hadFocus) creditToggle.focus({preventScroll: true});
  }
  function showClusterList(cluster) {
    hideCredits();
    clusterOptions.replaceChildren();clusterHeading.textContent = `${cluster.count} projects`;
    for (const member of cluster.members) {
      const location = locations.find(item => item.slug === member.slug);
      const button = document.createElement('button');button.type = 'button';
      button.className = 'gallery-room-globe-cluster-item';button.textContent = location.title;
      button.setAttribute('aria-current', location.slug === activeSlug ? 'true' : 'false');
      button.addEventListener('click', event => {
        event.stopPropagation();hideClusterList({focus: true});previousPick = null;onSelect(location.slug);
      });
      clusterOptions.append(button);
    }
    clusterList.hidden = false;clusterOptions.firstElementChild?.focus({preventScroll: true});
  }
  function advanceFlight(time) {
    if (!flight) return;
    const fraction = motion.matches ? 1 : THREE.MathUtils.clamp((time - flight.start) / flight.duration, 0, 1);
    // Quintic easing has no abrupt acceleration where the geographic phases meet.
    const ease = value => {const t = THREE.MathUtils.clamp(value, 0, 1);return t * t * t * (t * (t * 6 - 15) + 10);};
    const rotation = flight.arc ? ease((fraction - flight.rotationStart) / (.72 - flight.rotationStart))
      : flight.geographic ? ease(fraction) : 1 - Math.pow(1 - fraction, 3);
    pitch = THREE.MathUtils.lerp(flight.fromPitch, flight.toPitch, rotation);
    yaw = THREE.MathUtils.lerp(flight.fromYaw, flight.toYaw, rotation);
    const zoomBetween = (from, to, t) => Math.exp(THREE.MathUtils.lerp(Math.log(from), Math.log(to), t));
    zoom = flight.arc ? fraction < .24
      ? zoomBetween(flight.fromZoom, flight.cruiseZoom, ease(fraction / .24))
      : zoomBetween(flight.cruiseZoom, flight.toZoom, ease((fraction - .64) / .36))
      : zoomBetween(flight.fromZoom, flight.toZoom, rotation);
    if (fraction === 1) {pitch = flight.toPitch;yaw = flight.toYaw;zoom = flight.toZoom;flight = null;}
    camera.zoom = zoom;camera.updateProjectionMatrix();setRotation();
  }
  function flyTo(target, {geographic = false, preservePick = false} = {}) {
    const start = window.performance.now();advanceFlight(start);
    const {pitch: toPitch = pitch, yaw: targetYaw = yaw} = target;
    let {zoom: toZoom = zoom} = target;
    const toYaw = galleryGlobeYawTarget(yaw, targetYaw);
    toZoom = THREE.MathUtils.clamp(toZoom, 1, GALLERY_GLOBE_MAX_ZOOM);
    // Center directions give true angular distance, including high latitudes and the map seam.
    const angle = Math.acos(THREE.MathUtils.clamp(Math.sin(pitch) * Math.sin(toPitch)
      + Math.cos(pitch) * Math.cos(toPitch) * Math.cos(toYaw - yaw), -1, 1));
    // City-scale views need a gentle pullout even for a neighbouring city.
    const arcThreshold = Math.max(.004, Math.min(.12, 1.4 / Math.max(1, Math.min(zoom, toZoom))));
    const arc = geographic && angle > arcThreshold;
    const cruiseZoom = Math.min(zoom, toZoom, Math.max(1, .72 / Math.sin(Math.min(Math.PI / 2, Math.max(.001, angle)))));
    const duration = !geographic ? 700 : arc ? 1050 + 700 * Math.sqrt(angle / Math.PI)
      : angle < .002 ? 480 : 650 + 300 * angle / .12;
    flight = motion.matches ? null : {fromPitch: pitch, fromYaw: yaw, fromZoom: zoom,
      toPitch, toYaw, toZoom, start, duration, geographic, arc, cruiseZoom,
      rotationStart: zoom > cruiseZoom + .05 ? .12 : 0};
    if (motion.matches) {pitch = toPitch;yaw = toYaw;zoom = toZoom;camera.zoom = zoom;camera.updateProjectionMatrix();setRotation();}
    hoverSlug = null;if (!preservePick) previousPick = null;updateClusters();requestRender();
  }
  function focusCluster(cluster) {
    cancelGesture();advanceFlight(window.performance.now());flight = null;
    const members = cluster.members.map(member => locations.find(item => item.slug === member.slug));
    const target = galleryGlobeClusterTarget(members, zoom, {width, height, allLocations: locations});
    if (target.expand) {
      live.textContent = `${cluster.count} nearby projects. Choose an achievement.`;
      updateClusters();showClusterList(cluster);requestRender();
    } else {
      live.textContent = `${cluster.count} projects. Zooming into ${[...new Set(members.map(member => member.city).filter(Boolean))].slice(0, 3).join(', ')}.`;
      hideClusterList();flyTo(target);
    }
  }
  function changeZoom(factor) {
    cancelGesture();advanceFlight(window.performance.now());hideClusterList();flyTo({zoom: zoom * factor});
  }
  function resetView() {
    cancelGesture();hideClusterList();
    const active = locations.find(location => location.slug === activeSlug) || locations[0];
    flyTo({...galleryGlobeRotation(active.coordinates.lat, active.coordinates.lng), zoom: 1});
    live.textContent = 'Globe view reset. Numbered clusters show nearby projects.';
  }
  const point = event => {
    const rect = canvas.getBoundingClientRect();return {x: event.clientX - rect.left, y: event.clientY - rect.top};
  };
  const hit = (where, previousSlug = null) => pickGalleryGlobeMarker(getMarkerPositions()
    .filter(marker => !groupedSlugs.has(marker.slug)), where,
    {radius: width <= 150 ? 13 : 12, previousSlug});
  function requestRender() {
    if (frame || !renderer || !isVisible()) return;
    frame = window.requestAnimationFrame(draw);
  }
  function suspend() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }
  function draw(time) {
    frame = 0;
    if (!renderer || !isVisible()) return;
    if (time - lastFrame >= 1000 / 30 || motion.matches) {
      if (flight) {
        advanceFlight(time);
      }
      const phase = motion.matches ? 0 : Math.sin(time / 470);
      updateImagery();
      updateClusters();
      pulse.scale.setScalar((1 + .15 * phase) / zoom);pulse.material.opacity = .8 + .12 * phase;
      renderer.render(scene, camera);frames++;lastFrame = time;
    }
    if (flight || !motion.matches && activeSlug) requestRender();
  }

  function setActive(slug, {recenter = false} = {}) {
    if (disposed) return;
    const location = locations.find(item => item.slug === slug);
    if (!location || activeSlug === slug && !recenter) return;
    cancelGesture();
    activeSlug = slug;select.value = slug;
    for (const record of gallerySatelliteProjectLevels(slug)) ensureImagery(record);
    hideClusterList();
    live.textContent = `${location.city || location.venue || ''}, ${location.country || ''}. ${location.title}`;
    const rotation = galleryGlobeRotation(location.coordinates.lat, location.coordinates.lng);
    // The room may commit a dot selection after its transition. Keep that dot's
    // cycle position, while chronology or location-list selections start fresh.
    flyTo({...rotation, zoom: GALLERY_GLOBE_PROJECT_ZOOM}, {geographic: true, preservePick: previousPick?.slug === slug});
  }
  function resize() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));height = Math.max(1, Math.round(rect.height));
    const aspect = width / height;
    camera.left = -1.23 * Math.max(1, aspect);camera.right = -camera.left;
    camera.top = 1.23 * Math.max(1, 1 / aspect);camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    if (renderer) {
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(width, height, false);
    }
    updateClusters();requestRender();
  }
  function cancelGesture() {
    const pointerId = gesture?.id;gesture = null;
    if (pointerId != null && canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
    canvas.style.cursor = 'grab';
  }

  listen(canvas, 'pointerdown', event => {
    if (event.isPrimary === false) {event.preventDefault();event.stopPropagation();cancelGesture();return;}
    if (event.button !== 0 || gesture) return;
    event.preventDefault();event.stopPropagation();canvas.focus({preventScroll: true});
    const where = point(event);
    advanceFlight(window.performance.now());flight = null;hideClusterList();updateClusters();
    gesture = {id: event.pointerId, ...where, pitch, yaw, dragged: false};
    canvas.setPointerCapture(event.pointerId);canvas.style.cursor = 'grabbing';
  });
  listen(canvas, 'pointermove', event => {
    const where = point(event);
    if (gesture?.id === event.pointerId) {
      event.preventDefault();event.stopPropagation();
      const dx = where.x - gesture.x, dy = where.y - gesture.y;
      gesture.dragged ||= Math.hypot(dx, dy) > 5;
      if (gesture.dragged) {
        pitch = THREE.MathUtils.clamp(gesture.pitch + dy / height * Math.PI / zoom, -1.48, 1.48);
        yaw = gesture.yaw + dx / width * Math.PI / zoom;setRotation();previousPick = null;updateClusters();requestRender();
      }
    } else if (!gesture && event.pointerType !== 'touch') {
      const target = hit(where);const next = target?.slug ?? null;
      canvas.style.cursor = next ? 'pointer' : 'grab';
      if (hoverSlug !== next) {hoverSlug = next;updateMarkers();requestRender();}
    }
  });
  listen(canvas, 'pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    event.preventDefault();event.stopPropagation();
    const where = point(event), tap = galleryGlobeIsTap(gesture, where);
    cancelGesture();
    if (tap) {
      const cluster = pickGalleryGlobeCluster(clusters, where);
      if (cluster) {focusCluster(cluster);return;}
      const previous = previousPick && Math.hypot(previousPick.x - where.x, previousPick.y - where.y) < 6
        ? previousPick.slug : null;
      const selected = hit(where, previous);
      if (selected) {onSelect(selected.slug);previousPick = {...where, slug: selected.slug};}
    }
  });
  for (const type of ['pointercancel', 'lostpointercapture', 'blur']) listen(canvas, type, cancelGesture);
  listen(canvas, 'pointerleave', () => {if (!gesture) {hoverSlug = null;canvas.style.cursor = 'grab';updateMarkers();requestRender();}});
  listen(window, 'blur', event => {if (event.target === window) cancelGesture();});
  listen(canvas, 'keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const deltas = {ArrowLeft: [0, -.16], ArrowRight: [0, .16], ArrowUp: [-.12, 0], ArrowDown: [.12, 0]};
    if (deltas[event.key]) {
      event.preventDefault();event.stopPropagation();advanceFlight(window.performance.now());flight = null;
      pitch = THREE.MathUtils.clamp(pitch + deltas[event.key][0] / zoom, -1.48, 1.48);
      yaw += deltas[event.key][1] / zoom;setRotation();previousPick = null;hideClusterList();updateClusters();requestRender();
    } else if (event.key === 'Home') {
      event.preventDefault();event.stopPropagation();resetView();
    } else if (['+', '=', '-', '_'].includes(event.key)) {
      event.preventDefault();event.stopPropagation();changeZoom(event.key === '-' || event.key === '_' ? 1 / 1.5 : 1.5);
    }
  });
  listen(container, 'wheel', event => {
    if (!clusterList.hidden && clusterList.contains(event.target)
      || !attribution.hidden && attribution.contains(event.target)) return;
    event.preventDefault();event.stopPropagation();cancelGesture();
    changeZoom(Math.exp(-THREE.MathUtils.clamp(event.deltaY, -120, 120) * .004));
  }, {passive: false});
  for (const element of [tools, clusterList, clusterLayer, attribution]) {
    listen(element, 'pointerdown', event => event.stopPropagation());
    listen(element, 'keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!attribution.hidden) hideCredits({focus: true});else hideClusterList({focus: true});
      }
    });
  }
  listen(creditToggle, 'click', event => {
    event.stopPropagation();
    if (!attribution.hidden) {hideCredits();return;}
    cancelGesture();hideClusterList();attribution.hidden = false;creditToggle.setAttribute('aria-expanded', 'true');
  });
  listen(document, 'pointerdown', event => {
    if (!attribution.hidden && !attribution.contains(event.target) && !creditToggle.contains(event.target)) hideCredits();
  }, {capture: true});
  listen(document, 'keydown', event => {
    if (event.key === 'Escape' && !attribution.hidden) {
      event.preventDefault();event.stopPropagation();hideCredits({focus: true});
    }
  }, {capture: true});
  listen(zoomIn, 'click', event => {event.stopPropagation();changeZoom(1.5);});
  listen(zoomOut, 'click', event => {event.stopPropagation();changeZoom(1 / 1.5);});
  listen(reset, 'click', event => {event.stopPropagation();resetView();});
  listen(closeList, 'click', event => {event.stopPropagation();hideClusterList({focus: true});});
  listen(select, 'change', () => onSelect(select.value));
  listen(select, 'keydown', event => event.stopPropagation());
  listen(document, 'visibilitychange', () => {if (document.hidden) {cancelGesture();suspend();} else requestRender();});
  listen(motion, 'change', () => {
    if (motion.matches && flight) {
      pitch = flight.toPitch;yaw = flight.toYaw;zoom = flight.toZoom;camera.zoom = zoom;
      camera.updateProjectionMatrix();flight = null;setRotation();updateClusters();
    }
    requestRender();
  });
  listen(canvas, 'webglcontextlost', event => {event.preventDefault();contextLost = true;cancelGesture();suspend();});
  listen(canvas, 'webglcontextrestored', () => {contextLost = false;resize();});
  const resizeObserver = new window.ResizeObserver(resize);resizeObserver.observe(container);
  const intersectionObserver = new window.IntersectionObserver(entries => {
    intersecting = entries[0]?.isIntersecting !== false;
    if (intersecting) requestRender();else {cancelGesture();suspend();}
  });intersectionObserver.observe(container);
  const mutationObserver = new window.MutationObserver(() => {if (isVisible()) requestRender();else suspend();});
  for (let ancestor = container; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
    mutationObserver.observe(ancestor, {attributes: true, attributeFilter: ['hidden', 'style', 'class']});
  }
  try {
    renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'});
    renderer.setClearColor(0x000000, 0);renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = .85;
    image = new window.Image();image.decoding = 'async';
    image.onload = () => {
      if (disposed) return;
      texture = new THREE.Texture(image);texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());texture.needsUpdate = true;
      surface.material.map = texture;surface.material.needsUpdate = true;
      textureLoaded = true;requestRender();
    };
    image.onerror = () => {if (!disposed) container.classList.add('has-image-fallback');};
    image.src = textureUrl === TEXTURE_URL && (container.getBoundingClientRect().width < 240 || window.navigator?.deviceMemory <= 4)
      ? satelliteUrl(GALLERY_SATELLITE_DATA.smallGlobal) : textureUrl;
  } catch {
    container.classList.add('is-fallback');canvas.tabIndex = -1;
    canvas.setAttribute('aria-hidden', 'true');
  }
  resize();if (initialSlug != null) setActive(initialSlug);

  function dispose() {
    if (disposed) return;
    disposed = true;flight = null;suspend();cancelGesture();
    for (const entry of [...imagery.values()]) releaseImagery(entry);
    listeners.forEach(remove => remove());resizeObserver.disconnect();intersectionObserver.disconnect();mutationObserver.disconnect();
    const geometries = new Set(), materials = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());materials.forEach(material => material.dispose());
    markers.dispose();texture?.dispose();if (texture) texture.image = null;
    if (image) {image.onload = image.onerror = null;image.removeAttribute('src');image = null;}
    surface.material.map = null;
    scene.clear();renderer?.dispose();renderer?.forceContextLoss();renderer = null;
    canvas.remove();clusterLayer.remove();tools.remove();clusterList.remove();select.remove();live.remove();attribution.remove();
    clusterButtons.clear();delete container.dataset.zoom;delete container.dataset.clusterCount;
    delete container.dataset.imagery;
    if (!originalClass) container.classList.remove('gallery-room-globe');
    container.classList.remove('is-fallback', 'has-image-fallback');
  }
  return {setActive, resize, dispose, getMarkerPositions, getClusters: () => clusters,
    getStats: () => ({projects: locations.length, activeSlug, frames, running: !!frame, hidden: !isVisible(),
      webgl: !!renderer && !contextLost, reducedMotion: motion.matches, dragging: !!gesture, textureLoaded,
      width, height, zoom, pitch, yaw, flying: !!flight, clusters: clusters.filter(cluster => cluster.count > 1).length,
      imagery: activeImagery ?? 'world', desiredImagery, detailTextures: [...imagery.values()].filter(entry => entry.texture).length,
      detailRequests: imagery.size,
      clusterListOpen: !clusterList.hidden, pixelRatio: renderer?.getPixelRatio() ?? 0, drawCalls: renderer?.info.render.calls ?? 0})};
}
