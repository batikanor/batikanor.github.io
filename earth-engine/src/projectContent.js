/**
 * Full project stories from the existing batikanor.com portfolio.
 *
 * `data/contestsAndActivities.js` is a verbatim snapshot of the source file in
 * the neighbouring batikanor.github.io project. Keep it in sync when the live
 * portfolio changes; never replace the author's copy with generated summaries.
 */
import {contestsAndActivities} from './data/contestsAndActivities.js';

const projectsBySlug = new Map(contestsAndActivities.map(project => [project.slug, project]));
const mediaPlaceholder = /\{\{(image|embed|gdrive_embed)\[(\d+)\]\}\}/g;
const directImage = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;

export function getProject(slug) {
  return projectsBySlug.get(slug) ?? null;
}

export const projectCount = contestsAndActivities.length;

/** Preserve an authored link, except old project-to-project links now stay in this site. */
export function projectHref(rawHref, baseHref = 'https://batikanor.com/') {
  try {
    const url = new URL(rawHref, baseHref);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null;
    const fromPortfolio = rawHref.startsWith('/projects') || url.hostname === 'batikanor.com';
    if (fromPortfolio && url.pathname.replace(/\/$/, '') === '/projects' && url.hash) {
      const slug = decodeURIComponent(url.hash.slice(1));
      if (projectsBySlug.has(slug)) {
        const destination = new URL(baseHref);
        destination.searchParams.set('event', slug);
        destination.hash = '';
        return destination.href;
      }
    }
    return rawHref;
  } catch {
    return null;
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function appendLink(parent, label, rawHref, options) {
  const href = projectHref(rawHref, options.baseHref);
  if (!href) {
    parent.append(document.createTextNode(label));
    return;
  }
  const link = element('a', null, label);
  link.href = href;
  const destination = new URL(href, options.baseHref);
  const isInternalStory = destination.origin === new URL(options.baseHref).origin
    ? destination.searchParams.get('event') : null;
  if (isInternalStory && options.onProjectLink) {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      options.onProjectLink(isInternalStory);
    });
  } else if (!isInternalStory) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  parent.append(link);
}

// The source descriptions use a small Markdown subset. Construct DOM rather
// than inserting HTML so even future authored content cannot inject markup.
function appendInline(parent, text, options) {
  const token = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let previous = 0;
  for (const match of text.matchAll(token)) {
    if (match.index > previous) parent.append(document.createTextNode(text.slice(previous, match.index)));
    if (match[1] != null) {
      const strong = element('strong');
      appendInline(strong, match[1], options);
      parent.append(strong);
    } else if (match[2] != null) {
      const emphasis = element('em');
      appendInline(emphasis, match[2], options);
      parent.append(emphasis);
    } else {
      appendLink(parent, match[3], match[4], options);
    }
    previous = match.index + match[0].length;
  }
  if (previous < text.length) parent.append(document.createTextNode(text.slice(previous)));
}

function appendTextBlock(parent, text, options) {
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const isHeading = /^\*\*(.+)\*\*$/.exec(line.trim());
    const isBullet = /^-\s+(.+)$/.exec(line.trim());
    const node = element(isHeading ? 'h3' : isBullet ? 'p' : 'p', isHeading ? 'project-copy-heading' : isBullet ? 'project-copy-bullet' : 'project-copy-paragraph');
    appendInline(node, isHeading ? isHeading[1] : line, options);
    parent.append(node);
  }
}

/** Same media order as {{gdrive_embed[n]}} and {{image[n]}} in the original. */
export function projectMedia(project) {
  return {
    embeds: project?.gdrive_embed ?? [],
    images: project?.images ?? []
  };
}

function embedUrl(url) {
  const drive = /^https?:\/\/drive\.google\.com\/file\/d\/([-\w]+)/.exec(url);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  const slides = /^https?:\/\/docs\.google\.com\/presentation\/d\/([-\w]+)/.exec(url);
  if (slides) return `https://docs.google.com/presentation/d/${slides[1]}/embed?start=false&loop=false&delayms=3000`;
  const document = /^https?:\/\/docs\.google\.com\/document\/d\/([-\w]+)/.exec(url);
  if (document) return `https://docs.google.com/document/d/${document[1]}/preview`;
  return url;
}

function mediaSizeClass(size) {
  return ['S', 'M', 'L', 'XL'].includes(size) ? `project-media-${size.toLowerCase()}` : 'project-media-m';
}

function appendMedia(parent, project, kind, index, options) {
  const source = kind === 'image' ? project.images?.[index] : project.gdrive_embed?.[index];
  if (!source) return false;
  const media = typeof source === 'string' ? {url: source} : source;
  if (!media.url) return false;
  const figure = element('figure', `project-media ${mediaSizeClass(media.desktopSize)}`);
  figure.dataset.mobileSize = media.mobileSize ?? 'M';
  if (media.desktopEmbedAlign === 'left' || media.desktopEmbedAlign === 'right') {
    figure.classList.add(`project-media-align-${media.desktopEmbedAlign}`);
  }
  if (media.abovePhotoCaption) figure.append(element('figcaption', 'project-media-caption', media.abovePhotoCaption));
  const url = kind === 'image' ? media.url : media.url;
  if (directImage.test(url)) {
    const image = element('img', 'project-media-image');
    image.src = url;
    image.alt = media.abovePhotoCaption || `${project.title} — project media ${index + 1}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    figure.append(image);
  } else {
    const frame = element('iframe', 'project-media-frame');
    frame.src = embedUrl(url);
    frame.title = media.abovePhotoCaption || `${project.title} — embedded media ${index + 1}`;
    frame.loading = 'lazy';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    figure.append(frame);
    const mediaActions = element('div', 'project-media-actions');
    const sizes = element('div', 'project-media-sizes');
    sizes.setAttribute('role', 'group');
    sizes.setAttribute('aria-label', `Media size for ${frame.title}`);
    const preferredSize = window.matchMedia('(max-width: 760px)').matches ? media.mobileSize : media.desktopSize;
    const initialSize = ['S', 'M', 'L', 'XL'].includes(preferredSize) ? preferredSize : 'M';
    let selectedSize = initialSize;
    const sizeButtons = new Map();
    for (const size of ['S', 'M', 'L', 'XL']) {
      const button = element('button', null, size);
      button.type = 'button';
      button.title = `${{S:'Small', M:'Medium', L:'Large', XL:'Extra large'}[size]} media size`;
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(size === selectedSize));
      button.addEventListener('click', () => {
        selectedSize = size;
        figure.classList.remove('project-media-s', 'project-media-m', 'project-media-l', 'project-media-xl', 'project-media-expanded');
        figure.classList.add(mediaSizeClass(size));
        figure.dataset.mobileSize = size;
        for (const [key, control] of sizeButtons) control.setAttribute('aria-pressed', String(key === size));
        resize.textContent = 'Expand media';
        resize.setAttribute('aria-pressed', 'false');
      });
      sizeButtons.set(size, button);
      sizes.append(button);
    }
    const resize = element('button', 'project-media-expand', 'Expand media');
    resize.type = 'button';
    resize.setAttribute('aria-pressed', 'false');
    resize.addEventListener('click', () => {
      const expanded = figure.classList.toggle('project-media-expanded');
      resize.textContent = expanded ? 'Reduce media' : 'Expand media';
      resize.setAttribute('aria-pressed', String(expanded));
      for (const button of sizeButtons.values()) button.setAttribute('aria-pressed', String(!expanded && button.textContent === selectedSize));
    });
    mediaActions.append(sizes, resize);
    appendLink(mediaActions, 'Open original ↗', url, options);
    figure.append(mediaActions);
  }
  if (media.credit) figure.append(element('p', 'project-media-credit', media.credit));
  parent.append(figure);
  return true;
}

function appendStory(parent, project, options) {
  const description = project.longDescription || '';
  const used = {image: new Set(), embed: new Set()};
  let previous = 0;
  for (const match of description.matchAll(mediaPlaceholder)) {
    appendTextBlock(parent, description.slice(previous, match.index), options);
    const kind = match[1] === 'image' ? 'image' : 'embed';
    const index = Number(match[2]);
    if (appendMedia(parent, project, kind, index, options)) used[kind].add(index);
    previous = match.index + match[0].length;
  }
  appendTextBlock(parent, description.slice(previous), options);
  for (let index = 0; index < (project.images?.length ?? 0); index++) {
    if (!used.image.has(index)) appendMedia(parent, project, 'image', index, options);
  }
  for (let index = 0; index < (project.gdrive_embed?.length ?? 0); index++) {
    if (!used.embed.has(index)) appendMedia(parent, project, 'embed', index, options);
  }
}

function appendGitHub(parent, project, options) {
  if (!project.githubRepo) return;
  const repo = project.githubRepo;
  const section = element('section', 'project-repository');
  section.append(element('h3', null, 'GitHub Repository'));
  const actions = element('div', 'project-repository-actions');
  const stars = element('span');
  const watchers = element('span');
  appendLink(stars, 'Star on GitHub ↗', `https://github.com/${repo}`, options);
  appendLink(watchers, 'Watch on GitHub ↗', `https://github.com/${repo}/watchers`, options);
  actions.append(stars, watchers);
  section.append(actions);
  const chart = element('img', 'project-repository-chart');
  chart.src = `https://api.star-history.com/svg?repos=${encodeURIComponent(repo)}&type=Date`;
  chart.alt = `Star history for ${repo}`;
  chart.loading = 'lazy';
  section.append(chart);
  fetch(`https://api.github.com/repos/${repo}`).then(response => response.ok ? response.json() : null).then(data => {
    if (!data) return;
    if (Number.isFinite(data.stargazers_count)) stars.append(` · ${data.stargazers_count}`);
    if (Number.isFinite(data.subscribers_count)) watchers.append(` · ${data.subscribers_count}`);
  }).catch(() => {});
  parent.append(section);
}

function appendCopyLink(parent, project, options) {
  const copy = element('button', 'project-story-copy-link', 'Copy Link to this Project');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    const url = new URL(options.baseHref);
    url.searchParams.set('event', project.slug);
    url.hash = '';
    try {
      await navigator.clipboard.writeText(url.href);
      copy.textContent = 'Link copied';
      setTimeout(() => { copy.textContent = 'Copy Link to this Project'; }, 2000);
    } catch {
      copy.textContent = 'Unable to copy link';
    }
  });
  parent.append(copy);
}

/**
 * Render one complete existing project in a host detail panel.
 * Returns the authored project record, or null for an unknown slug.
 */
export function renderProjectContent(container, slug, options = {}) {
  const project = getProject(slug);
  if (!project) return null;
  const renderOptions = {
    baseHref: options.baseHref ?? (typeof window === 'undefined' ? 'https://batikanor.com/' : window.location.href),
    onProjectLink: options.onProjectLink
  };
  const fragment = document.createDocumentFragment();
  const header = element('header', 'project-story-header');
  header.append(element('p', 'project-story-date', project.date));
  header.append(element('h2', 'project-story-title', project.title));
  const map = project.mapData;
  if (map) header.append(element('p', 'project-story-place', `${map.venue}, ${map.city}/${map.country}`));
  fragment.append(header);
  if (project.shortDescription) {
    const summary = element('section', 'project-story-summary');
    summary.append(element('h3', null, 'Summary'));
    summary.append(element('p', null, project.shortDescription));
    fragment.append(summary);
  }
  const story = element('div', 'project-story-copy');
  appendStory(story, project, renderOptions);
  fragment.append(story);
  appendCopyLink(fragment, project, renderOptions);
  appendGitHub(fragment, project, renderOptions);
  if (project.links?.length) {
    const links = element('section', 'project-story-links');
    links.append(element('h3', null, 'Links'));
    const list = element('ul');
    for (const link of project.links) {
      const item = element('li');
      appendLink(item, link.label, link.url, renderOptions);
      list.append(item);
    }
    links.append(list);
    fragment.append(links);
  }
  if (project.technologies?.length) {
    const technologies = element('ul', 'project-story-technologies');
    technologies.setAttribute('aria-label', 'Technologies and topics');
    for (const technology of project.technologies) technologies.append(element('li', null, technology));
    fragment.append(technologies);
  }
  container.replaceChildren(fragment);
  return project;
}
