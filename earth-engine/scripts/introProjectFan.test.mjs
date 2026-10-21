import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {LIVE_PROJECTS} from '../src/liveProjectsData.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/intro.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/intro.js', import.meta.url), 'utf8')
  .replace(/^import '\.\/intro\.css';\s*/, '').replace(/^export /gm, '');
const origin = 'https://staging.batikanor.com/';
const decode = text => text.replace(/&(?:amp|quot|lt|gt|#39);/g,
  entity => ({'&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'"})[entity]);
const attributes = markup => Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)]
  .map(([, key, value]) => [key, decode(value)]));
const fanStart = /<div\b[^>]*\bid="intro-project-fan"[^>]*>/.exec(html)?.index;
assert.ok(Number.isInteger(fanStart), 'the actual entrance contains the project fan');
const fanMarkup = html.slice(fanStart, html.indexOf('<a id="intro-live-projects"', fanStart));

// The fan contains explicit, balanced native markup. Keep its real ancestry so
// a nested external anchor cannot accidentally pass as a separate source link.
function parseFan(markup) {
  const root = {tag: 'fragment', children: []}, stack = [root];
  for (const match of markup.matchAll(/<(\/?)([a-z][\w:-]*)\b([^>]*?)\/?\s*>/gi)) {
    const [, closing, tagName, attrs] = match, tag = tagName.toLowerCase();
    if (closing) {
      const node = stack.pop();
      assert.equal(node.tag, tag, 'project fan tags remain balanced');
      node.raw = markup.slice(node.start, match.index + match[0].length);
    } else {
      const parent = stack.at(-1), node = {tag, attrs: attributes(attrs), children: [], parent, start: match.index, raw: match[0]};
      parent.children.push(node);
      if (!/\/\s*>$/.test(match[0]) && !['img', 'br', 'hr', 'input', 'source'].includes(tag)) stack.push(node);
    }
  }
  assert.equal(stack.length, 1, 'the complete project fan was parsed');
  return root.children[0];
}
const descendants = node => node.children.flatMap(child => [child, ...descendants(child)]);
const hasClass = (node, name) => (node.attrs?.class || '').split(/\s+/).includes(name);
const text = node => decode(node.raw.replace(/<[^>]*>/g, '')).trim();
const fan = parseFan(fanMarkup);
const windows = descendants(fan).filter(node => node.attrs['data-project']);
const card = id => windows.find(node => node.attrs['data-project'] === id);
const internal = window => descendants(window).find(node => node.tag === 'a' && hasClass(node, 'intro-project-open'));
const external = window => window.children.find(node => node.tag === 'a' && hasClass(node, 'intro-project-domain'));
const surface = window => window.children.find(node => node.tag === 'button' && hasClass(node, 'intro-project-surface'));
const genericCTA = attributes(/<a\b([^>]*\bid="intro-live-projects"[^>]*)>/.exec(html)?.[1] || '');

test('all four cards separate native selection buttons from one content-sized logo destination', () => {
  assert.equal(windows.length, LIVE_PROJECTS.length);
  assert.deepEqual(windows.map(window => window.attrs['data-project']), LIVE_PROJECTS.map(project => project.id));
  for (const project of LIVE_PROJECTS) {
    const window = card(project.id), link = internal(window);
    assert.ok(link, `${project.name}: its logo is an actual native link`);
    assert.equal(descendants(window).filter(node => node.tag === 'a' && hasClass(node, 'intro-project-open')).length, 1,
      'one logo anchor serves every front/rear state without duplicate links');
    assert.ok(hasClass(link.parent, 'intro-project-body'), 'only the logo content lives inside its exploration link');
    assert.equal(descendants(link).some(node => hasClass(node, 'intro-project-header') || node.tag === 'button'), false,
      'header and bare-card selection remain outside the logo hit area');
    const route = new URL(link.attrs.href, origin);
    assert.equal(route.origin, new URL(origin).origin);
    assert.equal(route.pathname, '/');
    assert.equal(route.searchParams.get('view'), 'live-projects');
    assert.equal(route.searchParams.get('project'), project.id);
    assert.deepEqual([...route.searchParams.keys()].sort(), ['project', 'view']);
    assert.equal(route.hash, '');
    assert.ok(!link.attrs.target || link.attrs.target === '_self', 'internal exploration keeps normal same-tab navigation');
    assert.equal(link.attrs['aria-label'], `Explore ${project.name}`);
    for (const node of [window, link]) {
      assert.equal(node.attrs.role === 'button', false);
      assert.equal(node.attrs['aria-pressed'], undefined, 'a direct route is not advertised as a selection toggle');
      assert.equal(node.attrs.onclick, undefined, 'native navigation needs no click handler');
    }
    const button = surface(window);
    assert.ok(button, `${project.name}: the bare card has a genuine native selection button`);
    assert.equal(button.attrs.type, 'button');
    assert.equal(button.attrs['data-select-project'], project.id);
    assert.equal(button.attrs['aria-label'], `Bring ${project.name} to the front`);
    assert.equal(button.attrs['aria-pressed'], String(project.id === 'maptheory'));
    assert.equal(descendants(button).some(node => node.tag === 'a'), false, 'selection never contains navigation');
    assert.equal(window.attrs['data-project-name'], project.name);
  }
  assert.equal(descendants(fan).filter(node => node.tag === 'button').length, LIVE_PROJECTS.length);
  assert.equal(genericCTA.href, '/?view=live-projects', 'the generic exploration CTA keeps its original destination');
});

test('each project exposes its canonical website as a separate safely opened external URL link', () => {
  const allAnchors = descendants(fan).filter(node => node.tag === 'a');
  assert.equal(allAnchors.length, LIVE_PROJECTS.length * 2);
  for (const project of LIVE_PROJECTS) {
    const window = card(project.id), explore = internal(window), website = external(window);
    assert.ok(website, `${project.name}: its URL is an actual external anchor`);
    assert.equal(website.parent, window, 'the website URL remains outside the logo/body action');
    assert.notEqual(website, explore);
    assert.equal(website.attrs.href, project.url, `${project.name}: use the canonical public homepage`);
    assert.equal(new URL(website.attrs.href).searchParams.has('portfolio-preview'), false,
      'an embedding-only preview URL cannot replace the public website');
    assert.equal(text(website), project.domain);
    assert.equal(website.attrs.target, '_blank');
    const rel = new Set((website.attrs.rel || '').split(/\s+/));
    assert.ok(rel.has('noopener') && rel.has('noreferrer'));
    assert.match(website.attrs['aria-label'], /opens in a new tab/i);
    assert.equal(website.attrs['aria-hidden'], undefined);
    for (const anchor of [explore, website]) assert.equal(descendants(anchor).some(node => node.tag === 'a'), false,
      'anchors cannot be nested or depend on browser HTML repairs');
  }
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.ok(rules.some(([, selectors, declarations]) => selectors.split(',').some(selector => selector.trim() === '.intro-project-domain') &&
    /text-decoration:\s*underline\b/.test(declarations)), 'website URLs retain an explicit link underline');
});

test('the initial Maptheory foreground has one logo while every card retains its original identity for selection', () => {
  const foreground = windows.filter(window => window.attrs['data-front'] === 'true');
  assert.equal(foreground.length, 1);
  assert.equal(foreground[0], card('maptheory'));
  assert.equal(foreground[0].attrs['data-slot'], String(windows.length - 1));
  assert.deepEqual(windows.map(window => Number(window.attrs['data-slot'])).sort(), [0, 1, 2, 3]);
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selectors]) => selectors.trim() ===
    '.intro-project-window[data-front="true"] .intro-project-header');
  assert.ok(rule && /display:\s*none\b/.test(rule[2]), 'the foreground header cannot duplicate the central brand');
  const brand = descendants(foreground[0]).find(node => hasClass(node, 'intro-project-brand'));
  assert.ok(brand);
  assert.equal(text(brand), 'Maptheory');
  const mapLogo = descendants(brand).find(node => node.tag === 'img');
  assert.equal(new URL(mapLogo.attrs.src, origin).pathname, '/assets/intro-projects/maptheory.svg');
  for (const project of LIVE_PROJECTS) {
    const header = descendants(card(project.id)).find(node => hasClass(node, 'intro-project-header'));
    assert.ok(header, `${project.name}: preserve the native original header markup`);
    const name = descendants(header).find(node => hasClass(node, 'intro-project-name'));
    assert.equal(text(name).toLowerCase(), project.name.toLowerCase());
  }
  const nasaLogo = descendants(card('space-cottbus')).find(node => node.tag === 'img');
  assert.equal(new URL(nasaLogo.attrs.src, origin).pathname, '/assets/intro-projects/space-cottbus.svg');
  const tileLogo = descendants(card('cottbus')).find(node => node.tag === 'svg' && hasClass(node, 'intro-project-mark'));
  assert.equal(descendants(tileLogo).filter(node => node.tag === 'rect').length, 3, 'preserve the original three-tile Cottbus mark');
  const gralobe = descendants(card('gralobe')).find(node => hasClass(node, 'intro-gralobe-wordmark'));
  assert.equal(text(gralobe), 'gralobe');
});

test('the achievement gate retains its cold-start, first-choice and re-entry lifecycle independently of the fan controller', async () => {
  const nodes = {}, reads = [], label = {textContent: 'Explore achievements'};
  const classNames = new Set(), document = {activeElement: null, documentElement: {classList: {
    add: name => classNames.add(name), remove: name => classNames.delete(name),
  }}};
  for (const id of ['intro-enter', 'intro-screen', 'app', 'intro-fallback-link', 'intro-load-status']) {
    const listeners = new Map();
    nodes[id] = {hidden: false, inert: false, disabled: id === 'intro-enter', textContent: '', listeners,
      classList: {remove() {}}, querySelector: () => label,
      addEventListener(name, callback) {if (!listeners.has(name)) listeners.set(name, []);listeners.get(name).push(callback);},
      click() {if (!this.disabled) for (const callback of listeners.get('click') || []) callback();},
      focus() {document.activeElement = this;},
    };
  }
  document.getElementById = id => {
    reads.push(id);
    assert.ok(id !== 'intro-project-fan' && id !== 'intro-live-projects', 'native project links require no entrance initializer');
    return nodes[id];
  };
  const history = {state: {utm_source: 'friend'}, replaceState(state) {this.state = state;}};
  const context = {document, history, location: {href: origin}, requestAnimationFrame: callback => callback()};
  runInNewContext(source, context, {filename: 'intro.js'});
  assert.equal(context.requestIntroEntry({eventSlug: 'tesla-gigathon-2026'}), false);
  let entry = context.waitForIntroEntry({destination: 'gallery'}), resolved = false;
  entry.then(() => {resolved = true;});await Promise.resolve();
  assert.equal(resolved, false, 'native project routes do not trigger the achievements gate');
  assert.equal(history.state.earthIntroVisible, true);
  assert.equal(context.requestIntroEntry({eventSlug: 'tesla-gigathon-2026'}), true);
  assert.equal(JSON.stringify(await entry), '{"eventSlug":"tesla-gigathon-2026"}');
  assert.equal(context.requestIntroEntry({eventSlug: 'decarbon-days-climathon-2026'}), false);
  assert.equal(nodes['intro-enter'].disabled, true);
  assert.equal(label.textContent, 'Opening…');
  assert.equal(nodes['intro-load-status'].textContent, 'Opening the gallery…');
  assert.equal(history.state.earthIntroVisible, false);
  assert.equal(history.state.utm_source, 'friend');
  for (let visit = 0; visit < 4; visit++) {
    context.finishIntro({focusTarget: null});
    assert.equal(nodes['intro-screen'].hidden, true);
    assert.equal(nodes['intro-screen'].inert, true);
    entry = context.waitForIntroEntry({destination: 'gallery'});
    assert.equal(nodes['intro-screen'].hidden, false);
    assert.equal(nodes['intro-screen'].inert, false);
    assert.equal(nodes.app.inert, true);
    assert.equal(document.activeElement, nodes['intro-enter']);
    assert.equal(nodes['intro-enter'].listeners.get('click').length, 1, 're-entry does not duplicate achievement activation');
    nodes['intro-enter'].click();
    assert.equal(JSON.stringify(await entry), '{}');
    assert.equal(genericCTA.href, '/?view=live-projects');
  }
  assert.equal(reads.some(id => id === 'intro-project-fan' || id === 'intro-live-projects'), false);
});
