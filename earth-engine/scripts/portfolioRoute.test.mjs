import test from 'node:test';
import assert from 'node:assert/strict';
import {readPortfolioRoute, portfolioUrl} from '../src/portfolioRoute.js';

const slugs = new Set(['tesla-gigathon-2026', 'sui-hackathon-poland-2025']);

test('old root and projects hashes still open the matching map story', () => {
  assert.deepEqual(readPortfolioRoute('https://batikanor.com/#tesla-gigathon-2026', slugs),
    {eventSlug:'tesla-gigathon-2026', view:null, downloadCv:false});
  assert.equal(readPortfolioRoute('https://batikanor.com/projects/#sui-hackathon-poland-2025', slugs).eventSlug,
    'sui-hackathon-poland-2025');
  assert.equal(readPortfolioRoute('https://batikanor.com/?event=not-real', slugs).eventSlug, null);
});

test('CV route and explicit map views survive canonicalization', () => {
  assert.equal(readPortfolioRoute('https://batikanor.com/#cv', slugs).view, 'cv');
  assert.equal(readPortfolioRoute('https://batikanor.com/cv/', slugs).view, 'cv');
  assert.equal(readPortfolioRoute('https://batikanor.com/cv/en/', slugs).downloadCv, true);
  assert.equal(readPortfolioRoute('https://batikanor.com/?view=cv&download=cv', slugs).downloadCv, true);
  const canonical = portfolioUrl('https://batikanor.com/projects/?view=cv#foo',
    {eventSlug:'tesla-gigathon-2026', view:'world'});
  assert.equal(canonical.pathname, '/');
  assert.equal(canonical.hash, '');
  assert.equal(canonical.searchParams.get('event'), 'tesla-gigathon-2026');
  assert.equal(canonical.searchParams.get('view'), 'world');
});
