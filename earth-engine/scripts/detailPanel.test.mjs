import test from 'node:test';
import assert from 'node:assert/strict';
import {clampPanelRect, resizePanelRect} from '../src/detailPanel.js';

const desktopBounds = {
  left: 24, top: 72, right: 1176, bottom: 720,
  minWidth: 280, minHeight: 180,
};

test('dragged detail panel stays within the desktop work area without changing size', () => {
  const original = {x: 620, y: 130, width: 420, height: 350};
  assert.deepEqual(clampPanelRect(original, desktopBounds), original);
  assert.deepEqual(clampPanelRect({...original, x: -200, y: -100}, desktopBounds),
    {...original, x: desktopBounds.left, y: desktopBounds.top});
  assert.deepEqual(clampPanelRect({...original, x: 2000, y: 2000}, desktopBounds),
    {...original, x: desktopBounds.right - original.width,
      y: desktopBounds.bottom - original.height});
});

test('southeast resize grows down/right and respects minimum size and viewport edges', () => {
  const original = {x: 620, y: 130, width: 420, height: 350};
  assert.deepEqual(resizePanelRect(original, 80, 45, 'se', desktopBounds),
    {...original, width: 500, height: 395});
  assert.deepEqual(resizePanelRect(original, -1000, -1000, 'se', desktopBounds),
    {...original, width: desktopBounds.minWidth, height: desktopBounds.minHeight});
  assert.deepEqual(resizePanelRect(original, 1000, 1000, 'se', desktopBounds),
    {...original, width: desktopBounds.right - original.x,
      height: desktopBounds.bottom - original.y});
});

test('southwest resize keeps the right edge fixed while moving the left edge', () => {
  const original = {x: 620, y: 130, width: 420, height: 350};
  assert.deepEqual(resizePanelRect(original, -80, 45, 'sw', desktopBounds),
    {x: 540, y: 130, width: 500, height: 395});
  assert.deepEqual(resizePanelRect(original, 1000, -1000, 'sw', desktopBounds),
    {x: original.x + original.width - desktopBounds.minWidth,
      y: original.y, width: desktopBounds.minWidth,
      height: desktopBounds.minHeight});
  assert.deepEqual(resizePanelRect(original, -1000, 1000, 'sw', desktopBounds),
    {x: desktopBounds.left, y: original.y,
      width: original.x + original.width - desktopBounds.left,
      height: desktopBounds.bottom - original.y});
});

test('an undersized viewport wins over configured minimum dimensions', () => {
  const narrowBounds = {
    left: 12, top: 20, right: 228, bottom: 380,
    minWidth: 320, minHeight: 420,
  };
  const oversized = {x: -100, y: -100, width: 600, height: 600};
  const expected = {x: 12, y: 20, width: 216, height: 360};
  assert.deepEqual(clampPanelRect(oversized, narrowBounds), expected);
  assert.deepEqual(resizePanelRect(expected, 200, 200, 'se', narrowBounds), expected);
});
