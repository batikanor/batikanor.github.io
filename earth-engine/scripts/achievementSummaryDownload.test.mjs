import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAchievementSummaryDownload} from '../src/achievementSummaryDownload.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function pending() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return {promise, resolve, reject};
}
function event(type, values = {}) {
  const value = new Event(type, {cancelable: true, bubbles: true});
  for (const [key, entry] of Object.entries(values)) Object.defineProperty(value, key, {value: entry});
  return value;
}

function fixture({decode, toBlob, previewFailure = false} = {}) {
  const photos = [];
  const canvases = [];
  const createdUrls = [];
  const revokedUrls = [];
  const document = {activeElement: null};
  class Element extends EventTarget {
    constructor(tagName) {
      super(); this.tagName = tagName; this.ownerDocument = document;
      this.children = []; this.attributes = new Map(); this.textContent = '';
      this.disabled = false; this.hidden = false; this.open = false;
      this.value = ''; this.checked = false;
    }
    append(...children) { for (const child of children) { this.children.push(child); child.parentElement = this; } }
    remove() {
      if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      this.parentElement = null;
    }
    get isConnected() { return this === document.body || Boolean(this.parentElement?.isConnected); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); if (name === 'src') this.src = ''; }
    focus() { document.activeElement = this; }
    click(values) { if (!this.disabled) this.dispatchEvent(event('click', values)); }
    submit() { this.dispatchEvent(event('submit')); }
    input() { this.dispatchEvent(event('input')); }
    showModal() { this.open = true; this.modalCalls = (this.modalCalls ?? 0) + 1; }
    close() { this.open = false; this.dispatchEvent(event('close')); }
    getBoundingClientRect() { return {left: 100, top: 100, right: 620, bottom: 460}; }
  }
  document.body = new Element('body');
  document.createElement = tag => {
    const element = new Element(tag);
    if (tag === 'canvas') {
      canvases.push(element);
      element.getContext = () => ({drawImage: (...args) => { element.draw = args; }});
      element.toBlob = (callback, mime, quality) => {
        element.mime = mime; element.quality = quality;
        if (toBlob) toBlob(callback, mime, quality);
        else callback({size: 14336});
      };
    }
    return element;
  };
  document.defaultView = {
    Image: class {
      constructor() { photos.push(this); this.naturalWidth = 1200; this.naturalHeight = 1600; }
      decode() { return previewFailure ? Promise.reject(new Error('photo unavailable')) : decode?.promise ?? Promise.resolve(); }
    },
    URL: {
      createObjectURL(blob) { const url = `blob:preview-${createdUrls.length + 1}`; createdUrls.push({url, blob}); return url; },
      revokeObjectURL(url) { revokedUrls.push(url); }
    }
  };
  const button = new Element('button');
  button.textContent = 'Achievements ↓';
  const status = new Element('p'); status.hidden = true;
  document.body.append(button, status); button.focus();
  const nodes = (parent = document.body) => [parent, ...parent.children.flatMap(child => nodes(child))];
  const find = predicate => nodes().find(predicate);
  const name = value => find(node => node.name === value);
  const className = value => find(node => node.className === value);
  const dialog = () => find(node => node.tagName === 'dialog');
  const form = () => find(node => node.tagName === 'form');
  const open = () => button.click();
  const submit = () => form().submit();
  return {document, button, status, photos, canvases, createdUrls, revokedUrls, find, name, className, dialog, form, open, submit};
}

function fakeExporter({load, render, save} = {}) {
  let loads = 0;
  const calls = [];
  const saves = [];
  const loadExporter = async () => {
    loads++;
    if (load) return load(loads);
    return {exportProjectsPdf: async options => {
      calls.push(options);
      if (render) return render(options);
      return {save: async (name, settings) => { saves.push({name, settings}); await save?.(); }};
    }};
  };
  return {loadExporter, calls, saves, get loads() { return loads; }};
}

test('opening native options restores original defaults without loading the PDF engine or an eager image', async t => {
  const f = fixture(); const exporter = fakeExporter();
  const dispose = bindAchievementSummaryDownload(f.button, {status: f.status, loadExporter: exporter.loadExporter});
  t.after(dispose);
  assert.equal(f.dialog(), undefined);
  assert.equal(f.photos.length, 0);
  assert.equal(exporter.loads, 0);
  assert.equal(f.button.getAttribute('aria-haspopup'), 'dialog');
  f.open(); await flush();
  const dialog = f.dialog();
  assert.equal(dialog.open, true);
  assert.equal(dialog.modalCalls, 1, 'native modal provides focus trapping and an inert background');
  assert.equal(f.button.getAttribute('aria-controls'), dialog.id);
  assert.equal(f.button.getAttribute('aria-expanded'), 'true');
  assert.equal(f.find(node => node.id === dialog.getAttribute('aria-labelledby')).textContent, 'Achievements summary');
  assert.equal(dialog.getAttribute('aria-describedby'), null);
  assert.equal(f.name('include-images').checked, true);
  assert.equal(f.name('image-size').value, '100');
  assert.equal(f.name('image-size').min, '20');
  assert.equal(f.name('image-size').max, '100');
  assert.equal(f.name('compress-pdf').checked, true);
  assert.equal(f.name('compression-strength').value, '10');
  assert.equal(f.name('compression-strength').max, '90');
  assert.equal(f.document.activeElement, f.name('include-images'));
  assert.equal(exporter.loads, 0, 'configuration alone never imports jsPDF');
  assert.equal(f.photos.length, 1);
  assert.equal(f.photos[0].src, '/photos/tesla-gigathon/tesla-gigathon-2026-first-place-prize.jpg');
  f.open();
  assert.equal(dialog.modalCalls, 1, 'repeat header taps do not add duplicate dialogs');
});

test('one configured form submission exports all achievements with original defaults and reports progress', async t => {
  const f = fixture(); const render = pending();
  const exporter = fakeExporter({render: () => render.promise});
  const dispose = bindAchievementSummaryDownload(f.button, {status: f.status, loadExporter: exporter.loadExporter});
  t.after(dispose);
  f.open(); f.submit(); f.submit(); await flush();
  assert.equal(exporter.loads, 1);
  assert.equal(exporter.calls.length, 1);
  assert.equal(f.button.disabled, true);
  assert.equal(f.button.getAttribute('aria-busy'), 'true');
  assert.equal(f.className('achievement-summary-fields').disabled, true);
  assert.equal(f.className('achievement-summary-download').disabled, true);
  assert.equal(f.className('achievement-summary-close').textContent, 'Cancel');
  const options = exporter.calls[0];
  assert.equal(options.includeImages, true);
  assert.equal(options.imageScale, 1);
  assert.equal(options.compressPdf, true);
  assert.equal(options.compressionStrength, 0.1);
  assert.equal(options.save, false);
  assert.equal(options.signal.aborted, false);
  options.onProgress({index: 17, total: 32});
  assert.equal(f.className('achievement-summary-status').textContent, 'Preparing achievement 18 of 32…');
  assert.equal(f.className('achievement-summary-progress').value, 17);
  assert.equal(f.className('achievement-summary-progress').max, 32);
  assert.equal(f.status.hidden, true, 'only the modal progress is announced while it is open');
  const saves = [];
  render.resolve({save: async (name, settings) => saves.push({name, settings})});
  await flush();
  assert.deepEqual(saves, [{name: 'batikan-achievements-summary.pdf', settings: {returnPromise: true}}]);
  assert.equal(f.dialog().open, false);
  assert.equal(f.button.disabled, false);
  assert.equal(f.button.getAttribute('aria-busy'), null);
  assert.equal(f.button.textContent, 'Achievements ↓');
  assert.equal(f.document.activeElement, f.button);
  assert.equal(f.status.textContent, 'Achievements summary downloaded.');
  assert.equal(f.status.getAttribute('role'), 'status');
});

test('image and compression choices control both the preview and the exact exporter settings', async t => {
  const f = fixture(); const exporter = fakeExporter();
  const dispose = bindAchievementSummaryDownload(f.button, {loadExporter: exporter.loadExporter});
  t.after(dispose);
  f.open(); await flush();
  f.name('image-size').value = '40'; f.name('image-size').input();
  f.name('compression-strength').value = '70'; f.name('compression-strength').input();
  await flush();
  assert.equal(f.name('image-size').parentElement.children[0].children[1].value, '40%');
  assert.equal(f.name('compression-strength').parentElement.children[0].children[1].value, '70%');
  assert.equal(f.canvases.at(-1).width, 168);
  assert.equal(f.canvases.at(-1).height, 224);
  assert.ok(Math.abs(f.canvases.at(-1).quality - 0.3) < 1e-10);
  f.name('include-images').checked = false; f.name('include-images').input();
  assert.equal(f.name('image-size').parentElement.hidden, true);
  assert.equal(f.name('compression-strength').parentElement.hidden, true);
  assert.equal(f.className('achievement-summary-preview').hidden, true);
  f.name('compress-pdf').checked = false; f.name('compress-pdf').input();
  f.submit(); await flush();
  const options = exporter.calls[0];
  assert.equal(options.includeImages, false);
  assert.equal(options.imageScale, 0.4);
  assert.equal(options.compressPdf, false);
  assert.equal(options.compressionStrength, 0.7);
  f.open();
  assert.equal(f.name('include-images').checked, false, 'choices persist when the dialog is opened again');
  assert.equal(f.name('image-size').value, '40');
  f.name('include-images').checked = true; f.name('include-images').input();
  await flush();
  assert.equal(f.name('compression-strength').parentElement.hidden, true, 'quality is hidden when image compression is off');
  assert.equal(f.canvases.at(-1).quality, 1);
});

test('temporary export failure keeps the dialog and chosen quality available for retry', async t => {
  const f = fixture(); let attempts = 0; let saves = 0;
  const dispose = bindAchievementSummaryDownload(f.button, {status: f.status, loadExporter: async () => {
    if (++attempts === 1) throw new Error('temporary module fetch failure');
    return {exportProjectsPdf: async options => {
      assert.equal(options.imageScale, 0.6);
      return {save: async () => saves++};
    }};
  }});
  t.after(dispose);
  f.open(); f.name('image-size').value = '60'; f.name('image-size').input();
  f.submit(); await flush();
  assert.equal(f.dialog().open, true);
  assert.equal(f.button.disabled, false);
  assert.equal(f.className('achievement-summary-download').disabled, false);
  assert.equal(f.className('achievement-summary-fields').disabled, false);
  assert.match(f.className('achievement-summary-status').textContent, /Please try again/);
  f.submit(); await flush();
  assert.equal(attempts, 2);
  assert.equal(saves, 1);
  assert.equal(f.status.textContent, 'Achievements summary downloaded.');
});

test('Escape, native cancellation and the backdrop close options and restore focus without room keyboard actions', async t => {
  const f = fixture();
  const dispose = bindAchievementSummaryDownload(f.button);
  t.after(dispose);
  f.open();
  const rangeArrow = event('keydown', {key: 'ArrowRight'});
  f.dialog().dispatchEvent(rangeArrow);
  assert.equal(rangeArrow.defaultPrevented, false, 'native sliders retain their arrow-key behavior');
  assert.equal(rangeArrow.cancelBubble, true, 'keyboard events must not reach gallery navigation');
  const escape = event('keydown', {key: 'Escape'});
  f.dialog().dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(f.dialog().open, false);
  assert.equal(f.document.activeElement, f.button);
  f.open();
  const cancel = event('cancel'); f.dialog().dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  assert.equal(f.dialog().open, false);
  f.open(); f.dialog().click({clientX: 200, clientY: 200});
  assert.equal(f.dialog().open, true, 'inside padding does not dismiss options');
  f.dialog().click({clientX: 50, clientY: 50});
  assert.equal(f.dialog().open, false);
  assert.equal(f.button.getAttribute('aria-expanded'), 'false');
});

test('closing during loading cancels the old request and prevents late import or progress from interfering with a retry', async t => {
  const f = fixture(); const load = pending(); const render = pending(); let attempts = 0; let exports = 0; let oldOptions; let saves = 0;
  const dispose = bindAchievementSummaryDownload(f.button, {status: f.status, loadExporter: async () => {
    if (++attempts === 1) return load.promise;
    return {exportProjectsPdf: async options => { oldOptions = options; return render.promise; }};
  }});
  t.after(dispose);
  f.open(); f.submit(); await flush();
  f.className('achievement-summary-close').click();
  assert.equal(f.button.disabled, false);
  assert.equal(f.status.textContent, 'PDF download cancelled.');
  f.open(); f.submit(); await flush();
  assert.equal(f.button.disabled, true);
  load.resolve({exportProjectsPdf: async () => { exports++; }});
  await flush();
  assert.equal(exports, 0, 'cancelled lazy module completion cannot start generation');
  assert.equal(f.button.disabled, true, 'the old request cannot clear the new request busy state');
  f.dialog().dispatchEvent(event('keydown', {key: 'Escape'}));
  assert.equal(oldOptions.signal.aborted, true);
  const statusAtCancel = f.status.textContent;
  oldOptions.onProgress({index: 31, total: 32});
  render.resolve({save: async () => saves++});
  await flush();
  assert.equal(saves, 0);
  assert.equal(f.status.textContent, statusAtCancel);
});

test('external abort disposes the modal, aborts rendering and prevents a stale browser download', async () => {
  const f = fixture(); const controller = new AbortController(); const render = pending();
  const exporter = fakeExporter({render: () => render.promise});
  bindAchievementSummaryDownload(f.button, {status: f.status, signal: controller.signal, loadExporter: exporter.loadExporter});
  f.open(); f.submit(); await flush();
  const options = exporter.calls[0];
  controller.abort();
  const statusAtAbort = f.status.textContent;
  assert.equal(options.signal.aborted, true);
  assert.equal(f.dialog(), undefined);
  assert.equal(f.button.getAttribute('aria-haspopup'), null);
  assert.equal(f.button.getAttribute('aria-controls'), null);
  options.onProgress({index: 31, total: 32});
  let saves = 0;
  render.resolve({save: async () => saves++});
  await flush(); f.open();
  assert.equal(saves, 0);
  assert.equal(f.dialog(), undefined);
  assert.equal(f.status.textContent, statusAtAbort);
  assert.equal(f.button.disabled, false);
  assert.equal(f.button.getAttribute('aria-busy'), null);
});

test('already aborted bindings never create a dialog or fetch an image', () => {
  const f = fixture(); const controller = new AbortController(); controller.abort();
  const exporter = fakeExporter();
  bindAchievementSummaryDownload(f.button, {signal: controller.signal, loadExporter: exporter.loadExporter});
  f.open();
  assert.equal(f.dialog(), undefined);
  assert.equal(f.photos.length, 0);
  assert.equal(exporter.loads, 0);
});

test('quality previews preserve photo dimensions and revoke object URLs on updates and close', async t => {
  const f = fixture();
  const dispose = bindAchievementSummaryDownload(f.button);
  t.after(dispose);
  f.open(); await flush();
  assert.equal(f.canvases[0].width, 420);
  assert.equal(f.canvases[0].height, 560);
  assert.equal(f.canvases[0].mime, 'image/jpeg');
  assert.equal(f.canvases[0].quality, 0.9);
  assert.equal(f.className('achievement-summary-preview').hidden, false);
  assert.equal(f.className('achievement-summary-preview').children[1].textContent, 'Sample preview · 14 KB');
  f.name('compression-strength').value = '90'; f.name('compression-strength').input();
  await flush();
  assert.equal(f.createdUrls.length, 2);
  assert.deepEqual(f.revokedUrls, ['blob:preview-1']);
  f.className('achievement-summary-close').click();
  assert.deepEqual(f.revokedUrls, ['blob:preview-1', 'blob:preview-2']);
  assert.equal(f.className('achievement-summary-preview').children[0].src, '');
  f.open(); await flush();
  assert.equal(f.photos.length, 2, 'closed dialogs release the decoded sample');
});

test('disposal during sample decoding and close during encoding never leak previews into detached UI', async () => {
  const decode = pending(); const f = fixture({decode});
  const dispose = bindAchievementSummaryDownload(f.button);
  f.open(); dispose(); decode.resolve(); await flush();
  assert.equal(f.canvases.length, 0);
  assert.equal(f.createdUrls.length, 0);
  let encode;
  const second = fixture({toBlob: callback => { encode = callback; }});
  const secondDispose = bindAchievementSummaryDownload(second.button);
  second.open(); await flush();
  second.className('achievement-summary-close').click(); encode({size: 12345}); await flush();
  assert.equal(second.createdUrls.length, 0);
  secondDispose();
});

test('a preview failure does not block exporting the report', async t => {
  const f = fixture({previewFailure: true}); const exporter = fakeExporter();
  const dispose = bindAchievementSummaryDownload(f.button, {status: f.status, loadExporter: exporter.loadExporter});
  t.after(dispose);
  f.open(); await flush();
  assert.equal(f.className('achievement-summary-preview').hidden, true);
  f.submit(); await flush();
  assert.equal(exporter.saves.length, 1);
  assert.equal(f.status.textContent, 'Achievements summary downloaded.');
});

test('success clears after three seconds and reopening or disposal cancels old notice timers', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture(); const exporter = fakeExporter();
  const dispose = bindAchievementSummaryDownload(f.button, {status: f.status, loadExporter: exporter.loadExporter});
  t.after(dispose);
  f.open(); f.submit(); await flush();
  assert.equal(f.status.hidden, false);
  t.mock.timers.tick(2999);
  assert.equal(f.status.hidden, false);
  t.mock.timers.tick(1);
  assert.equal(f.status.hidden, true);
  assert.equal(f.status.textContent, '');
  f.open(); f.submit(); await flush();
  t.mock.timers.tick(1000); f.open();
  assert.equal(f.status.hidden, true, 'reopening clears the previous success notice');
  t.mock.timers.tick(3000);
  assert.equal(f.dialog().open, true, 'an older notice timer never closes newly opened options');
  f.submit(); await flush();
  const statusAtDisposal = f.status.textContent;
  dispose(); t.mock.timers.tick(3000);
  assert.equal(f.status.hidden, false, 'disposal prevents late status mutation after navigation');
  assert.equal(f.status.textContent, statusAtDisposal);
});
