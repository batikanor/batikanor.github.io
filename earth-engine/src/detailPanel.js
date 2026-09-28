/**
 * A modeless project window. The map and chronology remain usable behind it;
 * only the dedicated handle starts a drag, never story text or embedded media.
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
  let customized = false;
  let lastRect = null;
  let wasMobile = window.innerWidth <= 760;
  let reclampFrame = 0;

  function bounds() {
    const frame = app.getBoundingClientRect();
    const topbar = app.querySelector('.topbar').getBoundingClientRect();
    const journey = app.querySelector('.journey').getBoundingClientRect();
    const gutter = window.innerWidth <= 760 ? 8 : 12;
    const top = Math.max(gutter, topbar.bottom - frame.top + 8);
    const bottom = Math.max(top + 1, Math.min(frame.height - gutter, journey.top - frame.top - 8));
    const right = Math.max(gutter + 1, frame.width - gutter);
    return {
      left: gutter, top, right, bottom,
      minWidth: window.innerWidth <= 760 ? 280 : 320,
      minHeight: 180
    };
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
    root.style.left = `${next.x}px`;
    root.style.top = `${next.y}px`;
    root.style.width = `${next.width}px`;
    root.style.height = `${next.height}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    customized = true;
    lastRect = next;
  }

  function reset(notify = false) {
    for (const property of ['left', 'top', 'right', 'bottom', 'width', 'height']) {
      root.style[property] = '';
    }
    customized = false;
    lastRect = null;
    if (notify) onGeometrySettled?.();
  }

  function reclamp() {
    if (!customized) return;
    // Preserve a closed panel's reachable placement too: display:none has no
    // measurable rect, but its last geometry may now exceed a smaller window.
    apply(root.hidden ? lastRect : measuredRect());
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
    apply(start);
    const pointer = {x: event.clientX, y: event.clientY};
    let changed = false;
    handle.classList.add('is-dragging');
    handle.setPointerCapture(event.pointerId);

    const move = moveEvent => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const dx = moveEvent.clientX - pointer.x;
      const dy = moveEvent.clientY - pointer.y;
      changed ||= Math.abs(dx) + Math.abs(dy) > 2;
      apply(mode === 'move'
        ? {...start, x: start.x + dx, y: start.y + dy}
        : resizePanelRect(start, dx, dy, mode, bounds()));
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
      if (event.key === 'Home' && mode === 'move') {
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
      const current = clampPanelRect(measuredRect(), bounds());
      apply(mode === 'move'
        ? {...current, x: current.x + dx, y: current.y + dy}
        : resizePanelRect(current, dx, dy, mode, bounds()));
      onGeometrySettled?.();
    });
  }

  function render() {
    const chrome = element('div', 'detail-chrome');
    const resetButton = element('button', 'detail-reset', 'Reset project panel size and position', '↺');
    resetButton.title = 'Reset size and position';
    resetButton.addEventListener('click', () => reset(true));
    const dragHandle = element('button', 'detail-drag-handle', 'Move project panel', '⠿');
    dragHandle.title = 'Drag to move · arrow keys to move · double-click to reset';
    dragHandle.addEventListener('dblclick', () => reset(true));
    bindHandle(dragHandle, 'move');
    const close = element('button', 'close-detail', 'Close project details', '×');
    close.addEventListener('click', () => { root.hidden = true; });
    chrome.append(resetButton, dragHandle, close);

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
    return scroll;
  }

  window.addEventListener('resize', () => {
    const mobile = window.innerWidth <= 760;
    if (mobile !== wasMobile) reset();
    else scheduleReclamp();
    wasMobile = mobile;
  });
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(scheduleReclamp);
    observer.observe(app.querySelector('.journey'));
    observer.observe(app.querySelector('.sources'));
  }

  return {render, reset, reclamp, getRect: () => root.hidden ? lastRect : measuredRect()};
}
