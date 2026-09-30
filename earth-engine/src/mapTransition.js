/**
 * Retain the last painted map while a distant destination's overview tiles
 * become available. The frame is read only inside MapLibre's render callback;
 * enabling preserveDrawingBuffer globally would cost every frame, so do not.
 */
export function createMapTransition(map, {container, overviewSource = 'esa-overview', detailSource = () => 'esa'} = {}) {
  if (!map || !container) throw new TypeError('Map transition needs a map and container');
  const veil = document.createElement('div');
  veil.className = 'map-handoff';
  veil.hidden = true;
  veil.setAttribute('aria-hidden', 'true');
  const frame = document.createElement('img');
  frame.alt = '';
  frame.hidden = true;
  veil.append(frame);
  const cue = document.createElement('div');
  cue.className = 'map-arrival-cue';
  cue.hidden = true;
  cue.setAttribute('role', 'status');
  container.append(veil, cue);
  let token = 0;
  let cleanup = () => {};

  function isLoaded(source) {
    if (!source) return true;
    try { return map.isSourceLoaded(source); }
    catch { return false; }
  }

  function cancel() {
    token++;
    cleanup();
    cleanup = () => {};
    veil.hidden = true;
    cue.hidden = true;
    frame.removeAttribute('src');
    frame.hidden = true;
  }

  function captureFrame() {
    return new Promise(resolve => {
      let settled = false;
      const finish = image => { if (settled) return; settled = true; resolve(image); };
      map.once('render', () => {
        try {
          const data = map.getCanvas().toDataURL('image/jpeg', .66);
          finish(data.length > 5000 ? data : null);
        } catch { finish(null); }
      });
      map.triggerRepaint();
      setTimeout(() => finish(null), 150);
    });
  }

  /** Camera changes are immediate behind the veil; it never waits forever. */
  async function jump(target, label) {
    cancel();
    const current = token;
    const image = await captureFrame();
    if (current !== token) return;
    if (image) { frame.src = image; frame.hidden = false; }
    veil.hidden = false;
    cue.textContent = `Approaching ${label}`;
    const cueDelay = setTimeout(() => { if (current === token) cue.hidden = false; }, 450);
    let elapsed = 0;
    let started = false;
    let released = false;
    let settlingTimer;
    let hardTimeout;
    let cueTimeout;
    const stopObserving = () => {
      map.off('render', progress);
      map.off('sourcedata', progress);
      clearTimeout(hardTimeout);
    };
    const release = () => {
      if (released || current !== token) return;
      released = true;
      veil.classList.add('is-releasing');
      settlingTimer = setTimeout(() => {
        if (current !== token) return;
        veil.hidden = true;
        veil.classList.remove('is-releasing');
        frame.removeAttribute('src');
        frame.hidden = true;
      }, 250);
      if (isLoaded(detailSource())) { cue.hidden = true; stopObserving(); return; }
      cue.textContent = `Refining map detail near ${label}`;
      cue.hidden = false;
      cueTimeout = setTimeout(() => {
        if (current === token) cue.hidden = true;
        stopObserving();
      }, 6000);
    };
    const check = () => {
      if (current !== token || !started) return;
      if (isLoaded(overviewSource) || elapsed > 1800 && isLoaded('nasa')) release();
      if (released && isLoaded(detailSource())) {
        cue.hidden = true;
        clearTimeout(cueTimeout);
        stopObserving();
      }
    };
    const began = performance.now();
    const progress = () => { elapsed = performance.now() - began; check(); };
    map.on('render', progress);
    map.on('sourcedata', progress);
    hardTimeout = setTimeout(release, 2800);
    cleanup = () => {
      clearTimeout(cueDelay);
      clearTimeout(hardTimeout);
      clearTimeout(settlingTimer);
      clearTimeout(cueTimeout);
      stopObserving();
      veil.classList.remove('is-releasing');
    };
    map.jumpTo(target);
    // A source can still report the old viewport's loaded state synchronously
    // after jumpTo; wait until the new camera has rendered once.
    map.once('render', () => { started = true; progress(); });
  }

  return {jump, cancel};
}
