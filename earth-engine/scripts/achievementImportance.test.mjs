import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {achievementStarFills, achievementStarColor, sortAchievementsByImportance} from '../src/achievementImportance.js';
import {parseAchievementDate} from '../src/chronology.js';
import {achievementStarFills as pdfStarFills} from '../src/exportProjectsPdf.js';

const achievements = JSON.parse(readFileSync(new URL('../src/data/achievements.json', import.meta.url), 'utf8'));

test('shared stars preserve the exact PDF fills, fractional ratings and historical rounded palette', () => {
  assert.equal(pdfStarFills, achievementStarFills, 'the PDF and picker use the same fill function');
  assert.deepEqual(achievementStarFills(8.5), [1, 1, 1, 1, .25]);
  assert.deepEqual(achievementStarFills(9), [1, 1, 1, 1, .5]);
  assert.deepEqual(achievementStarFills(2.75), [1, .375]);
  assert.deepEqual(achievementStarFills(-1), []);
  assert.deepEqual(achievementStarFills('invalid'), []);
  assert.deepEqual(achievementStarFills(12), [1, 1, 1, 1, 1]);
  assert.deepEqual(Array.from({length: 5}, (_, index) => achievementStarColor(index)), [
    [245, 158, 11], [219, 142, 70], [192, 125, 129], [166, 109, 187], [139, 92, 246],
  ]);
  for (const achievement of achievements) {
    assert.equal(achievementStarFills(achievement.importance).reduce((sum, fill) => sum + fill, 0), achievement.importance / 2);
  }
});

test('all 32 achievements sort by importance before chronology without changing authored input', () => {
  const before = achievements.map(achievement => achievement.slug);
  const ordered = sortAchievementsByImportance(achievements);
  assert.equal(ordered.length, 32);
  assert.equal(new Set(ordered.map(achievement => achievement.slug)).size, 32);
  assert.deepEqual(achievements.map(achievement => achievement.slug), before);
  assert.deepEqual(ordered.slice(0, 5).map(achievement => achievement.slug), [
    'hong-kong-talent-engage-eurotech-healthtech-2026',
    'decarbon-days-climathon-2026',
    'decarbon-days-climathon-2025',
    'tgu-perfect-gpa',
    'tesla-gigathon-2026',
  ]);
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1], current = ordered[index];
    assert.ok(previous.importance >= current.importance);
    if (previous.importance === current.importance) {
      assert.ok(parseAchievementDate(previous.date).end >= parseAchievementDate(current.date).end);
    }
  }
});

test('equal importance uses completion dates and stable editorial ties, including fractional and numeric ratings', () => {
  const input = Object.freeze([
    Object.freeze({slug: 'editor-first', importance: 8.5, date: '06/2026'}),
    Object.freeze({slug: 'lower-newer', importance: 7, date: '2026'}),
    Object.freeze({slug: 'highest-older', importance: '9', date: '2023'}),
    Object.freeze({slug: 'editor-second', importance: 8.5, date: '06/2026'}),
    Object.freeze({slug: 'same-rating-older', importance: 8.5, date: '12/2024 - 01/2025'}),
    Object.freeze({slug: 'same-rating-newer', importance: 8.5, date: '07/2026'}),
  ]);
  const ordered = sortAchievementsByImportance(input);
  assert.notEqual(ordered, input);
  assert.deepEqual(ordered.map(achievement => achievement.slug), [
    'highest-older', 'same-rating-newer', 'editor-first', 'editor-second', 'same-rating-older', 'lower-newer',
  ]);
  assert.ok(ordered.every(achievement => input.includes(achievement)), 'sorting preserves the authored records');
  assert.deepEqual(sortAchievementsByImportance([]), []);
  assert.throws(() => sortAchievementsByImportance(null), TypeError);
});
