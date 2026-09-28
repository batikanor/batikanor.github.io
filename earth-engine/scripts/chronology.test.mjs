import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getChronologyState,
  parseAchievementDate,
  sortAchievementsNewestFirst,
  stepChronology
} from '../src/chronology.js';

const achievements = JSON.parse(readFileSync(new URL('../src/data/achievements.json', import.meta.url), 'utf8'));

test('parses month, day, year and date ranges without inventing a day', () => {
  const month = parseAchievementDate('02/2024');
  assert.equal(new Date(month.start).toISOString(), '2024-02-01T00:00:00.000Z');
  assert.equal(new Date(month.end).toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(new Date(parseAchievementDate('05/15/2026 - 05/17/2026').end).toISOString(), '2026-05-17T00:00:00.000Z');
  assert.equal(new Date(parseAchievementDate('12/2024 - 01/2025').end).toISOString(), '2025-01-31T00:00:00.000Z');
  assert.equal(new Date(parseAchievementDate('2023').start).toISOString(), '2023-01-01T00:00:00.000Z');
  assert.equal(new Date(parseAchievementDate('2023').end).toISOString(), '2023-12-31T00:00:00.000Z');
});

test('rejects malformed calendar values and backwards ranges', () => {
  for (const date of ['02/30/2024', '13/2024', '02/2023 - 01/2023', '2024/05', '']) {
    assert.throws(() => parseAchievementDate(date));
  }
});

test('orders all real achievements newest to oldest, including exact May 2026 ranges', () => {
  const ordered = sortAchievementsNewestFirst(achievements);
  assert.equal(ordered.length, 32);
  assert.deepEqual(ordered.slice(0, 5).map(({ slug }) => slug), [
    'tesla-gigathon-2026',
    'hong-kong-talent-engage-eurotech-healthtech-2026',
    'decarbon-days-climathon-2026',
    'zero-one-hack-supercompute-industrial-2026',
    'pdm-kill-the-search-bar-2026'
  ]);
  assert.deepEqual(ordered.slice(-2).map(({ slug }) => slug), ['bachelors-thesis', 'tgu-perfect-gpa']);
  assert.deepEqual(achievements.slice(0, 5).map(({ slug }) => slug), [
    'tesla-gigathon-2026',
    'hong-kong-talent-engage-eurotech-healthtech-2026',
    'decarbon-days-climathon-2026',
    'pdm-kill-the-search-bar-2026',
    'zero-one-hack-supercompute-industrial-2026'
  ], 'source array is not mutated');
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(parseAchievementDate(ordered[i - 1].date).end >= parseAchievementDate(ordered[i].date).end);
  }
});

test('one-by-one navigator starts newest, has stable equal-month ties and bounded ends', () => {
  const ordered = sortAchievementsNewestFirst(achievements);
  assert.equal(stepChronology(ordered, null, 'next').slug, 'tesla-gigathon-2026');
  assert.equal(stepChronology(ordered, null, 'previous'), null);
  assert.equal(stepChronology(ordered, ordered[0].slug, 'previous'), null);
  assert.equal(stepChronology(ordered, ordered[0].slug, 'next').slug, ordered[1].slug);
  assert.equal(stepChronology(ordered, ordered.at(-1).slug, 'next'), null);
  assert.equal(stepChronology(ordered, ordered.at(-1).slug, 'previous').slug, ordered.at(-2).slug);
  const state = getChronologyState(ordered, ordered[10].slug);
  assert.equal(state.index, 10);
  assert.equal(state.total, 32);
  assert.equal(state.previous.slug, ordered[9].slug);
  assert.equal(state.current.slug, ordered[10].slug);
  assert.equal(state.next.slug, ordered[11].slug);
  assert.deepEqual(sortAchievementsNewestFirst([
    { slug: 'editor-first', date: '06/2026' }, { slug: 'editor-second', date: '06/2026' }
  ]).map(({ slug }) => slug), ['editor-first', 'editor-second']);
  assert.throws(() => stepChronology(ordered, null, 'earlier'));
});
