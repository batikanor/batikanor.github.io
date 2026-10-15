import {achievementStarColor, achievementStarFills} from './achievementImportance.js';

const searchable = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ı/g, 'i');
let pickerSequence = 0;

/** Native controls keep project selection separate from the room's movement keys. */
export function createGalleryRoomPicker({projects, onSelect = () => {}, onSortChange = () => {}, document = globalThis.document}) {
  if (!document?.createElement || !Array.isArray(projects) || !projects.length
    || new Set(projects.map(project => project.slug)).size !== projects.length) {
    throw new TypeError('The room picker needs unique project locations');
  }
  const node = (tag, className, text) => {
    const element = document.createElement(tag);element.className = className;
    if (text != null) element.textContent = text;return element;
  };
  const element = node('div', 'gallery-room-current');
  const controls = node('div', 'gallery-room-current-controls');
  const sortButton = node('button', 'gallery-room-sort-button');sortButton.type = 'button';
  const button = node('button', 'gallery-room-selector-button');button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');button.setAttribute('aria-expanded', 'false');
  const count = node('span', 'gallery-room-current-count');
  const current = node('span', 'gallery-room-current-number');
  const total = node('span', 'gallery-room-current-total', String(projects.length));
  count.append(current, node('span', 'gallery-room-current-divider', '/'), total);
  const chevron = node('span', 'gallery-room-selector-chevron', '⌃');chevron.setAttribute('aria-hidden', 'true');
  button.append(count, chevron);
  const details = node('div', 'gallery-room-current-details');
  const date = node('span', 'gallery-room-current-date');
  const place = node('span', 'gallery-room-current-place');
  details.append(date, place);
  const panel = node('div', 'gallery-room-picker');panel.hidden = true;
  panel.id = `gallery-room-picker-${++pickerSequence}`;panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Choose achievement');button.setAttribute('aria-controls', panel.id);
  const search = node('input', 'gallery-room-picker-search');search.type = 'search';
  search.placeholder = 'Search achievements';search.setAttribute('aria-label', 'Search achievements');
  search.autocomplete = 'off';search.spellcheck = false;
  const options = node('div', 'gallery-room-picker-options');
  const empty = node('p', 'gallery-room-picker-empty', 'No achievements found.');empty.hidden = true;
  empty.setAttribute('role', 'status');
  controls.append(sortButton, button);
  panel.append(search, options, empty);element.append(controls, details, panel);
  let disposed = false, activeSlug = projects[0].slug, sortMode = 'recent';
  const removals = [], entries = [];
  const listen = (target, type, callback, config) => {
    target.addEventListener(type, callback, config);removals.push(() => target.removeEventListener(type, callback, config));
  };
  const location = project => [project.city, project.country].filter(Boolean).join(', ');
  const fullLocation = project => [project.venue, location(project)].filter(Boolean).join(' · ');
  function close({focus = false} = {}) {
    panel.hidden = true;button.setAttribute('aria-expanded', 'false');
    if (focus && !disposed) button.focus({preventScroll: true});
  }
  function filter() {
    const query = searchable(search.value).trim();
    for (const entry of entries) entry.button.hidden = !entry.search.includes(query);
    empty.hidden = entries.some(entry => !entry.button.hidden);
  }
  function open() {
    if (disposed) return;
    search.value = '';filter();panel.hidden = false;button.setAttribute('aria-expanded', 'true');
    search.focus({preventScroll: true});
  }
  function setActive(slug) {
    if (disposed) return;
    const index = entries.findIndex(item => item.project.slug === slug);if (index < 0) return;
    const entry = entries[index];
    activeSlug = slug;
    current.textContent = String(index + 1);
    date.textContent = entry.project.date || '';
    date.title = date.textContent;
    place.textContent = fullLocation(entry.project);
    place.title = place.textContent;
    button.title = `Choose achievement · ${index + 1} / ${entries.length}`;
    button.setAttribute('aria-label', `Choose achievement. Project ${index + 1} of ${entries.length}. ${entry.project.title}`);
    for (const item of entries) item.button.setAttribute('aria-current', item === entry ? 'true' : 'false');
  }
  function setSortMode(mode) {
    if (disposed) return;
    if (mode !== 'recent' && mode !== 'importance') throw new TypeError('Unknown achievement sort mode');
    sortMode = mode;
    const label = mode === 'recent' ? 'more recent first' : 'more important first';
    const next = mode === 'recent' ? 'more important first' : 'more recent first';
    sortButton.textContent = `(${label})`;
    sortButton.title = `Sort achievements: ${label}. Switch to ${next}.`;
    sortButton.setAttribute('aria-label', `Sort achievements: ${label}. Switch to ${next}.`);
    sortButton.setAttribute('aria-pressed', String(mode === 'importance'));
  }
  function setProjects(orderedProjects) {
    if (disposed) return;
    const bySlug = new Map(entries.map(entry => [entry.project.slug, entry]));
    if (!Array.isArray(orderedProjects) || orderedProjects.length !== entries.length
      || new Set(orderedProjects.map(project => project.slug)).size !== entries.length
      || orderedProjects.some(project => !bySlug.has(project.slug))) {
      throw new TypeError('Reordering the room picker needs the same project locations');
    }
    const focused = document.activeElement, scrollTop = options.scrollTop;
    entries.splice(0, entries.length, ...orderedProjects.map(project => bySlug.get(project.slug)));
    options.append(...entries.map(entry => entry.button));
    filter();setActive(activeSlug);
    // Moving an existing option can blur it in a browser; retain the same native focus target.
    if (focused && element.contains(focused) && document.activeElement !== focused && !focused.hidden) {
      focused.focus({preventScroll: true});
    }
    options.scrollTop = scrollTop;
  }
  function choose(entry) {
    if (disposed) return;
    setActive(entry.project.slug);close({focus: true});onSelect(entry.project.slug);
  }
  for (const project of projects) {
    const option = node('button', 'gallery-room-picker-option');option.type = 'button';
    option.dataset.projectSlug = project.slug;
    const meta = node('span', 'gallery-room-picker-meta');
    const stars = node('span', 'gallery-room-picker-stars');
    const fills = achievementStarFills(project.importance);
    stars.setAttribute('role', 'img');stars.setAttribute('aria-label', `Importance ${fills.reduce((sum, fill) => sum + fill, 0)} of 5`);
    for (let index = 0; index < 5; index++) {
      const fill = fills[index] || 0;
      const star = node('span', 'gallery-room-picker-star');star.setAttribute('aria-hidden', 'true');
      const filled = node('span', 'gallery-room-picker-star-fill');
      filled.style.width = `${fill * 100}%`;filled.style.backgroundColor = `rgb(${achievementStarColor(index).join(', ')})`;
      star.append(filled);stars.append(star);
    }
    meta.append(node('span', 'gallery-room-picker-city', location(project)), stars);
    option.append(node('span', 'gallery-room-picker-title', project.title), meta);
    const entry = {project, button: option, search: searchable(`${project.title} ${location(project)}`)};
    entries.push(entry);options.append(option);
    listen(option, 'click', event => {event.stopPropagation();choose(entry);});
    listen(option, 'keydown', event => {
      const visible = entries.filter(item => !item.button.hidden), index = visible.indexOf(entry);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = index + (event.key === 'ArrowDown' ? 1 : -1);
        (next < 0 ? search : visible[Math.min(next, visible.length - 1)]?.button)?.focus({preventScroll: true});
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();(event.key === 'Home' ? visible[0] : visible.at(-1))?.button.focus({preventScroll: true});
      }
    });
  }
  listen(sortButton, 'click', event => {
    event.stopPropagation();if (disposed) return;
    setSortMode(sortMode === 'recent' ? 'importance' : 'recent');onSortChange(sortMode);
  });
  listen(button, 'click', event => {event.stopPropagation();if (panel.hidden) open();else close({focus: true});});
  listen(search, 'input', filter);
  listen(search, 'keydown', event => {
    const first = entries.find(entry => !entry.button.hidden);
    if (event.key === 'ArrowDown') {event.preventDefault();first?.button.focus({preventScroll: true});}
    if (event.key === 'Enter' && first) {event.preventDefault();choose(first);}
  });
  listen(element, 'keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !panel.hidden) {event.preventDefault();close({focus: true});}
  });
  listen(element, 'pointerdown', event => event.stopPropagation());
  listen(document, 'pointerdown', event => {if (!panel.hidden && !element.contains(event.target)) close();}, true);
  function dispose() {
    if (disposed) return;
    close();disposed = true;removals.forEach(remove => remove());element.remove();
  }
  setSortMode('recent');setActive(activeSlug);
  return {element, setActive, setProjects, setSortMode, close, dispose};
}
