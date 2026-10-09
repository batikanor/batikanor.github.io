/** Keep old CV/project anchors useful without replacing the project archive. */
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {readPortfolioRoute, portfolioUrl} from '../earth-engine/src/portfolioRoute.js';

const marker = /<script id="legacy-project-routes">[\s\S]*?<\/script>\n?/g;

export function addLegacyProjectRoutes(html) {
  if (!html.includes('</head>')) throw new Error('Project archive has no HTML head');
  const original = html.replace(marker, '');
  const slugs = contestsAndActivities.map(project => project.slug);
  const script = `<script id="legacy-project-routes">(() => {
    const knownSlugs = new Set(${JSON.stringify(slugs).replace(/</g, '\\u003c')});
    const readPortfolioRoute = ${readPortfolioRoute.toString()};
    const portfolioUrl = ${portfolioUrl.toString()};
    const openProject = () => {
      const {eventSlug} = readPortfolioRoute(location.href, knownSlugs);
      if (eventSlug) location.replace(portfolioUrl(location.href, {eventSlug}).href);
    };
    addEventListener('hashchange', openProject);
    openProject();
  })();</script>\n`;
  return original.replace('</head>', script + '</head>');
}

export async function writeLegacyProjectRoutes(directory) {
  const path = join(directory, 'projects', 'index.html');
  const html = await readFile(path, 'utf8');
  const updated = addLegacyProjectRoutes(html);
  if (updated.replace(marker, '') !== html.replace(marker, '')) {
    throw new Error('Project compatibility changed archive content');
  }
  await writeFile(path, updated);
}
