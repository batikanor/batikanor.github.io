/**
 * Retain the last painted map while a distant destination's overview tiles
 * become available. The frame is read only inside MapLibre's render callback;
 * enabling preserveDrawingBuffer globally would cost every frame, so do not.
 */
export function createMapTransition(map, {container, overviewSource = 'esa-overview', detailSource = () => 'esa',
  arrivalTiles = () => [], arrivalReady = () => false, qualityRequired = () => false,
  qualityTimeoutMs = 8000, onQualityTimeout = null} = {}) {
  if (!map || !container) throw new TypeError('Map transition needs a map and container');
  if(typeof qualityRequired!=='function' || !Number.isFinite(qualityTimeoutMs) || qualityTimeoutMs<=0
    || (onQualityTimeout!=null && typeof onQualityTimeout!=='function'))
    throw new TypeError('Map transition needs a valid quality policy and bounded timeout');
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
      let timeout;
      const finish = image => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        map.off('render', onRender);
        resolve(image);
      };
      const onRender = () => {
        try {
          const data = map.getCanvas().toDataURL('image/jpeg', .66);
          finish(data.length > 5000 ? data : null);
        } catch { finish(null); }
      };
      map.once('render', onRender);
      timeout = setTimeout(() => finish(null), 150);
      // A canceled capture must settle its caller and remove the readback,
      // including when a background tab never produces another frame.
      cleanup = () => finish(null);
      map.triggerRepaint();
    });
  }

  /**
   * Camera changes are immediate behind the veil; it never waits forever.
   * HQ destinations cannot release on a coarse tile: arrivalReady must certify
   * the current native photograph plus any required textured 3D chapter after
   * paint. onQualityTimeout({target,label}) synchronously reframes to an honest
   * lower-resolution camera before fallback paint/release. Ordinary overview
   * transitions retain their legacy 2800ms upper bound.
   */
  async function jump(target, label) {
    cancel();
    const current = token;
    const image = await captureFrame();
    if (current !== token) return;
    if (image) { frame.src = image; frame.hidden = false; }
    veil.hidden = false;
    let requiresQuality;
    try {requiresQuality=!!qualityRequired(target,label);}
    catch {requiresQuality=true;} // A failed policy must not silently accept coarse imagery.
    cue.textContent = requiresQuality?`Refining map detail near ${label}`:`Approaching ${label}`;
    const cueDelay = setTimeout(() => { if (current === token) cue.hidden = false; }, 450);
    let elapsed = 0;
    let started = false;
    let released = false;
    let centerLoaded = false;
    let detailCenterLoaded = false;
    let ownedArrivalReady = false;
    let arrivalRenderQueued = false;
    let arrivalDetailPending = false;
    const renderWaiters = new Set();
    const afterRender = callback => {
      const listener = event => {
        renderWaiters.delete(listener);
        if (current === token) callback(event);
      };
      renderWaiters.add(listener);
      map.once('render', listener);
    };
    const expectedTiles = arrivalTiles();
    let settlingTimer;
    let hardTimeout;
    let cueTimeout;
    let qualityFallbackTimer;
    let qualityTimedOut=false;
    const stopObserving = () => {
      map.off('render', renderProgress);
      map.off('sourcedata', progress);
      for (const listener of renderWaiters) map.off('render', listener);
      renderWaiters.clear();
      clearTimeout(hardTimeout);
      clearTimeout(qualityFallbackTimer);
    };
    const release = () => {
      if (released || current !== token) return;
      released = true;
      // A warm destination may release before the delayed cue appears. Do
      // not let that timer revive a stale "Approaching" chip afterward.
      clearTimeout(cueDelay);
      veil.classList.add('is-releasing');
      settlingTimer = setTimeout(() => {
        if (current !== token) return;
        veil.hidden = true;
        veil.classList.remove('is-releasing');
        frame.removeAttribute('src');
        frame.hidden = true;
      }, 250);
      const detailReady=requiresQuality?ownedArrivalReady:(ownedArrivalReady || detailCenterLoaded || isLoaded(detailSource()));
      if (detailReady) { cue.hidden = true; stopObserving(); return; }
      cue.textContent = `Refining map detail near ${label}`;
      cue.hidden = false;
      cueTimeout = setTimeout(() => {
        if (current === token) cue.hidden = true;
        stopObserving();
      }, 6000);
    };
    const check = () => {
      if (current !== token || !started) return;
      if (requiresQuality?ownedArrivalReady:(ownedArrivalReady || centerLoaded || isLoaded(overviewSource)
        || elapsed > 1800 && isLoaded('nasa'))) release();
      if (released && (requiresQuality?ownedArrivalReady:(ownedArrivalReady || detailCenterLoaded || isLoaded(detailSource())))) {
        cue.hidden = true;
        clearTimeout(cueTimeout);
        stopObserving();
      }
    };
    const began = performance.now();
    const progress = (event, painted = false) => {
      // Owned single-image readiness is independent of global horizon loads.
      // Never use it from a sourcedata callback before the target was painted.
      if (painted && started) {
        try {ownedArrivalReady ||= !!arrivalReady();} catch { /* Ordinary tile readiness remains. */ }
      }
      // Horizon tiles may keep an entire source "loading" even though the
      // local arrival is already painted. A sourced, centre tile plus a
      // subsequent render is enough; no private MapLibre cache access needed.
      const tile=event?.coord?.canonical;
      // MapLibre's tile completion has dataType:'source' and no
      // sourceDataType. 'content' is a source update, not a tile completion.
      if (event?.dataType==='source' && tile && event?.tile?.state==='loaded'
        && (event.sourceId===overviewSource || event.sourceId===detailSource())
        && expectedTiles.some(item=>item.z===tile.z && item.x===tile.x && item.y===tile.y)) {
        const detail=event.sourceId===detailSource();
        arrivalDetailPending ||= detail;
        if (!arrivalRenderQueued) {
          arrivalRenderQueued = true;
          afterRender(() => {
            arrivalRenderQueued = false;
            centerLoaded = true;
            detailCenterLoaded ||= arrivalDetailPending;
            arrivalDetailPending = false;
            elapsed = performance.now() - began;
            check();
          });
        }
      }
      elapsed = performance.now() - began; check();
    };
    const renderProgress = event => progress(event,true);
    map.on('render', renderProgress);
    map.on('sourcedata', progress);
    const qualityTimeout=()=>{
      if(current!==token || released || qualityTimedOut)return;
      qualityTimedOut=true;
      // The host synchronously reframes to honest source resolution rather
      // than exposing a building-closeup filled with magnified overview pixels.
      try {onQualityTimeout?.({target,label});}
      catch(error){console.warn('Map quality fallback could not reframe the camera.',error);}
      if(current!==token)return; // The callback may cancel or start another destination.
      cue.textContent=`Refining map detail near ${label}`;cue.hidden=false;
      // Retain the old frame until the honest fallback camera has painted.
      // A background/no-frame tab still settles after a bounded 150ms grace.
      afterRender(release);
      qualityFallbackTimer=setTimeout(release,150);
      map.triggerRepaint();
    };
    hardTimeout = setTimeout(requiresQuality?qualityTimeout:release, requiresQuality?qualityTimeoutMs:2800);
    cleanup = () => {
      clearTimeout(cueDelay);
      clearTimeout(hardTimeout);
      clearTimeout(settlingTimer);
      clearTimeout(cueTimeout);
      clearTimeout(qualityFallbackTimer);
      stopObserving();
      veil.classList.remove('is-releasing');
    };
    try {
      map.jumpTo(target);
      if (current !== token) return;
      // JumpToOptions has no offset: silently passing it leaves the venue
      // underneath a mobile bottom sheet or desktop project panel. First
      // make the distant destination local (terrain-safe), then apply the
      // supported offset synchronously, before the first arrival paint.
      const offset = Array.isArray(target.offset) ? target.offset
        : [target.offset?.x,target.offset?.y];
      if (offset.length === 2 && offset.every(Number.isFinite) && offset.some(value => value !== 0)) {
        map.easeTo({...target,offset,duration:0,animate:false});
      }
      if (current !== token) return;
    } catch (error) {
      cancel();
      throw error;
    }
    // A source can still report the old viewport's loaded state synchronously
    // after jumpTo; wait until the new camera has rendered once.
    afterRender(() => { started = true; progress(undefined,true); });
  }

  return {jump, cancel};
}
