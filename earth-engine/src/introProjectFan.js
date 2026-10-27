import {mountNpmDownloads} from './npmDownloads.js';
import {mountGithubStars} from './githubStars.js';

const mountedFans = new WeakMap();
const modified = event => event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;

/** Keep visual stacking separate from native links, focus and DOM order. */
export function mountIntroProjectFan(fan, {
  link = fan?.ownerDocument?.getElementById?.('intro-live-projects'),
  window: host = fan?.ownerDocument?.defaultView,
} = {}) {
  if (!fan) return null;
  if (mountedFans.has(fan)) return mountedFans.get(fan);
  const cards = [...fan.querySelectorAll('.intro-project-window[data-project]')].map(node => ({
    node, id: node.dataset.project, name: node.dataset.projectName || node.dataset.project,
    surface: node.querySelector('.intro-project-surface'), logo: node.querySelector('.intro-project-open'),
  })).filter(card => card.id && card.surface && card.logo);
  const listeners = [], seenMoves = new WeakSet();
  let downloads = mountNpmDownloads(fan.querySelector('.intro-project-downloads'));
  let stars = mountGithubStars(fan.querySelector('.intro-project-stars'));
  let selectedIndex = -1, gesture = null, suppressPointerClick = false, disposed = false;
  const wrap = index => (index % cards.length + cards.length) % cards.length;
  const listen = (target, type, handler, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };

  function applySelection(index) {
    if (!cards.length || index < 0 || disposed) return false;
    if (selectedIndex === index) return true;
    selectedIndex = index;
    let rearSlot = 0;
    for (let i = 0; i < cards.length; i++) {
      const selected = i === index, card = cards[i];
      card.node.dataset.front = String(selected);
      card.node.dataset.slot = String(selected ? cards.length - 1 : rearSlot++);
      card.surface.setAttribute('aria-pressed', String(selected));
    }
    const selected = cards[index], href = selected.logo.getAttribute('href');
    if (link && href) {
      link.setAttribute('href', href);
      link.setAttribute('aria-label', `Explore live projects — ${selected.name}`);
    }
    return true;
  }

  function finishGesture(forceSuppress = false) {
    const previous = gesture;
    gesture = null;
    if (previous && (forceSuppress || previous.claimed || previous.moved)) suppressPointerClick = true;
    fan.dataset.dragging = 'false';
    fan.style?.removeProperty?.('--fan-pull-x');
    if (previous?.captured && fan.releasePointerCapture) {
      try {
        if (!fan.hasPointerCapture || fan.hasPointerCapture(previous.id)) fan.releasePointerCapture(previous.id);
      } catch { /* The browser may already have released a cancelled pointer. */ }
    }
  }
  function cancelGesture() {if (!disposed) finishGesture(true);}
  function cancelSecondPointer(event) {
    if (gesture && event.pointerId !== gesture.id &&
      (event.pointerType === 'touch' || gesture.pointerType === 'touch')) {
      cancelGesture();return true;
    }
    return false;
  }
  function pointerDown(event) {
    if (disposed || cancelSecondPointer(event)) return;
    if (gesture) return;
    // A new primary activation, including a modified link click, is independent
    // of the preceding swipe. A second pinch contact cannot clear its guard.
    if (event.isPrimary !== false) suppressPointerClick = false;
    if (event.isPrimary === false || (event.button ?? 0) !== 0 || modified(event) || event.pointerId == null || !cards.length) return;
    gesture = {id: event.pointerId, pointerType: event.pointerType || 'mouse',
      x: event.clientX, y: event.clientY, initialIndex: selectedIndex,
      step: Math.max(24, Math.min(42, (Number(fan.clientWidth) || 0) * .15)),
      moved: false, claimed: false, captured: false};
  }
  function observePointerDown(event) {
    if (disposed || cancelSecondPointer(event)) return;
    if (!gesture && event.isPrimary !== false) suppressPointerClick = false;
  }
  function pointerMove(event) {
    if (disposed || !gesture || event.pointerId !== gesture.id) return;
    // A move can bubble from the fan to the window. Window observation also
    // covers a pointer leaving the fan before it has earned capture.
    if (seenMoves.has(event)) return;
    seenMoves.add(event);
    if (modified(event) || gesture.pointerType === 'mouse' && event.buttons != null && event.buttons !== 1) {
      cancelGesture();return;
    }
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (Math.hypot(dx, dy) >= 8) {
      gesture.moved = true;suppressPointerClick = true;
    }
    if (!gesture.claimed) {
      if (Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        gesture.claimed = true;fan.dataset.dragging = 'true';
        try {
          if (fan.setPointerCapture) {fan.setPointerCapture(gesture.id);gesture.captured = true;}
        } catch { /* Window listeners still complete the gesture without capture. */ }
      } else {
        if (Math.abs(dy) >= 8) cancelGesture();
        return;
      }
    }
    event.preventDefault?.();
    const steps = Math.round(dx / gesture.step);
    applySelection(wrap(gesture.initialIndex - steps));
    const pull = Math.max(-8, Math.min(8, (dx - steps * gesture.step) * .18));
    fan.style?.setProperty?.('--fan-pull-x', `${pull}px`);
  }
  function pointerUp(event) {
    if (disposed || !gesture || event.pointerId !== gesture.id) return;
    // Coalesced or missed moves must not turn a displaced release into a
    // surface selection or native link activation.
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (Number.isFinite(dx) && Number.isFinite(dy) && Math.hypot(dx, dy) >= 8) gesture.moved = true;
    finishGesture();
  }
  function pointerCancelled(event) {
    if (!disposed && gesture && event.pointerId === gesture.id) cancelGesture();
  }
  function suppressClick(event) {
    if (disposed || !suppressPointerClick || event.detail === 0) return false;
    event.preventDefault?.();event.stopPropagation?.();event.stopImmediatePropagation?.();
    return true;
  }
  function preventNativeDrag(event) {if (!disposed) event.preventDefault?.();}
  function pageHidden(event) {
    if (event.persisted) {
      cancelGesture();
      downloads?.dispose();
      downloads = null;
      stars?.dispose();
      stars = null;
    }
    else dispose();
  }
  function pageShown(event) {
    if (!event.persisted || disposed) return;
    downloads ||= mountNpmDownloads(fan.querySelector('.intro-project-downloads'));
    stars ||= mountGithubStars(fan.querySelector('.intro-project-stars'));
    void stars?.refresh();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;finishGesture(true);
    downloads?.dispose();
    stars?.dispose();
    for (const remove of listeners.splice(0)) remove();
    if (mountedFans.get(fan) === api) mountedFans.delete(fan);
  }
  const api = {
    select(id) {
      const index = cards.findIndex(card => card.id === id);
      if (disposed || index < 0) return false;
      cancelGesture();return applySelection(index);
    },
    get selectedId() {return cards[selectedIndex]?.id ?? null;},
    cancelGesture, dispose,
  };
  mountedFans.set(fan, api);
  fan.dataset.dragging = 'false';
  for (let index = 0; index < cards.length; index++) {
    const card = cards[index];
    listen(card.surface, 'click', event => {
      if (disposed || modified(event) || suppressClick(event) || event.defaultPrevented) return;
      api.select(card.id);
    });
    listen(card.surface, 'keydown', event => {
      if (disposed || modified(event) || event.defaultPrevented) return;
      const destination = event.key === 'ArrowLeft' ? wrap(index - 1)
        : event.key === 'ArrowRight' ? wrap(index + 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : null;
      if (destination == null) return;
      event.preventDefault?.();event.stopPropagation?.();
      api.select(cards[destination].id);cards[destination].surface.focus({preventScroll: true});
    });
  }
  listen(fan, 'click', suppressClick, {capture: true});
  listen(fan, 'dragstart', preventNativeDrag);
  listen(fan, 'pointerdown', pointerDown, {passive: true});
  listen(fan, 'pointermove', pointerMove, {passive: false});
  listen(fan, 'pointerup', pointerUp);
  listen(fan, 'pointercancel', pointerCancelled);
  listen(fan, 'lostpointercapture', pointerCancelled);
  if (host && host !== fan) {
    listen(host, 'pointerdown', observePointerDown, {passive: true});
    listen(host, 'pointermove', pointerMove, {passive: false});
    listen(host, 'pointerup', pointerUp);
    listen(host, 'pointercancel', pointerCancelled);
  }
  listen(host, 'resize', cancelGesture);
  listen(host, 'blur', cancelGesture);
  listen(host, 'pagehide', pageHidden);
  listen(host, 'pageshow', pageShown);
  const initial = cards.findIndex(card => card.node.dataset.front === 'true');
  applySelection(initial < 0 ? 0 : initial);
  return api;
}
