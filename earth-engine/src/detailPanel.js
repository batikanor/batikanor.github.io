/**
 * Project stories open as modeless reading windows above the chronology.
 * Only the dedicated handle starts a drag, never story text or embedded media.
 */

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function clampPanelRect(rect, bounds) {
  const availableWidth = Math.max(1, bounds.right - bounds.left);
  const availableHeight = Math.max(1, bounds.bottom - bounds.top);
  const minWidth = Math.min(bounds.minWidth ?? 320, availableWidth);
  const minHeight = Math.min(bounds.minHeight ?? 180, availableHeight);
  const width = clamp(rect.width, minWidth, availableWidth);
  const height = clamp(rect.height, minHeight, availableHeight);
  return {
    x: clamp(rect.x, bounds.left, bounds.right - width),
    y: clamp(rect.y, bounds.top, bounds.bottom - height),
    width,
    height
  };
}

/** A right-aligned reading window that leaves the map visible on the left. */
export function largePanelRect(bounds) {
  const top = Math.max(bounds.top, Math.min(bounds.bottom - 1, bounds.readingTop ?? bounds.top));
  const width = clamp((bounds.viewportWidth ?? bounds.right - bounds.left) * .7,
    Math.min(bounds.minWidth ?? 280, bounds.right - bounds.left), bounds.right - bounds.left);
  const height = clamp((bounds.viewportHeight ?? bounds.bottom - bounds.top) * .7,
    Math.min(bounds.minHeight ?? 180, bounds.bottom - top), bounds.bottom - top);
  return {x: bounds.right - width,
    y: top + (bounds.bottom - top - height) / 2, width, height};
}

export function expandedPanelRect(bounds) {
  return {x: bounds.left, y: bounds.top,
    width: bounds.right - bounds.left, height: bounds.bottom - bounds.top};
}

/** Reserve the real, visible chronology rather than an assumed footer height. */
export function reserveJourneySpace(bounds, journey, originY = 0) {
  if (!journey || journey.hidden || journey.closest?.('[hidden]')) return bounds;
  const rect = journey.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return bounds;
  return {...bounds, journeyReserved: true,
    bottom: Math.min(bounds.bottom, Math.max(bounds.top + 1, rect.top - originY - 12))};
}

export function reserveReadingTopbar(bounds, topbar, originY = 0) {
  if (!topbar || topbar.hidden || topbar.closest?.('[hidden]')) return bounds;
  const rect = topbar.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return bounds;
  return {...bounds, readingTop: Math.max(bounds.top, Math.min(bounds.bottom - 1, rect.bottom - originY + 12))};
}

/** Keep short map windows resizable without inflating their initial reading view. */
export function withCompactPanelMinimum(bounds, compactMinimum) {
  const readingHeight = bounds.bottom - Math.max(bounds.top, bounds.readingTop ?? bounds.top);
  if (!bounds.journeyReserved || readingHeight >= bounds.minHeight) return bounds;
  return {...bounds, minHeight: Math.max(1, Math.min(bounds.minHeight, compactMinimum, readingHeight))};
}

/** Resize from the lower-left or lower-right corner, preserving the far edge. */
export function resizePanelRect(rect, dx, dy, corner, bounds) {
  const start = clampPanelRect(rect, bounds);
  const minWidth = Math.min(bounds.minWidth ?? 320, bounds.right - bounds.left);
  const minHeight = Math.min(bounds.minHeight ?? 180, bounds.bottom - bounds.top);
  const height = clamp(start.height + dy, minHeight, bounds.bottom - start.y);
  if (corner === 'sw') {
    const right = start.x + start.width;
    const x = clamp(start.x + dx, bounds.left, right - minWidth);
    return {x, y: start.y, width: right - x, height};
  }
  const width = clamp(start.width + dx, minWidth, bounds.right - start.x);
  return {x: start.x, y: start.y, width, height};
}

function element(tag, className, label, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (tag === 'button') node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  if (text) node.textContent = text;
  return node;
}

export function createDetailPanel(root, {onGeometrySettled} = {}) {
  const app = root.parentElement;
  let expanded = false;
  let reading = true;
  let floatingRect = null;
  let restoreState = null;
  let reclampFrame = 0;
  let toggleButton;
  let dragHandle;

  function viewportBounds() {
    const frame = app.getBoundingClientRect();
    return {
      left: 0, top: 0, right: Math.max(1, frame.width), bottom: Math.max(1, frame.height),
      viewportWidth: frame.width, viewportHeight: frame.height,
      minWidth: window.innerWidth <= 760 ? 280 : 320,
      minHeight: 180
    };
  }

  function bounds() {
    const viewport = viewportBounds();
    const gutter = window.innerWidth <= 760 ? 8 : 12;
    const styles = window.getComputedStyle(root);
    const safe = edge => Math.max(0, parseFloat(styles.getPropertyValue(`--detail-safe-${edge}`)) || 0);
    const left = Math.min(gutter + safe('left'), viewport.right - 1);
    const top = Math.min(gutter + safe('top'), viewport.bottom - 1);
    const area = reserveJourneySpace({
      ...viewport, left, top,
      right: Math.max(left + 1, viewport.right - gutter - safe('right')),
      bottom: Math.max(top + 1, viewport.bottom - gutter - safe('bottom'))
    }, app.querySelector('#journey') ?? app.querySelector('.journey'), app.getBoundingClientRect().top);
    const readingArea = reserveReadingTopbar(area, app.querySelector('.topbar'), app.getBoundingClientRect().top);
    // The compact project toolbar is44px; retain32px of story scroll space.
    return withCompactPanelMinimum(readingArea, 78);
  }

  function measuredRect() {
    const frame = app.getBoundingClientRect();
    const panel = root.getBoundingClientRect();
    return {
      x: panel.left - frame.left,
      y: panel.top - frame.top,
      width: panel.width,
      height: panel.height
    };
  }

  function apply(rect) {
    const next = clampPanelRect(rect, bounds());
    expanded = false;
    reading = false;
    restoreState = null;
    write(next);
    floatingRect = next;
    updateControls();
  }

  function write(next) {
    root.classList.remove('is-expanded');
    root.classList.add('is-floating');
    root.style.left = `${next.x}px`;
    root.style.top = `${next.y}px`;
    root.style.width = `${next.width}px`;
    root.style.height = `${next.height}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function updateControls() {
    if (!toggleButton) return;
    const label = expanded ? 'Restore project window' : 'Expand project window';
    toggleButton.textContent = expanded ? '↙ Restore' : '⛶ Expand';
    toggleButton.setAttribute('aria-label', label);
    toggleButton.setAttribute('aria-pressed', String(expanded));
    toggleButton.title = label;
    dragHandle.disabled = false;
    root.classList.toggle('is-expanded', expanded);
    root.classList.toggle('is-floating', !expanded);
    root.classList.toggle('is-reading', reading);
    dragHandle.title = 'Drag to move · arrow keys to move · Home or double-click for reading view';
  }

  function reset(notify = false) {
    const rect = largePanelRect(bounds());
    expanded = false;
    reading = true;
    restoreState = null;
    floatingRect = rect;
    write(rect);
    updateControls();
    if (notify) onGeometrySettled?.();
  }

  function toggleExpanded() {
    if (expanded) {
      const previous = restoreState;
      if (previous?.reading) reset();
      else apply(previous?.rect ?? largePanelRect(bounds()));
    } else {
      restoreState = {rect: root.hidden ? floatingRect : measuredRect(), reading};
      expanded = true;
      reading = false;
      write(expandedPanelRect(bounds()));
      updateControls();
    }
    onGeometrySettled?.();
  }

  function reclamp() {
    if (expanded) {
      if (restoreState) restoreState.rect = clampPanelRect(restoreState.rect, bounds());
      write(expandedPanelRect(bounds()));
      updateControls();
    } else if (reading) reset();
    else if (floatingRect) apply(root.hidden ? floatingRect : measuredRect());
  }

  function scheduleReclamp() {
    if (reclampFrame) cancelAnimationFrame(reclampFrame);
    // The attribution observer also updates --credits-height. Recalculate after
    // that CSS change has moved the chronology, not from its previous position.
    reclampFrame = requestAnimationFrame(() => {
      reclampFrame = 0;
      reclamp();
    });
  }

  function beginGesture(handle, mode, event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = clampPanelRect(measuredRect(), bounds());
    const pointer = {x: event.clientX, y: event.clientY};
    let changed = false;
    handle.classList.add('is-dragging');
    handle.setPointerCapture(event.pointerId);

    const move = moveEvent => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const dx = moveEvent.clientX - pointer.x;
      const dy = moveEvent.clientY - pointer.y;
      if (!changed && Math.abs(dx) + Math.abs(dy) <= 2) return;
      const next = mode === 'move'
        ? {...start, x: start.x + dx, y: start.y + dy}
        : resizePanelRect(start, dx, dy, mode, bounds());
      const clamped = clampPanelRect(next, bounds());
      if (Object.keys(start).every(key => clamped[key] === start[key])) return;
      changed = true;
      apply(next);
    };
    const finish = endEvent => {
      if (endEvent.pointerId !== event.pointerId) return;
      handle.classList.remove('is-dragging');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      handle.removeEventListener('lostpointercapture', finish);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (changed) onGeometrySettled?.();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    handle.addEventListener('lostpointercapture', finish);
  }

  function bindHandle(handle, mode) {
    handle.addEventListener('pointerdown', event => beginGesture(handle, mode, event));
    handle.addEventListener('keydown', event => {
      if (event.key === 'Home') {
        event.preventDefault();
        reset(true);
        return;
      }
      const direction = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, -1], ArrowDown: [0, 1]
      }[event.key];
      if (!direction) return;
      event.preventDefault();
      const step = event.shiftKey ? 48 : 16;
      const dx = direction[0] * step;
      const dy = direction[1] * step;
      const area = bounds();
      const current = clampPanelRect(measuredRect(), area);
      const next = mode === 'move'
        ? {...current, x: current.x + dx, y: current.y + dy}
        : resizePanelRect(current, dx, dy, mode, area);
      const clamped = clampPanelRect(next, area);
      if (Object.keys(current).every(key => clamped[key] === current[key])) return;
      apply(next);
      onGeometrySettled?.();
    });
  }

  function render({preserveGeometry = false} = {}) {
    const preserve = preserveGeometry && Boolean(floatingRect || expanded);
    const chrome = element('div', 'detail-chrome');
    toggleButton = element('button', 'detail-reset');
    toggleButton.addEventListener('click', toggleExpanded);
    dragHandle = element('button', 'detail-drag-handle', 'Move project panel', '⠿');
    dragHandle.addEventListener('dblclick', () => reset(true));
    bindHandle(dragHandle, 'move');
    const close = element('button', 'close-detail', 'Close project details', '×');
    close.addEventListener('click', () => { root.hidden = true; });
    chrome.append(toggleButton, dragHandle, close);

    const scroll = element('div', 'detail-scroll');
    const resizeLeft = element('button', 'detail-resize-handle detail-resize-left',
      'Resize project panel from lower-left corner');
    resizeLeft.title = 'Drag to resize · arrow keys to resize';
    bindHandle(resizeLeft, 'sw');
    const resizeRight = element('button', 'detail-resize-handle detail-resize-right',
      'Resize project panel from lower-right corner');
    resizeRight.title = 'Drag to resize · arrow keys to resize';
    bindHandle(resizeRight, 'se');
    root.replaceChildren(chrome, scroll, resizeLeft, resizeRight);
    if (preserve) { reclamp(); updateControls(); }
    else reset();
    return scroll;
  }

  window.addEventListener('resize', scheduleReclamp);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(scheduleReclamp);
    observer.observe(app);
    for (const selector of ['.journey', '.sources']) {
      const node = app.querySelector(selector);
      if (node) observer.observe(node);
    }
  }

  return {render, reset, reclamp, isExpanded: () => expanded,
    getRect: () => root.hidden ? expanded ? expandedPanelRect(bounds()) : floatingRect : measuredRect()};
}
