import './brandLinks.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const icons = {
  email: {
    viewBox: '0 0 48 48',
    paths: [
      ['#4285F4', 'M3 16.2 13 23.7V40H6a3 3 0 0 1-3-3V16.2Z'],
      ['#34A853', 'm45 16.2-10 7.5V40h7a3 3 0 0 0 3-3V16.2Z'],
      ['#EA4335', 'm35 11.2-11 8.25-11-8.25v12.5l11 8.25 11-8.25V11.2Z'],
      ['#C5221F', 'M3 12.298V16.2l10 7.5V11.2L9.876 8.858C7.043 6.734 3 8.755 3 12.298Z'],
      ['#FBBC04', 'M45 12.298V16.2l-10 7.5V11.2l3.124-2.342C40.957 6.734 45 8.755 45 12.298Z'],
    ],
  },
  linkedin: {
    viewBox: '0 0 24 24',
    paths: [['currentColor', 'M6.5 8.5H3V20h3.5V8.5ZM4.75 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM21 13.4c0-3.2-1.7-4.7-4-4.7a3.4 3.4 0 0 0-3.1 1.7V8.5h-3.5V20h3.5v-6.2c0-1.6.3-3.1 2.3-3.1s2 1.8 2 3.2V20H21v-6.6Z']],
  },
};

/** Add a brand mark while retaining the native link and its accessible text. */
export function decorateBrandLink(link, brand) {
  const spec = icons[brand];
  if (!link || !spec) return link;
  link.classList.add('portfolio-brand-link');
  link.classList.remove('portfolio-brand-link-email', 'portfolio-brand-link-linkedin');
  link.classList.add(`portfolio-brand-link-${brand}`);
  if (link.getAttribute('data-brand-link') === brand) return link;
  const text = link.textContent;
  const icon = document.createElementNS(SVG_NS, 'svg');
  icon.setAttribute('class', 'portfolio-brand-icon');
  icon.setAttribute('viewBox', spec.viewBox);
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  icon.setAttribute('data-brand-icon', brand);
  for (const [fill, d] of spec.paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', fill);
    path.setAttribute('d', d);
    icon.append(path);
  }
  const label = document.createElement('span');
  label.className = 'portfolio-brand-label';
  label.textContent = text;
  link.replaceChildren(icon, label);
  link.setAttribute('data-brand-link', brand);
  return link;
}
