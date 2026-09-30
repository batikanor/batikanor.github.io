/**
 * A small, no-JavaScript reading view for each achievement. The interactive
 * homepage is a client-rendered map, so it cannot be the only crawlable copy
 * of the portfolio. These pages use the same authored data, not SEO-only copy.
 */
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';

const productionOrigin = 'https://batikanor.com';
const stagingOrigin = 'https://staging.batikanor.com';
const author = 'Batıkan Bora Ormancı';

export const achievementPages = contestsAndActivities;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function safeUrl(value) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function inlineMarkdown(value) {
  const input = String(value ?? '');
  let result = '';
  for (let position = 0; position < input.length;) {
    if (input.startsWith('**', position)) {
      const end = input.indexOf('**', position + 2);
      if (end > position + 2) {
        result += `<strong>${inlineMarkdown(input.slice(position + 2, end))}</strong>`;
        position = end + 2;
        continue;
      }
    }
    if (input[position] === '[') {
      const labelEnd = input.indexOf('](', position + 1);
      if (labelEnd > position) {
        let depth = 1;
        let end = labelEnd + 2;
        for (; end < input.length; end++) {
          if (input[end] === '(') depth++;
          if (input[end] === ')' && --depth === 0) break;
        }
        if (end < input.length) {
          const label = input.slice(position + 1, labelEnd);
          const href = safeUrl(input.slice(labelEnd + 2, end));
          result += href
            ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
            : escapeHtml(label);
          position = end + 1;
          continue;
        }
      }
    }
    result += escapeHtml(input[position]);
    position++;
  }
  return result;
}

function mediaMarkup(item, index, used) {
  const media = item.gdrive_embed?.[index];
  if (!media) return '';
  used.add(index);
  const url = safeUrl(media.url);
  if (!url) return '';
  const caption = media.abovePhotoCaption || 'Project media';
  const credit = media.credit ? `<small>${escapeHtml(media.credit)}</small>` : '';
  if (/^\/(?:photos|images)\/.+\.(?:avif|gif|jpe?g|png|webp)$/i.test(url)) {
    return `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(caption)}" loading="lazy" decoding="async" /><figcaption>${escapeHtml(caption)}${credit}</figcaption></figure>`;
  }
  return `<p class="media-link"><a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(caption)} ↗</a>${credit}</p>`;
}

function bodyMarkup(item) {
  const usedMedia = new Set();
  const blocks = String(item.longDescription ?? '').trim().split(/\n\s*\n/g).filter(Boolean);
  const markup = blocks.map(block => {
    const onlyMedia = block.match(/^\s*\{\{gdrive_embed\[(\d+)\]\}\}\s*$/);
    if (onlyMedia) return mediaMarkup(item, Number(onlyMedia[1]), usedMedia);
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length > 0 && lines.every(line => line.startsWith('- '))) {
      return `<ul>${lines.map(line => `<li>${inlineMarkdown(line.slice(2))}</li>`).join('')}</ul>`;
    }
    if (/^\*\*[^*]+\*\*$/.test(block.trim())) {
      return `<h2>${inlineMarkdown(block.trim().slice(2, -2))}</h2>`;
    }
    // Mixed text/media paragraphs occur in the original authoring format.
    return block.split(/(\{\{gdrive_embed\[\d+\]\}\})/g).filter(Boolean).map(part => {
      const match = part.match(/^\{\{gdrive_embed\[(\d+)\]\}\}$/);
      if (match) return mediaMarkup(item, Number(match[1]), usedMedia);
      return `<p>${part.split('\n').map(inlineMarkdown).join('<br />')}</p>`;
    }).join('');
  }).join('\n');
  const remainingMedia = (item.gdrive_embed ?? []).map((_, index) =>
    usedMedia.has(index) ? '' : mediaMarkup(item, index, usedMedia)).join('');
  return `${markup}${remainingMedia}`;
}

function mediaImage(item, origin) {
  const local = item.gdrive_embed?.find(media =>
    /^\/(?:photos|images)\/.+\.(?:jpe?g|png|webp)$/i.test(media.url));
  return `${origin}${local?.url ?? '/seo/batikan-social.png'}`;
}

function pageDescription(item) {
  return String(item.shortDescription || item.title).replace(/\s+/g, ' ').trim();
}

export function renderAchievementPage(item, index, {staging = false} = {}) {
  const origin = staging ? stagingOrigin : productionOrigin;
  const canonical = `${origin}/achievements/${encodeURIComponent(item.slug)}/`;
  const map = `/?event=${encodeURIComponent(item.slug)}`;
  const title = `${item.title} | Batıkan`;
  const description = pageDescription(item);
  const location = [item.mapData?.venue, item.mapData?.city, item.mapData?.country]
    .filter(Boolean).filter((value, position, all) => all.indexOf(value) === position).join(' · ');
  const prev = achievementPages[index - 1];
  const next = achievementPages[index + 1];
  const image = mediaImage(item, origin);
  const schema = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebPage',
    '@id': canonical, url: canonical, name: item.title, description,
    isPartOf: {'@type': 'WebSite', '@id': `${origin}/#website`},
    about: {'@type': 'Thing', name: item.title},
    author: {'@type': 'Person', name: author, url: `${origin}/`},
    primaryImageOfPage: {'@type': 'ImageObject', url: image}
  }).replace(/</g, '\\u003c');
  const sourceLinks = [
    ...(item.links ?? []),
    ...(item.githubRepo ? [{label: 'Source repository', url: item.githubRepo}] : [])
  ].filter(link => safeUrl(link.url));
  const sources = sourceLinks.length ? `<section class="sources"><h2>Links</h2><ul>${sourceLinks.map(link =>
    `<li><a href="${escapeHtml(safeUrl(link.url))}" rel="noopener noreferrer">${escapeHtml(link.label || link.url)} ↗</a></li>`
  ).join('')}</ul></section>` : '';
  const technologies = item.technologies?.length
    ? `<section class="tags" aria-label="Topics">${item.technologies.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</section>` : '';
  const robots = staging ? '<meta name="robots" content="noindex,nofollow" />' : '<meta name="robots" content="index,follow" />';
  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${robots}
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <meta name="theme-color" content="#10191c" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:alt" content="${escapeHtml(item.gdrive_embed?.find(media => image.endsWith(media.url))?.abovePhotoCaption || 'Batıkan portfolio')}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${schema}</script>
  <link rel="stylesheet" href="/seo/achievement.css" />
</head><body>
  <header class="site-header"><a class="brand" href="/">Batıkan <small>Hacker · Developer · Entrepreneur</small></a><a class="map-link" href="${escapeHtml(map)}">Open on the map ↗</a></header>
  <main><article>
    <p class="eyebrow">${escapeHtml(item.date || '')}${location ? ` · ${escapeHtml(location)}` : ''}</p>
    <h1>${escapeHtml(item.title)}</h1>
    <p class="summary">${escapeHtml(description)}</p>
    ${technologies}
    <div class="article-body">${bodyMarkup(item)}</div>
    ${sources}
  </article></main>
  <nav class="article-nav" aria-label="Achievement chronology">${prev ? `<a href="/achievements/${encodeURIComponent(prev.slug)}/"><span>Newer</span>${escapeHtml(prev.title)}</a>` : '<span></span>'}${next ? `<a href="/achievements/${encodeURIComponent(next.slug)}/"><span>Older</span>${escapeHtml(next.title)}</a>` : '<span></span>'}</nav>
  <footer><a href="/">Interactive map</a><a href="/cv/">CV</a><a href="/projects/">Projects</a><a href="mailto:batikanor@gmail.com">Email</a></footer>
</body></html>\n`;
}

export const achievementStyles = `
:root{color-scheme:dark;font-family:Arial,Helvetica,sans-serif;background:#10191c;color:#edf2ed}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:radial-gradient(circle at 0 0,#213b3b,#10191c 48%);line-height:1.65}
a{color:#e7bc7e;text-underline-offset:.2em}a:hover{color:#fff}a:focus-visible{outline:2px solid #f2cd92;outline-offset:4px}
.site-header{max-width:1080px;margin:auto;padding:28px 24px;display:flex;gap:18px;align-items:center;justify-content:space-between;border-bottom:1px solid #b3c4ba32}
.site-header a{text-decoration:none}.brand{color:#f8f5ed;font-family:Georgia,serif;font-size:32px;line-height:1}.brand small{display:block;margin-top:9px;color:#e2c394;font:700 10px Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase}.map-link{border:1px solid #d6b88780;border-radius:4px;padding:9px 15px;font-size:13px;font-weight:700;white-space:nowrap}
main{max-width:900px;padding:58px 24px 28px;margin:auto}.eyebrow{color:#e7bc7e;letter-spacing:.14em;text-transform:uppercase;font-size:11px;font-weight:700}h1{font:normal clamp(38px,6vw,70px)/1.08 Georgia,serif;letter-spacing:-.035em;margin:12px 0 22px;overflow-wrap:anywhere}.summary{font-size:clamp(18px,2.3vw,23px);line-height:1.5;color:#dce8e3;border-left:3px solid #d6b887;padding-left:19px;margin:0 0 32px}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 40px}.tags span{border:1px solid #e7bc7e50;padding:4px 11px;border-radius:99px;color:#e4d1b8;font-size:11px;letter-spacing:.06em}.article-body{color:#d1ddda;font-size:16px}.article-body p{margin:0 0 24px}.article-body h2,.sources h2{color:#f8f5ed;font:normal 29px/1.2 Georgia,serif;margin:42px 0 15px}.article-body ul,.sources ul{padding-left:24px}.article-body li,.sources li{margin:8px 0}.article-body figure{margin:32px 0 42px}.article-body img{max-width:100%;height:auto;display:block;border-radius:6px;border:1px solid #b3c4ba44;box-shadow:0 16px 45px #0005}.article-body figcaption,.media-link small{display:block;margin-top:8px;color:#9faeaa;font-size:13px}.media-link{border-left:2px solid #d6b887;padding-left:14px}.sources{border-top:1px solid #b3c4ba32;margin-top:50px;padding-top:2px}.sources ul{columns:2;column-gap:40px}.sources li{break-inside:avoid}
.article-nav{max-width:900px;margin:45px auto;padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:18px;border-top:1px solid #b3c4ba32}.article-nav a{text-decoration:none;color:#e5eee9;font:normal 18px/1.3 Georgia,serif}.article-nav a:last-child{text-align:right}.article-nav a span{display:block;font:700 10px Arial,sans-serif;color:#d6b887;letter-spacing:.15em;text-transform:uppercase;margin-bottom:7px}footer{max-width:1080px;margin:auto;padding:28px 24px 50px;border-top:1px solid #b3c4ba32;display:flex;flex-wrap:wrap;gap:22px;font-size:12px;font-weight:700}
@media(max-width:650px){.site-header{padding:19px 16px}.brand{font-size:27px}.brand small{font-size:8px;letter-spacing:.08em}.map-link{font-size:11px;padding:7px 9px}main{padding:32px 18px 12px}.sources ul{columns:1}.article-nav{padding:20px 18px;gap:14px}.article-nav a{font-size:15px}}
`;

export async function writeAchievementPages(out, {staging = false} = {}) {
  const base = join(out, 'achievements');
  await rm(base, {recursive: true, force: true});
  await mkdir(base, {recursive: true});
  await mkdir(join(out, 'seo'), {recursive: true});
  await writeFile(join(out, 'seo', 'achievement.css'), achievementStyles);
  for (const [index, item] of achievementPages.entries()) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) {
      throw new Error(`Unsafe achievement slug: ${item.slug}`);
    }
    const directory = join(base, item.slug);
    await mkdir(directory, {recursive: true});
    await writeFile(join(directory, 'index.html'), renderAchievementPage(item, index, {staging}));
  }
}

export function renderSitemap() {
  const paths = ['/', '/projects/', '/cv/', ...achievementPages.map(item => `/achievements/${encodeURIComponent(item.slug)}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${productionOrigin}${path}</loc></url>`).join('\n')}\n</urlset>\n`;
}

export function renderNoScriptIndex() {
  return `<noscript><style>
    .intro-screen,#app{display:none!important}
    body{margin:0;background:#10191c;color:#edf2ed;font:16px/1.6 Arial,sans-serif}
    #seo-noscript{display:block;max-width:850px;margin:auto;padding:40px 22px 70px}
    #seo-noscript h1{font:normal 58px Georgia,serif;margin:0 0 8px}
    #seo-noscript h2{font:normal 30px Georgia,serif;margin:42px 0 12px}
    #seo-noscript a{color:#e7bc7e}#seo-noscript li{margin:9px 0}
  </style><main id="seo-noscript"><h1>Batıkan</h1><p>Hacker · Developer · Entrepreneur</p>
  <p>I’ve won prizes in 30+ competitions, acted as a juror and mentor several times, and worked in software, tooling, space tech, biotech, energy, finance and AI.</p>
  <p>This interactive map needs JavaScript. You can still read every achievement below, or visit my <a href="/cv/">CV</a> and <a href="/projects/">projects</a>.</p>
  <h2>Achievements</h2><ol>${achievementPages.map(item => `<li><a href="/achievements/${encodeURIComponent(item.slug)}/">${escapeHtml(item.title)}</a> <small>${escapeHtml(item.date || '')}</small></li>`).join('')}</ol>
  </main></noscript>`;
}
