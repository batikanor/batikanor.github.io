/**
 * One explicitly owned, georeferenced ESA arrival image. Unlike raster tile
 * history, this ImageSource's public completion/readiness is unambiguous even
 * when horizon tiles keep the global imagery pyramid pending on a revisit.
 * Only compressed files are prewarmed elsewhere; this layer decodes one stop.
 * Decode independently and use public updateImage({image}), never the shared
 * MapLibre URL-image FIFO where slow WMS requests can strand a cached arrival.
 */
const MAX_IMAGE_BYTES = 1_200_000;
const MAX_IMAGE_DIMENSION = 1024;
let nextInstance = 0;

function assert(condition, message) {if (!condition) throw new Error(message);}

export function validateArrivalLandings(manifest) {
  assert(manifest?.schema === 1 && manifest.events && manifest.landings,
    'Invalid arrival landing manifest');
  for (const [key, item] of Object.entries(manifest.landings)) {
    assert(/^14\/\d+\/\d+$/.test(key) && typeof item.url === 'string'
      && /^\/assets\/arrival\/landing-14-\d+-\d+-[a-f0-9]{8,64}\.webp$/.test(item.url),
    'Arrival landing lacks a fingerprinted real-data asset');
    assert(Number.isInteger(item.bytes) && item.bytes > 0 && item.bytes <= MAX_IMAGE_BYTES
      && Number.isInteger(item.width) && Number.isInteger(item.height)
      && item.width === 768 && item.width <= MAX_IMAGE_DIMENSION
      && item.height === 768 && item.height <= MAX_IMAGE_DIMENSION,
    'Arrival landing exceeds image budget');
    assert(Array.isArray(item.coordinates) && item.coordinates.length === 4
      && item.coordinates.every(point => Array.isArray(point) && point.length === 2
        && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) < 85.1),
    'Arrival landing has invalid geographic coordinates');
    const [tl,tr,br,bl] = item.coordinates;
    assert(tr[0] > tl[0] && br[0] > bl[0] && tl[1] > bl[1] && tr[1] > br[1]
      && Math.abs(tl[1]-tr[1]) < 1e-8 && Math.abs(bl[1]-br[1]) < 1e-8
      && Math.abs(tl[0]-bl[0]) < 1e-8 && Math.abs(tr[0]-br[0]) < 1e-8,
    'Arrival landing must use clockwise, unwarped XYZ bounds');
    const [z,x,y] = key.split('/').map(Number),n=2**z;
    const lon = value => value/n*360-180;
    const lat = value => Math.atan(Math.sinh(Math.PI*(1-2*value/n)))*180/Math.PI;
    const expected = [[lon(x-1),lat(y-1)],[lon(x+2),lat(y-1)],
      [lon(x+2),lat(y+2)],[lon(x-1),lat(y+2)]];
    assert(x >= 1 && y >= 1 && x <= n-2 && y <= n-2
      && item.coordinates.every((point,index) => point.every((value,axis) => Math.abs(value-expected[index][axis])<1e-8))
      && item.url.startsWith(`/assets/arrival/landing-${z}-${x}-${y}-`),
    'Arrival landing coordinates differ from its native XYZ source grid');
  }
  for (const key of Object.values(manifest.events)) assert(Object.hasOwn(manifest.landings,key),
    'Arrival landing event references a missing image');
  return manifest;
}

async function boundedImage(response, maxBytes, signal) {
  assert(response.ok && /^image\/webp\b/i.test(response.headers.get('content-type') ?? ''),
    `Arrival image HTTP/MIME ${response.status}`);
  assert(Number(response.headers.get('content-length')) <= maxBytes,
    'Arrival image exceeds advertised transfer budget');
  if (!response.body?.getReader) {
    const blob = await response.blob();
    assert(blob.size <= maxBytes, 'Arrival image exceeds actual transfer budget');
    return blob;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      if (signal.aborted) throw signal.reason ?? new Error('Arrival image canceled');
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      assert(bytes <= maxBytes, 'Arrival image exceeds actual transfer budget');
      chunks.push(result.value);
    }
  } catch (error) {void reader.cancel().catch(() => {}); throw error;}
  return new Blob(chunks,{type:'image/webp'});
}

/** Decode outside MapLibre's image queue; keep pixels alive for context restore. */
export async function decodeArrivalImage(blob,{signal,bitmapFactory=globalThis.createImageBitmap,
  imageFactory=()=>new Image(),urlFactory=URL}={}) {
  if(signal?.aborted)throw signal.reason??new Error('Arrival image canceled');
  if(typeof bitmapFactory==='function') {
    const bitmap=await bitmapFactory(blob);
    return {image:bitmap,dispose:()=>bitmap.close()};
  }
  // Older WebGL2 browsers can use a native image element without passing its
  // blob URL through MapLibre. This fallback still owns/revokes its local URL.
  const image=imageFactory(),url=urlFactory.createObjectURL(blob);
  let owned=false;
  let rejectLoad;
  const abort=()=>{image.src='';rejectLoad?.(signal.reason??new Error('Arrival image canceled'));};
  try {
    await new Promise((resolve,reject)=>{
      rejectLoad=reject;
      image.onload=resolve;image.onerror=()=>reject(new Error('Arrival image decode failed'));
      signal?.addEventListener('abort',abort,{once:true});
      image.src=url;
    });
    if(typeof image.decode==='function')await image.decode();
    if(signal?.aborted)throw signal.reason??new Error('Arrival image canceled');
    owned=true;
    return {image,dispose:()=>{image.src='';urlFactory.revokeObjectURL(url);}};
  } catch(error) {image.src='';throw error;}
  finally {
    image.onload=null;image.onerror=null;signal?.removeEventListener('abort',abort);
    if(!owned)urlFactory.revokeObjectURL(url);
  }
}

export function createArrivalLandingLayer({manifest, baseUrl = '/', onChange = null,
  fetcher = fetch, imageDecoder = decodeArrivalImage, beforeId = 'bavaria-imagery',
  manifestValidator = validateArrivalLandings, maxImageBytes = MAX_IMAGE_BYTES,
  minZoom = 12, onImageReady = null, onBeforeImageRelease = null} = {}) {
  assert(typeof manifestValidator === 'function','Arrival image requires a manifest validator');
  manifestValidator(manifest);
  assert(Number.isInteger(maxImageBytes) && maxImageBytes>0 && maxImageBytes<=10_000_000
    && Number.isFinite(minZoom) && minZoom>=0 && minZoom<=20,
    'Invalid independent image limits');
  assert((onImageReady==null||typeof onImageReady==='function')
    && (onBeforeImageRelease==null||typeof onBeforeImageRelease==='function'),
    'Invalid borrowed image lifecycle callbacks');
  assert(typeof fetcher === 'function' && typeof imageDecoder==='function'
    && (onChange == null || typeof onChange === 'function'),
    'Arrival landing requires a fetcher and optional callback');
  const prefix = `earth-arrival-landing-${++nextInstance}`;
  const metrics = {requests:0, completed:0, failures:0, aborted:0,decodes:0,closedImages:0};
  let map = null;
  let focus = null;
  let enabled = true;
  let generation = 0;
  let active = null;
  let watchingPaint = false;
  let decodeTail=Promise.resolve();
  let decoding=0;

  const sourcePresent = entry => !!entry?.source
    && map?.getSource(entry.sourceId) === entry.source;
  function visibleForCurrentView(entry) {
    if (!sourcePresent(entry) || !map.getLayer(entry.layerId) || map.getZoom()<minZoom
      || map.getLayoutProperty?.(entry.layerId,'visibility') === 'none') return false;
    // Do not require the camera centre inside the patch: popup offsets can
    // move it while the achievement is visible. Public viewport bounds only
    // reject a different city/world view, not an offset closeup.
    try {
      const bounds = map.getBounds();
      const [tl,,br] = entry.image.coordinates;
      const west = bounds.getWest(),east=bounds.getEast();
      const longitudeOverlap = west<=east ? west<=br[0] && east>=tl[0]
        : west<=br[0] || east>=tl[0];
      return longitudeOverlap && bounds.getSouth()<=tl[1] && bounds.getNorth()>=br[1];
    } catch {return false;}
  }
  const notify = () => {
    try {onChange?.(api.getStats());}
    catch (error) {console.warn('Arrival image callback failed.',error);}
  };
  const stopPaint = () => {
    if (watchingPaint) map?.off('render',onRender);
    watchingPaint = false;
  };
  const disposeDecoded = decoded => {
    if(!decoded)return;
    try {decoded.dispose();} catch { /* Already closed by a failed browser decode. */ }
    metrics.closedImages++;
  };
  function release() {
    const entry = active;
    active = null;
    stopPaint();
    if (!entry) return;
    entry.abort.abort();
    clearTimeout(entry.timeout);
    // Remove the source before closing its independently owned pixels: the
    // source may need them for context restoration until this exact teardown.
    try {if (map?.getLayer(entry.layerId)) map.removeLayer(entry.layerId);} catch { /* Map removed. */ }
    try {if (map?.getSource(entry.sourceId)) map.removeSource(entry.sourceId);} catch { /* Map removed. */ }
    // Borrowers release their GPU wrappers synchronously before the sole
    // decoded image is closed. They never own/close these shared pixels.
    if(entry.decoded) {
      try {onBeforeImageRelease?.({slug:entry.slug,image:entry.decoded.image,metadata:entry.image});}
      catch(error) {console.warn('Borrowed image release failed.',error);}
    }
    disposeDecoded(entry.decoded);
    entry.decoded = null;
    entry.source = null;
  }
  function onRender() {
    const entry = active;
    if (!enabled || !entry?.imageComplete || !visibleForCurrentView(entry)) return;
    let loaded = false;
    try {loaded = map.isSourceLoaded(entry.sourceId);} catch {return;}
    if (!loaded) return;
    // Public render fires after the current frame. The independently owned
    // image has now had a paint; unrelated ESA/DEM/horizon loads do not matter.
    entry.ready = true;
    entry.loading = false;
    clearTimeout(entry.timeout);
    stopPaint();
    metrics.completed++;
    notify();
    // A transition observer may precede this listener in registration order.
    // One final frame lets it see readiness; stopPaint already prevents loops.
    map.triggerRepaint();
  }
  function onSourceData(event) {
    const entry = active;
    if (!entry || event?.dataType !== 'source' || event.sourceId !== entry.sourceId
      || !entry.decoded || !entry.imageProvided || !sourcePresent(entry)
      || !['metadata','content'].includes(event.sourceDataType)) return;
    entry.imageComplete = true;
    entry.ready = false;
    entry.loading = true;
    if (!watchingPaint) {map.on('render',onRender);watchingPaint = true;}
    map.triggerRepaint();
  }
  function fail(entry) {
    if (active !== entry) return;
    metrics.failures++;
    release();
    notify();
  }
  function onError(event) {
    if (active && event?.sourceId === active.sourceId) fail(active);
  }
  function provideImage(entry) {
    // Decoded payloads are deliberately absent from ImageSource.serialize().
    // A public style reload/context restore must rebind the replacement source
    // and feed the retained pixels, not certify the empty serialized source.
    let source=map.getSource(entry.sourceId);
    if(!source) {
      entry.imageProvided=false;
      map.addSource(entry.sourceId,{type:'image',coordinates:entry.image.coordinates});
      source=map.getSource(entry.sourceId);
    }
    entry.source=source;
    entry.imageProvided=true;
    source.updateImage({image:entry.decoded.image});
    if(!map.getLayer(entry.layerId)) {
      const before=beforeId&&map.getLayer(beforeId)?beforeId:undefined;
      map.addLayer({id:entry.layerId,type:'raster',source:entry.sourceId,minzoom:minZoom,
        paint:{'raster-fade-duration':0,'raster-saturation':.06,'raster-contrast':.075,
          'raster-brightness-max':1}},before);
    }
    onImageReady?.({slug:entry.slug,image:entry.decoded.image,metadata:entry.image});
    map.triggerRepaint();
  }
  function onStyleLoad() {
    const entry=active;
    if(!enabled||!entry?.decoded||!map)return;
    entry.ready=false;entry.imageComplete=false;entry.loading=true;
    clearTimeout(entry.timeout);
    entry.timeout=setTimeout(()=>fail(entry),12_000);
    try {provideImage(entry);} catch {fail(entry);}
  }
  function begin() {
    if (!map || !focus || !enabled || active) return;
    const key = manifest.events[focus];
    const image = manifest.landings[key];
    const current = ++generation;
    const entry = {slug:focus,key,image,sourceId:`${prefix}-${current}`,
      layerId:`${prefix}-${current}-imagery`,abort:new AbortController(),
      source:null,decoded:null,imageProvided:false,imageComplete:false,ready:false,loading:true};
    active = entry;
    entry.timeout = setTimeout(() => fail(entry),12_000);
    metrics.requests++;
    notify();
    void (async () => {
      let decoded=null;
      try {
        const response = await fetcher(`${baseUrl.replace(/\/$/,'')}${image.url}`,{
          signal:entry.abort.signal,cache:'force-cache',credentials:'same-origin',priority:'high'
        });
        const blob = await boundedImage(response,Math.min(image.bytes,maxImageBytes),entry.abort.signal);
        assert(blob.size === image.bytes,'Arrival image disagrees with release manifest');
        if (active !== entry || generation !== current || entry.abort.signal.aborted || !map) return;
        // Native bitmap decode cannot be aborted. Serialize it so rapid
        // navigation never starts dozens of concurrent uncancelable decodes;
        // queued stale generations are skipped and late bitmaps are closed.
        const task=decodeTail.then(async()=>{
          if(active!==entry||generation!==current||entry.abort.signal.aborted)return null;
          metrics.decodes++;decoding++;
          try {return await imageDecoder(blob,{signal:entry.abort.signal});}
          finally {decoding--;}
        });
        decodeTail=task.then(()=>undefined,()=>undefined); // Never retain decoded pixels in the tail.
        decoded=await task;
        if(!decoded || active !== entry || generation !== current || entry.abort.signal.aborted || !map) return;
        const width=decoded.image.naturalWidth??decoded.image.width;
        const height=decoded.image.naturalHeight??decoded.image.height;
        assert(width===image.width&&height===image.height,'Decoded arrival dimensions differ from native manifest');
        entry.decoded=decoded;decoded=null;
        // The empty source may synchronously emit metadata while addSource
        // runs. imageProvided stays false so that event cannot fake readiness.
        provideImage(entry);
      } catch (error) {
        if (entry.abort.signal.aborted || active !== entry || generation !== current) {
          metrics.aborted++;
          return;
        }
        fail(entry); // Global imagery remains the honest normal fallback.
      } finally {disposeDecoded(decoded);}
    })();
  }

  const api = {
    onAdd(nextMap) {
      if (map === nextMap) return api;
      if (map) api.onRemove();
      map = nextMap;
      map.on('sourcedata',onSourceData);map.on('error',onError);map.on('style.load',onStyleLoad);
      begin();
      return api;
    },
    addTo(nextMap) {return api.onAdd(nextMap);},
    setFocus(slug = null) {
      assert(slug == null || Object.hasOwn(manifest.events,slug),'Unknown arrival landing event');
      if (focus === slug && active) return;
      // The manifest, not a city name/distance heuristic, proves identical
      // geometry/pixels. Shared-coordinate achievements can keep that one
      // owned source (or its in-flight fetch) while changing only attribution
      // of readiness to the current slug.
      if (slug && enabled && active && manifest.events[slug] === active.key
        && (sourcePresent(active) || !active.source && active.loading)) {
        focus = slug;
        active.slug = slug;
        if(active.decoded)onImageReady?.({slug,image:active.decoded.image,metadata:active.image});
        notify();
        return;
      }
      focus = slug;
      generation++;
      release();
      begin();
      notify();
    },
    setEnabled(next) {
      if (enabled === !!next) return;
      enabled = !!next;
      generation++;
      if (!enabled) release();else begin();
      notify();
    },
    isReadyFor(slug) {return enabled && focus === slug && !!active?.ready
      && active.slug === slug && visibleForCurrentView(active);},
    getStats() {return {...metrics,eventSlug:focus,enabled,ready:api.isReadyFor(focus),
      loading:!!active?.loading,sourceId:active?.sourceId??null,activeSources:sourcePresent(active)?1:0,
      decoding,ownedDecodedImages:active?.decoded?1:0,
      bytes:active?.source ? active.image.bytes : 0,
      estimatedDecodedRgbaBytes:active?.source ? active.image.width*active.image.height*4 : 0};},
    onRemove() {
      generation++;
      release();
      map?.off('sourcedata',onSourceData);map?.off('error',onError);map?.off('style.load',onStyleLoad);
      map = null;
      notify();
    }
  };
  return api;
}
