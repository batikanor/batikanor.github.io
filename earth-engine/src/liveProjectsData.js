/** Concise project facts, including the owner's Space Cottbus organising role. */
export const LIVE_PROJECTS = Object.freeze([
  {
    id: 'maptheory',
    name: 'Maptheory',
    domain: 'maptheory.org',
    url: 'https://maptheory.org/',
    dailyUniqueVisitors: 100,
    points: Object.freeze([
      'Interactive maps and statistics.',
      'Geography games, solo or with friends.',
      Object.freeze({
        text: 'Best hackathon archive in the world at hack.maptheory.org',
        url: 'https://hack.maptheory.org/',
      }),
    ]),
    accent: '#d7bf95',
    accentRgb: '215 191 149',
  },
  {
    id: 'space-cottbus',
    name: 'NASA Space Apps Cottbus',
    domain: 'spacecottbus.com',
    url: 'https://spacecottbus.com/',
    previewUrl: 'https://spacecottbus.com/?portfolio-preview=1',
    points: Object.freeze([
      'The biggest space event in Cottbus’s history.',
      'Official NASA Space Apps hackathon.',
      'I’m organising it as Cottbus Local Lead.',
    ]),
    accent: '#b8c9df',
    accentRgb: '184 201 223',
  },
  {
    id: 'cottbus',
    name: 'Map of Cottbus',
    domain: 'cottbus.maptheory.org',
    url: 'https://cottbus.maptheory.org/',
    points: Object.freeze([
      'Interactive, illustrated map of Cottbus.',
      'Explore local streets and landmarks.',
      'Take a virtual drive through the city.',
    ]),
    accent: '#b8cbb4',
    accentRgb: '184 203 180',
  },
  {
    id: 'gralobe',
    name: 'Gralobe',
    domain: 'gralobe.maptheory.org',
    url: 'https://gralobe.maptheory.org/',
    points: Object.freeze([
      'Open-source TypeScript library for interactive 3D globes.',
      'Smooth transitions between globe and flat map.',
      'Visualise world statistics and your own geographic data.',
    ]),
    githubRepo: 'batikanor/gralobe',
    npmPackage: 'gralobe',
    npmPublishedOn: '2025-11-29',
    accent: '#a8c9e2',
    accentRgb: '168 201 226',
  },
].map(project => Object.freeze(project)));

export function liveProjectIndex(id) {
  const index = LIVE_PROJECTS.findIndex(project => project.id === id);
  return index < 0 ? 0 : index;
}

export function adjacentLiveProject(index, direction) {
  const current = Number.isInteger(index) ? index : 0;
  const step = direction < 0 ? -1 : 1;
  return ((current + step) % LIVE_PROJECTS.length + LIVE_PROJECTS.length) % LIVE_PROJECTS.length;
}

export function liveProjectUrl(href, id) {
  const url = new URL(href);
  url.pathname = '/';
  for (const key of ['event', 'view', 'download', 'prototype', 'experience', 'project']) url.searchParams.delete(key);
  url.hash = '';
  url.searchParams.set('view', 'live-projects');
  url.searchParams.set('project', LIVE_PROJECTS[liveProjectIndex(id)].id);
  return url;
}
