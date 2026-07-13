import * as THREE from "three";

const fract = (value) => value - Math.floor(value);
const fade = (value) => value * value * (3 - 2 * value);

function latticeValue(x, z) {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}

function smoothNoise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const tz = fade(z - z0);
  const top = THREE.MathUtils.lerp(
    latticeValue(x0, z0),
    latticeValue(x0 + 1, z0),
    tx,
  );
  const bottom = THREE.MathUtils.lerp(
    latticeValue(x0, z0 + 1),
    latticeValue(x0 + 1, z0 + 1),
    tx,
  );
  return THREE.MathUtils.lerp(top, bottom, tz);
}

export function terrainHeight(x, z) {
  const broad = (smoothNoise(x * 0.018, z * 0.018) - 0.5) * 9.5;
  const rolling = (smoothNoise(x * 0.048 + 19, z * 0.048 - 7) - 0.5) * 3.2;
  const detail = (smoothNoise(x * 0.11 - 31, z * 0.11 + 13) - 0.5) * 0.7;
  return broad + rolling + detail;
}

export function seededUnit(index, salt = 0) {
  return latticeValue(index * 17 + salt * 101, index * 29 - salt * 43);
}

export function makeTerrainGeometry(originX, originZ, size, resolution) {
  const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const low = new THREE.Color("#075a37");
  const middle = new THREE.Color("#147b48");
  const high = new THREE.Color("#4f8e6a");
  const color = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const worldX = originX + positions.getX(index);
    const worldZ = originZ + positions.getZ(index);
    const height = terrainHeight(worldX, worldZ);
    positions.setY(index, height);
    const elevationMix = THREE.MathUtils.clamp((height + 4) / 11, 0, 1);
    color
      .copy(elevationMix < 0.62 ? low : middle)
      .lerp(elevationMix < 0.62 ? middle : high, elevationMix);
    const variation = (seededUnit(index, originX + originZ) - 0.5) * 0.055;
    colors[index * 3] = color.r + variation;
    colors[index * 3 + 1] = color.g + variation;
    colors[index * 3 + 2] = color.b + variation;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
