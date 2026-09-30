import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {explorerVariant, filterExplorerEvents} from '../src/journeyExplorer.js';
import {sortAchievementsNewestFirst} from '../src/chronology.js';

const achievements = JSON.parse(readFileSync(new URL('../src/data/achievements.json', import.meta.url), 'utf8'));
const ordered = sortAchievementsNewestFirst(achievements);

test('two staging explorer variants, with the labeled tab as default', () => {
  assert.equal(explorerVariant('https://staging.batikanor.com/'), 'tab');
  assert.equal(explorerVariant('https://staging.batikanor.com/?explore=tab'), 'tab');
  assert.equal(explorerVariant('https://staging.batikanor.com/?explore=more&event=tesla-gigathon-2026'), 'more');
  assert.equal(explorerVariant('https://staging.batikanor.com/?explore=unknown'), 'tab');
});

test('the unfiltered index has every achievement in existing newest-first order', () => {
  const result = filterExplorerEvents(ordered, '', event => event.title);
  assert.equal(result.length, 32);
  assert.deepEqual(result.map(event => event.slug), ordered.map(event => event.slug));
  assert.notEqual(result, ordered, 'the helper does not expose the original array for mutation');
});

test('search matches real title, city, country and date without changing order', () => {
  const title = filterExplorerEvents(ordered, 'industrial track', event => event.title);
  assert.equal(title.length, 1);
  assert.equal(title[0].slug, 'zero-one-hack-supercompute-industrial-2026');
  const city = filterExplorerEvents(ordered, 'Cottbus', event => event.title);
  assert.ok(city.length > 1);
  assert.deepEqual(city.map(event => event.slug), ordered.filter(event => event.city === 'Cottbus').map(event => event.slug));
  const date = filterExplorerEvents(ordered, '2026', event => event.title);
  assert.ok(date.length > 0);
  assert.ok(date.every(event => event.date.includes('2026')));
});

test('search is accent-insensitive, case-insensitive and supports separated terms', () => {
  const fixtures = [
    {slug: 'one', title: 'Énergie Prize', city: 'München', country: 'Germany', date: '2026'},
    {slug: 'two', title: 'Space', city: 'Berlin', country: 'Germany', date: '2025'}
  ];
  assert.deepEqual(filterExplorerEvents(fixtures, 'energie MUNCHEN 2026').map(event => event.slug), ['one']);
  assert.deepEqual(filterExplorerEvents(fixtures, 'germany').map(event => event.slug), ['one', 'two']);
  assert.deepEqual(filterExplorerEvents(fixtures, 'none').map(event => event.slug), []);
});
