import { useMemo } from "react";
import * as THREE from "three";

// Custom Plane Marker component
const PlaneMarker = ({ lat, lng }) => {
  const planeMesh = useMemo(() => {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 1); // A simple box representing the plane
    const material = new THREE.MeshStandardMaterial({ color: "orange" });
    return new THREE.Mesh(geometry, material);
  }, []);

  return (
    <mesh position={new THREE.Vector3(lng, lat, 0.1)}> {/* Adjust position */}
      {planeMesh}
    </mesh>
  );
};
