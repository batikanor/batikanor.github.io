import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {addLegacyProjectRoutes} from '../scripts/legacy-project-routes.mjs';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';

const original = '<html><head><title>Project archive</title></head><body>Original stories and media</body></html>';
function run(href) {
  const redirects = [], listeners = {};
  const location = {href, replace: url => redirects.push(url)};
  const html = addLegacyProjectRoutes(original);
  const script = html.match(/<script id="legacy-project-routes">([\s\S]*?)<\/script>/)[1];
  runInNewContext(script, {URL, location, addEventListener: (name, fn) => listeners[name] = fn});
  return {redirects, location, listeners};
}

test('old and new archive project links open each matching current project on the same site', () => {
  for (const {slug} of contestsAndActivities) {
    for (const origin of ['https://batikanor.com', 'https://www.batikanor.com', 'https://staging.batikanor.com']) {
      for (const tail of [`#${slug}`, `/#${slug}`, `?event=${slug}`, `/index.html#${encodeURIComponent(slug)}`]) {
        const {redirects} = run(`${origin}/projects${tail}`);
        assert.deepEqual(redirects, [`${origin}/?event=${slug}`]);
      }
    }
  }
});

test('plain archive, unknown anchors and malformed links retain the original archive', () => {
  for (const tail of ['', '/', '#unknown', '#%ZZ', '?event=unknown']) {
    assert.deepEqual(run('https://batikanor.com/projects' + tail).redirects, []);
  }
  const html = addLegacyProjectRoutes(original);
  assert.equal(html.replace(/<script id="legacy-project-routes">[\s\S]*?<\/script>\n/, ''), original);
  assert.equal(addLegacyProjectRoutes(html), html);
});

test('archive hash changes navigate to current projects and retain campaign parameters', () => {
  const result = run('https://staging.batikanor.com/projects/?utm_source=cv');
  result.location.href += '#tesla-gigathon-2026';
  result.listeners.hashchange();
  assert.deepEqual(result.redirects, ['https://staging.batikanor.com/?utm_source=cv&event=tesla-gigathon-2026']);
});
