import * as THREE from "three";

export const CAT_OPTIONS = [
  { id: "whitecat", label: "Whitecat", type: "3D" },
  { id: "blackcat", label: "Blackcat", type: "3D" },
  { id: "pixelcat", label: "Pixelcat", type: "2D" },
];

function createThreeDimensionalCat({ fur, accent, eyes }) {
  const cat = new THREE.Group();
  const furMaterial = new THREE.MeshPhysicalMaterial({
    color: fur,
    roughness: 0.42,
    metalness: 0.03,
    clearcoat: 0.25,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: eyes, toneMapped: false });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), furMaterial);
  body.scale.set(0.92, 1.1, 0.86);
  body.position.y = -0.08;
  cat.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), furMaterial);
  head.scale.set(1, 0.9, 0.92);
  head.position.set(0, 0.48, -0.08);
  cat.add(head);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.34, 3), furMaterial);
    ear.position.set(side * 0.23, 0.79, -0.08);
    ear.rotation.z = side * -0.12;
    cat.add(ear);

    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), accentMaterial);
    innerEar.position.set(side * 0.23, 0.79, -0.105);
    innerEar.rotation.z = side * -0.12;
    innerEar.scale.set(0.72, 0.72, 0.35);
    cat.add(innerEar);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), eyeMaterial);
    eye.position.set(side * 0.13, 0.52, -0.39);
    cat.add(eye);
  }

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 8), accentMaterial);
  muzzle.scale.set(1.1, 0.65, 0.55);
  muzzle.position.set(0, 0.38, -0.405);
  cat.add(muzzle);

  for (const x of [-0.24, 0.24]) {
    for (const z of [-0.2, 0.2]) {
      const paw = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.2, 4, 8), furMaterial);
      paw.position.set(x, -0.45, z);
      paw.castShadow = true;
      cat.add(paw);
    }
  }

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.28, -0.17, 0.25),
    new THREE.Vector3(0.55, 0.03, 0.35),
    new THREE.Vector3(0.58, 0.42, 0.25),
    new THREE.Vector3(0.4, 0.64, 0.2),
  ]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 24, 0.07, 8, false), furMaterial);
  cat.add(tail);
  cat.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  cat.userData.dimension = "3d";
  return cat;
}

function createPixelCatCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 512, 512);
  context.imageSmoothingEnabled = false;
  const unit = 32;
  const fill = (x, y, width, height, color) => {
    context.fillStyle = color;
    context.fillRect(x * unit, y * unit, width * unit, height * unit);
  };
  fill(5, 4, 2, 3, "#f4b25f");
  fill(9, 4, 2, 3, "#f4b25f");
  fill(6, 5, 5, 5, "#ffc978");
  fill(4, 9, 8, 5, "#f4b25f");
  fill(3, 12, 2, 3, "#f4b25f");
  fill(10, 12, 2, 3, "#f4b25f");
  fill(12, 8, 2, 2, "#f4b25f");
  fill(13, 7, 1, 2, "#f4b25f");
  fill(7, 7, 1, 1, "#18212a");
  fill(9, 7, 1, 1, "#18212a");
  fill(8, 8, 1, 1, "#ef7d78");
  return canvas;
}

function createPixelCat() {
  const texture = new THREE.CanvasTexture(createPixelCatCanvas());
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  const sprite = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 1.65),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.03,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  sprite.userData.dimension = "2d";
  return sprite;
}

export function createCatAvatarSet() {
  return {
    whitecat: createThreeDimensionalCat({
      fur: 0xf3f1ed,
      accent: 0xf09da0,
      eyes: 0x172027,
    }),
    blackcat: createThreeDimensionalCat({
      fur: 0x12151d,
      accent: 0x30384d,
      eyes: 0x6ff6ff,
    }),
    pixelcat: createPixelCat(),
  };
}
