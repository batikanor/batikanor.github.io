const WORLD_METRES_PER_PIXEL = 78271.51696; // MapLibre's 512px Mercator world.
const MAX_ZOOM = 21.35;
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Frame the physical playground inside the existing elevated exhibition. */
export function exhibitGameCamera(center, width, {height = 800, baseM = 0, scale = 4,
  floorM = 7.28, hero = false, headerBottom = 72, footerTop = height - 114,
  gameRect = null, includeSigns = false} = {}) {
  width = Math.max(32, finite(width, 800));
  height = Math.max(32, finite(height, 800));
  scale = hero ? 1 : Math.max(.1, finite(scale, 4));
  baseM = hero ? 0 : Math.max(0, finite(baseM, 0));
  floorM = hero ? 0 : Math.max(0, finite(floorM, 7.28));
  const pitch = 54, bearing = 0, angle = pitch * Math.PI / 180;
  const sin = Math.sin(angle), cos = Math.cos(angle), distance = height * 1.5;
  const horizontalInset = Math.min(24, width * .06);
  // Actual chrome is respected whenever it leaves room. A compressed or
  // overlapping layout still yields a finite, positive camera fitting area.
  const minimumHeight = Math.min(48, height * .3);
  const chromeTop = clamp(finite(headerBottom, 72) + 8, 8, height - 8 - minimumHeight);
  const chromeBottom = clamp(finite(footerTop, height - 114) - 8, chromeTop + minimumHeight, height - 8);
  const safeLeft=clamp(finite(gameRect?.left,finite(gameRect?.x,horizontalInset)),horizontalInset,width-horizontalInset-16);
  const safeRight=clamp(finite(gameRect?.right,gameRect?finite(gameRect.x,0)+finite(gameRect.width,width):width-horizontalInset),safeLeft+16,width-horizontalInset);
  const safeTop=clamp(finite(gameRect?.top,finite(gameRect?.y,chromeTop)),chromeTop,chromeBottom-minimumHeight);
  const safeBottom=clamp(finite(gameRect?.bottom,gameRect?finite(gameRect.y,chromeTop)+finite(gameRect.height,chromeBottom-chromeTop):chromeBottom),safeTop+minimumHeight,chromeBottom);
  const safeMiddle = (safeTop + safeBottom) / 2;
  const safeMiddleX=(safeLeft+safeRight)/2;
  const lower = baseM + floorM * scale, upper = baseM + (floorM + 4.7) * scale;
  const halfWidth = (includeSigns?10.45:6.8) * scale,halfDepth=6.8*scale;
  const points = [];
  for (const x of [-halfWidth, halfWidth]) for (const north of [-halfDepth, halfDepth])
    for (const altitude of [lower, upper]) points.push([x, north, altitude]);

  function projectedBounds(mpp, offset,offsetX=0) {
    // easeTo offset moves the ground target before perspective projection;
    // adding pixels to the raised objects afterward gives the wrong framing.
    const shift = -offset * distance / (distance * cos + offset * sin);
    const horizontal=offsetX*(distance+shift*sin)/distance;
    const bounds = {left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity};
    for (const [east, north, altitude] of points) {
      const n = shift + north / mpp, z = altitude / mpp;
      const depth = distance + n * sin - z * cos;
      if (!(depth > 0)) return null;
      const x = width / 2 + distance * (horizontal+east / mpp) / depth;
      const y = height / 2 - distance * (n * cos + z * sin) / depth;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
    }
    return bounds;
  }

  function fitAt(mpp) {
    let forward = 0;
    for (const [, north, altitude] of points) forward = Math.max(forward, (altitude * cos - north * sin) / mpp);
    let low = -height * .25;
    // This bound keeps the complete box in front of the camera throughout
    // the search, including tall roofs. More offset than whole-globe framing
    // permits a close view of the elevated floor without its ground ladder.
    let high = Math.min(height * 2, (distance * distance * cos / (forward + 1) - distance * cos) / sin);
    if (!(high >= low)) return null;
    for (let i = 0; i < 40; i++) {
      const middle = (low + high) / 2, bounds = projectedBounds(mpp, middle);
      if (!bounds) return null;
      if ((bounds.top + bounds.bottom) / 2 < safeMiddle) low = middle;
      else high = middle;
    }
    const offset = (low + high) / 2;
    let offsetX=0;
    if(Math.abs(safeMiddleX-width/2)>1e-8){
      let left=-width*4,right=width*4;
      for(let i=0;i<36;i++){
        const middle=(left+right)/2,bounds=projectedBounds(mpp,offset,middle);
        if(!bounds)return null;
        if((bounds.left+bounds.right)/2<safeMiddleX)left=middle;else right=middle;
      }
      offsetX=(left+right)/2;
    }
    const bounds=projectedBounds(mpp,offset,offsetX);
    return {offset,offsetX, fits: !!bounds && bounds.left >= safeLeft && bounds.right <= safeRight
      && bounds.top >= safeTop && bounds.bottom <= safeBottom};
  }

  // Being above the highest game point makes the offset fit monotonic. The
  // zoom cap is imposed before fitting, so a capped hero view is centred at
  // its actual zoom instead of reusing an offset from a closer camera.
  const latitude = clamp(finite(center?.[1], 0), -85, 85);
  const worldMpp = WORLD_METRES_PER_PIXEL * Math.cos(latitude * Math.PI / 180);
  const cappedMpp = worldMpp / 2 ** MAX_ZOOM;
  let low = Math.max(cappedMpp, upper / (distance * cos) * 1.025,
    halfWidth * 2 / (safeRight-safeLeft) * .2), high = low;
  let fitted = fitAt(high);
  for (let i = 0; i < 64 && !fitted?.fits; i++) { high *= 1.35; fitted = fitAt(high); }
  for (let i = 0; i < 36; i++) {
    const middle = (low + high) / 2, result = fitAt(middle);
    if (result?.fits) { high = middle; fitted = result; }
    else low = middle;
  }
  return {center, zoom: Math.min(MAX_ZOOM, Math.log2(worldMpp / high)), pitch, bearing,
    offset: [fitted?.offsetX??0, fitted?.offset ?? 0]};
}
