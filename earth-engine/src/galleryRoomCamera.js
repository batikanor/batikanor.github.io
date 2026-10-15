/** Fit a physical board inside the usable screen while leaving the globe dock visible. */
export function roomSafeArea(width, height, focused = false, dockBounds = null) {
  const phone = width < 700;
  if (!focused) return {left: 0, right: 0, top: 0, bottom: 0};
  const landscape = height < 480 && width > height;
  const safe = landscape ? {left: phone ? 212 : 266, right: 20, top: phone ? 92 : 64, bottom: 20}
    : phone ? {left: 16, right: 16, top: 92, bottom: height <= 620 ? 214 : height <= 740 ? 242 : 268}
    : {left: width <= 900 ? 308 : 372, right: width <= 900 ? 32 : 48, top: 80, bottom: 44};
  // Actual dock bounds include CSS safe-area insets and any device font sizing.
  if (dockBounds) {
    if (phone && !landscape && Number.isFinite(dockBounds.top)) safe.bottom = Math.max(safe.bottom, height - dockBounds.top);
    else if (Number.isFinite(dockBounds.right)) safe.left = Math.max(safe.left, dockBounds.right + 8);
  }
  return safe;
}

/** A wider lens keeps reading approaches inside narrow tablet rooms. */
export function roomCameraFov(width) {return width < 900 ? 65 : 50;}

export function surfaceCameraPlan(surface, viewport, fov = 50) {
  const {width, height} = viewport;
  const safe = roomSafeArea(width, height, true, viewport.dockBounds);
  const usableWidth = Math.max(120, width - safe.left - safe.right);
  const readingWidth = surface.kind === 'link' || surface.type === 'link' ? Math.min(usableWidth, 420) : usableWidth;
  const usableHeight = Math.max(100, height - safe.top - safe.bottom);
  const worldWidth = surface.worldWidth;
  const worldHeight = surface.worldHeight ?? surface.height / surface.width * worldWidth;
  const framePadding = 2 * (surface.framePadding ?? .08);
  const tangent = Math.tan(fov * Math.PI / 360);
  const distance = Math.max(
    Math.max(worldWidth * height / (2 * tangent * readingWidth),
      worldHeight * height / (2 * tangent * usableHeight)) * 1.09,
    // Compact plaques need their tangible frame inside the safe area too.
    (worldWidth + framePadding) * height / (2 * tangent * usableWidth) * 1.02,
    (worldHeight + framePadding) * height / (2 * tangent * usableHeight) * 1.02
  );
  const yaw = surface.rotation?.[1] ?? 0;
  const pitch = surface.rotation?.[0] ?? 0;
  const normal = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const target = [...surface.position];
  const position = target.map((value, index) => value + normal[index] * distance);
  return {position, target, distance, safe, viewOffset: {
    x: width / 2 - (safe.left + usableWidth / 2),
    y: height / 2 - (safe.top + usableHeight / 2)
  }};
}

export function roomDockRectangle(width, height, measured) {
  const phone = width < 700, landscape = height < 480 && width > height;
  const compactDesktop = !phone && height < 480;
  const dockWidth = phone ? 188 : compactDesktop ? 240 : width <= 900 ? 280 : 336;
  const margin = phone ? 16 : compactDesktop ? 18 : width <= 900 ? 20 : 28;
  const globe = phone ? landscape ? 112 : height <= 620 ? 144 : height <= 740 ? 168 : 188
    : compactDesktop ? 180 : height <= 650 ? 220 : width <= 900 ? 280 : 336;
  const bottom = phone ? height <= 620 ? 10 : height <= 740 ? 12 : 18 : compactDesktop ? 12 : 27;
  const gap = phone && height <= 620 ? 2 : 4;
  const chronologyHeight = phone ? 58 : 78;
  return {
    left: (Number.isFinite(measured?.left) ? measured.left : margin) - 8,
    right: (Number.isFinite(measured?.right) ? measured.right : margin + dockWidth) + 8,
    top: (Number.isFinite(measured?.top) ? measured.top : height - globe - chronologyHeight - gap - bottom) - 8,
    bottom: (Number.isFinite(measured?.bottom) ? measured.bottom : height - bottom) + 8
  };
}

function validBounds(bounds) {
  return bounds?.min?.length === 3 && bounds?.max?.length === 3 &&
    [...bounds.min, ...bounds.max].every(Number.isFinite);
}

/** Use the room above the dock while keeping every actual object unobstructed. */
function frontOverviewPlan(station, viewport, fov) {
  const {width, height, dockBounds} = viewport;
  if (!validBounds(station.frontBounds) || !station.frontObjects?.length ||
      !station.frontObjects.every(validBounds)) return null;
  const side = width < 700 ? 16 : width <= 900 ? 32 : 48;
  const safe = {left: side, right: side, top: width < 700 ? 92 : height < 480 ? 64 : 80,
    bottom: width < 700 ? 72 : height < 480 ? 96 : 112};
  const usableWidth = Math.max(120, width - safe.left - safe.right);
  const usableHeight = Math.max(100, height - safe.top - safe.bottom);
  const bounds = station.frontBounds;
  const target = bounds.min.map((value, index) => (value + bounds.max[index]) / 2);
  const focal = height / (2 * Math.tan(fov * Math.PI / 360));
  const dock = roomDockRectangle(width, height, dockBounds);
  const evaluate = cameraZ => {
    const boxes = station.frontObjects.map(object => {
      const points = [];
      for (const x of [object.min[0], object.max[0]])
        for (const y of [object.min[1], object.max[1]])
          for (const z of [object.min[2], object.max[2]]) {
            const scale = focal / (cameraZ - z);
            points.push([width / 2 + (x - target[0]) * scale, height / 2 - (y - target[1]) * scale]);
          }
      return {left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])),
        top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1]))};
    });
    const left = Math.min(...boxes.map(box => box.left));
    const right = Math.max(...boxes.map(box => box.right));
    const offsetY = Math.min(...boxes.map(box => box.top)) - safe.top;
    const minimumX = right - (width - safe.right);
    let maximumX = left - safe.left;
    for (const box of boxes) {
      if (box.top - offsetY < dock.bottom && box.bottom - offsetY > dock.top) {
        maximumX = Math.min(maximumX, box.left - dock.right - 1);
      }
    }
    // Center the room when space permits, shifting right only as far as the
    // globe requires. This leaves room to turn toward either media wing.
    const centeredX = (left + right) / 2 - (safe.left + usableWidth / 2);
    const viewOffset = {x: Math.max(minimumX, Math.min(centeredX, maximumX)), y: offsetY};
    const fits = boxes.every(box => {
      const left = box.left - viewOffset.x, right = box.right - viewOffset.x;
      const top = box.top - viewOffset.y, bottom = box.bottom - viewOffset.y;
      const overlapsDock = left < dock.right && right > dock.left && top < dock.bottom && bottom > dock.top;
      return left >= safe.left && right <= safe.left + usableWidth &&
        bottom <= safe.top + usableHeight && !overlapsDock;
    });
    return {fits: fits && minimumX <= maximumX, viewOffset};
  };
  let near = bounds.max[2] + .1, far = near + 8, result = evaluate(far);
  for (let attempt = 0; !result.fits && attempt < 10; attempt++) {
    far = bounds.max[2] + (far - bounds.max[2]) * 1.5;
    result = evaluate(far);
  }
  if (!result.fits || far - bounds.min[2] >= 160) return null;
  for (let step = 0; step < 26; step++) {
    const middle = (near + far) / 2, candidate = evaluate(middle);
    if (candidate.fits) {far = middle; result = candidate;} else near = middle;
  }
  // A small physical cushion keeps antialiasing and the tangible frame off UI.
  far += .04;
  result = evaluate(far);
  return {target, position: [target[0], target[1], far], distance: far - target[2], safe,
    viewOffset: result.viewOffset, dock, frontObjects: station.frontObjects.length};
}

/** Frame the main display wall; additional angled screens stay within a short turn. */
export function overviewCameraPlan(station, viewport, fov = 50) {
  const wall = station.wallLayout;
  if (Number.isFinite(wall?.worldHeight) && wall.worldHeight > 0) {
    const target = [station.anchor?.[0] ?? station.lookAt[0], wall.worldHeight / 2, wall.wallZ ?? -2.72];
    const distance = wall.worldHeight / (2 * Math.tan(fov * Math.PI / 360));
    return {target, position: [target[0], target[1], target[2] + distance], distance,
      safe: {left: 0, right: 0, top: 0, bottom: 0}, viewOffset: {x: 0, y: 0},
      dock: roomDockRectangle(viewport.width, viewport.height, viewport.dockBounds)};
  }
  const optimized = frontOverviewPlan(station, viewport, fov);
  if (optimized) return optimized;
  const {width, height, dockBounds} = viewport;
  const safe = roomSafeArea(width, height, true, dockBounds);
  // The overview shows movement hints above the lower-right contact links.
  if (width >= 700) safe.bottom = Math.max(safe.bottom, height < 480 ? 96 : 112);
  const usableWidth = Math.max(120, width - safe.left - safe.right);
  const usableHeight = Math.max(100, height - safe.top - safe.bottom);
  const tangent = Math.tan(fov * Math.PI / 360);
  const viewOffset = {
    x: width / 2 - (safe.left + usableWidth / 2),
    y: height / 2 - (safe.top + usableHeight / 2)
  };
  const bounds = station.frontBounds;
  if (validBounds(bounds)) {
    const target = bounds.min.map((value, index) => (value + bounds.max[index]) / 2);
    const size = bounds.max.map((value, index) => value - bounds.min[index]);
    const distance = Math.max(size[0] * height / (2 * tangent * usableWidth),
      size[1] * height / (2 * tangent * usableHeight)) * 1.07 + size[2] / 2;
    return {target, position: [target[0], target[1], target[2] + distance], distance, safe, viewOffset};
  }
  const target = [...station.lookAt];
  const original = station.camera.map((value, index) => value - target[index]);
  const baseDistance = Math.hypot(...original);
  const distance = Math.max(baseDistance, 18.3 * height / (2 * tangent * usableWidth) * 1.04);
  return {target, position: target.map((value, index) => value + original[index] / baseDistance * distance),
    distance, safe, viewOffset};
}

/** Camera-relative, normalized movement, so diagonal WASD is not faster. */
export function roomWalkingVector(keys, yaw) {
  let x = Number(keys.has('d')) - Number(keys.has('a'));
  let z = Number(keys.has('s')) - Number(keys.has('w'));
  const length = Math.hypot(x, z);
  if (!length) return [0, 0, 0];
  x /= length; z /= length;
  return [x * Math.cos(yaw) + z * Math.sin(yaw), 0, z * Math.cos(yaw) - x * Math.sin(yaw)];
}

export function roomTransitionDuration(distance, reducedMotion = false) {
  return reducedMotion ? 0 : Math.min(1050, 480 + distance * 22);
}
