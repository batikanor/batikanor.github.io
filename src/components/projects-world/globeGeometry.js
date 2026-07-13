import * as THREE from "three";

export const GLOBE_RADIUS = 6;

export function latLngToVector3(latitude, longitude, radius = GLOBE_RADIUS) {
  const polar = THREE.MathUtils.degToRad(90 - latitude);
  const azimuth = THREE.MathUtils.degToRad(longitude + 180);
  return new THREE.Vector3(
    -radius * Math.sin(polar) * Math.cos(azimuth),
    radius * Math.cos(polar),
    radius * Math.sin(polar) * Math.sin(azimuth),
  );
}

export function createCoordinateGrid(radius = GLOBE_RADIUS + 0.012) {
  const positions = [];
  const addSegment = (first, second) => {
    positions.push(first.x, first.y, first.z, second.x, second.y, second.z);
  };

  for (let latitude = -75; latitude <= 75; latitude += 15) {
    for (let longitude = -180; longitude < 180; longitude += 3) {
      addSegment(
        latLngToVector3(latitude, longitude, radius),
        latLngToVector3(latitude, longitude + 3, radius),
      );
    }
  }
  for (let longitude = -180; longitude < 180; longitude += 15) {
    for (let latitude = -90; latitude < 90; latitude += 3) {
      addSegment(
        latLngToVector3(latitude, longitude, radius),
        latLngToVector3(latitude + 3, longitude, radius),
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x8ed9d0,
      transparent: true,
      opacity: 0.13,
    }),
  );
}

export function createCountryOutlines(geoJson, radius = GLOBE_RADIUS + 0.035) {
  const positions = [];
  const appendRing = (ring) => {
    for (let index = 1; index < ring.length; index += 1) {
      const [previousLongitude, previousLatitude] = ring[index - 1];
      const [longitude, latitude] = ring[index];
      if (Math.abs(longitude - previousLongitude) > 180) continue;
      const previous = latLngToVector3(previousLatitude, previousLongitude, radius);
      const current = latLngToVector3(latitude, longitude, radius);
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
      color: 0xb9ffe4,
      transparent: true,
      opacity: 0.62,
    }),
  );
}
