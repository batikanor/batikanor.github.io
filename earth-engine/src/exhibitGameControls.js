const MOVEMENT = new Map([
  ['KeyW', [0, -1]], ['ArrowUp', [0, -1]],
  ['KeyS', [0, 1]], ['ArrowDown', [0, 1]],
  ['KeyA', [-1, 0]], ['ArrowLeft', [-1, 0]],
  ['KeyD', [1, 0]], ['ArrowRight', [1, 0]],
]);
const ACTIVATION = new Set(['KeyE', 'Space', 'Enter']);
const HANDLERS = ['dragPan', 'scrollZoom', 'boxZoom', 'doubleClickZoom', 'touchZoomRotate', 'keyboard'];
// Wheel and two-finger zoom remain available while the game owns clicks/WASD.
const LOCKED_HANDLERS = new Set(['dragPan', 'boxZoom', 'doubleClickZoom', 'keyboard']);

function keyCode(event) {
  if (event.code) return event.code;
  const key = event.key ?? '';
  if (/^[wasder]$/i.test(key)) return `Key${key.toUpperCase()}`;
  return key === ' ' ? 'Space' : key;
}

function editableTarget(target) {
  return !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|OPTION)$/.test(target.tagName ?? '')
    || !!target.closest?.('[contenteditable="true"], [contenteditable=""]'));
}

/** Native canvas input for physical exhibit games; this creates no DOM UI. */
export function createExhibitGameControls({map, getScene, getEvent, canPlay, onStart, onExit}) {
  const canvas = map.getCanvas();
  const document = canvas.ownerDocument;
  const window = document?.defaultView;
  const held = new Set();
  let activeScene = null, activeSlug = null, pointer = null, handlerState = null;
  let serial = 0, destroyed = false, lastInput = null, consumedClick = null;
  let hoverScene = null, hoverSlug = null, hoverId = null;
  const originalCursor = canvas.style?.cursor ?? '';
  const originalTabIndex = canvas.getAttribute('tabindex');
  const originalLabel = canvas.getAttribute('aria-label');
  const originalPlaying = canvas.getAttribute('data-exhibit-playing');
  if (originalTabIndex === null) canvas.setAttribute('tabindex', '0');
  if (originalLabel === null) canvas.setAttribute('aria-label', 'Interactive 3D project exhibit');

  function consume(event) {
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    event.stopPropagation?.();
  }

  function lockMap() {
    if (handlerState) return;
    handlerState = HANDLERS.map(name => {
      const handler = map[name], enabled = !!handler?.isEnabled?.();
      const changed = enabled && LOCKED_HANDLERS.has(name);
      if (changed) handler.disable();
      return {name, handler, enabled, changed};
    });
  }

  function unlockMap() {
    if (!handlerState) return;
    for (const state of handlerState) if (state.changed && !state.handler.isEnabled()) state.handler.enable();
    handlerState = null;
  }

  function releasePointer() {
    const previous = pointer;
    pointer = null;
    if (previous && canvas.hasPointerCapture?.(previous.id)) canvas.releasePointerCapture(previous.id);
    if (!activeScene) unlockMap();
  }

  function sendInput(force = false) {
    if (!activeScene) return;
    let x = 0, z = 0;
    for (const code of held) {
      const movement = MOVEMENT.get(code);
      if (movement) { x += movement[0]; z += movement[1]; }
    }
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    const activate = [...ACTIVATION].some(code => held.has(code));
    const input = {x, z, activate};
    if (force || !lastInput || x !== lastInput.x || z !== lastInput.z || activate !== lastInput.activate) {
      activeScene.gameInput?.(input);
      lastInput = input;
      map.triggerRepaint?.();
    }
  }

  function clearInput() {
    held.clear();
    sendInput();
  }

  function clearHover() {
    hoverScene?.gameHover?.(null);
    hoverScene = null;
    hoverSlug = null;
    hoverId = null;
    if (canvas.style) canvas.style.cursor = originalCursor;
  }

  function hover(scene, id) {
    const slug = getEvent()?.slug;
    if (scene !== hoverScene || slug !== hoverSlug || id !== hoverId) {
      if (scene !== hoverScene) hoverScene?.gameHover?.(null);
      scene?.gameHover?.(id);
      hoverScene = scene;
      hoverSlug = slug;
      hoverId = id;
      map.triggerRepaint?.();
    }
    if (canvas.style) canvas.style.cursor = id ? 'pointer' : originalCursor;
  }

  function close() {
    ++serial;
    const scene = activeScene, slug = activeSlug;
    clearInput();
    clearHover();
    activeScene = null;
    activeSlug = null;
    if (canvas.getAttribute('data-exhibit-playing') === 'true') canvas.removeAttribute('data-exhibit-playing');
    lastInput = null;
    releasePointer();
    unlockMap();
    scene?.stopGame?.();
    if (scene) onExit?.(slug);
    map.triggerRepaint?.();
  }

  function eligible() {
    return !destroyed && document?.visibilityState !== 'hidden' && !!getEvent()?.slug && !!canPlay();
  }

  function sync() {
    if (destroyed) return;
    const scene = getScene(), slug = getEvent()?.slug;
    if (activeScene && (!eligible() || scene !== activeScene || slug !== activeSlug || !scene?.gameIsActive?.())) close();
    if (pointer && (!eligible() || scene !== pointer.scene || slug !== pointer.slug)) releasePointer();
    if (hoverScene && (!eligible() || scene !== hoverScene || slug !== hoverSlug)) clearHover();
  }

  function start() {
    sync();
    if (activeScene) return true;
    if (!eligible()) return false;
    const scene = getScene(), slug = getEvent()?.slug;
    if (!scene?.startGame) return false;
    const request = ++serial;
    activeScene = scene;
    activeSlug = slug;
    clearHover();
    canvas.setAttribute('data-exhibit-playing', 'true');
    lockMap();
    let result;
    try { result = scene.startGame(slug); }
    catch { close(); return false; }
    if (result === false) { close(); return false; }
    onStart?.(slug);
    sendInput(true);
    map.triggerRepaint?.();
    if (result?.then) Promise.resolve(result).then(ready => {
      if (request !== serial || activeScene !== scene || activeSlug !== slug) return;
      if (ready === false || !eligible() || getScene() !== scene || getEvent()?.slug !== slug) close();
      else sendInput(true);
    }, () => {
      if (request === serial && activeScene === scene) close();
    });
    return true;
  }

  function pick(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > bounds.width || y > bounds.height) return null;
    return getScene()?.pickGameObject?.({x, y}) ?? null;
  }

  function pointerDown(event) {
    sync();
    if (event.target === canvas && !pointer) consumedClick = null;
    if (!eligible() || event.target !== canvas || pointer || event.isPrimary === false
      || (event.button !== undefined && event.button !== 0) || event.ctrlKey || event.metaKey || event.altKey) return;
    const hit = pick(event);
    if (!hit || (!activeScene && hit.id !== '__start')) return;
    pointer = {id: event.pointerId, scene: getScene(), slug: getEvent().slug, hit,
      x: event.clientX, y: event.clientY, moved: false};
    lockMap();
    canvas.setPointerCapture?.(event.pointerId);
    canvas.focus?.({preventScroll: true});
    consume(event);
  }

  function pointerMove(event) {
    if (!pointer) {
      sync();
      if (!eligible() || event.target !== canvas) { clearHover(); return; }
      const hit = pick(event);
      const id = hit && (activeScene ? hit.id !== '__floor' : hit.id === '__start') ? hit.id : null;
      hover(getScene(), id);
      return;
    }
    if (event.pointerId !== pointer.id) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 7) pointer.moved = true;
    consume(event);
  }

  function pointerUp(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const press = pointer;
    consume(event);
    consumedClick = {x: event.clientX, y: event.clientY, time: Date.now()};
    sync();
    if (!pointer) return;
    const released = !press.moved && eligible() ? pick(event) : null;
    // Moving actors can pass in front of a clicked dock between down/up.
    // Keep the stationary tap's original object intent throughout that frame.
    const hit=activeScene&&released&&!press.moved&&eligible()?press.hit:released;
    // Keep transient map locks through starting, so the click cannot also pan.
    if (hit?.id === press.hit.id) {
      if (!activeScene && hit.id === '__start') start();
      else if (activeScene && hit.id !== '__start') {
        activeScene.gameClick?.(hit.id, hit.point);
        map.triggerRepaint?.();
      }
    }
    releasePointer();
  }

  function pointerCancel(event) {
    if (pointer && event.pointerId === pointer.id) releasePointer();
  }

  function keyDown(event) {
    sync();
    if (event.target !== canvas || (document && document.activeElement !== canvas) || editableTarget(event.target)
      || event.ctrlKey || event.metaKey || event.altKey) return;
    const code = keyCode(event);
    if (code === 'Escape' && activeScene) { consume(event); close(); return; }
    if (code === 'KeyR' && activeScene) {
      consume(event);
      if (!event.repeat) { clearInput(); activeScene.resetGame?.(); map.triggerRepaint?.(); }
      return;
    }
    if (!MOVEMENT.has(code) && !ACTIVATION.has(code)) return;
    if (!activeScene && !(MOVEMENT.has(code) || code === 'Enter')) return;
    const wasActive = !!activeScene;
    if (!wasActive && !start()) return;
    consume(event);
    if (!wasActive && code === 'Enter') return;
    held.add(code);
    sendInput();
  }

  function keyUp(event) {
    const code = keyCode(event);
    if (!held.delete(code)) return;
    if (event.target === canvas) consume(event);
    sendInput();
  }

  function blur() { clearInput(); clearHover(); releasePointer(); }
  function windowBlur(event) {
    // Focusing the canvas blurs the previous popup control. That captured
    // descendant event must not cancel the exhibit press we just accepted.
    if (event.target === window) blur();
  }
  function visibilityChange() { if (document.visibilityState === 'hidden') close(); }
  function doubleClick(event) { if (activeScene && event.target === canvas) consume(event); }
  function compatibilityClick(event) {
    // Pointer cancellation does not cancel the separate native `click` that
    // MapLibre uses for marker selection. Consume it without a second action.
    if (!consumedClick || event.target !== canvas) return;
    const previous = consumedClick;
    consumedClick = null;
    if (Date.now() - previous.time < 1000 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 7) consume(event);
  }
  const bindings = [
    [canvas, 'pointerdown', pointerDown], [canvas, 'pointermove', pointerMove],
    [canvas, 'pointerup', pointerUp], [canvas, 'pointercancel', pointerCancel],
    [canvas, 'pointerleave', clearHover],
    [canvas, 'lostpointercapture', pointerCancel], [canvas, 'keydown', keyDown],
    [canvas, 'blur', blur], [canvas, 'dblclick', doubleClick], [canvas, 'click', compatibilityClick],
    [document, 'keyup', keyUp],
    [document, 'visibilitychange', visibilityChange], [window, 'blur', windowBlur],
  ];
  for (const [target, name, handler] of bindings) target?.addEventListener(name, handler, true);

  function destroy() {
    if (destroyed) return;
    close();
    destroyed = true;
    for (const [target, name, handler] of bindings) target?.removeEventListener(name, handler, true);
    if (originalTabIndex === null && canvas.getAttribute('tabindex') === '0') canvas.removeAttribute('tabindex');
    if (originalLabel === null && canvas.getAttribute('aria-label') === 'Interactive 3D project exhibit') canvas.removeAttribute('aria-label');
    if (originalPlaying !== null && canvas.getAttribute('data-exhibit-playing') === null) canvas.setAttribute('data-exhibit-playing', originalPlaying);
  }

  return {sync, start, close, destroy, getStats: () => ({active: !!activeScene, activeSlug,
    heldKeys: [...held], lockedHandlers: handlerState?.filter(state => state.changed).map(state => state.name) ?? [],
    pointerActive: !!pointer, markers: 0, panels: 0, buttons: 0})};
}
