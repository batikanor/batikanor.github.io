import * as THREE from "three";

export const MAP_WORLD_WIDTH = 240;
export const MAP_WORLD_DEPTH = 120;
export const MAP_WORLD_MODES = ["atlas", "relief", "night"];

export function latLngToMapWorld(latitude, longitude, mode = "atlas", yOffset = 0) {
  const x = (longitude / 180) * (MAP_WORLD_WIDTH / 2);
  const z = -(latitude / 90) * (MAP_WORLD_DEPTH / 2);
  return new THREE.Vector3(x, mapWorldHeight(x, z, mode) + yOffset, z);
}

export function mapWorldHeight(x, z, mode) {
  if (mode !== "relief") return 0;
  return (
    Math.sin(x * 0.115) * 0.34
    + Math.cos(z * 0.19) * 0.28
    + Math.sin((x + z) * 0.07) * 0.2
  );
}

function createMapGrid(mode) {
  const positions = [];
  const color = mode === "night" ? 0x2c8b96 : 0x8ec6bd;
  for (let longitude = -180; longitude <= 180; longitude += 15) {
    const x = (longitude / 180) * (MAP_WORLD_WIDTH / 2);
    for (let z = -MAP_WORLD_DEPTH / 2; z < MAP_WORLD_DEPTH / 2; z += 1.5) {
      const y1 = mapWorldHeight(x, z, mode) + 0.025;
      const y2 = mapWorldHeight(x, z + 1.5, mode) + 0.025;
      positions.push(x, y1, z, x, y2, z + 1.5);
    }
  }
  for (let latitude = -75; latitude <= 75; latitude += 15) {
    const z = -(latitude / 90) * (MAP_WORLD_DEPTH / 2);
    for (let x = -MAP_WORLD_WIDTH / 2; x < MAP_WORLD_WIDTH / 2; x += 1.5) {
      const y1 = mapWorldHeight(x, z, mode) + 0.025;
      const y2 = mapWorldHeight(x + 1.5, z, mode) + 0.025;
      positions.push(x, y1, z, x + 1.5, y2, z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: mode === "night" ? 0.2 : 0.12,
    }),
  );
}

export function createMapWorldBase(mode) {
  const root = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(MAP_WORLD_WIDTH, MAP_WORLD_DEPTH, 120, 60);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    positions.setY(index, mapWorldHeight(x, z, mode));
  }
  geometry.computeVertexNormals();
  const palettes = {
    atlas: { color: 0x17343b, emissive: 0x07191e, roughness: 0.76, metalness: 0.08 },
    relief: { color: 0x294b3f, emissive: 0x0d211b, roughness: 0.92, metalness: 0.02 },
    night: { color: 0x07131d, emissive: 0x020a11, roughness: 0.36, metalness: 0.34 },
  };
  const palette = palettes[mode];
  const floor = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ ...palette, emissiveIntensity: mode === "night" ? 1.1 : 0.5 }),
  );
  floor.receiveShadow = true;
  root.add(floor, createMapGrid(mode));
  root.userData.floor = floor;
  return root;
}

export function createMapCountryOutlines(geoJson, mode) {
  const positions = [];
  const appendRing = (ring) => {
    for (let index = 1; index < ring.length; index += 1) {
      const [previousLongitude, previousLatitude] = ring[index - 1];
      const [longitude, latitude] = ring[index];
      if (Math.abs(longitude - previousLongitude) > 180) continue;
      const previous = latLngToMapWorld(previousLatitude, previousLongitude, mode, 0.08);
      const current = latLngToMapWorld(latitude, longitude, mode, 0.08);
      positions.push(previous.x, previous.y, previous.z, current.x, current.y, current.z);
    }
  };
  geoJson.features.forEach((feature) => {
    const geometry = feature.geometry;
    if (!geometry) return;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    polygons.forEach((polygon) => polygon.forEach(appendRing));
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: mode === "night" ? 0x66f4ff : mode === "relief" ? 0xe1e9bd : 0xc5ffe5,
      transparent: true,
      opacity: mode === "night" ? 0.9 : 0.72,
    }),
  );
}

export function createProjectNetwork(projectSites, mode) {
  if (mode !== "night") return null;
  const points = projectSites
    .map((site) => site.project.mapData?.coordinates)
    .filter(Boolean)
    .map((coordinates) => latLngToMapWorld(coordinates.lat, coordinates.lng, mode, 0.16));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xffc26a, transparent: true, opacity: 0.28 }),
  );
}
