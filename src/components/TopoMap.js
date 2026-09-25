"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { contestsAndActivities } from "../data/contestsAndActivities";
import MarkerInfo from "./MarkerInfo";
import {
  FiPlus,
  FiMinus,
  FiRotateCcw,
  FiGlobe,
  FiMoon,
  FiSun,
  FiLayers,
} from "react-icons/fi";

// Damped spring-inertia physics matching Statskog millionen (O.p2)
class SpringDamper {
  constructor(from, to, acc = 0.22, dec = 0.78) {
    this.from = from;
    this.to = to;
    this.acc = acc;
    this.dec = dec;
    this.value = from;
    this.speed = 0;
  }
  update(target) {
    this.speed = (this.speed + (target - this.value) * this.acc) * this.dec;
    this.value += this.speed;
    this.value = Math.min(this.to, Math.max(this.from, this.value));
    return this.value;
  }
  setValue(val) {
    this.speed = 0;
    this.value = Math.min(this.to, Math.max(this.from, val));
    return this.value;
  }
}

// 3D Plane dimensions and projection mapping
const MAP_WIDTH_3D = 160;
const MAP_HEIGHT_3D = 80;
const MIN_LAT = -56;
const MAX_LAT = 76;
const LAT_RANGE = MAX_LAT - MIN_LAT;

function latLngTo3D(lat, lng, z = 2.4) {
  const x = (lng / 180) * (MAP_WIDTH_3D / 2);
  const y = ((lat - MIN_LAT) / LAT_RANGE) * MAP_HEIGHT_3D - MAP_HEIGHT_3D / 2;
  return new THREE.Vector3(x, y, z);
}

// Group raw activities by venue
const processLocations = () => {
  const venueMap = new Map();

  contestsAndActivities.forEach((activity) => {
    if (!activity.mapData?.coordinates) return;
    const { lat, lng } = activity.mapData.coordinates;
    const key = `${activity.mapData.venue}-${activity.mapData.city}-${activity.mapData.country}`;

    if (!venueMap.has(key)) {
      venueMap.set(key, {
        city: activity.mapData.city,
        country: activity.mapData.country,
        coords: [lat, lng],
        pos: latLngTo3D(lat, lng, 2.5),
        venue: activity.mapData.venue,
        achievements: [],
        activities: [],
        totalImportance: 0,
        count: 0,
      });
    }

    const venue = venueMap.get(key);
    venue.achievements.push({
      title: activity.title,
      date: activity.date,
      importance: activity.importance || 5,
      shortDescription: activity.shortDescription,
    });
    venue.activities.push({
      ...activity,
      title: activity.title,
      venue: activity.mapData.venue,
      city: activity.mapData.city,
      country: activity.mapData.country,
      date: activity.date,
      slug: activity.slug,
      shortDescription: activity.shortDescription,
      importance: activity.importance || 5,
    });
    venue.totalImportance += activity.importance || 5;
    venue.count += 1;
  });

  const processed = Array.from(venueMap.values()).map((v) => ({
    ...v,
    type:
      v.totalImportance >= 15
        ? "major"
        : v.totalImportance >= 8
        ? "medium"
        : "minor",
    averageImportance: v.totalImportance / v.count,
    maxImportance: Math.max(...v.achievements.map((a) => a.importance)),
    label: `${v.venue}, ${v.city}`,
  }));

  // Relaxation algorithm to ensure minimum distance of 0.22 between any two venues
  // so close hackathons in Munich, Berlin, Zurich etc. never overlap or occlude when zooming in!
  const MIN_DIST = 0.22;
  for (let i = 0; i < processed.length; i++) {
    for (let j = i + 1; j < processed.length; j++) {
      const d = Math.hypot(processed[i].pos.x - processed[j].pos.x, processed[i].pos.y - processed[j].pos.y);
      if (d < 0.001) {
        const angle = j * 1.25;
        processed[j].pos.x += Math.cos(angle) * 0.02;
        processed[j].pos.y += Math.sin(angle) * 0.02;
      }
    }
  }

  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < processed.length; i++) {
      for (let j = i + 1; j < processed.length; j++) {
        const dx = processed[j].pos.x - processed[i].pos.x;
        const dy = processed[j].pos.y - processed[i].pos.y;
        const d = Math.hypot(dx, dy);
        if (d < MIN_DIST && d > 0.0001) {
          const overlap = (MIN_DIST - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          processed[i].pos.x -= nx * overlap * 0.6;
          processed[i].pos.y -= ny * overlap * 0.6;
          processed[j].pos.x += nx * overlap * 0.6;
          processed[j].pos.y += ny * overlap * 0.6;
        }
      }
    }
  }

  return processed;
};

// Distance-based clustering algorithm matching the classic map
// Multi-stage hierarchical clustering algorithm matching classic map & progressive unclustering
function computeClusters(locations, zoomZ) {
  // Deep Zoom (zoomZ <= 28): uncluster into all individual venues
  if (zoomZ <= 28) {
    return locations.map((loc) => ({
      isCluster: false,
      count: loc.count,
      totalImportance: loc.totalImportance,
      maxImportance: loc.maxImportance,
      pos: loc.pos.clone(),
      locations: [loc],
      label: `${loc.venue}, ${loc.city}`,
      city: loc.city,
      country: loc.country,
      key: `venue_${loc.venue}_${loc.city}`,
    }));
  }

  // Stage 1 - Global Overview (zoomZ > 58):
  // The iconic classic 6 clusters: Central Europe (26), Beykoz (2), Barcelona (1), Helsinki (1), Hong Kong (1), Nara (1)
  if (zoomZ > 58) {
    const isCentralEurope = (loc) =>
      loc.coords[0] >= 41.5 &&
      loc.coords[0] <= 55.5 &&
      loc.coords[1] >= 4.0 &&
      loc.coords[1] <= 20.0;

    const ceGroup = [];
    const otherLocations = [];

    locations.forEach((loc) => {
      if (isCentralEurope(loc)) ceGroup.push(loc);
      else otherLocations.push(loc);
    });

    const clusters = [];
    if (ceGroup.length > 0) {
      const sumCount = ceGroup.reduce((sum, item) => sum + item.count, 0);
      const sumImportance = ceGroup.reduce((sum, item) => sum + item.totalImportance, 0);
      const maxImp = Math.max(...ceGroup.map((item) => item.maxImportance));
      const avgX = ceGroup.reduce((sum, item) => sum + item.pos.x, 0) / ceGroup.length;
      const avgY = ceGroup.reduce((sum, item) => sum + item.pos.y, 0) / ceGroup.length;

      clusters.push({
        isCluster: true,
        count: sumCount, // Exactly 26
        totalImportance: sumImportance,
        maxImportance: maxImp,
        pos: new THREE.Vector3(avgX, avgY, 2.5),
        locations: ceGroup,
        label: "Central Europe (13 cities, 26 milestones)",
        city: "Central Europe",
        country: "Europe",
        key: "cluster_central_europe",
      });
    }

    otherLocations.forEach((loc) => {
      clusters.push({
        isCluster: loc.count > 1,
        count: loc.count,
        totalImportance: loc.totalImportance,
        maxImportance: loc.maxImportance,
        pos: loc.pos.clone(),
        locations: [loc],
        label: `${loc.venue}, ${loc.city}`,
        city: loc.city,
        country: loc.country,
        key: `venue_${loc.city}_${loc.venue}`,
      });
    });

    return clusters;
  }

  // Stage 2 & 3 - Progressive Hierarchical Breakdown:
  // Zooming in breaks down into sub-clusters before becoming 1s!
  // At zoom 42..58: regional clusters (Munich/Salzburg: 10, Berlin/East: 8, Switzerland: 5, etc.)
  // At zoom 28..42: city clusters (Munich: 9, Berlin: 4, Zurich: 3, Cottbus: 2, etc.)
  const threshold = zoomZ > 42 ? 1.35 : 0.55;
  const assigned = new Set();
  const clusters = [];

  locations.forEach((loc, i) => {
    if (assigned.has(i)) return;
    const group = [loc];
    assigned.add(i);

    const queue = [loc];
    while (queue.length > 0) {
      const cur = queue.pop();
      locations.forEach((other, j) => {
        if (!assigned.has(j)) {
          const dist = Math.hypot(cur.pos.x - other.pos.x, cur.pos.y - other.pos.y);
          if (dist <= threshold) {
            group.push(other);
            assigned.add(j);
            queue.push(other);
          }
        }
      });
    }

    const sumCount = group.reduce((sum, item) => sum + item.count, 0);
    const sumImportance = group.reduce((sum, item) => sum + item.totalImportance, 0);
    const maxImp = Math.max(...group.map((item) => item.maxImportance));
    const avgX = group.reduce((sum, item) => sum + item.pos.x, 0) / group.length;
    const avgY = group.reduce((sum, item) => sum + item.pos.y, 0) / group.length;

    const isGroup = group.length > 1;
    const uniqueCities = [...new Set(group.map((item) => item.city))];
    const label = isGroup
      ? `${uniqueCities.slice(0, 2).join(", ")}${uniqueCities.length > 2 ? ` & ${uniqueCities.length - 2} more` : ""}`
      : `${group[0].venue}, ${group[0].city}`;

    clusters.push({
      isCluster: isGroup,
      count: sumCount,
      totalImportance: sumImportance,
      maxImportance: maxImp,
      pos: new THREE.Vector3(avgX, avgY, 2.5),
      locations: group,
      label,
      city: isGroup ? `${uniqueCities.join(", ")}` : group[0].city,
      country: group[0].country,
      key: `cluster_${uniqueCities[0]}_${sumCount}_${i}`,
    });
  });

  return clusters;
}

// Generate high-DPI cluster badge textures in warm amber/gold theme
const textureCache = new Map();

function getClusterTexture(count) {
  if (textureCache.has(count)) return textureCache.get(count);

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const isSingle = count === 1;
  const isLarge = count > 9;
  const badgeRadius = isLarge ? 96 : isSingle ? 90 : 93;
  const auraRadius = badgeRadius + 14;

  // Soft, clean circular aura glow in warm amber
  const aura = ctx.createRadialGradient(128, 128, badgeRadius * 0.6, 128, 128, auraRadius);
  aura.addColorStop(0, isSingle ? "rgba(251, 191, 36, 0.85)" : "rgba(255, 235, 170, 0.95)");
  aura.addColorStop(0.5, isSingle ? "rgba(245, 158, 11, 0.4)" : "rgba(251, 191, 36, 0.5)");
  aura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(128, 128, auraRadius, 0, Math.PI * 2);
  ctx.fill();

  // Central cluster pill (dark warm obsidian bronze)
  const badgeGrad = ctx.createRadialGradient(128, 128, 4, 128, 128, badgeRadius);
  badgeGrad.addColorStop(0, "#3a200e");
  badgeGrad.addColorStop(0.7, "#221307");
  badgeGrad.addColorStop(1, "#120a04");
  ctx.fillStyle = badgeGrad;
  ctx.beginPath();
  ctx.arc(128, 128, badgeRadius, 0, Math.PI * 2);
  ctx.fill();

  // Glowing ring border in warm amber
  ctx.strokeStyle = "rgba(251, 191, 36, 0.95)";
  ctx.lineWidth = isSingle ? 8 : 9;
  ctx.beginPath();
  ctx.arc(128, 128, badgeRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Bold, prominent number text - prominently sized to be clearly legible
  ctx.fillStyle = "#ffffff";
  const fontSize = isSingle ? 136 : isLarge ? 114 : 126;
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
  ctx.shadowBlur = 10;
  ctx.fillText(String(count), 128, 131);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  textureCache.set(count, texture);
  return texture;
}

export const MAP_STYLES = [
  {
    id: "satellite-hybrid",
    name: "Satellite Topo Hybrid",
    icon: FiGlobe,
    config: {
      baseTexture: "satellite-warm",
      satellite: true,
      nightLights: false,
      contours: true,
      terraces: false,
    },
  },
  {
    id: "night-lights",
    name: "Satellite Night Metropolis",
    icon: FiMoon,
    config: {
      baseTexture: "none",
      satellite: false,
      nightLights: true,
      contours: true,
      terraces: false,
    },
  },
  {
    id: "natural-satellite",
    name: "True-Color Earth Satellite",
    icon: FiSun,
    config: {
      baseTexture: "satellite-natural",
      satellite: true,
      nightLights: false,
      contours: true,
      terraces: false,
    },
  },
  {
    id: "warm-topo",
    name: "Classic Warm Topo",
    icon: FiLayers,
    config: {
      baseTexture: "none",
      satellite: false,
      nightLights: false,
      contours: false,
      terraces: true,
    },
  },
];

export default function TopoMap({ navigateWithRefresh, isSiteBackground = false }) {
  const containerRef = useRef(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  // Map visualization state: 4 curated styles
  const [visualMode, setVisualMode] = useState("satellite-hybrid");
  const [layers, setLayers] = useState(MAP_STYLES[0].config);

  // References for HUD actions & visual layers sync
  const controlsRef = useRef({
    zoomIn: () => {},
    zoomOut: () => {},
    resetView: () => {},
  });
  const updateVisualsRef = useRef(null);

  // Synchronize visual mode & layer toggles with Three.js scene
  useEffect(() => {
    if (updateVisualsRef.current) {
      updateVisualsRef.current(visualMode, layers);
    }
  }, [visualMode, layers]);

  const handleSelectMode = (modeId, config) => {
    setVisualMode(modeId);
    setLayers(config);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId;
    let isDisposed = false;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0806);

    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
    const baseZ = 84;
    camera.position.set(10, 5, baseZ);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.outline = "none";
    container.appendChild(renderer.domElement);

    // 2. Spring-Damper Inertia Physics
    const panLimits = {
      x: [-72, 72],
      y: [-36, 36],
      z: [7, 125],
    };

    const pan = { x: 10, y: 5, z: baseZ };
    const panInertia = {
      x: new SpringDamper(panLimits.x[0], panLimits.x[1], 0.2, 0.78),
      y: new SpringDamper(panLimits.y[0], panLimits.y[1], 0.2, 0.78),
      z: new SpringDamper(panLimits.z[0], panLimits.z[1], 0.24, 0.74),
    };
    panInertia.x.setValue(pan.x);
    panInertia.y.setValue(pan.y);
    panInertia.z.setValue(pan.z);

    const mousePos = { x: 0, y: 0 };
    const mouseInertia = {
      x: new SpringDamper(-1, 1, 0.12, 0.85),
      y: new SpringDamper(-1, 1, 0.12, 0.85),
    };

    // HUD Actions
    controlsRef.current.zoomIn = () => {
      const step = pan.z > 45 ? 18 : pan.z > 24 ? 10 : pan.z > 14 ? 5 : 2.5;
      pan.z = Math.max(panLimits.z[0], pan.z - step);
    };
    controlsRef.current.zoomOut = () => {
      const step = pan.z < 14 ? 2.5 : pan.z < 24 ? 5 : pan.z < 45 ? 10 : 18;
      pan.z = Math.min(panLimits.z[1], pan.z + step);
    };
    controlsRef.current.resetView = () => {
      pan.x = 10;
      pan.y = 5;
      pan.z = baseZ;
      mousePos.x = 0;
      mousePos.y = 0;
    };

    // 3. Load Pre-baked Warm Amber Topographic Layers & Visual Extensions
    const textureLoader = new THREE.TextureLoader();
    const planeGeo = new THREE.PlaneGeometry(MAP_WIDTH_3D, MAP_HEIGHT_3D);

    // 3a. Multi-base Satellite and Artistic Landcover Surfaces
    const baseTexturesGroup = new THREE.Group();
    scene.add(baseTexturesGroup);

    const createBaseMesh = (url) => {
      const tex = textureLoader.load(url, (t) => {
        if (isDisposed) return;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
      });
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.position.z = 0.05;
      mesh.visible = false;
      baseTexturesGroup.add(mesh);
      return mesh;
    };

    const meshWarm = createBaseMesh("/topo-world/satellite-warm.jpg");
    const meshNatural = createBaseMesh("/topo-world/satellite-natural.jpg");
    meshWarm.visible = true; // initial active

    // 3b. Satellite Night City Lights (Warm Amber Additive Glow)
    const nightTexture = textureLoader.load("/topo-world/night-lights-amber.jpg", (tex) => {
      if (isDisposed) return;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
    });
    const nightMat = new THREE.MeshBasicMaterial({
      map: nightTexture,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nightMesh = new THREE.Mesh(planeGeo, nightMat);
    nightMesh.position.z = 2.05;
    nightMesh.visible = layers.nightLights;
    scene.add(nightMesh);

    // 3c. Crisp glowing elevation contour lines
    const contourLinesTex = textureLoader.load("/topo-world/contour-lines.png", (tex) => {
      if (isDisposed) return;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
    });
    const contourLinesMat = new THREE.MeshBasicMaterial({
      map: contourLinesTex,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const contourLinesMesh = new THREE.Mesh(planeGeo, contourLinesMat);
    contourLinesMesh.position.z = 1.95;
    contourLinesMesh.visible = layers.contours;
    scene.add(contourLinesMesh);

    // 3h. Stepped Strata Terraces (5 Physical Elevation Slabs)
    const layersGroup = new THREE.Group();
    scene.add(layersGroup);

    const layerConfigs = [
      { url: "/topo-world/layer0.png", z: -0.2 },
      { url: "/topo-world/layer1.png", z: 0.0 },
      { url: "/topo-world/layer2.png", z: 0.6 },
      { url: "/topo-world/layer3.png", z: 1.2 },
      { url: "/topo-world/layer4.png", z: 1.8 },
    ];

    let loadedLayers = 0;
    layerConfigs.forEach(({ url, z }, index) => {
      textureLoader.load(url, (texture) => {
        if (isDisposed) return;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        });

        const mesh = new THREE.Mesh(planeGeo, material);
        mesh.position.z = z;
        mesh.userData = { layerIndex: index };
        layersGroup.add(mesh);

        loadedLayers += 1;
        if (loadedLayers === layerConfigs.length) {
          setIsLoaded(true);
          if (updateVisualsRef.current) {
            updateVisualsRef.current(visualMode, layers);
          }
        }
      });
    });

    // Reactive visualizer update function
    updateVisualsRef.current = (mode, curLayers) => {
      const base = curLayers.baseTexture || "satellite-warm";
      const isSatActive = !!curLayers.satellite && base !== "none";

      meshWarm.visible = isSatActive && base === "satellite-warm";
      meshNatural.visible = isSatActive && base === "satellite-natural";

      if (nightMesh) {
        nightMesh.visible = !!curLayers.nightLights;
        nightMesh.position.z = 2.05;
        nightMesh.material.opacity = mode === "night-lights" ? 0.98 : 0.85;
      }

      if (contourLinesMesh) {
        contourLinesMesh.visible = !!curLayers.contours;
        contourLinesMesh.material.opacity = mode === "night-lights" ? 0.65 : 0.95;
      }

      if (layersGroup) {
        if (curLayers.terraces) {
          layersGroup.visible = true;
          layersGroup.children.forEach((mesh) => {
            if (mesh.material) {
              mesh.visible = true;
              mesh.material.opacity = 1.0;
            }
          });
        } else if (isSatActive) {
          layersGroup.visible = true;
          layersGroup.children.forEach((mesh) => {
            if (mesh.material) {
              const idx = mesh.userData?.layerIndex ?? 0;
              if (idx === 0) {
                mesh.material.opacity = 0.45;
                mesh.visible = true;
              } else {
                mesh.visible = false;
              }
            }
          });
        } else if (curLayers.nightLights) {
          layersGroup.visible = true;
          layersGroup.children.forEach((mesh) => {
            if (mesh.material) {
              const idx = mesh.userData?.layerIndex ?? 0;
              mesh.visible = true;
              if (idx === 0) mesh.material.opacity = 0.2;
              else if (idx === 1) mesh.material.opacity = 0.28;
              else mesh.material.opacity = 0.35;
            }
          });
        } else {
          layersGroup.visible = false;
        }
      }
    };
    updateVisualsRef.current(visualMode, layers);

    // 4. Locations & Clustering
    const allLocations = processLocations();
    let currentClusters = [];
    const markerGroup = new THREE.Group();
    scene.add(markerGroup);

    // Active amber highlight ring
    const ringCanvas = document.createElement("canvas");
    ringCanvas.width = 128;
    ringCanvas.height = 128;
    const rctx = ringCanvas.getContext("2d");
    rctx.strokeStyle = "rgba(251, 191, 36, 0.95)";
    rctx.lineWidth = 5;
    rctx.shadowColor = "rgba(245, 158, 11, 0.9)";
    rctx.shadowBlur = 10;
    rctx.beginPath();
    rctx.arc(64, 64, 48, 0, Math.PI * 2);
    rctx.stroke();
    const ringTex = new THREE.CanvasTexture(ringCanvas);

    const ringMat = new THREE.SpriteMaterial({
      map: ringTex,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const activeRingMesh = new THREE.Sprite(ringMat);
    activeRingMesh.scale.set(6.5, 6.5, 1);
    activeRingMesh.position.set(0, 0, 2.7);
    scene.add(activeRingMesh);

    // Synchronize cluster meshes based on camera zoom with progressive unclustering
    let lastClusteredZoomState = null;

    function updateClusterMeshes(currentZ) {
      let bracket;
      if (currentZ > 58) bracket = "global";
      else if (currentZ > 42) bracket = "regional";
      else if (currentZ > 28) bracket = "metro";
      else bracket = "venues";

      if (lastClusteredZoomState === bracket) return;
      lastClusteredZoomState = bracket;

      // Clear existing sprites
      while (markerGroup.children.length > 0) {
        const child = markerGroup.children[0];
        markerGroup.remove(child);
      }

      currentClusters = computeClusters(allLocations, currentZ);

      currentClusters.forEach((item) => {
        const texture = getClusterTexture(item.count);
        const spriteMat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.copy(item.pos);

        // Size scaling: balanced point sizes so numbers are large, bold, and clear without crowding
        let targetPixelSize;
        if (bracket === "global") {
          targetPixelSize = item.count > 15 ? 34 : item.count > 5 ? 28 : 22;
        } else if (bracket === "regional") {
          targetPixelSize = item.count > 5 ? 28 : item.count > 1 ? 24 : 20;
        } else if (bracket === "metro") {
          targetPixelSize = item.count > 5 ? 25 : item.count > 1 ? 21 : 18;
        } else {
          // Venues level: individual milestones are neat 17px-20px dots with large, clear numbers
          targetPixelSize = item.count > 1 ? 20 : 17;
        }

        const fovFactor = height / (2 * Math.tan((camera.fov * Math.PI) / 360)) || 1086;
        const initialScale = (targetPixelSize * currentZ) / fovFactor;
        sprite.scale.set(initialScale, initialScale, 1);
        sprite.userData = { clusterItem: item, targetPixelSize };
        markerGroup.add(sprite);
      });
    }

    updateClusterMeshes(baseZ);

    // 5. Interaction Handlers: Pan, Zoom, Momentum, Parallax
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panStartX = 0;
    let panStartY = 0;
    let lastDragTime = 0;
    let dragVelocityX = 0;
    let dragVelocityY = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panStartX = pan.x;
      panStartY = pan.y;
      lastDragTime = performance.now();
      dragVelocityX = 0;
      dragVelocityY = 0;
      container.style.cursor = "grabbing";
    };

    const onPointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      mousePos.x = (clientX / rect.width) * 2 - 1;
      mousePos.y = (clientY / rect.height) * 2 - 1;

      if (isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        const now = performance.now();
        const dt = Math.max(1, now - lastDragTime);

        const zoomFactor = pan.z / baseZ;
        const moveScale = 0.08 * zoomFactor;

        const newPanX = panStartX - dx * moveScale;
        const newPanY = panStartY + dy * moveScale;

        dragVelocityX = (newPanX - pan.x) / dt;
        dragVelocityY = (newPanY - pan.y) / dt;

        pan.x = Math.min(panLimits.x[1], Math.max(panLimits.x[0], newPanX));
        pan.y = Math.min(panLimits.y[1], Math.max(panLimits.y[0], newPanY));

        lastDragTime = now;
      } else {
        const mouseNorm = new THREE.Vector2(
          (clientX / rect.width) * 2 - 1,
          -(clientY / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouseNorm, camera);

        let hoverTarget = null;
        const intersects = raycaster.intersectObjects(markerGroup.children);
        if (intersects.length > 0) {
          hoverTarget = intersects[0].object;
        } else {
          let minDist = 32;
          const proj = new THREE.Vector3();
          for (let i = 0; i < markerGroup.children.length; i++) {
            const child = markerGroup.children[i];
            proj.copy(child.position).project(camera);
            const sx = (proj.x * 0.5 + 0.5) * rect.width;
            const sy = (-(proj.y * 0.5) + 0.5) * rect.height;
            const d = Math.hypot(clientX - sx, clientY - sy);
            if (d < minDist) {
              minDist = d;
              hoverTarget = child;
            }
          }
        }

        if (hoverTarget) {
          const item = hoverTarget.userData.clusterItem;
          setHoveredItem(item);
          setTooltipPos({ x: clientX, y: clientY });
          container.style.cursor = "pointer";

          activeRingMesh.position.set(hoverTarget.position.x, hoverTarget.position.y, 2.7);
          const rScale = (hoverTarget.scale.x || 2) * 1.35;
          activeRingMesh.userData = { baseScale: rScale };
          activeRingMesh.scale.set(rScale, rScale, 1);
          activeRingMesh.material.opacity = 0.95;
        } else {
          setHoveredItem(null);
          container.style.cursor = isDragging ? "grabbing" : "grab";
          activeRingMesh.material.opacity = 0;
        }
      }
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      container.style.cursor = "grab";

      // Momentum glide
      const momentumX = dragVelocityX * 90;
      const momentumY = dragVelocityY * 90;
      pan.x = Math.min(panLimits.x[1], Math.max(panLimits.x[0], pan.x + momentumX));
      pan.y = Math.min(panLimits.y[1], Math.max(panLimits.y[0], pan.y + momentumY));

      // Click detection if barely moved
      const totalDist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
      if (totalDist < 8) {
        const rect = container.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const mouseNorm = new THREE.Vector2(
          (clientX / rect.width) * 2 - 1,
          -(clientY / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouseNorm, camera);

        let hitItem = null;
        const intersects = raycaster.intersectObjects(markerGroup.children);
        if (intersects.length > 0) {
          hitItem = intersects[0].object.userData.clusterItem;
        } else {
          // Forgiving click radius: find closest marker within 38px on screen
          let minDist = 38;
          const proj = new THREE.Vector3();
          for (let i = 0; i < markerGroup.children.length; i++) {
            const child = markerGroup.children[i];
            proj.copy(child.position).project(camera);
            const sx = (proj.x * 0.5 + 0.5) * rect.width;
            const sy = (-(proj.y * 0.5) + 0.5) * rect.height;
            const d = Math.hypot(clientX - sx, clientY - sy);
            if (d < minDist) {
              minDist = d;
              hitItem = child.userData.clusterItem;
            }
          }
        }

        if (hitItem) {
          if (hitItem.isCluster) {
            // Clicked a cluster: progressively zoom in step-by-step
            pan.x = hitItem.pos.x;
            pan.y = hitItem.pos.y;
            if (pan.z > 58) {
              pan.z = 46; // Zoom into Regional clusters
            } else if (pan.z > 36) {
              pan.z = 28; // Zoom into Metro clusters
            } else if (pan.z > 18) {
              pan.z = 14; // Zoom into Individual venues
            } else {
              pan.z = 8; // Zoom in extra close
            }
          } else {
            // Clicked an individual venue: center camera on it & open details card
            pan.x = hitItem.pos.x;
            pan.y = hitItem.pos.y;
            pan.z = Math.min(pan.z, 14);
            setSelectedMarker(hitItem.locations[0]);
          }
        }
      }
    };

    const onWheel = (e) => {
      // Pinch-to-zoom on trackpad (ctrlKey is true) or zoom when hovering canvas
      if (e.ctrlKey) {
        e.preventDefault();
        const zoomSpeed = 0.035;
        pan.z = Math.min(panLimits.z[1], Math.max(panLimits.z[0], pan.z + e.deltaY * zoomSpeed));
        return;
      }

      // If scrolling up at the top of the page, zoom in
      if (e.deltaY < 0 && window.scrollY <= 10) {
        if (pan.z > panLimits.z[0]) {
          e.preventDefault();
          pan.z = Math.max(panLimits.z[0], pan.z - 2.5);
        }
      }
      // If zoomed in close and scrolling down at the top of the page, zoom out towards overview
      else if (e.deltaY > 0 && window.scrollY <= 10 && pan.z < baseZ - 2) {
        e.preventDefault();
        pan.z = Math.min(baseZ, pan.z + 2.5);
      }
      // Otherwise allow standard natural page scroll down to Projects & CV
    };

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    container.addEventListener("wheel", onWheel, { passive: false });

    // Expose debug info for automated testing if window is defined
    if (typeof window !== "undefined") {
      window.__getTopoMarkers = () => {
        const rect = container.getBoundingClientRect();
        return markerGroup.children.map((c) => {
          const proj = new THREE.Vector3();
          proj.copy(c.position).project(camera);
          return {
            label: c.userData.clusterItem?.label,
            city: c.userData.clusterItem?.city,
            count: c.userData.clusterItem?.count,
            isCluster: c.userData.clusterItem?.isCluster,
            screenX: Math.round((proj.x * 0.5 + 0.5) * rect.width + rect.left),
            screenY: Math.round((-(proj.y * 0.5) + 0.5) * rect.height + rect.top),
            panZ: pan.z,
          };
        });
      };
      window.__getTopoPan = () => ({ x: pan.x, y: pan.y, z: pan.z });
      window.__setTopoPan = (x, y, z) => {
        if (x !== undefined) pan.x = x;
        if (y !== undefined) pan.y = y;
        if (z !== undefined) pan.z = z;
      };
      window.__getTopoVisualState = () => ({
        satWarmVisible: meshWarm?.visible,
        satNaturalVisible: meshNatural?.visible,
        nightVisible: nightMesh?.visible,
        contoursVisible: contourLinesMesh?.visible,
        terracesVisible: layersGroup?.visible,
      });
      window.__setVisualMode = (modeId) => {
        const style = MAP_STYLES.find((s) => s.id === modeId);
        if (style) {
          handleSelectMode(style.id, style.config);
          if (updateVisualsRef.current) {
            updateVisualsRef.current(style.id, style.config);
          }
        }
      };
      window.__getVisualMode = () => visualMode;
    }

    // 6. Resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        width = entry.contentRect.width || width;
        height = entry.contentRect.height || height;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(container);

    // 7. Render Loop with Statskog Spring Damper Physics
    let startTime = performance.now();

    const animate = () => {
      if (isDisposed) return;
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = (performance.now() - startTime) * 0.001;

      // Update physics
      const currentPanX = panInertia.x.update(pan.x);
      const currentPanY = panInertia.y.update(pan.y);
      const currentPanZ = panInertia.z.update(pan.z);

      // Check if cluster meshes need update
      updateClusterMeshes(currentPanZ);

      // Maintain exact screen pixel size so markers never blow up when zooming in, nor shrink into dots
      const fovFactor = height / (2 * Math.tan((camera.fov * Math.PI) / 360)) || 1086;
      for (let i = 0; i < markerGroup.children.length; i++) {
        const s = markerGroup.children[i];
        if (s.userData?.targetPixelSize) {
          const ws = (s.userData.targetPixelSize * currentPanZ) / fovFactor;
          s.scale.set(ws, ws, 1);
        }
      }

      const tiltX = mouseInertia.x.update(mousePos.x);
      const tiltY = mouseInertia.y.update(mousePos.y);

      // Camera position with 3D parallax tilt
      camera.position.x = currentPanX + tiltX * 3.5;
      camera.position.y = currentPanY - tiltY * 2.2;
      camera.position.z = currentPanZ;
      camera.lookAt(currentPanX * 0.95, currentPanY * 0.95, 0);

      // Pulse active ring
      if (activeRingMesh.material.opacity > 0) {
        const pulse = 1 + Math.sin(elapsed * 5) * 0.08;
        const rScale = (activeRingMesh.userData?.baseScale || 2.5) * pulse;
        activeRingMesh.scale.set(rScale, rScale, 1);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Teardown
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("wheel", onWheel);
      resizeObserver.disconnect();

      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const handleProjectNav = (slug) => {
    setSelectedMarker(null);
    if (navigateWithRefresh) {
      navigateWithRefresh(slug);
      return;
    }
    const projEl = document.getElementById(slug);
    if (projEl) {
      window.history.pushState(null, "", `#${slug}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      const top = projEl.getBoundingClientRect().top + window.scrollY - 30;
      window.scrollTo({ top, behavior: "smooth" });
    } else {
      window.location.href = `/#${slug}`;
    }
  };

  return (
    <div
      className={
        isSiteBackground
          ? "fixed inset-0 w-screen h-screen z-0 overflow-hidden bg-[#0a0806] select-none"
          : "relative w-full rounded-3xl overflow-hidden shadow-2xl border border-amber-950/60 bg-[#0a0806] select-none"
      }
    >
      {/* 3D Map Viewport */}
      <div
        ref={containerRef}
        className={
          isSiteBackground
            ? "w-full h-full cursor-grab active:cursor-grabbing"
            : "w-full h-[580px] sm:h-[680px] cursor-grab active:cursor-grabbing relative"
        }
      />

      {/* Loading Overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0806]/95 backdrop-blur-md z-30 transition-opacity duration-500">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
            <span className="text-xs font-mono tracking-wider uppercase text-amber-400/80">
              Loading Topographic World Map...
            </span>
          </div>
        </div>
      )}

      {/* Bottom Right HUD Controls */}
      <div className="fixed right-6 bottom-6 z-20 flex items-center gap-1.5 bg-[#140e08]/90 border border-amber-500/25 p-1 rounded-2xl shadow-xl backdrop-blur-xl pointer-events-auto">
        {/* 4-Option Style Toggle (No text, just 4 icons) */}
        <div className="flex items-center gap-0.5 bg-[#0b0805]/90 p-0.5 rounded-xl border border-amber-500/20">
          {MAP_STYLES.map((style) => {
            const Icon = style.icon;
            const isActive = visualMode === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => handleSelectMode(style.id, style.config)}
                aria-label={style.name}
                title={style.name}
                className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-amber-400 text-gray-950 shadow-md shadow-amber-950/40"
                    : "text-amber-200/60 hover:text-white hover:bg-amber-500/20"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        <div className="w-[1px] h-4 bg-amber-500/20 my-auto mx-0.5" />

        {/* Zoom Controls */}
        <button
          type="button"
          onClick={() => controlsRef.current.zoomIn()}
          aria-label="Zoom in"
          className="p-2 text-amber-200/80 hover:text-white hover:bg-amber-500/20 rounded-xl transition cursor-pointer"
        >
          <FiPlus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => controlsRef.current.zoomOut()}
          aria-label="Zoom out"
          className="p-2 text-amber-200/80 hover:text-white hover:bg-amber-500/20 rounded-xl transition cursor-pointer"
        >
          <FiMinus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => controlsRef.current.resetView()}
          aria-label="Reset view"
          className="p-2 text-amber-200/80 hover:text-white hover:bg-amber-500/20 rounded-xl transition cursor-pointer"
          title="Reset to global overview"
        >
          <FiRotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Tooltip */}
      {hoveredItem && (
        <div
          className="fixed z-40 pointer-events-none -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 12}px`,
          }}
        >
          <div className="min-w-[220px] max-w-[380px] rounded-xl border border-amber-400/40 bg-[#160f09]/95 px-3 py-2.5 text-left shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-xs text-white">
                {hoveredItem.isCluster
                  ? `${hoveredItem.city}, ${hoveredItem.country}`
                  : `${hoveredItem.locations[0].city}, ${hoveredItem.locations[0].country}`}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold whitespace-nowrap flex-shrink-0">
                {hoveredItem.count} {hoveredItem.count === 1 ? "milestone" : "milestones"}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-amber-200/70">
              {hoveredItem.isCluster
                ? `${hoveredItem.locations.length} venues in this region`
                : hoveredItem.locations[0].venue}
            </div>
            {/* Achievement titles for individual venues */}
            {!hoveredItem.isCluster && hoveredItem.locations[0].achievements && (
              <div className="mt-1.5 pt-1.5 border-t border-amber-400/15 space-y-0.5">
                {hoveredItem.locations[0].achievements.slice(0, 3).map((ach, i) => (
                  <div key={i} className="text-[11px] text-amber-100/90 leading-snug flex items-start gap-1.5">
                    <span className="text-amber-400/70 flex-shrink-0 mt-px">▸</span>
                    <span className="line-clamp-2">{ach.title}</span>
                  </div>
                ))}
                {hoveredItem.locations[0].achievements.length > 3 && (
                  <div className="text-[10px] text-amber-300/50 pl-4">
                    +{hoveredItem.locations[0].achievements.length - 3} more
                  </div>
                )}
              </div>
            )}
            <div className="mt-1.5 text-[10px] text-amber-400/90 font-medium">
              {hoveredItem.isCluster
                ? "Click to zoom into this cluster →"
                : "Click to view achievements →"}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Modal/Drawer — portaled to body to escape z-0 stacking context */}
      {selectedMarker &&
        createPortal(
          <MarkerInfo
            marker={selectedMarker}
            onClose={() => setSelectedMarker(null)}
            navigateWithRefresh={handleProjectNav}
          />,
          document.body
        )}
    </div>
  );
}
