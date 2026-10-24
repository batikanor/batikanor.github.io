import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function parseRules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selector, body]) => {
    const declarations = Object.fromEntries(body.split(';').filter(value => value.includes(':')).map(value => {
      const separator = value.indexOf(':');
      return [value.slice(0, separator).trim(), value.slice(separator + 1).trim()];
    }));
    return selector.split(',').map(value => ({ selector: value.trim(), declarations }));
  });
}

function readRules(filename) {
  return parseRules(readFileSync(new URL(`../src/${filename}`, import.meta.url), 'utf8'));
}

function mediaRules(filename, condition) {
  const css = readFileSync(new URL(`../src/${filename}`, import.meta.url), 'utf8');
  const marker = `@media ${condition} {`;
  const rules = [];
  let offset = 0;
  while ((offset = css.indexOf(marker, offset)) !== -1) {
    const start = offset + marker.length;
    let depth = 1;
    let end = start;
    while (end < css.length && depth > 0) {
      if (css[end] === '{') depth += 1;
      if (css[end] === '}') depth -= 1;
      end += 1;
    }
    assert.equal(depth, 0, `${condition} has balanced styles`);
    rules.push(...parseRules(css.slice(start, end - 1)));
    offset = end;
  }
  assert.ok(rules.length, `${condition} has explicitly scoped styles`);
  return rules;
}

const shared = readRules('statPennants.css');
const intro = readRules('intro.css');
const studio = readRules('liveProjects.css');
const matching = (rules, selector) => rules.filter(rule => rule.selector === selector).map(rule => rule.declarations);
const first = (rules, selector) => {
  const rule = matching(rules, selector)[0];
  assert.ok(rule, `${selector} has an explicit style`);
  return rule;
};

function assertSize(rule, expected) {
  assert.ok(rule, 'the responsive pennant style exists');
  for (const [property, value] of Object.entries(expected)) {
    assert.equal(rule[`--stat-${property}`], `${value}px`, `${property} retains the larger responsive size`);
  }
}

test('visitor captions always show unique regardless of entrance or studio selection', () => {
  assert.equal(first(shared, '.stat-pennant-caption > .stat-pennant-unique').display, 'inline');
  assert.equal(shared.some(rule => rule.selector.includes('stat-pennant-unique') && /data-front|is-selected/.test(rule.selector)), false,
    'visitor wording never depends on the selected card');
});

test('GitHub stars have a steady brighter gold shine without animation', () => {
  const star = first(shared, '.stat-pennant--github .stat-pennant-value::after');
  assert.equal(star.content, '"★"');
  assert.equal(star.color, '#d59b16');
  assert.ok(star['text-shadow'] && star['text-shadow'] !== 'none', 'the star has a visible highlight');
  assert.equal(shared.some(rule => Object.keys(rule.declarations).some(property => property.startsWith('animation'))), false);
});

test('only native linked pennants advertise interaction while visitor figures stay plain', () => {
  assert.equal(first(shared, '.stat-pennant').cursor, 'default');
  assert.equal(first(shared, 'a.stat-pennant').cursor, 'pointer');
  assert.ok(first(shared, 'a.stat-pennant:focus-visible').outline, 'native links have a keyboard focus indicator');
  assert.ok(first(shared, 'a.stat-pennant:hover::before').filter, 'native links have hover feedback');
  for (const rule of shared.filter(rule => /:(?:hover|focus)/.test(rule.selector))) {
    assert.ok(rule.selector.split(',').every(selector => selector.trim().startsWith('a.stat-pennant')),
      'non-clickable visitor pennants never receive link interaction styling');
  }
});

test('entrance pennants gain one pixel of count and caption type with larger cards and wordmarks', () => {
  const front = matching(intro, '.intro-project-stats');
  const rear = matching(intro, '.intro-project-window:not([data-front="true"]) .intro-project-stats');
  assertSize(front[0], { 'font-size': 13, 'label-size': 7, width: 126, height: 29, 'brand-width': 41 });
  assertSize(rear[0], { 'font-size': 9, 'label-size': 6, width: 99, height: 21, 'brand-width': 32 });
  assertSize(front[1], { 'font-size': 9, 'label-size': 5.5, width: 74, height: 21, 'brand-width': 27 });
  assertSize(rear[1], { 'font-size': 9, width: 76, height: 16, 'brand-width': 28 });
  assert.equal(rear[1]['--stat-label-size'] ?? rear[0]['--stat-label-size'], '6px');
  assert.equal(front[0]['justify-self'], 'end', 'larger pennants stay on the right');
  assert.ok(rear.every(rule => Number.parseFloat(rule.right ?? rear[0].right) >= 0), 'rear pennants retain their right inset');
});

test('studio pennants gain one pixel in desktop and phone layouts including visitor captions', () => {
  const pennants = matching(studio, '.live-projects-window-stats');
  assertSize(pennants[0], { 'font-size': 17, 'label-size': 9, width: 150, height: 36, 'brand-width': 50 });
  assertSize(pennants[1], { 'font-size': 11, 'label-size': 7.5, width: 84, height: 31, 'brand-width': 30 });
  assertSize(first(studio, '.has-visitor-stats .live-projects-window-stats'), { 'label-size': 6, height: 25 });
  const bars = matching(studio, '.live-projects-browser-bar.has-project-stats').filter(rule => rule['grid-template-columns']);
  for (const [index, pennant] of pennants.entries()) {
    assert.ok(bars[index]['grid-template-columns'].includes(pennant['--stat-width']),
      'the browser bar reserves the full wider pennant column');
  }
});

test('small rear pennants reserve room above their independent website link', () => {
  const rear = matching(intro, '.intro-project-window:not([data-front="true"]) .intro-project-stats').find(rule => rule['--stat-width'] === '76px');
  const domain = matching(intro, '.intro-project-gralobe:not([data-front="true"]) .intro-project-domain').at(-1);
  const stackBottom = Number.parseFloat(rear.top) + 2 * Number.parseFloat(rear['--stat-height']) + Number.parseFloat(rear['--stat-gap']);
  assert.ok(Number.parseFloat(domain.top) >= stackBottom + 2,
    'the larger GitHub/npm stack keeps a separate website link below it');
  assert.equal(first(intro, '.intro-exploration')['grid-template-columns'], 'repeat(2, minmax(0, 1fr))',
    'the entrance retains side-by-side exploration choices');
});

test('desktop entrance pennants grow substantially within a wider and taller fan', () => {
  const desktop = mediaRules('intro.css', '(min-width: 761px)');
  assertSize(first(desktop, '.intro-project-stats'), { 'font-size': 17, 'label-size': 10, width: 160, height: 40, 'brand-width': 52 });
  assertSize(first(desktop, '.intro-project-window:not([data-front="true"]) .intro-project-stats'), { 'font-size': 12, 'label-size': 9, width: 124, height: 28, 'brand-width': 40 });
  const exploration = first(desktop, '.intro-exploration');
  assert.equal(exploration.width, 'min(100%, 720px)');
  assert.equal(exploration['--intro-visual-size'], 'calc(max(var(--intro-map-size), 232px) + 80px)');
  assert.equal(first(desktop, '.intro-project-fan').width, 'min(100%, 340px)');
  const card = first(desktop, '.intro-project-window');
  assert.equal(card.top, 'calc(14px + var(--fan-slot) * 64px)');
  assert.equal(card.left, 'calc(14px + (1.5 - var(--fan-slot)) * 6px)');
  assert.equal(card.width, 'calc(100% - 28px)');
  assert.equal(card.height, 'calc(var(--intro-visual-size) - 216px)');
  assert.equal(first(desktop, '.intro-project-gralobe[data-front="true"]').height, 'calc(var(--intro-visual-size) - 202px)');
  const css = readFileSync(new URL('../src/intro.css', import.meta.url), 'utf8');
  assert.ok(css.includes('@container intro-fan (height < 322px)'), 'branding tracks the additional desktop fan height');
  const phone = mediaRules('intro.css', '(max-width: 760px)');
  assert.equal(first(phone, '.intro-exploration')['--intro-visual-size'], 'calc(max(var(--intro-map-size), 208px) + 32px)',
    'phone fan height remains at the reviewed size');
});

test('desktop studio pennants reserve larger header columns without shrinking previews', () => {
  const desktop = mediaRules('liveProjects.css', '(min-width: 750px)');
  assertSize(first(desktop, '.live-projects-window-stats'), { 'font-size': 22, 'label-size': 12, width: 180, height: 48, 'brand-width': 60 });
  const bar = first(desktop, '.live-projects-browser-bar.has-project-stats');
  assert.equal(bar['grid-template-columns'], '28px minmax(0, 1fr) 180px 28px');
  assert.equal(bar['min-height'], '110px');
  assert.equal(first(desktop, '.live-projects-card').height, 'clamp(226px, calc(27vh + 16px), 296px)');
  const short = mediaRules('liveProjects.css', '(max-height: 660px) and (min-width: 750px)');
  assert.equal(matching(short, '.live-projects-card').at(-1).height, '226px');
  const phone = mediaRules('liveProjects.css', '(max-width: 749px)');
  assertSize(first(phone, '.live-projects-window-stats'), { 'font-size': 11, 'label-size': 7.5, width: 84, height: 31, 'brand-width': 30 });
  assert.equal(first(phone, '.live-projects-card').height, 'auto', 'phone card sizing remains unchanged');
});

test('narrow desktops recover header space instead of reducing the larger statistics', () => {
  const compact = mediaRules('liveProjects.css', '(min-width: 750px) and (max-width: 900px)');
  const bar = first(compact, '.live-projects-browser-bar.has-project-stats');
  assert.equal(bar['grid-template-columns'], '0 minmax(0, 1fr) 180px 24px');
  assert.equal(bar['column-gap'], '4px');
  assert.equal(bar['padding-inline'], '6px');
  assert.equal(first(compact, '.live-projects .has-project-stats .live-projects-browser-dots').display, 'none');
  assert.equal(first(compact, '.has-project-stats .live-projects-tab-caption').gap, '6px');
  assert.equal(matching(compact, '.live-projects-window-stats').length, 0, 'statistics keep the desktop scale');
});
