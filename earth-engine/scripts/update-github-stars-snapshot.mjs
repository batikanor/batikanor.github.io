import {readFile, writeFile} from 'node:fs/promises';
import {GITHUB_STARS_URL, GITHUB_STARS_SOURCE_URL} from '../src/githubStarsData.js';

// Run before freezing a staging release. Builds and production promotions must
// keep the reviewed snapshot unchanged; runtime refreshes use the shared feed.
const response = await fetch(GITHUB_STARS_SOURCE_URL, {
  cache: 'no-cache', credentials: 'omit', signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`GitHub statistics feed returned ${response.status}`);
const data = await response.json();
const verified = Date.parse(data?.verified_at);
if (data?.full_name !== 'batikanor/gralobe' || !Number.isSafeInteger(data?.stargazers_count)
  || data.stargazers_count < 0 || typeof data.verified_at !== 'string'
  || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(data.verified_at)
  || !Number.isFinite(verified) || verified > Date.now() + 300000
  || new Date(verified).toISOString().slice(0, 19) !== data.verified_at.slice(0, 19))
  throw new Error('Invalid verified GitHub statistics snapshot');
const snapshot = {full_name: data.full_name, stargazers_count: data.stargazers_count, verified_at: data.verified_at};
const formatted = snapshot.stargazers_count.toLocaleString('en-US');
const label = snapshot.stargazers_count === 1 ? 'star' : 'stars';
const path = new URL('../index.html', import.meta.url);
const html = await readFile(path, 'utf8');
let matches = 0;
const updated = html.replace(/<a class="intro-project-stars\b[^>]*>[\s\S]*?<\/a>/g, markup => {
  matches++;
  return markup.replace(/aria-label="[^"]*"/, `aria-label="${formatted} GitHub ${label} — view repository, opens in a new tab"`)
    .replace(/ title="[^"]*"/g, '')
    .replace(/<span class="stat-pennant-number">[^<]*<\/span>/, `<span class="stat-pennant-number">${formatted}</span>`)
    .replace(/<span class="stat-pennant-label">[^<]*<\/span>/, `<span class="stat-pennant-label">${label}</span>`);
});
if (matches !== 1) throw new Error('Expected one native entrance GitHub badge');
await writeFile(new URL('../src/githubStarsData.js', import.meta.url),
  '// Verified release snapshot; refresh with scripts/update-github-stars-snapshot.mjs before freezing a new release.\n'
  + `export const GITHUB_STARS_URL = ${JSON.stringify(GITHUB_STARS_URL)};\n`
  + `export const GITHUB_STARS_SOURCE_URL = ${JSON.stringify(GITHUB_STARS_SOURCE_URL)};\n`
  + `export const GITHUB_STARS_SNAPSHOT = Object.freeze(${JSON.stringify(snapshot, null, 2)});\n`);
await writeFile(path, updated);
console.log(JSON.stringify(snapshot));
