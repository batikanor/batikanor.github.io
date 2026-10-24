import test from 'node:test';
import assert from 'node:assert/strict';
import { mountNpmDownloads } from '../src/npmDownloads.js';

const reply = (downloads, start, end = start, packageName = 'gralobe') => ({
  ok: true,
  json: async () => ({ downloads, start, end, package: packageName }),
});
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(publishedOn = '2025-11-29') {
  const node = { dataset: { npmPackage: 'gralobe', npmPublishedOn: publishedOn }, textContent: '', title: '', isConnected: true };
  const requests = [];
  const fetcher = (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
  const controller = mountNpmDownloads(node, { fetch: fetcher });
  return { node, requests, controller, fetcher };
}

function pennantFixture() {
  const countNode = { textContent: '' };
  const brandNode = { className: 'stat-pennant-brand' };
  const labelNode = { textContent: 'downloads' };
  const attributes = new Map();
  const children = [brandNode, { children: [countNode] }, labelNode];
  const node = {
    dataset: { npmPackage: 'gralobe', npmPublishedOn: '2025-11-29' },
    children,
    title: '',
    isConnected: true,
    querySelector: selector => selector === '[data-npm-count]' ? countNode : null,
    setAttribute: (name, value) => attributes.set(name, value),
    set textContent(value) { throw new Error(`Pennant children replaced with ${value}`); },
  };
  const requests = [];
  const fetcher = (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
  const controller = mountNpmDownloads(node, { fetch: fetcher });
  return { node, countNode, brandNode, labelNode, attributes, children, requests, controller };
}

test('structured pennants preserve branding and labels while updating count and accessible range', async () => {
  const state = pennantFixture();
  assert.equal(state.countNode.textContent, '…');
  assert.equal(state.attributes.get('aria-label'), 'npm downloads…');
  state.requests[0].resolve(reply(0, '2026-10-18'));
  await settle();
  state.requests[1].resolve(reply(9723, '2025-11-29', '2026-10-18'));
  await settle();
  assert.equal(state.countNode.textContent, '9,723');
  assert.equal(state.attributes.get('aria-label'), '9,723 npm downloads');
  assert.equal(state.node.title, 'npm downloads since publication: 2025-11-29–2026-10-18. Fetched from npm.');
  assert.equal(state.node.children, state.children);
  assert.equal(state.children[0], state.brandNode);
  assert.equal(state.children[2], state.labelNode);
  assert.equal(state.labelNode.textContent, 'downloads');
  const refreshed = state.controller.refresh();
  assert.equal(state.countNode.textContent, '…');
  assert.equal(state.node.title, '');
  state.requests[2].reject(new Error('Network unavailable'));
  await refreshed;
  assert.equal(state.countNode.textContent, '—');
  assert.equal(state.attributes.get('aria-label'), 'npm downloads unavailable');
  assert.equal(state.node.children, state.children);
  state.controller.dispose();
});

test('structured pennant cancellation and disposal prevent stale count or accessible-label writes', async () => {
  const state = pennantFixture();
  const refreshed = state.controller.refresh();
  assert.equal(state.requests[0].options.signal.aborted, true);
  state.requests[0].resolve(reply(0, '2026-10-17'));
  await settle();
  assert.equal(state.requests.length, 2);
  assert.equal(state.countNode.textContent, '…');
  state.requests[1].resolve(reply(0, '2026-10-18'));
  await settle();
  state.requests[2].resolve(reply(10000, '2025-11-29', '2026-10-18'));
  await refreshed;
  assert.equal(state.countNode.textContent, '10,000');
  assert.equal(state.attributes.get('aria-label'), '10,000 npm downloads');
  const disposed = state.controller.refresh();
  state.controller.dispose();
  state.requests[3].resolve(reply(0, '2026-10-19'));
  await disposed;
  assert.equal(state.requests[3].options.signal.aborted, true);
  assert.equal(state.requests.length, 4);
  assert.equal(state.countNode.textContent, '…');
  assert.equal(state.attributes.get('aria-label'), 'npm downloads…');
  assert.equal(state.node.children, state.children);
});

test('uses npm’s latest available day and fetches a fresh total rather than a fixed fallback', async () => {
  const state = fixture();
  assert.equal(state.node.textContent, 'npm downloads…');
  assert.equal(state.requests[0].url, 'https://api.npmjs.org/downloads/point/last-day/gralobe');
  assert.equal(state.requests[0].options.credentials, 'omit');
  assert.equal(state.requests[0].options.cache, 'no-cache');
  state.requests[0].resolve(reply(2, '2026-10-18'));
  await settle();
  assert.equal(state.requests[1].url, 'https://api.npmjs.org/downloads/point/2025-11-29:2026-10-18/gralobe');
  state.requests[1].resolve(reply(9723, '2025-11-29', '2026-10-18'));
  await settle();
  assert.equal(state.node.textContent, '9,723 npm downloads');
  assert.equal(state.node.title, 'npm downloads since publication: 2025-11-29–2026-10-18. Fetched from npm.');
  state.controller.dispose();
});

test('sums inclusive non-overlapping windows safely beyond npm’s 18-month limit', async () => {
  const state = fixture('2024-01-01');
  state.requests[0].resolve(reply(0, '2026-10-18'));
  await settle();
  const ranges = [
    ['2024-01-01', '2024-12-30', 100],
    ['2024-12-31', '2025-12-30', 200],
    ['2025-12-31', '2026-10-18', 300],
  ];
  for (const [index, [start, end, downloads]] of ranges.entries()) {
    assert.equal(state.requests[index + 1].url, `https://api.npmjs.org/downloads/point/${start}:${end}/gralobe`);
    state.requests[index + 1].resolve(reply(downloads, start, end));
    await settle();
  }
  assert.equal(state.requests.length, 4);
  assert.equal(state.node.textContent, '600 npm downloads');
  state.controller.dispose();
});

test('invalid metadata, counts, package identity and ranges never produce a total', async () => {
  const failures = [
    { first: reply(-1, '2026-10-18') },
    { first: reply(1.5, '2026-10-18') },
    { first: reply(Number.MAX_SAFE_INTEGER + 1, '2026-10-18') },
    { first: reply(0, '2026-02-30') },
    { first: reply(0, '2026-10-17', '2026-10-18') },
    { first: reply(0, '2026-10-18', '2026-10-18', 'another-package') },
    { first: reply(0, '2025-01-01') },
    { first: { ok: false } },
    { first: reply(0, '2026-10-18'), total: reply(100, '2025-11-30', '2026-10-18') },
    { first: reply(0, '2026-10-18'), total: reply(100, '2025-11-29', '2026-10-19') },
    { first: reply(0, '2026-10-18'), total: reply(100, '2025-11-29', '2026-10-18', 'other') },
  ];
  for (const failure of failures) {
    const state = fixture();
    state.requests[0].resolve(failure.first);
    await settle();
    if (failure.total) {
      state.requests[1].resolve(failure.total);
      await settle();
    }
    assert.equal(state.node.textContent, 'npm downloads unavailable');
    assert.equal(state.node.title, '');
    state.controller.dispose();
  }
  const invalid = fixture('2025-11-31');
  assert.equal(invalid.requests.length, 0);
  assert.equal(invalid.node.textContent, 'npm downloads unavailable');
  invalid.controller.dispose();
});

test('sum overflow is rejected instead of rounding a reported total', async () => {
  const state = fixture('2025-01-01');
  state.requests[0].resolve(reply(0, '2026-10-18'));
  await settle();
  state.requests[1].resolve(reply(Number.MAX_SAFE_INTEGER, '2025-01-01', '2025-12-31'));
  await settle();
  state.requests[2].resolve(reply(1, '2026-01-01', '2026-10-18'));
  await settle();
  assert.equal(state.node.textContent, 'npm downloads unavailable');
  assert.equal(state.node.title, '');
  state.controller.dispose();
});

test('refresh aborts the previous request and ignores a response already in flight', async () => {
  const state = fixture();
  const refreshed = state.controller.refresh();
  assert.equal(state.requests[0].options.signal.aborted, true);
  state.requests[0].resolve(reply(0, '2026-10-17'));
  await settle();
  assert.equal(state.requests.length, 2);
  state.requests[1].resolve(reply(0, '2026-10-18'));
  await settle();
  state.requests[2].resolve(reply(10000, '2025-11-29', '2026-10-18'));
  await refreshed;
  assert.equal(state.node.textContent, '10,000 npm downloads');
  state.controller.dispose();
});

test('refresh clears previous success and an API failure shows no stale count', async () => {
  const state = fixture();
  state.requests[0].resolve(reply(0, '2026-10-18'));
  await settle();
  state.requests[1].resolve(reply(9723, '2025-11-29', '2026-10-18'));
  await settle();
  const refreshed = state.controller.refresh();
  assert.equal(state.node.textContent, 'npm downloads…');
  assert.equal(state.node.title, '');
  state.requests[2].reject(new Error('Network unavailable'));
  await refreshed;
  assert.equal(state.node.textContent, 'npm downloads unavailable');
  assert.equal(state.node.title, '');
  state.controller.dispose();
});

test('mounting is idempotent and disposal aborts without allowing late detached writes', async () => {
  assert.equal(mountNpmDownloads(null), null);
  const state = fixture();
  assert.equal(mountNpmDownloads(state.node, { fetch: state.fetcher }), state.controller);
  assert.equal(state.requests.length, 1);
  state.requests[0].resolve(reply(0, '2026-10-18'));
  await settle();
  state.controller.dispose();
  state.controller.dispose();
  assert.equal(state.requests[1].options.signal.aborted, true);
  state.requests[1].resolve(reply(9723, '2025-11-29', '2026-10-18'));
  await settle();
  assert.equal(state.node.textContent, 'npm downloads…');
  await state.controller.refresh();
  assert.equal(state.requests.length, 2);
  const remounted = mountNpmDownloads(state.node, { fetch: state.fetcher });
  assert.notEqual(remounted, state.controller);
  assert.equal(state.requests.length, 3);
  remounted.dispose();
});

test('detaching the node before a response prevents success and error writes', async () => {
  for (const success of [true, false]) {
    const state = fixture();
    state.requests[0].resolve(reply(0, '2026-10-18'));
    await settle();
    state.node.isConnected = false;
    if (success) state.requests[1].resolve(reply(9723, '2025-11-29', '2026-10-18'));
    else state.requests[1].reject(new Error('Network unavailable'));
    await settle();
    assert.equal(state.node.textContent, 'npm downloads…');
    assert.equal(state.node.title, '');
    state.controller.dispose();
  }
});
