"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CAT_OPTIONS, createCatAvatarSet } from "../cats/catAvatars";
import ExperienceThemePicker, {
  useExperienceTheme,
} from "../experience/ExperienceThemePicker";
import {
  GLOBE_RADIUS,
  createCoordinateGrid,
  createCountryOutlines,
  latLngToVector3,
} from "./globeGeometry";
import {
  MAP_WORLD_DEPTH,
  MAP_WORLD_MODES,
  MAP_WORLD_WIDTH,
  createMapCountryOutlines,
  createMapWorldBase,
  createProjectNetwork,
  latLngToMapWorld,
  mapWorldHeight,
} from "./mapWorldGeometry";
import { PROJECT_COUNT, PROJECT_SITES } from "./projectSites";
import { makeTerrainGeometry, seededUnit, terrainHeight } from "./worldMath";
import styles from "./ExploreProjectsWorld.module.css";

const WORLD_TILE_SIZE = 34;
const WORLD_TILE_RADIUS = 2;
const TERRAIN_RESOLUTION = 28;
const GRASS_COUNT = 2800;

function wrapText(context, text, maxWidth, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && context.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.join(" ").split(" ").length < words.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,:]$/, "")}…`;
  }
  return lines;
}

function makeProjectTexture(site, index) {
  const { project } = site;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 500;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(8, 25, 25, .94)");
  gradient.addColorStop(1, "rgba(9, 15, 31, .9)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(132, 255, 211, .75)";
  context.lineWidth = 4;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  context.fillStyle = "#75f2c5";
  context.font = "600 24px monospace";
  context.fillText(
    `PROJECT ${String(index + 1).padStart(2, "0")} / ${PROJECT_COUNT}  ·  ${project.date}`,
    58,
    70,
  );
  context.fillStyle = "#f2fff9";
  context.font = "700 52px sans-serif";
  wrapText(context, project.title, 900, 2).forEach((line, lineIndex) => {
    context.fillText(line, 58, 155 + lineIndex * 58);
  });
  context.fillStyle = "rgba(229, 255, 245, .78)";
  context.font = "28px sans-serif";
  wrapText(context, project.shortDescription, 900, 2).forEach((line, lineIndex) => {
    context.fillText(line, 58, 300 + lineIndex * 40);
  });
  context.fillStyle = "rgba(117, 242, 197, .86)";
  context.font = "600 21px monospace";
  const location = [project.mapData?.city, project.mapData?.country]
    .filter(Boolean)
    .join(", ");
  context.fillText(
    `${project.categories?.join(" · ") || "PROJECT"}  ·  ${location || "REMOTE"}  ·  IMPACT ${project.importance}/10`,
    58,
    445,
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createProjectInstallation(site, index) {
  const group = new THREE.Group();
  group.position.set(site.x, terrainHeight(site.x, site.z), site.z);
  group.userData.homeY = group.position.y;

  const markerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x6fffd0,
    emissive: 0x0d5d4b,
    emissiveIntensity: 1.6,
    transparent: true,
    opacity: 0.78,
    metalness: 0.25,
    roughness: 0.16,
    transmission: 0.1,
  });
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.045, 8, 64),
    markerMaterial,
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.08;
  group.add(halo);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.14, 2.4, 12, 1, true),
    markerMaterial,
  );
  beam.position.y = 1.2;
  group.add(beam);

  const panelMaterial = new THREE.MeshBasicMaterial({
    map: makeProjectTexture(site, index),
    transparent: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.03), panelMaterial);
  panel.position.y = 3.15;
  panel.userData.isProjectPanel = true;
  panel.userData.projectIndex = index;
  group.add(panel);
  group.userData.markerMaterial = markerMaterial;
  group.userData.projectIndex = index;
  return group;
}

function createMapProjectInstallation(site, index, mode, mappedPosition = null) {
  const coordinates = site.project.mapData?.coordinates;
  if (!coordinates) return null;
  const group = new THREE.Group();
  group.position.copy(
    mappedPosition || latLngToMapWorld(coordinates.lat, coordinates.lng, mode),
  );
  group.userData.homeY = group.position.y;
  const color = mode === "night" ? 0x62f4ff : index === 0 ? 0xffc26a : 0x79f6cf;
  const markerMaterial = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: mode === "night" ? 2.5 : 1.25,
    transparent: true,
    opacity: 0.84,
    metalness: 0.42,
    roughness: 0.18,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 48), markerMaterial);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.1;
  group.add(halo);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.16, 2.8, 12, 1, true),
    markerMaterial,
  );
  tower.position.y = 1.4;
  tower.userData.projectIndex = index;
  group.add(tower);
  const hitArea = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.82, 3.4, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitArea.position.y = 1.7;
  hitArea.userData.projectIndex = index;
  hitArea.userData.isProjectHitArea = true;
  group.add(hitArea);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 2.34),
    new THREE.MeshBasicMaterial({
      map: makeProjectTexture(site, index),
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  panel.position.y = 3.45;
  panel.userData.isProjectPanel = true;
  panel.userData.projectIndex = index;
  group.add(panel);
  group.userData.markerMaterial = markerMaterial;
  group.userData.projectIndex = index;
  return group;
}

function getProjectMediaUrl(url) {
  if (!url) return null;
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFile) return `https://drive.google.com/file/d/${driveFile[1]}/preview`;
  const presentation = url.match(/docs\.google\.com\/presentation\/d\/([^/]+)/);
  if (presentation) {
    return `https://docs.google.com/presentation/d/${presentation[1]}/embed?start=false&loop=false&delayms=3000`;
  }
  return url;
}

function cleanDescription(text = "") {
  return text
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .trim();
}

function createSky() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(260, 32, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        upper: { value: new THREE.Color("#182542") },
        lower: { value: new THREE.Color("#8e7fa8") },
      },
      vertexShader: `
        varying vec3 worldDirection;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          worldDirection = normalize(world.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 upper;
        uniform vec3 lower;
        varying vec3 worldDirection;
        void main() {
          float horizon = smoothstep(-0.12, 0.72, worldDirection.y);
          gl_FragColor = vec4(mix(lower, upper, horizon), 1.0);
        }
      `,
    }),
  );
}

export default function ExploreProjectsWorld() {
  const mountRef = useRef(null);
  const movementRef = useRef(new Set());
  const viewRef = useRef("follow");
  const worldModeRef = useRef("landscape");
  const avatarRef = useRef("whitecat");
  const selectedIndexRef = useRef(0);
  const jumpRequestRef = useRef({ index: 0, token: 0 });
  const [viewMode, setViewMode] = useState("follow");
  const [worldMode, setWorldMode] = useState("landscape");
  const [avatar, setAvatar] = useState("whitecat");
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [experienceTheme, selectExperienceTheme] = useExperienceTheme();
  const [pointerLocked, setPointerLocked] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [coordinates, setCoordinates] = useState({ x: 0, z: 8 });
  const [nearestProject, setNearestProject] = useState({ index: 0, distance: 22 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const selectedProject = PROJECT_SITES[selectedIndex].project;
  const selectedMedia = selectedProject.gdrive_embed?.[0];
  const selectedMediaUrl = getProjectMediaUrl(selectedMedia?.url);

  const chooseAvatar = useCallback((nextAvatar) => {
    avatarRef.current = nextAvatar;
    setAvatar(nextAvatar);
    setCatMenuOpen(false);
  }, []);

  const changeWorldMode = useCallback((nextMode) => {
    worldModeRef.current = nextMode;
    setWorldMode(nextMode);
    jumpRequestRef.current = {
      index: selectedIndexRef.current,
      token: jumpRequestRef.current.token + 1,
    };
  }, []);

  const visitProject = useCallback((index, teleport = true) => {
    const normalized = (index + PROJECT_COUNT) % PROJECT_COUNT;
    selectedIndexRef.current = normalized;
    setSelectedIndex(normalized);
    setDetailsOpen(true);
    if (teleport) {
      jumpRequestRef.current = {
        index: normalized,
        token: jumpRequestRef.current.token + 1,
      };
    }
  }, []);

  const toggleView = useCallback(() => {
    setViewMode((current) => {
      const next = current === "follow" ? "eyes" : "follow";
      viewRef.current = next;
      return next;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) mountRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  const togglePointerLock = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    else mountRef.current?.querySelector("canvas")?.requestPointerLock?.();
  }, []);

  const holdDirection = useCallback((code, active) => {
    if (active) movementRef.current.add(code);
    else movementRef.current.delete(code);
  }, []);

  useEffect(() => {
    document.body.classList.add("projects-world-active");
    return () => document.body.classList.remove("projects-world-active");
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050914);
    scene.fog = new THREE.FogExp2(0x6b7190, 0.009);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 340);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Explore Projects World");
    mount.appendChild(renderer.domElement);

    const sky = createSky();
    scene.add(sky);
    scene.add(new THREE.HemisphereLight(0xb7caff, 0x0d452f, 2.2));
    const sun = new THREE.DirectionalLight(0xffe5cb, 3.4);
    sun.position.set(-35, 55, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    scene.add(sun);
    scene.add(sun.target);

    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0,
      flatShading: false,
    });
    const terrainTiles = [];
    const tileCount = (WORLD_TILE_RADIUS * 2 + 1) ** 2;
    for (let index = 0; index < tileCount; index += 1) {
      const tile = new THREE.Mesh(undefined, terrainMaterial);
      tile.receiveShadow = true;
      tile.userData.tileX = Number.NaN;
      tile.userData.tileZ = Number.NaN;
      terrainTiles.push(tile);
      scene.add(tile);
    }

    let activeTileX = Number.NaN;
    let activeTileZ = Number.NaN;
    const refreshTerrain = (x, z) => {
      const centerX = Math.floor(x / WORLD_TILE_SIZE);
      const centerZ = Math.floor(z / WORLD_TILE_SIZE);
      if (centerX === activeTileX && centerZ === activeTileZ) return;
      activeTileX = centerX;
      activeTileZ = centerZ;
      let tileIndex = 0;
      for (let dz = -WORLD_TILE_RADIUS; dz <= WORLD_TILE_RADIUS; dz += 1) {
        for (let dx = -WORLD_TILE_RADIUS; dx <= WORLD_TILE_RADIUS; dx += 1) {
          const tile = terrainTiles[tileIndex];
          const tileX = centerX + dx;
          const tileZ = centerZ + dz;
          if (tile.userData.tileX !== tileX || tile.userData.tileZ !== tileZ) {
            tile.geometry?.dispose();
            tile.geometry = makeTerrainGeometry(
              tileX * WORLD_TILE_SIZE,
              tileZ * WORLD_TILE_SIZE,
              WORLD_TILE_SIZE,
              TERRAIN_RESOLUTION,
            );
            tile.position.set(
              tileX * WORLD_TILE_SIZE,
              0,
              tileZ * WORLD_TILE_SIZE,
            );
            tile.userData.tileX = tileX;
            tile.userData.tileZ = tileZ;
          }
          tileIndex += 1;
        }
      }
    };

    const grassGeometry = new THREE.ConeGeometry(0.052, 0.48, 3);
    grassGeometry.translate(0, 0.24, 0);
    const grassMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      fog: true,
    });
    const grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, GRASS_COUNT);
    grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    grass.receiveShadow = true;
    scene.add(grass);
    const grassTransform = new THREE.Object3D();
    const grassColor = new THREE.Color();
    let grassCenterX = Number.NaN;
    let grassCenterZ = Number.NaN;
    const refreshGrass = (x, z) => {
      const nextX = Math.round(x / 12) * 12;
      const nextZ = Math.round(z / 12) * 12;
      if (nextX === grassCenterX && nextZ === grassCenterZ) return;
      grassCenterX = nextX;
      grassCenterZ = nextZ;
      for (let index = 0; index < GRASS_COUNT; index += 1) {
        const radius = Math.sqrt(seededUnit(index, nextX + nextZ)) * 34;
        const angle = seededUnit(index, nextX - nextZ + 7) * Math.PI * 2;
        const bladeX = nextX + Math.cos(angle) * radius;
        const bladeZ = nextZ + Math.sin(angle) * radius;
        const scale = 0.65 + seededUnit(index, 83) * 1.15;
        grassTransform.position.set(bladeX, terrainHeight(bladeX, bladeZ), bladeZ);
        grassTransform.rotation.y = seededUnit(index, 29) * Math.PI;
        grassTransform.scale.set(0.75 + scale * 0.2, scale, 0.75 + scale * 0.2);
        grassTransform.updateMatrix();
        grass.setMatrixAt(index, grassTransform.matrix);
        grassColor.setHSL(
          0.39 + seededUnit(index, 17) * 0.025,
          0.68,
          0.2 + scale * 0.025,
        );
        grass.setColorAt(index, grassColor);
      }
      grass.instanceMatrix.needsUpdate = true;
      if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    };

    const avatarRoot = new THREE.Group();
    const avatars = createCatAvatarSet();
    Object.values(avatars).forEach((cat) => avatarRoot.add(cat));
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.025, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xb7fff0, transparent: true, opacity: 0.72 }),
    );
    orbit.rotation.x = Math.PI / 2;
    orbit.position.y = -0.46;
    avatarRoot.add(orbit);
    scene.add(avatarRoot);

    const trailGeometry = new THREE.BufferGeometry().setFromPoints(
      PROJECT_SITES.flatMap((site, index) => {
        if (index === PROJECT_SITES.length - 1) return [];
        const next = PROJECT_SITES[index + 1];
        return Array.from({ length: 12 }, (_, step) => {
          const mix = step / 12;
          const x = THREE.MathUtils.lerp(site.x, next.x, mix);
          const z = THREE.MathUtils.lerp(site.z, next.z, mix);
          return new THREE.Vector3(x, terrainHeight(x, z) + 0.1, z);
        });
      }),
    );
    const projectTrail = new THREE.Line(
      trailGeometry,
      new THREE.LineBasicMaterial({
        color: 0x7cf0ca,
        transparent: true,
        opacity: 0.34,
      }),
    );
    scene.add(projectTrail);

    const installations = PROJECT_SITES.map((site, index) => {
      const installation = createProjectInstallation(site, index);
      scene.add(installation);
      return installation;
    });
    const projectPanels = installations.map((installation) =>
      installation.children.find((child) => child.userData.isProjectPanel),
    );

    const globeRoot = new THREE.Group();
    globeRoot.visible = false;
    scene.add(globeRoot);
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0x123d59,
        emissive: 0x071d2b,
        emissiveIntensity: 0.65,
        metalness: 0.18,
        roughness: 0.58,
        clearcoat: 0.42,
      }),
    );
    globeRoot.add(globe);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS + 0.16, 64, 40),
      new THREE.MeshBasicMaterial({
        color: 0x70d9ff,
        transparent: true,
        opacity: 0.055,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    globeRoot.add(atmosphere);
    globeRoot.add(createCoordinateGrid());

    let disposed = false;
    fetch("/data/ne_110m_admin_0_countries.geojson")
      .then((response) => response.json())
      .then((geoJson) => {
        if (disposed) return;
        globeRoot.add(createCountryOutlines(geoJson));
        MAP_WORLD_MODES.forEach((mode) => {
          mapWorlds[mode].root.add(createMapCountryOutlines(geoJson, mode));
        });
      })
      .catch((error) => console.error("Unable to load world boundaries", error));

    const globeMarkers = PROJECT_SITES.map((site, index) => {
      const coordinates = site.project.mapData?.coordinates;
      if (!coordinates) return null;
      const marker = new THREE.Group();
      const surface = latLngToVector3(coordinates.lat, coordinates.lng, GLOBE_RADIUS + 0.05);
      const tip = latLngToVector3(coordinates.lat, coordinates.lng, GLOBE_RADIUS + 0.52);
      const stemGeometry = new THREE.BufferGeometry().setFromPoints([surface, tip]);
      const color = index === 0 ? 0xffc26a : 0x79f6cf;
      marker.add(
        new THREE.Line(
          stemGeometry,
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
        ),
      );
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 12, 10),
        new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      );
      dot.position.copy(tip);
      dot.userData.projectIndex = index;
      marker.add(dot);
      marker.userData.dot = dot;
      marker.userData.localTip = tip;
      marker.userData.projectIndex = index;
      globeRoot.add(marker);
      return marker;
    }).filter(Boolean);
    const globeMarkerMeshes = globeMarkers.map((marker) => marker.userData.dot);
    const globeTargetQuaternion = new THREE.Quaternion();
    const globeYaw = new THREE.Quaternion();
    const globePitch = new THREE.Quaternion();
    const globeXAxis = new THREE.Vector3(1, 0, 0);
    const globeYAxis = new THREE.Vector3(0, 1, 0);
    const globeFront = new THREE.Vector3(0, 0, 1);
    let globeDistance = 16;

    const coordinateGroups = new Map();
    PROJECT_SITES.forEach((site, index) => {
      const coordinates = site.project.mapData?.coordinates;
      if (!coordinates) return;
      const key = `${coordinates.lat.toFixed(4)},${coordinates.lng.toFixed(4)}`;
      coordinateGroups.set(key, [...(coordinateGroups.get(key) || []), index]);
    });

    const mapWorlds = Object.fromEntries(
      MAP_WORLD_MODES.map((mode) => {
        const root = createMapWorldBase(mode);
        root.visible = false;
        scene.add(root);
        const mapInstallations = PROJECT_SITES.map((site, index) => {
          const coordinates = site.project.mapData?.coordinates;
          if (!coordinates) return null;
          const mappedPosition = latLngToMapWorld(coordinates.lat, coordinates.lng, mode);
          const key = `${coordinates.lat.toFixed(4)},${coordinates.lng.toFixed(4)}`;
          const group = coordinateGroups.get(key) || [index];
          if (group.length > 1) {
            const slot = group.indexOf(index);
            const angle = (slot / group.length) * Math.PI * 2;
            mappedPosition.x += Math.cos(angle) * 1.15;
            mappedPosition.z += Math.sin(angle) * 1.15;
            mappedPosition.y = mapWorldHeight(mappedPosition.x, mappedPosition.z, mode);
          }
          return createMapProjectInstallation(site, index, mode, mappedPosition);
        }).filter(Boolean);
        mapInstallations.forEach((installation) => root.add(installation));
        const network = createProjectNetwork(PROJECT_SITES, mode);
        if (network) root.add(network);
        return [
          mode,
          {
            root,
            installations: mapInstallations,
            panels: mapInstallations.map((installation) =>
              installation.children.find((child) => child.userData.isProjectPanel),
            ),
            hitAreas: mapInstallations.map((installation) =>
              installation.children.find((child) => child.userData.isProjectHitArea),
            ),
          },
        ];
      }),
    );

    const player = new THREE.Vector3(0, terrainHeight(0, 8) + 0.05, 8);
    const cameraTarget = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    const lookDirection = new THREE.Vector3();
    const globeCatPosition = new THREE.Vector3();
    let yaw = 0;
    let pitch = -0.08;
    let previousTime = performance.now();
    let frameId;
    let debugUpdate = 0;
    let touchX = null;
    let touchY = null;
    let lastJumpToken = 0;
    let lastNearestIndex = -1;
    let lastAutoOpenedIndex = -1;

    refreshTerrain(player.x, player.z);
    refreshGrass(player.x, player.z);

    const onKeyDown = (event) => {
      movementRef.current.add(event.code);
      if (event.repeat) return;
      if (event.code === "KeyF") toggleFullscreen();
      if (event.code === "KeyP") togglePointerLock();
      if (event.code === "KeyV") toggleView();
      if (event.code === "KeyB") setShowDebug((current) => !current);
      if (event.code === "KeyE" && lastNearestIndex >= 0) {
        visitProject(lastNearestIndex, false);
      }
    };
    const onKeyUp = (event) => movementRef.current.delete(event.code);
    const onMouseMove = (event) => {
      if (worldModeRef.current === "globe" && event.buttons === 1) {
        globeYaw.setFromAxisAngle(globeYAxis, event.movementX * 0.005);
        globePitch.setFromAxisAngle(globeXAxis, event.movementY * 0.005);
        globeTargetQuaternion.premultiply(globeYaw).premultiply(globePitch).normalize();
        return;
      }
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= event.movementX * 0.0023;
      pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0019, -0.55, 0.55);
    };
    const onPointerLockChange = () =>
      setPointerLocked(document.pointerLockElement === renderer.domElement);
    const onTouchStart = (event) => {
      if (event.target !== renderer.domElement) return;
      touchX = event.touches[0]?.clientX ?? null;
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event) => {
      if (touchX === null || touchY === null) return;
      const touch = event.touches[0];
      if (worldModeRef.current === "globe") {
        globeYaw.setFromAxisAngle(globeYAxis, (touch.clientX - touchX) * 0.006);
        globePitch.setFromAxisAngle(globeXAxis, (touch.clientY - touchY) * 0.006);
        globeTargetQuaternion.premultiply(globeYaw).premultiply(globePitch).normalize();
        touchX = touch.clientX;
        touchY = touch.clientY;
        return;
      }
      yaw -= (touch.clientX - touchX) * 0.006;
      pitch = THREE.MathUtils.clamp(
        pitch - (touch.clientY - touchY) * 0.004,
        -0.45,
        0.48,
      );
      touchX = touch.clientX;
      touchY = touch.clientY;
    };
    const onTouchEnd = () => {
      touchX = null;
      touchY = null;
    };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onCanvasClick = (event) => {
      if (document.pointerLockElement === renderer.domElement) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const activeMapWorld = mapWorlds[worldModeRef.current];
      const targets = activeMapWorld
        ? [
            ...activeMapWorld.hitAreas,
            ...activeMapWorld.panels.filter((panel) => panel.visible),
          ]
        : worldModeRef.current === "globe"
          ? globeMarkerMeshes
          : projectPanels;
      const target = raycaster.intersectObjects(targets, false)[0]?.object;
      if (target) visitProject(target.userData.projectIndex, false);
    };
    const onWheel = (event) => {
      if (worldModeRef.current === "globe") {
        globeDistance = THREE.MathUtils.clamp(globeDistance + event.deltaY * 0.008, 10, 26);
      }
    };
    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width < 700 ? 67 : 58;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: true });
    renderer.domElement.addEventListener("touchend", onTouchEnd, { passive: true });
    renderer.domElement.addEventListener("click", onCanvasClick);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

    const render = (time) => {
      const delta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      const globeMode = worldModeRef.current === "globe";
      const mapMode = Boolean(mapWorlds[worldModeRef.current]);
      const landscapeMode = !globeMode && !mapMode;
      const gameplayMode = landscapeMode || mapMode;
      sky.visible = gameplayMode;
      globeRoot.visible = globeMode;
      Object.entries(mapWorlds).forEach(([mode, map]) => {
        map.root.visible = mode === worldModeRef.current;
      });
      grass.visible = landscapeMode;
      projectTrail.visible = landscapeMode;
      terrainTiles.forEach((tile) => {
        tile.visible = landscapeMode;
      });
      installations.forEach((installation) => {
        installation.visible = landscapeMode;
      });
      scene.fog.density = landscapeMode ? 0.009 : mapMode ? 0.0045 : 0.0012;

      const keys = movementRef.current;
      const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
      const speed = mapMode ? (sprinting ? 20 : 11) : sprinting ? 12 : 6.5;
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      velocity.set(0, 0, 0);
      if (gameplayMode) {
        if (keys.has("KeyW") || keys.has("ArrowUp")) velocity.add(forward);
        if (keys.has("KeyS") || keys.has("ArrowDown")) velocity.sub(forward);
        if (keys.has("KeyD") || keys.has("ArrowRight")) velocity.add(right);
        if (keys.has("KeyA") || keys.has("ArrowLeft")) velocity.sub(right);
        if (velocity.lengthSq() > 0) {
          velocity.normalize().multiplyScalar(speed * delta);
          player.add(velocity);
        }
      }
      const jumpRequest = jumpRequestRef.current;
      if (jumpRequest.token !== lastJumpToken) {
        lastJumpToken = jumpRequest.token;
        const destination = PROJECT_SITES[jumpRequest.index];
        if (mapMode) {
          const mapInstallation = mapWorlds[worldModeRef.current].installations.find(
            (installation) => installation.userData.projectIndex === jumpRequest.index,
          );
          if (mapInstallation) {
            const mapPosition = mapInstallation.position;
            player.set(mapPosition.x, mapPosition.y + 0.05, mapPosition.z + 4.5);
            yaw = 0;
            movementRef.current.clear();
          }
        } else if (globeMode) {
          const coordinates = destination.project.mapData?.coordinates;
          if (coordinates) {
            const direction = latLngToVector3(coordinates.lat, coordinates.lng, 1).normalize();
            globeTargetQuaternion.setFromUnitVectors(direction, globeFront);
          }
        } else {
          player.set(
            destination.x,
            terrainHeight(destination.x, destination.z + 5) + 0.05,
            destination.z + 5,
          );
          yaw = 0;
          movementRef.current.clear();
        }
      }
      if (gameplayMode) {
        const groundHeight = landscapeMode
          ? terrainHeight(player.x, player.z)
          : mapWorldHeight(player.x, player.z, worldModeRef.current);
        player.y = THREE.MathUtils.lerp(
          player.y,
          groundHeight + 0.05,
          1 - Math.exp(-delta * 12),
        );
        if (landscapeMode) {
          refreshTerrain(player.x, player.z);
          refreshGrass(player.x, player.z);
        } else {
          player.x = THREE.MathUtils.clamp(
            player.x,
            -MAP_WORLD_WIDTH / 2 + 1,
            MAP_WORLD_WIDTH / 2 - 1,
          );
          player.z = THREE.MathUtils.clamp(
            player.z,
            -MAP_WORLD_DEPTH / 2 + 1,
            MAP_WORLD_DEPTH / 2 - 1,
          );
        }
      }

      Object.entries(avatars).forEach(([id, cat]) => {
        cat.visible = id === avatarRef.current;
      });
      orbit.rotation.z += delta * 0.42;

      if (globeMode) {
        globeRoot.quaternion.slerp(globeTargetQuaternion, 1 - Math.exp(-delta * 4.5));
        desiredCamera.set(0, 0, globeDistance);
        camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * 5.5));
        cameraTarget.set(0, 0, 0);
        camera.lookAt(cameraTarget);
        globeRoot.updateMatrixWorld();
        const selectedMarker = globeMarkers.find(
          (marker) => marker.userData.projectIndex === selectedIndexRef.current,
        );
        if (selectedMarker) {
          globeCatPosition
            .copy(selectedMarker.userData.localTip)
            .applyMatrix4(globeRoot.matrixWorld);
          avatarRoot.position.copy(globeCatPosition);
          avatarRoot.position.y += 0.35;
          avatarRoot.position.z += 0.24;
          avatarRoot.scale.setScalar(0.52);
          avatarRoot.visible = true;
          orbit.visible = false;
          const activeCat = avatars[avatarRef.current];
          activeCat.quaternion.copy(camera.quaternion);
        }
      } else if (viewRef.current === "eyes") {
        avatarRoot.visible = false;
        desiredCamera.copy(player).add(new THREE.Vector3(0, 1.32, 0));
        camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * 16));
        lookDirection.set(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
        cameraTarget.copy(camera.position).add(lookDirection);
        camera.lookAt(cameraTarget);
      } else {
        avatarRoot.visible = true;
        avatarRoot.position.copy(player);
        avatarRoot.position.y += 0.58 + Math.sin(time * 0.0024) * 0.035;
        avatarRoot.scale.setScalar(1);
        orbit.visible = true;
        desiredCamera.set(
          player.x + Math.sin(yaw) * 7.2,
          player.y + 4.1 + pitch * 4,
          player.z + Math.cos(yaw) * 7.2,
        );
        camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * 5.5));
        cameraTarget.copy(player).addScaledVector(forward, 2.2);
        cameraTarget.y += 1.15 + pitch * 3;
        camera.lookAt(cameraTarget);
        const activeCat = avatars[avatarRef.current];
        if (activeCat.userData.dimension === "2d") {
          activeCat.quaternion.copy(camera.quaternion);
        } else {
          activeCat.rotation.y = yaw;
        }
      }

      globeMarkers.forEach((marker) => {
        const selected = marker.userData.projectIndex === selectedIndexRef.current;
        const pulse = selected ? 1.6 + Math.sin(time * 0.004) * 0.25 : 1;
        marker.userData.dot.scale.setScalar(pulse);
        marker.userData.dot.material.color.set(selected ? 0xffc26a : 0x79f6cf);
      });

      Object.entries(mapWorlds).forEach(([mode, map]) => {
        const mapIsActive = mode === worldModeRef.current;
        const visibleInstallations = mapIsActive
          ? map.installations.filter(
              (installation) => installation.userData.projectIndex === selectedIndexRef.current,
            )
          : [];
        const visibleSlots = new Map(
          visibleInstallations.map((installation, slot) => [installation, slot]),
        );
        map.installations.forEach((installation, index) => {
          const panel = installation.children.find((child) => child.userData.isProjectPanel);
          if (panel) {
            const slot = visibleSlots.get(installation);
            panel.visible = slot !== undefined;
            panel.quaternion.copy(camera.quaternion);
            panel.position.x = 0;
            panel.position.y = 3.45 + Math.sin(time * 0.0012 + index) * 0.08;
          }
          const selected = installation.userData.projectIndex === selectedIndexRef.current;
          installation.children[0].rotation.z += delta * (selected ? 1.2 : 0.24);
          installation.userData.markerMaterial.emissiveIntensity = THREE.MathUtils.lerp(
            installation.userData.markerMaterial.emissiveIntensity,
            selected ? 3.8 : 1.35,
            1 - Math.exp(-delta * 5),
          );
        });
      });

      installations.forEach((installation, index) => {
        const panel = installation.children.find((child) => child.userData.isProjectPanel);
        if (panel) {
          panel.quaternion.copy(camera.quaternion);
          panel.position.y = 3.15 + Math.sin(time * 0.0012 + index) * 0.08;
        }
        installation.children[0].rotation.z += delta * (0.18 + index * 0.012);
        const isNearest = index === lastNearestIndex;
        installation.userData.markerMaterial.emissiveIntensity = THREE.MathUtils.lerp(
          installation.userData.markerMaterial.emissiveIntensity,
          isNearest ? 3.4 : 1.6,
          1 - Math.exp(-delta * 5),
        );
      });

      sun.position.x = player.x - 35;
      sun.position.z = player.z + 22;
      sun.target.position.set(player.x, 0, player.z);

      if (time - debugUpdate > 250) {
        debugUpdate = time;
        setCoordinates({ x: Math.round(player.x), z: Math.round(player.z) });
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        PROJECT_SITES.forEach((site, index) => {
          const mapInstallation = mapMode
            ? mapWorlds[worldModeRef.current].installations.find(
                (installation) => installation.userData.projectIndex === index,
              )
            : null;
          const target = mapInstallation?.position || site;
          const distance = Math.hypot(player.x - target.x, player.z - target.z);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });
        lastNearestIndex = nearestIndex;
        setNearestProject((current) =>
          current.index === nearestIndex && Math.round(current.distance) === Math.round(nearestDistance)
            ? current
            : { index: nearestIndex, distance: nearestDistance },
        );
        const entryRadius = mapMode ? 2.1 : 3.2;
        if (nearestDistance < entryRadius && lastAutoOpenedIndex !== nearestIndex) {
          lastAutoOpenedIndex = nearestIndex;
          visitProject(nearestIndex, false);
        } else if (nearestDistance > entryRadius + 1.4) {
          lastAutoOpenedIndex = -1;
        }
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      disposed = true;
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose?.();
        object.material?.map?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [toggleFullscreen, togglePointerLock, toggleView, visitProject]);

  const directionButton = (label, code, className = "") => (
    <button
      className={className}
      type="button"
      aria-label={`Move ${label}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        holdDirection(code, true);
      }}
      onPointerUp={() => holdDirection(code, false)}
      onPointerCancel={() => holdDirection(code, false)}
    >
      {label}
    </button>
  );

  return (
    <main
      className={styles.world}
      data-experience-theme={experienceTheme}
      ref={mountRef}
    >
      <div className={styles.vignette} aria-hidden="true" />
      <Link href="/" className={styles.homeLink}>
        ← Go back to main menu
      </Link>

      <div className={styles.worldModeSwitch} aria-label="World visualization">
        <button
          type="button"
          className={worldMode === "landscape" ? styles.modeActive : ""}
          onClick={() => changeWorldMode("landscape")}
        >
          Project trail
        </button>
        <button
          type="button"
          className={worldMode === "atlas" ? styles.modeActive : ""}
          onClick={() => changeWorldMode("atlas")}
        >
          Atlas Ground
        </button>
        <button
          type="button"
          className={worldMode === "relief" ? styles.modeActive : ""}
          onClick={() => changeWorldMode("relief")}
        >
          Relief Earth
        </button>
        <button
          type="button"
          className={worldMode === "night" ? styles.modeActive : ""}
          onClick={() => changeWorldMode("night")}
        >
          Night Network
        </button>
      </div>

      <button
        type="button"
        className={styles.catSelectorButton}
        onClick={() => setCatMenuOpen((current) => !current)}
      >
        CAT · {CAT_OPTIONS.find((option) => option.id === avatar)?.label}
      </button>
      {catMenuOpen && (
        <div className={styles.catSelectorMenu} aria-label="Choose explorer cat">
          {CAT_OPTIONS.map((option) => (
            <button
              type="button"
              className={avatar === option.id ? styles.catActive : ""}
              onClick={() => chooseAvatar(option.id)}
              key={option.id}
            >
              <strong>{option.label}</strong>
              <small>{option.type}</small>
            </button>
          ))}
        </div>
      )}
      <ExperienceThemePicker
        className={`${styles.themePicker} ${catMenuOpen ? styles.themePickerMenuOpen : ""}`}
        theme={experienceTheme}
        onChange={selectExperienceTheme}
      />

      <nav className={styles.projectAtlas} aria-label="Project atlas">
        <button type="button" onClick={() => visitProject(selectedIndex - 1)} aria-label="Previous project">
          ←
        </button>
        <button
          type="button"
          className={styles.atlasCurrent}
          onClick={() => setDetailsOpen(true)}
        >
          <span>PROJECT {String(selectedIndex + 1).padStart(2, "0")} / {PROJECT_COUNT}</span>
          <strong>{selectedProject.title}</strong>
        </button>
        <button type="button" onClick={() => visitProject(selectedIndex + 1)} aria-label="Next project">
          →
        </button>
      </nav>

      {detailsOpen && (
        <article className={styles.projectDetails}>
          <div className={styles.detailsHeader}>
            <span>
              PROJECT {String(selectedIndex + 1).padStart(2, "0")} / {PROJECT_COUNT}
              {" · "}{selectedProject.categories?.join(" · ")}
            </span>
            <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close project details">
              ×
            </button>
          </div>
          <div className={styles.detailsScroll}>
            <p className={styles.detailsDate}>{selectedProject.date}</p>
            <h1>{selectedProject.title}</h1>
            <p className={styles.detailsLead}>{selectedProject.shortDescription}</p>

            {selectedMediaUrl && (
              <figure className={styles.detailsMedia}>
                <iframe
                  key={`${selectedProject.slug}-${selectedMediaUrl}`}
                  src={selectedMediaUrl}
                  title={selectedMedia?.abovePhotoCaption || `${selectedProject.title} media`}
                  loading="eager"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
                {selectedMedia?.abovePhotoCaption && (
                  <figcaption>{selectedMedia.abovePhotoCaption}</figcaption>
                )}
              </figure>
            )}

            <div className={styles.projectFacts}>
              <div>
                <span>Location</span>
                <strong>
                  {[selectedProject.mapData?.city, selectedProject.mapData?.country]
                    .filter(Boolean)
                    .join(", ") || "Remote"}
                </strong>
              </div>
              <div>
                <span>Impact</span>
                <strong>{selectedProject.importance}/10</strong>
              </div>
            </div>

            {cleanDescription(selectedProject.longDescription)
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p className={styles.detailsBody} key={`${selectedProject.slug}-p-${index}`}>
                  {paragraph}
                </p>
              ))}

            {!!selectedProject.technologies?.length && (
              <div className={styles.projectTags}>
                {selectedProject.technologies.map((technology) => (
                  <span key={technology}>{technology}</span>
                ))}
              </div>
            )}

            {(selectedProject.links?.length > 0 || selectedProject.githubRepo) && (
              <div className={styles.projectLinks}>
                {selectedProject.githubRepo && (
                  <a href={selectedProject.githubRepo} target="_blank" rel="noreferrer">GitHub ↗</a>
                )}
                {selectedProject.links?.map((link) => (
                  <a href={link.url} target="_blank" rel="noreferrer" key={`${link.label}-${link.url}`}>
                    {link.label} ↗
                  </a>
                ))}
              </div>
            )}
          </div>
        </article>
      )}

      <div className={styles.desktopControls} aria-label="World controls">
        <div className={styles.keyCluster}>
          <span className={styles.blank} />
          <kbd>W</kbd>
          <span className={styles.blank} />
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
        </div>
        <span>move</span>
        <button type="button" onClick={toggleFullscreen}><kbd>F</kbd> fullscreen</button>
        <button type="button" onClick={togglePointerLock}>
          <kbd>P</kbd> {pointerLocked ? "release cursor" : "pointer lock"}
        </button>
        <button type="button" onClick={toggleView}><kbd>V</kbd> {viewMode} view</button>
        <button type="button" onClick={() => setShowDebug((current) => !current)}>
          <kbd>B</kbd> field data
        </button>
      </div>

      <div className={styles.mobileControls} aria-label="Touch movement controls">
        {directionButton("↑", "KeyW", styles.up)}
        {directionButton("←", "KeyA", styles.left)}
        {directionButton("↓", "KeyS", styles.down)}
        {directionButton("→", "KeyD", styles.right)}
      </div>
      <button className={styles.mobileView} type="button" onClick={toggleView}>
        {viewMode === "follow" ? "1st person" : "3rd person"}
      </button>

      {showDebug && (
        <aside className={styles.debugPanel}>
          <span>WORLD STREAM</span>
          <strong>X {coordinates.x} · Z {coordinates.z}</strong>
          <small>
            {worldMode === "landscape"
              ? `25 terrain tiles · ${GRASS_COUNT.toLocaleString()} grass instances`
              : "walkable geographic world · exact project coordinates"}
          </small>
        </aside>
      )}

      <div className={styles.caption}>
        {worldMode === "landscape" ? (
          <>
            <span>{PROJECT_COUNT} PROJECT LANDMARKS —</span>
            <strong>
              nearest: {String(nearestProject.index + 1).padStart(2, "0")} · {Math.round(nearestProject.distance)}m
              {nearestProject.distance < 8 ? " · press E or tap to inspect" : ""}
            </strong>
          </>
        ) : (
          <>
            <span>
              {worldMode === "atlas"
                ? "WALKABLE ATLAS"
                : worldMode === "relief"
                  ? "GEOGRAPHIC RELIEF"
                  : "PROJECT CONSTELLATION"}
              {" — "}
            </span>
            <strong>
              nearest: {String(nearestProject.index + 1).padStart(2, "0")} · {Math.round(nearestProject.distance)}m
              {nearestProject.distance < 7 ? " · press E or tap to inspect" : " · exact latitude / longitude"}
            </strong>
          </>
        )}
      </div>
    </main>
  );
}
