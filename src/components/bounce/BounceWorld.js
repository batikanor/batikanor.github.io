"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CAT_OPTIONS, createCatAvatarSet } from "../cats/catAvatars";
import ExperienceThemePicker, {
  useExperienceTheme,
} from "../experience/ExperienceThemePicker";
import { GAME_MODES } from "./courseBlueprints";
import styles from "./BounceWorld.module.css";

const PLAYER_RADIUS = 0.4;
const PLAYER_HALF_HEIGHT = 0.72;

function formatRunTime(seconds) {
  if (seconds === null || !Number.isFinite(seconds)) return "--:--.-";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(1).padStart(4, "0")}`;
}


function makeFloorLabel(level, instruction) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 300;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.fillStyle = "rgba(255,255,255,.45)";
  context.font = "700 54px monospace";
  context.fillText(`STAGE ${String(level).padStart(2, "0")}`, 512, 92);
  context.fillStyle = "rgba(255,255,255,.88)";
  context.font = "800 58px sans-serif";
  context.fillText(instruction.toUpperCase(), 512, 190, 920);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSignalLabel(text, color = "#dffaff") {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(3, 7, 12, .84)";
  context.fillRect(8, 8, 624, 112);
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.strokeRect(8, 8, 624, 112);
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "800 42px monospace";
  context.fillText(text, 320, 65, 580);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose?.();
      object.material?.map?.dispose?.();
    });
  }
}

function createGoalSignal(position, answer = null) {
  const group = new THREE.Group();
  group.position.fromArray(position);
  const inactiveColor = new THREE.Color(0x63ddff);
  const activeColor = new THREE.Color(0xffb45e);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x151b24,
    metalness: 0.82,
    roughness: 0.24,
  });
  const glowMaterial = new THREE.MeshPhysicalMaterial({
    color: inactiveColor,
    emissive: inactiveColor,
    emissiveIntensity: 2.2,
    metalness: 0.3,
    roughness: 0.12,
    clearcoat: 0.85,
  });
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: inactiveColor,
    transparent: true,
    opacity: 0.78,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: inactiveColor,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.82, 0.24, 32),
    baseMaterial,
  );
  pedestal.position.y = 0.08;
  pedestal.castShadow = true;
  group.add(pedestal);

  const energyDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.08, 32),
    glowMaterial,
  );
  energyDisc.position.y = 0.24;
  group.add(energyDisc);

  const floorRings = [0.9, 1.18].map((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, index ? 0.018 : 0.03, 8, 72),
      lineMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2 + index * 0.025;
    group.add(ring);
    return ring;
  });

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.56, 2.7, 32, 1, true),
    beamMaterial,
  );
  beam.position.y = 1.58;
  group.add(beam);

  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 2), glowMaterial);
  orb.position.y = 1.65;
  group.add(orb);

  const orbitRings = [0, 1].map((index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.48 + index * 0.12, 0.024, 8, 64),
      lineMaterial,
    );
    ring.position.y = 1.65;
    ring.rotation.set(Math.PI * (0.34 + index * 0.22), index * 0.7, index * 0.45);
    group.add(ring);
    return ring;
  });

  const light = new THREE.PointLight(inactiveColor, 24, 8, 2);
  light.position.y = 1.35;
  group.add(light);

  if (answer?.label) {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(3.15, 0.72),
      new THREE.MeshBasicMaterial({
        map: makeSignalLabel(answer.label),
        transparent: true,
        toneMapped: false,
        depthWrite: false,
      }),
    );
    label.position.set(0, 0.34, 3);
    label.rotation.x = -Math.PI / 2;
    group.add(label);
  }

  group.userData.floorRings = floorRings;
  group.userData.orbitRings = orbitRings;
  group.userData.orb = orb;
  group.userData.beam = beam;
  group.userData.glowMaterial = glowMaterial;
  group.userData.lineMaterial = lineMaterial;
  group.userData.beamMaterial = beamMaterial;
  group.userData.light = light;
  group.userData.activeColor = activeColor;
  group.userData.answer = answer;
  group.userData.visited = false;
  return group;
}

function createFinishSignal(position) {
  const group = new THREE.Group();
  group.position.fromArray(position);
  const lockedColor = new THREE.Color(0x6d7482);
  const readyColor = new THREE.Color(0xffd36b);
  const material = new THREE.MeshPhysicalMaterial({
    color: lockedColor,
    emissive: lockedColor,
    emissiveIntensity: 0.55,
    metalness: 0.76,
    roughness: 0.18,
    clearcoat: 0.9,
  });
  const pillars = [-0.72, 0.72].map((x) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.65, 18), material);
    pillar.position.set(x, 1.32, 0);
    pillar.castShadow = true;
    group.add(pillar);
    return pillar;
  });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.105, 12, 48, Math.PI), material);
  arch.position.y = 2.62;
  group.add(arch);
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 1),
    new THREE.MeshBasicMaterial({ color: lockedColor, toneMapped: false }),
  );
  core.position.y = 1.65;
  group.add(core);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 0.7),
    new THREE.MeshBasicMaterial({
      map: makeSignalLabel("FINISH · LOCKED", "#ffd36b"),
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  label.position.y = 3.92;
  group.add(label);
  const light = new THREE.PointLight(lockedColor, 8, 8, 2);
  light.position.y = 1.6;
  group.add(light);
  group.userData.material = material;
  group.userData.core = core;
  group.userData.light = light;
  group.userData.readyColor = readyColor;
  group.userData.lockedColor = lockedColor;
  group.userData.ready = false;
  group.userData.pillars = pillars;
  group.userData.labelMaterial = label.material;
  return group;
}

function createHazard(position) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xff405d,
    emissive: 0xb8002d,
    emissiveIntensity: 2.8,
    metalness: 0.18,
    roughness: 0.18,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 1.25), material);
  mesh.position.fromArray(position);
  mesh.castShadow = true;
  return mesh;
}



export default function BounceWorld() {
  const mountRef = useRef(null);
  const keyRef = useRef(new Set());
  const startedRef = useRef(false);
  const avatarRef = useRef("whitecat");
  const runStartedAtRef = useRef(0);
  const currentRunTimeRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [stage, setStage] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [avatar, setAvatar] = useState("whitecat");
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [runTime, setRunTime] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [gameMode, setGameMode] = useState("course");
  const [experienceTheme, selectExperienceTheme] = useExperienceTheme();
  const activeStages = GAME_MODES[gameMode].stages;

  const chooseAvatar = useCallback((nextAvatar) => {
    avatarRef.current = nextAvatar;
    setAvatar(nextAvatar);
    setAvatarMenuOpen(false);
  }, []);

  const begin = useCallback(() => {
    runStartedAtRef.current = performance.now();
    currentRunTimeRef.current = 0;
    setRunTime(0);
    startedRef.current = true;
    setStarted(true);
    setFinished(false);
  }, []);

  useEffect(() => {
    const storedBest = Number(window.localStorage.getItem(`catalyst-run-best-time-${gameMode}`));
    if (Number.isFinite(storedBest) && storedBest > 0) setBestTime(storedBest);
    else setBestTime(null);
  }, [gameMode]);

  useEffect(() => {
    if (!started || finished) return undefined;
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - runStartedAtRef.current) / 1000;
      currentRunTimeRef.current = elapsed;
      setRunTime(elapsed);
    }, 100);
    return () => window.clearInterval(timer);
  }, [finished, started]);

  useEffect(() => {
    if (!finished || currentRunTimeRef.current <= 0) return;
    const completedTime = currentRunTimeRef.current;
    setBestTime((currentBest) => {
      const nextBest = currentBest === null ? completedTime : Math.min(currentBest, completedTime);
      window.localStorage.setItem(`catalyst-run-best-time-${gameMode}`, String(nextBest));
      return nextBest;
    });
  }, [finished, gameMode]);

  const hold = useCallback((code, active) => {
    if (active) keyRef.current.add(code);
    else keyRef.current.delete(code);
  }, []);

  useEffect(() => {
    document.body.classList.add("bounce-world-active");
    return () => document.body.classList.remove("bounce-world-active");
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030407);
    scene.fog = new THREE.Fog(0x030407, 18, 62);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 110);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Playable neon platform course");
    mount.appendChild(renderer.domElement);

    const hemisphere = new THREE.HemisphereLight(0x8db4ff, 0x05060a, 0.65);
    scene.add(hemisphere);
    const keyLight = new THREE.SpotLight(0xdceaff, 85, 55, Math.PI * 0.23, 0.6, 1.2);
    keyLight.position.set(-8, 18, 11);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1536, 1536);
    scene.add(keyLight, keyLight.target);
    const blueRim = new THREE.PointLight(0x22cfff, 42, 16, 2);
    blueRim.position.set(0, 4, -4);
    scene.add(blueRim);

    const levelRoot = new THREE.Group();
    scene.add(levelRoot);
    const effectRoot = new THREE.Group();
    scene.add(effectRoot);

    const avatarRoot = new THREE.Group();
    const avatars = createCatAvatarSet();
    Object.values(avatars).forEach((cat) => avatarRoot.add(cat));
    scene.add(avatarRoot);

    const playerPosition = new THREE.Vector3();
    const previousPosition = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    let activeStage = 0;
    let stageData = null;
    let platformMeshes = [];
    let goalGroups = [];
    let finishGroup = null;
    let hazardMeshes = [];
    let crateBodies = [];
    let shockwaves = [];
    let grounded = false;
    let jumpWasHeld = false;
    let transitionDeadline = 0;
    let lastTime = performance.now();
    let frameId;
    let cameraYaw = 0;
    let dragPoint = null;
    let lockedFinishCooldown = 0;

    const resetPlayer = (countDeath = false) => {
      const blueprint = activeStages[activeStage];
      playerPosition.fromArray(blueprint.spawn);
      previousPosition.copy(playerPosition);
      velocity.set(0, 0, 0);
      grounded = false;
      if (countDeath) setDeaths((current) => current + 1);
    };

    const spawnShockwave = (position, color = 0x57eaff) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 64), material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(position);
      ring.position.y += 0.14;
      effectRoot.add(ring);
      shockwaves.push({ ring, age: 0 });
    };

    const buildStage = (index) => {
      clearGroup(levelRoot);
      clearGroup(effectRoot);
      shockwaves = [];
      activeStage = index;
      stageData = activeStages[index];
      platformMeshes = stageData.platforms.map((definition) => {
        const material = new THREE.MeshStandardMaterial({
          color: definition.motion ? 0x252a33 : 0x171a20,
          roughness: 0.72,
          metalness: 0.18,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...definition.size), material);
        mesh.position.fromArray(definition.position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.definition = definition;
        mesh.userData.origin = mesh.position.clone();
        levelRoot.add(mesh);
        return mesh;
      });
      goalGroups = (stageData.goals || []).map((position, goalIndex) => {
        const signal = createGoalSignal(position, stageData.answers?.[goalIndex] || null);
        levelRoot.add(signal);
        return signal;
      });
      finishGroup = stageData.finish ? createFinishSignal(stageData.finish) : null;
      if (finishGroup) levelRoot.add(finishGroup);
      hazardMeshes = (stageData.hazards || []).map((position) => {
        const hazard = createHazard(position);
        levelRoot.add(hazard);
        return hazard;
      });
      crateBodies = (stageData.crates || []).map((position, crateIndex) => {
        const material = new THREE.MeshStandardMaterial({
          color: crateIndex % 2 ? 0x444954 : 0x353a44,
          roughness: 0.46,
          metalness: 0.36,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.82, 0.82), material);
        mesh.position.fromArray(position);
        mesh.castShadow = true;
        levelRoot.add(mesh);
        return { mesh, velocity: new THREE.Vector3(), broken: false };
      });

      const labelTexture = makeFloorLabel(index + 1, stageData.instruction);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 1.6),
        new THREE.MeshBasicMaterial({
          map: labelTexture,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      label.rotation.x = -Math.PI / 2;
      const firstPlatform = stageData.platforms[0];
      const finishNearSpawn = stageData.finish
        && Math.abs(stageData.finish[2] - stageData.spawn[2]) < 2.4;
      label.position.set(
        stageData.spawn[0],
        firstPlatform.position[1] + firstPlatform.size[1] / 2 + 0.012,
        stageData.spawn[2] + (finishNearSpawn ? 0.65 : -0.15),
      );
      levelRoot.add(label);
      blueRim.position.set(
        stageData.goals[0][0],
        stageData.goals[0][1] + 3,
        stageData.goals[0][2],
      );
      resetPlayer(false);
      setStage(index);
      setTransitioning(false);
      transitionDeadline = 0;
      lockedFinishCooldown = 0;
    };

    const die = () => {
      spawnShockwave(playerPosition, 0xff315d);
      resetPlayer(true);
      crateBodies.forEach((crate) => {
        crate.broken = false;
        crate.velocity.set(0, 0, 0);
      });
      if (stageData.crates) {
        crateBodies.forEach((crate, index) => crate.mesh.position.fromArray(stageData.crates[index]));
      }
    };

    buildStage(0);

    const onKeyDown = (event) => {
      keyRef.current.add(event.code);
      if (event.code === "Enter" && !startedRef.current) begin();
      if (event.code === "KeyR" && startedRef.current) die();
    };
    const onKeyUp = (event) => keyRef.current.delete(event.code);
    const onPointerDown = (event) => {
      if (event.target !== renderer.domElement) return;
      dragPoint = event.clientX;
    };
    const onPointerMove = (event) => {
      if (dragPoint === null) return;
      cameraYaw += (event.clientX - dragPoint) * 0.004;
      cameraYaw = THREE.MathUtils.clamp(cameraYaw, -0.7, 0.7);
      dragPoint = event.clientX;
    };
    const onPointerUp = () => {
      dragPoint = null;
    };
    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width < 720 ? 54 : 43;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const render = (time) => {
      const delta = Math.min((time - lastTime) / 1000, 0.045);
      lastTime = time;
      const elapsed = time / 1000;

      platformMeshes.forEach((mesh) => {
        const motion = mesh.userData.definition.motion;
        if (!motion) return;
        const offset = Math.sin(elapsed * motion.speed + (motion.phase || 0)) * motion.range;
        mesh.position.copy(mesh.userData.origin);
        mesh.position[motion.axis] += offset;
      });

      if (startedRef.current && !finished && transitionDeadline === 0) {
        previousPosition.copy(playerPosition);
        const keys = keyRef.current;
        const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const targetSpeed = sprinting ? 9.2 : 5.1;
        let inputX = 0;
        let inputZ = 0;
        if (keys.has("KeyA") || keys.has("ArrowLeft")) inputX -= 1;
        if (keys.has("KeyD") || keys.has("ArrowRight")) inputX += 1;
        if (keys.has("KeyW") || keys.has("ArrowUp")) inputZ -= 1;
        if (keys.has("KeyS") || keys.has("ArrowDown")) inputZ += 1;
        const inputLength = Math.hypot(inputX, inputZ) || 1;
        const acceleration = 1 - Math.exp(-delta * (grounded ? 13 : 4.5));
        velocity.x = THREE.MathUtils.lerp(velocity.x, (inputX / inputLength) * targetSpeed, acceleration);
        velocity.z = THREE.MathUtils.lerp(velocity.z, (inputZ / inputLength) * targetSpeed, acceleration);
        if (inputX === 0) velocity.x *= Math.exp(-delta * (grounded ? 9 : 1.4));
        if (inputZ === 0) velocity.z *= Math.exp(-delta * (grounded ? 9 : 1.4));
        const jumpHeld = keys.has("Space") || keys.has("KeyJ");
        if (jumpHeld && !jumpWasHeld && grounded) {
          velocity.y = 7.6;
          grounded = false;
          spawnShockwave(playerPosition, 0xffffff);
        }
        jumpWasHeld = jumpHeld;
        velocity.y -= 18.5 * delta;
        playerPosition.addScaledVector(velocity, delta);

        grounded = false;
        if (velocity.y <= 0) {
          let highestLanding = -Infinity;
          platformMeshes.forEach((mesh) => {
            const definition = mesh.userData.definition;
            const halfX = definition.size[0] / 2;
            const halfZ = definition.size[2] / 2;
            const top = mesh.position.y + definition.size[1] / 2;
            const inside =
              Math.abs(playerPosition.x - mesh.position.x) <= halfX + PLAYER_RADIUS * 0.55 &&
              Math.abs(playerPosition.z - mesh.position.z) <= halfZ + PLAYER_RADIUS * 0.55;
            const previousBottom = previousPosition.y - PLAYER_HALF_HEIGHT;
            const currentBottom = playerPosition.y - PLAYER_HALF_HEIGHT;
            if (inside && previousBottom >= top - 0.14 && currentBottom <= top + 0.12) {
              highestLanding = Math.max(highestLanding, top);
            }
          });
          if (highestLanding > -Infinity) {
            playerPosition.y = highestLanding + PLAYER_HALF_HEIGHT;
            velocity.y = 0;
            grounded = true;
          }
        }

        crateBodies.forEach((crate) => {
          if (!crate.broken && crate.mesh.position.distanceTo(playerPosition) < 1.25) {
            crate.broken = true;
            crate.velocity
              .subVectors(crate.mesh.position, playerPosition)
              .normalize()
              .multiplyScalar(3.8 + Math.random() * 2.5);
            crate.velocity.y = 3.5 + Math.random() * 2.3;
            spawnShockwave(crate.mesh.position, 0x9bc8ff);
          }
          if (crate.broken) {
            crate.velocity.y -= 12 * delta;
            crate.mesh.position.addScaledVector(crate.velocity, delta);
            crate.mesh.rotation.x += delta * crate.velocity.z;
            crate.mesh.rotation.z -= delta * crate.velocity.x;
          }
        });

        for (const hazard of hazardMeshes) {
          if (
            Math.hypot(playerPosition.x - hazard.position.x, playerPosition.z - hazard.position.z) < 0.78 &&
            Math.abs(playerPosition.y - hazard.position.y) < 1.3
          ) {
            die();
            break;
          }
        }
        if (playerPosition.y < -7) die();

        for (const goal of goalGroups) {
          if (goal.userData.visited) continue;
          const distance = Math.hypot(playerPosition.x - goal.position.x, playerPosition.z - goal.position.z);
          if (distance < 0.96 && Math.abs(playerPosition.y - goal.position.y) < 1.7) {
            if (goal.userData.answer && !goal.userData.answer.correct) {
              spawnShockwave(goal.position, 0xff315d);
              goal.userData.glowMaterial.color.set(0xff315d);
              goal.userData.glowMaterial.emissive.set(0xff315d);
              die();
              break;
            }
            goal.userData.visited = true;
            const activeColor = goal.userData.activeColor;
            goal.userData.glowMaterial.color.copy(activeColor);
            goal.userData.glowMaterial.emissive.copy(activeColor);
            goal.userData.glowMaterial.emissiveIntensity = 3.8;
            goal.userData.lineMaterial.color.copy(activeColor);
            goal.userData.beamMaterial.color.copy(activeColor);
            goal.userData.beamMaterial.opacity = 0.3;
            goal.userData.light.color.copy(activeColor);
            goal.userData.light.intensity = 42;
            goal.userData.orb.scale.setScalar(1.45);
            spawnShockwave(goal.position, 0xffb45e);
          }
        }
        const activationComplete = stageData.answers
          ? goalGroups.some((goal) => goal.userData.answer?.correct && goal.userData.visited)
          : goalGroups.length > 0 && goalGroups.every((goal) => goal.userData.visited);

        if (finishGroup) {
          if (activationComplete && !finishGroup.userData.ready) {
            finishGroup.userData.ready = true;
            const readyColor = finishGroup.userData.readyColor;
            finishGroup.userData.material.color.copy(readyColor);
            finishGroup.userData.material.emissive.copy(readyColor);
            finishGroup.userData.material.emissiveIntensity = 2.2;
            finishGroup.userData.core.material.color.copy(readyColor);
            finishGroup.userData.light.color.copy(readyColor);
            finishGroup.userData.light.intensity = 34;
            finishGroup.userData.labelMaterial.map.dispose();
            finishGroup.userData.labelMaterial.map = makeSignalLabel(
              "FINISH · READY",
              "#fff3bd",
            );
            finishGroup.userData.labelMaterial.needsUpdate = true;
            spawnShockwave(finishGroup.position, 0xffd36b);
          }
          const finishDistance = Math.hypot(
            playerPosition.x - finishGroup.position.x,
            playerPosition.z - finishGroup.position.z,
          );
          if (finishDistance < 1.05 && Math.abs(playerPosition.y - finishGroup.position.y) < 1.8) {
            if (activationComplete) {
              transitionDeadline = time + 1500;
            } else if (time > lockedFinishCooldown) {
              lockedFinishCooldown = time + 900;
              spawnShockwave(finishGroup.position, 0xff405d);
            }
          }
        } else if (activationComplete) {
          transitionDeadline = time + 1800;
        }
      }

      if (transitionDeadline && time >= transitionDeadline - 520) {
        setTransitioning(true);
      }
      if (transitionDeadline && time >= transitionDeadline) {
        transitionDeadline = 0;
        if (activeStage >= activeStages.length - 1) {
          startedRef.current = false;
          setFinished(true);
          setTransitioning(false);
        } else {
          buildStage(activeStage + 1);
        }
      }

      goalGroups.forEach((goal, index) => {
        const speed = goal.userData.visited ? 1.7 : 0.7;
        goal.userData.floorRings[0].rotation.z += delta * speed;
        goal.userData.floorRings[1].rotation.z -= delta * speed * 0.62;
        goal.userData.orbitRings[0].rotation.y += delta * speed;
        goal.userData.orbitRings[0].rotation.z += delta * speed * 0.43;
        goal.userData.orbitRings[1].rotation.x -= delta * speed * 0.54;
        goal.userData.orbitRings[1].rotation.z += delta * speed * 0.7;
        goal.userData.orb.rotation.y += delta * speed * 1.4;
        goal.userData.orb.position.y =
          1.65 + Math.sin(elapsed * 2.2 + index) * (goal.userData.visited ? 0.1 : 0.055);
        goal.userData.beamMaterial.opacity =
          (goal.userData.visited ? 0.25 : 0.12) +
          Math.sin(elapsed * 2.5 + index) * (goal.userData.visited ? 0.08 : 0.035);
      });
      if (finishGroup) {
        finishGroup.userData.core.rotation.y += delta * (finishGroup.userData.ready ? 2.8 : 0.7);
        finishGroup.userData.core.rotation.x += delta * 0.45;
        const breathe = 1 + Math.sin(elapsed * 3.2) * (finishGroup.userData.ready ? 0.12 : 0.035);
        finishGroup.userData.core.scale.setScalar(breathe);
      }
      shockwaves.forEach((effect) => {
        effect.age += delta;
        const scale = 1 + effect.age * 6.5;
        effect.ring.scale.setScalar(scale);
        effect.ring.material.opacity = Math.max(0, 0.9 - effect.age * 1.25);
      });
      shockwaves = shockwaves.filter((effect) => {
        if (effect.age < 0.75) return true;
        effectRoot.remove(effect.ring);
        effect.ring.geometry.dispose();
        effect.ring.material.dispose();
        return false;
      });

      avatarRoot.position.copy(playerPosition);
      avatarRoot.position.y += Math.sin(time * 0.008) * 0.025;
      Object.entries(avatars).forEach(([id, cat]) => {
        cat.visible = id === avatarRef.current;
      });
      const cameraDistance = mount.clientWidth < 720 ? 12 : 13.5;
      desiredCamera.set(
        playerPosition.x + Math.sin(cameraYaw) * cameraDistance,
        playerPosition.y + (mount.clientWidth < 720 ? 7 : 7.8),
        playerPosition.z + Math.cos(cameraYaw) * cameraDistance,
      );
      camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * 4.5));
      lookTarget.copy(playerPosition);
      lookTarget.z -= 2.5;
      camera.lookAt(lookTarget);
      const activeCat = avatars[avatarRef.current];
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
      if (activeCat.userData.dimension === "2d") {
        activeCat.quaternion.copy(camera.quaternion);
      } else if (horizontalSpeed > 0.18) {
        const facing = Math.atan2(-velocity.x, -velocity.z);
        activeCat.rotation.y = THREE.MathUtils.lerp(
          activeCat.rotation.y,
          facing,
          1 - Math.exp(-delta * 9),
        );
        activeCat.rotation.z = Math.sin(time * 0.014) * 0.035;
      }
      keyLight.position.set(playerPosition.x - 8, playerPosition.y + 18, playerPosition.z + 11);
      keyLight.target.position.copy(playerPosition);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      clearGroup(levelRoot);
      clearGroup(effectRoot);
      avatarRoot.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose?.();
        object.material?.map?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [activeStages, begin, finished, gameMode]);

  const moveButton = (label, code, className) => (
    <button
      className={className}
      type="button"
      aria-label={`Move ${label}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        hold(code, true);
      }}
      onPointerUp={() => hold(code, false)}
      onPointerCancel={() => hold(code, false)}
    >
      {label}
    </button>
  );

  return (
    <main
      className={styles.game}
      data-experience-theme={experienceTheme}
      ref={mountRef}
    >
      <div className={styles.grain} aria-hidden="true" />
      <Link href="/" className={styles.home}>← Main menu</Link>
      <ExperienceThemePicker
        className={styles.themePicker}
        theme={experienceTheme}
        onChange={selectExperienceTheme}
      />

      {!started && !finished && (
        <section className={styles.intro}>
          <h1>CATALYST<br /><span>RUN</span></h1>
          <div className={styles.introRule} />
          <p>Run. Jump. Think. Activate the course and reach the finish signal.</p>
          <span className={styles.choiceLabel}>Choose a game mode</span>
          <div className={styles.modePicker} aria-label="Choose a game mode">
            {Object.entries(GAME_MODES).map(([id, mode]) => (
              <button
                type="button"
                className={gameMode === id ? styles.catOptionActive : ""}
                onClick={() => setGameMode(id)}
                key={id}
              >
                <strong>{mode.label}</strong>
                <small>{mode.description}</small>
              </button>
            ))}
          </div>
          <span className={styles.choiceLabel}>Choose a cat</span>
          <div className={styles.catPicker} aria-label="Choose a cat">
            {CAT_OPTIONS.map((option) => (
              <button
                type="button"
                className={avatar === option.id ? styles.catOptionActive : ""}
                onClick={() => chooseAvatar(option.id)}
                key={option.id}
              >
                <span>
                  {option.id === "whitecat" ? "🐈" : option.id === "blackcat" ? "🐈‍⬛" : "▦🐱"}
                </span>
                <strong>{option.label}</strong>
                <small>{option.type}</small>
              </button>
            ))}
          </div>
          <button type="button" onClick={begin}>START RUN</button>
          <small>BEST · {formatRunTime(bestTime)}</small>
          <small>WASD · SPACE · SHIFT · R</small>
        </section>
      )}

      {finished && (
        <section className={styles.intro}>
          <p>COURSE COMPLETE</p>
          <h1>RUN<br /><span>COMPLETE</span></h1>
          <p>
            {formatRunTime(runTime)} · {deaths} resets · best {formatRunTime(bestTime)}
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            PLAY AGAIN
          </button>
        </section>
      )}

      {started && (
        <>
          <button
            type="button"
            className={styles.catMenuButton}
            onClick={() => setAvatarMenuOpen((current) => !current)}
          >
            CAT · {CAT_OPTIONS.find((option) => option.id === avatar)?.label}
          </button>
          {avatarMenuOpen && (
            <div className={styles.catMenu} aria-label="Change cat">
              {CAT_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={avatar === option.id ? styles.catOptionActive : ""}
                  onClick={() => chooseAvatar(option.id)}
                  key={option.id}
                >
                  <strong>{option.label}</strong>
                  <small>{option.type}</small>
                </button>
              ))}
            </div>
          )}
          <div className={styles.hud}>
            <span>{GAME_MODES[gameMode].shortLabel} · {String(stage + 1).padStart(2, "0")} / {activeStages.length}</span>
            <strong>{activeStages[stage].instruction}</strong>
            <span>TIME {formatRunTime(runTime)} · RESETS {String(deaths).padStart(2, "0")}</span>
          </div>
          <div className={styles.keyboardHelp}>WASD MOVE · SPACE JUMP · SHIFT SPRINT · R RESET</div>
          <div className={styles.touchMove} aria-label="Touch movement controls">
            {moveButton("↑", "KeyW", styles.up)}
            {moveButton("←", "KeyA", styles.left)}
            {moveButton("↓", "KeyS", styles.down)}
            {moveButton("→", "KeyD", styles.right)}
          </div>
          <button
            className={styles.jump}
            type="button"
            onPointerDown={() => hold("Space", true)}
            onPointerUp={() => hold("Space", false)}
            onPointerCancel={() => hold("Space", false)}
          >
            JUMP
          </button>
        </>
      )}

      <div className={`${styles.transition} ${transitioning ? styles.transitionActive : ""}`} />
    </main>
  );
}
