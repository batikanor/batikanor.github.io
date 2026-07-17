"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { contestsAndActivities } from "../data/contestsAndActivities";
import ExperienceThemePicker, {
  useExperienceTheme,
} from "./experience/ExperienceThemePicker";
import styles from "./ProjectLab3D.module.css";

const PALETTE = [
  ["#ff8a2a", "#ffcf67"],
  ["#5f4bff", "#b35cff"],
  ["#00b8a9", "#55e6c1"],
  ["#e83e8c", "#ff887b"],
  ["#2878ff", "#60d8ff"],
  ["#7a53ff", "#ff67ba"],
];

const HOMEPAGE_PALETTE = [
  ["#b45309", "#f59e0b"],
  ["#475569", "#cbd5e1"],
  ["#92400e", "#fbbf24"],
  ["#334155", "#94a3b8"],
  ["#78350f", "#fdba74"],
  ["#1f2937", "#f59e0b"],
];

const PROJECT_LAB_THEME_OVERRIDES = {
  aurora: { label: "Portfolio", color: "#f59e0b" },
};

const LAB_PROJECTS = [...contestsAndActivities].sort(
  (first, second) => second.importance - first.importance,
);

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

function isImageMediaUrl(url) {
  return /\.(?:avif|gif|jpe?g|png|webp)(?:\?.*)?$/i.test(url || "");
}

function wrapCanvasText(context, text, maxWidth, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) break;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine && lines.length < maxLines) lines.push(currentLine);

  const consumedWords = lines.join(" ").split(" ").length;
  if (consumedWords < words.length) {
    lines[lines.length - 1] =
      `${lines[lines.length - 1].replace(/[.,;:]$/, "")}…`;
  }

  return lines;
}

function createProjectTexture(project, index, homepageAligned = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  const palette = homepageAligned ? HOMEPAGE_PALETTE : PALETTE;
  const [accentA, accentB] = palette[index % palette.length];

  const background = context.createLinearGradient(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  background.addColorStop(0, homepageAligned ? "#111827" : "#11101d");
  background.addColorStop(0.55, homepageAligned ? "#1f2937" : "#19132b");
  background.addColorStop(1, homepageAligned ? "#0f172a" : "#080812");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(
    canvas.width * 0.76,
    canvas.height * 0.22,
    0,
    canvas.width * 0.76,
    canvas.height * 0.22,
    canvas.width * 0.65,
  );
  glow.addColorStop(0, `${accentA}${homepageAligned ? "7a" : "cc"}`);
  glow.addColorStop(0.34, `${accentB}${homepageAligned ? "2e" : "42"}`);
  glow.addColorStop(1, "transparent");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.translate(canvas.width * 0.76, canvas.height * 0.44);
  context.rotate(-0.28);
  for (let ring = 0; ring < 8; ring += 1) {
    context.strokeStyle = ring % 2 ? `${accentA}66` : `${accentB}44`;
    context.lineWidth = 2;
    context.strokeRect(
      -canvas.width * (0.08 + ring * 0.035),
      -canvas.width * (0.08 + ring * 0.035),
      canvas.width * (0.16 + ring * 0.07),
      canvas.width * (0.16 + ring * 0.07),
    );
  }
  context.restore();

  const pad = 40;
  context.fillStyle = "rgba(255,255,255,0.62)";
  context.font = "600 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(
    `PROJECT ${String(index + 1).padStart(2, "0")} / ${project.date || "UNDATED"}`,
    pad,
    54,
  );

  context.fillStyle = "#fffaf2";
  context.font = "800 38px Inter, Arial, sans-serif";
  const lines = wrapCanvasText(
    context,
    project.title,
    canvas.width * 0.77,
    3,
  );
  const lineHeight = 46;
  const titleTop = 118;
  lines.forEach((line, lineIndex) => {
    context.fillText(line, pad, titleTop + lineIndex * lineHeight);
  });

  const labelY = canvas.height - 45;
  context.fillStyle = accentB;
  context.fillRect(pad, labelY - 28, 82, 4);
  context.fillStyle = "rgba(255,255,255,0.78)";
  context.font = "600 17px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(
    `${project.mapData?.city || "Remote"}  •  ${project.categories?.[0] || "Builder"}`,
    pad,
    labelY,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createBox(width, height, depth, material, position) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material,
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function ProjectLabScene({
  projects,
  selectedIndex,
  onSelect,
  focused,
  theme,
  embedded,
}) {
  const hostRef = useRef(null);
  const selectedRef = useRef(selectedIndex);
  const focusedRef = useRef(focused);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    selectedRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const homepageAligned = theme === "aurora";
    const blendWithHomepage = homepageAligned && embedded;
    const sceneBackground = homepageAligned ? "#111827" : "#090711";

    const scene = new THREE.Scene();
    scene.background = blendWithHomepage
      ? null
      : new THREE.Color(sceneBackground);
    scene.fog = new THREE.Fog(sceneBackground, 10, 28);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0.25, 2.7, 8.3);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: blendWithHomepage,
    });
    if (blendWithHomepage) renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive Three.js project selector",
    );
    host.appendChild(renderer.domElement);

    const contentRoot = new THREE.Group();
    scene.add(contentRoot);

    scene.add(
      new THREE.AmbientLight(homepageAligned ? 0x94a3b8 : 0x8f82b5, 1.05),
    );

    const keyLight = new THREE.DirectionalLight(0xfff2db, 3.2);
    keyLight.position.set(-4, 9, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const violetLight = new THREE.PointLight(
      homepageAligned ? 0x64748b : 0x7b54ff,
      homepageAligned ? 20 : 45,
      12,
    );
    violetLight.position.set(6, 4, 3);
    scene.add(violetLight);

    const orangeLight = new THREE.PointLight(
      homepageAligned ? 0xf59e0b : 0xff6f27,
      homepageAligned ? 22 : 34,
      10,
    );
    orangeLight.position.set(-5, 1, 2);
    scene.add(orangeLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 44),
      new THREE.MeshStandardMaterial({
        color: homepageAligned ? 0x0f172a : 0x0b0811,
        roughness: 0.96,
        metalness: 0.05,
        transparent: blendWithHomepage,
        opacity: blendWithHomepage ? 0.04 : 1,
        depthWrite: !blendWithHomepage,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(
      44,
      64,
      homepageAligned ? 0x6b7280 : 0x855084,
      homepageAligned ? 0x1f2937 : 0x35234d,
    );
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = blendWithHomepage ? 0.18 : 0.62;
    scene.add(grid);

    const compactTextures = projects.map((project, index) =>
      createProjectTexture(project, index, homepageAligned),
    );

    const chainGroup = new THREE.Group();
    contentRoot.add(chainGroup);
    // A proper elongated link rather than a torus: the closed tube has the
    // proportions and alternating interlock of a real forged chain.
    const linkPathPoints = Array.from({ length: 48 }, (_, index) => {
      const angle = (index / 48) * Math.PI * 2;
      return new THREE.Vector3(
        Math.cos(angle) * 0.19,
        Math.sin(angle) * 0.105,
        0,
      );
    });
    const chainGeometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(linkPathPoints, true, "centripetal"),
      64,
      0.024,
      8,
      true,
    );
    const chainMaterial = new THREE.MeshPhysicalMaterial({
      color: homepageAligned ? 0x6b7280 : 0x77747d,
      metalness: 1,
      roughness: 0.19,
      clearcoat: 0.35,
      clearcoatRoughness: 0.16,
    });
    const maxChainLinks = 160;
    const chainLinks = new THREE.InstancedMesh(
      chainGeometry,
      chainMaterial,
      maxChainLinks,
    );
    chainLinks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    chainLinks.castShadow = true;
    chainLinks.receiveShadow = true;
    chainGroup.add(chainLinks);
    const chainLinkTransform = new THREE.Object3D();
    const chainAxis = new THREE.Vector3(1, 0, 0);
    const chainTangent = new THREE.Vector3();
    const chainPosition = new THREE.Vector3();

    const selectorCards = projects.map((project, index) => {
      const group = new THREE.Group();
      contentRoot.add(group);

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: homepageAligned ? 0x374151 : 0x272238,
        metalness: 0.6,
        roughness: 0.28,
      });
      group.add(createBox(3.3, 1.95, 0.18, frameMaterial, [0, 0, 0]));

      const cardMaterial = new THREE.MeshBasicMaterial({
        map: compactTextures[index],
        toneMapped: false,
      });
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(3.08, 1.72),
        cardMaterial,
      );
      card.position.z = 0.105;
      card.userData.projectIndex = index;
      group.add(card);

      return { group, frameMaterial, card };
    });

    const particleCount = 120;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      particlePositions[index * 3] = (Math.random() - 0.5) * 20;
      particlePositions[index * 3 + 1] = Math.random() * 7 + 0.4;
      particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 13 - 2;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: homepageAligned ? 0xf59e0b : 0xff9d62,
        size: 0.035,
        transparent: true,
        opacity: 0.75,
      }),
    );
    scene.add(particles);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const interactiveCards = selectorCards.map((item) => item.card);
    const cameraTarget = new THREE.Vector3();
    const cameraLookAt = new THREE.Vector3();
    let hoveredCard = null;
    let renderedSelection = -1;
    let transition = 0;
    let frameId;
    let lastTime = performance.now();
    let mobileView = false;

    const getPointer = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    };

    const findCard = (event) => {
      getPointer(event);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(interactiveCards, false)[0]?.object;
    };

    const onPointerMove = (event) => {
      hoveredCard = findCard(event) || null;
      renderer.domElement.style.cursor = hoveredCard ? "pointer" : "grab";
    };

    const onClick = (event) => {
      const card = findCard(event);
      if (card) onSelectRef.current(card.userData.projectIndex);
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      mobileView = width <= 800;
      camera.fov = mobileView ? 52 : 42;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const render = (time) => {
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const selection = selectedRef.current;

      if (renderedSelection !== selection) {
        renderedSelection = selection;
        transition = 1;
        selectorCards.forEach((item, index) => {
          const active = index === selection;
          item.frameMaterial.color.set(
            active
              ? homepageAligned
                ? 0xf59e0b
                : 0xff8f3f
              : homepageAligned
                ? 0x374151
                : 0x272238,
          );
          item.frameMaterial.emissive.set(
            active ? (homepageAligned ? 0xb45309 : 0xff5d19) : 0x000000,
          );
          item.frameMaterial.emissiveIntensity = active ? 0.24 : 0;
        });
      }

      transition = Math.max(0, transition - delta * 0.95);
      const kick = Math.sin(transition * Math.PI) * 0.5;
      if (mobileView) {
        cameraTarget.set(
          0,
          focusedRef.current ? 3.6 : 4.8,
          (focusedRef.current ? 10.5 : 14.5) - kick,
        );
        cameraLookAt.set(0, 2.7, 0);
      } else {
        cameraTarget.set(
          0,
          focusedRef.current ? 4.2 : 5.4,
          (focusedRef.current ? 12.5 : 17) - kick,
        );
        cameraLookAt.set(0, 3, 0);
      }
      camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 3.6));
      camera.lookAt(cameraLookAt);

      particles.rotation.y += delta * 0.006;

      const rootInterpolation = 1 - Math.exp(-delta * 5);
      contentRoot.position.y = THREE.MathUtils.lerp(
        contentRoot.position.y,
        mobileView ? 0.5 : 0,
        rootInterpolation,
      );
      const rootScale = THREE.MathUtils.lerp(
        contentRoot.scale.x,
        mobileView ? 0.86 : 1,
        rootInterpolation,
      );
      contentRoot.scale.setScalar(rootScale);

      const visibleTrailItems = [];
      selectorCards.forEach((item, index) => {
        let offset = index - selection;
        if (offset > projects.length / 2) offset -= projects.length;
        if (offset < -projects.length / 2) offset += projects.length;
        const visible = Math.abs(offset) <= (mobileView ? 2 : 3);
        item.group.visible = visible;
        if (!visible) return;
        visibleTrailItems.push({ item, offset });

        let targetX;
        let targetY;
        let targetZ;
        let targetRotation;
        let targetScale;

        if (mobileView) {
          targetX = offset === 0 ? 0 : offset % 2 === 0 ? 1.75 : -1.75;
          targetY = 2.8 - offset * 2.02;
          targetZ = -Math.abs(offset) * 0.7;
          targetRotation = offset === 0 ? 0 : targetX > 0 ? -0.24 : 0.24;
          targetScale = offset === 0 ? 0.92 : 0.5;
        } else {
          const distance = Math.abs(offset);
          const trailCenter = 3.8;
          const trailSpread = 3.8;
          targetX =
            offset === 0
              ? trailCenter
              : offset > 0
                ? distance % 2
                  ? trailCenter + trailSpread
                  : trailCenter - trailSpread
                : distance % 2
                  ? trailCenter - trailSpread
                  : trailCenter + trailSpread;
          targetY = 3 - offset * 1.95;
          targetZ = -distance * 0.68;
          targetRotation =
            offset === 0 ? 0 : targetX > trailCenter ? -0.2 : 0.2;
          targetScale = offset === 0 ? 1.22 : 0.6;
        }
        targetY += Math.sin(time * 0.0008 + index * 0.83) * 0.07;
        targetRotation += Math.sin(time * 0.00065 + index) * 0.018;
        const interpolation = 1 - Math.exp(-delta * 7);
        item.group.position.x = THREE.MathUtils.lerp(
          item.group.position.x,
          targetX,
          interpolation,
        );
        item.group.position.y = THREE.MathUtils.lerp(
          item.group.position.y,
          targetY,
          interpolation,
        );
        item.group.position.z = THREE.MathUtils.lerp(
          item.group.position.z,
          targetZ,
          interpolation,
        );
        item.group.rotation.y = THREE.MathUtils.lerp(
          item.group.rotation.y,
          targetRotation,
          interpolation,
        );
        const nextScale = THREE.MathUtils.lerp(
          item.group.scale.x,
          targetScale,
          interpolation,
        );
        item.group.scale.setScalar(nextScale);
        if (index === selection) {
          item.frameMaterial.emissiveIntensity =
            0.28 + Math.sin(time * 0.003) * 0.09;
        }
      });

      visibleTrailItems.sort((first, second) => first.offset - second.offset);
      let chainLinkIndex = 0;
      for (let itemIndex = 0; itemIndex < visibleTrailItems.length - 1; itemIndex += 1) {
        const start = visibleTrailItems[itemIndex].item.group.position;
        const end = visibleTrailItems[itemIndex + 1].item.group.position;
        const distance = start.distanceTo(end);
        const segmentLinkCount = Math.max(3, Math.round(distance / 0.34));
        const sway = Math.sin(time * 0.00065 + itemIndex * 1.7) * 0.035;
        for (
          let step = 1;
          step <= segmentLinkCount && chainLinkIndex < maxChainLinks;
          step += 1
        ) {
          const progress = step / (segmentLinkCount + 1);
          const sag = Math.sin(progress * Math.PI) * (0.16 + distance * 0.018);
          chainPosition.lerpVectors(start, end, progress);
          chainPosition.y -= sag;
          chainPosition.z -= 0.24 + Math.sin(progress * Math.PI) * 0.08;

          chainTangent.subVectors(end, start);
          chainTangent.y -=
            Math.cos(progress * Math.PI) *
            Math.PI *
            (0.16 + distance * 0.018);
          chainTangent.normalize();

          chainLinkTransform.position.copy(chainPosition);
          chainLinkTransform.quaternion.setFromUnitVectors(chainAxis, chainTangent);
          chainLinkTransform.rotateX(
            (chainLinkIndex % 2) * (Math.PI / 2) + sway,
          );
          chainLinkTransform.scale.setScalar(1);
          chainLinkTransform.updateMatrix();
          chainLinks.setMatrixAt(chainLinkIndex, chainLinkTransform.matrix);
          chainLinkIndex += 1;
        }
      }
      chainLinks.count = chainLinkIndex;
      chainLinks.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      compactTextures.forEach((texture) => texture.dispose());
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material?.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [embedded, projects, theme]);

  return <div ref={hostRef} className={styles.canvasHost} />;
}

export default function ProjectLab3D({ embedded = false }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const [experienceTheme, selectExperienceTheme] = useExperienceTheme();
  const wheelLocked = useRef(false);
  const pointerStart = useRef(null);
  const selectedProject = LAB_PROJECTS[selectedIndex];
  const selectedMedia = selectedProject.gdrive_embed?.[0];
  const selectedMediaUrl = getProjectMediaUrl(selectedMedia?.url);

  useEffect(() => {
    const bodyClass = embedded
      ? "project-lab-embedded-active"
      : "project-lab-active";

    document.body.classList.add(bodyClass);
    return () => document.body.classList.remove(bodyClass);
  }, [embedded]);

  const selectRelative = useCallback((direction) => {
    setSelectedIndex(
      (current) =>
        (current + direction + LAB_PROJECTS.length) % LAB_PROJECTS.length,
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (["ArrowRight", "ArrowDown"].includes(event.key)) selectRelative(1);
      if (["ArrowLeft", "ArrowUp"].includes(event.key)) selectRelative(-1);
      if (event.key.toLowerCase() === "z") setFocused((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectRelative]);

  const handleWheel = (event) => {
    if (wheelLocked.current || Math.abs(event.deltaY) < 8) return;
    wheelLocked.current = true;
    selectRelative(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => {
      wheelLocked.current = false;
    }, 420);
  };

  const handlePointerDown = (event) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event) => {
    if (!pointerStart.current) return;
    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;
    pointerStart.current = null;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 55) return;
    selectRelative(
      Math.abs(deltaX) > Math.abs(deltaY)
        ? deltaX < 0
          ? 1
          : -1
        : deltaY < 0
          ? 1
          : -1,
    );
  };

  return (
    <section
      className={styles.lab}
      data-experience-theme={experienceTheme}
      data-embedded={embedded ? "true" : undefined}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-label="Interactive 3D project lab"
    >
      <ProjectLabScene
        projects={LAB_PROJECTS}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        focused={focused}
        theme={experienceTheme}
        embedded={embedded}
      />

      {!embedded && (
        <div className={styles.topBar}>
          <Link href="/" className={styles.homeLink}>
            <span aria-hidden="true">←</span> Go back to main menu
          </Link>
        </div>
      )}
      <ExperienceThemePicker
        className={styles.themePicker}
        theme={experienceTheme}
        onChange={selectExperienceTheme}
        overrides={PROJECT_LAB_THEME_OVERRIDES}
      />

      <article
        className={styles.monitorWindow}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className={styles.monitorScroll}>
          <div className={styles.monitorKicker}>
            <span>
              Project {String(selectedIndex + 1).padStart(2, "0")} of {LAB_PROJECTS.length}
              {" · "}
              {selectedProject.categories?.join(" · ") || "Project"}
            </span>
            <span>{selectedProject.date}</span>
          </div>
          <p className={styles.monitorLead}>{selectedProject.shortDescription}</p>

          {selectedMediaUrl && (
            <figure className={styles.monitorMedia}>
              {isImageMediaUrl(selectedMediaUrl) ? (
                <img
                  key={`${selectedProject.slug}-${selectedMediaUrl}`}
                  src={selectedMediaUrl}
                  alt={selectedMedia.abovePhotoCaption || `${selectedProject.title} media`}
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <iframe
                  key={`${selectedProject.slug}-${selectedMediaUrl}`}
                  src={selectedMediaUrl}
                  title={selectedMedia.abovePhotoCaption || `${selectedProject.title} media`}
                  loading="eager"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              )}
              {selectedMedia.abovePhotoCaption && (
                <figcaption>{selectedMedia.abovePhotoCaption}</figcaption>
              )}
              {selectedMedia.credit && (
                <figcaption>{selectedMedia.credit}</figcaption>
              )}
            </figure>
          )}

          <div className={styles.monitorFacts}>
            <div>
              <span>Location</span>
              <strong>
                {[selectedProject.mapData?.city, selectedProject.mapData?.country]
                  .filter(Boolean)
                  .join(", ") || "Remote"}
              </strong>
            </div>
            <div>
              <span>Recognition</span>
              <strong>Importance {selectedProject.importance}/10</strong>
            </div>
          </div>

          {selectedProject.longDescription && (
            <div className={styles.monitorAbout}>
              <h2>About this project</h2>
              {selectedProject.longDescription
                .replace(/\{\{[^}]+\}\}/g, "")
                .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                .replace(/[*_#]/g, "")
                .split(/\n\s*\n/)
                .filter(Boolean)
                .map((paragraph, paragraphIndex) => (
                  <p key={`${selectedProject.slug}-${paragraphIndex}`}>
                    {paragraph}
                  </p>
                ))}
            </div>
          )}

          {selectedProject.technologies?.length > 0 && (
            <div className={styles.monitorSection}>
              <h2>Built with</h2>
              <div className={styles.monitorTags}>
                {selectedProject.technologies.map((technology) => (
                  <span key={technology}>{technology}</span>
                ))}
              </div>
            </div>
          )}

          <div className={styles.monitorActions}>
            <Link href={`/projects#${selectedProject.slug}`}>
              Open the full project entry <span aria-hidden="true">↗</span>
            </Link>
            {selectedProject.links?.slice(0, 3).map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>
      </article>

      <p className={styles.trailHint}>
        <span>
          {String(selectedIndex + 1).padStart(2, "0")} / {LAB_PROJECTS.length}
        </span>
      </p>

      <div className={styles.controls}>
        <button
          type="button"
          onClick={() => selectRelative(-1)}
          aria-label="Previous project"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => selectRelative(1)}
          aria-label="Next project"
        >
          →
        </button>
      </div>

      <div className={styles.vignette} aria-hidden="true" />
    </section>
  );
}
