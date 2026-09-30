/** An achievement index shared by the streamed map and the no-WebGL list. */

const $ = id => document.getElementById(id);

export function explorerVariant(href) {
  return new URL(href).searchParams.get('explore') === 'more' ? 'more' : 'tab';
}

function searchable(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

/** Search real achievement metadata, preserving the caller's chronological order. */
export function filterExplorerEvents(events, query, getTitle = event => event.title) {
  const words = searchable(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [...events];
  return events.filter(event => {
    const text = searchable([
      getTitle(event), event.date, event.city, event.country
    ].join(' '));
    return words.every(word => text.includes(word));
  });
}

/**
 * `events` must already be newest-first. The explorer never changes chronology;
 * it only gives visitors a direct way to select one of its existing entries.
 */
export function createJourneyExplorer({events, getTitle, onSelect, getActiveSlug}) {
  const journey = $('journey');
  const trigger = $('journey-explore');
  const panel = $('journey-explorer');
  const closeButton = $('explorer-close');
  const search = $('explorer-search');
  const list = $('explorer-list');
  const empty = $('explorer-empty');
  const count = $('explorer-count');
  if (!Array.isArray(events) || typeof getTitle !== 'function'
    || typeof onSelect !== 'function' || typeof getActiveSlug !== 'function') {
    throw new TypeError('Journey explorer requires events, getTitle, onSelect and getActiveSlug');
  }
  if ([journey, trigger, panel, closeButton, search, list, empty, count].some(element => !element)) {
    throw new Error('Journey explorer markup is incomplete');
  }

  const variant = explorerVariant(location.href);
  journey.dataset.exploreVariant = variant;
  trigger.type = 'button';
  trigger.setAttribute('aria-controls', panel.id);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-label', `Explore all ${events.length} achievements`);
  trigger.title = 'Explore all achievements';
  trigger.textContent = variant === 'more' ? '⋯' : `⌃  All ${events.length}`;
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Explore achievements');
  closeButton.type = 'button';
  search.setAttribute('aria-label', 'Search achievements');
  search.setAttribute('autocomplete', 'off');
  search.placeholder ||= 'Search achievements';
  if (!empty.textContent.trim()) empty.textContent = 'No achievements match this search.';
  if (!['OL', 'UL'].includes(list.tagName)) list.setAttribute('role', 'list');

  function render() {
    const visible = filterExplorerEvents(events, search.value, getTitle);
    const activeSlug = getActiveSlug();
    const fragment = document.createDocumentFragment();
    for (const event of visible) {
      const ordinal = events.indexOf(event) + 1;
      const title = getTitle(event);
      const item = document.createElement(['OL', 'UL'].includes(list.tagName) ? 'li' : 'div');
      item.className = 'explorer-item';
      if (!['OL', 'UL'].includes(list.tagName)) item.setAttribute('role', 'listitem');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'explorer-event';
      button.dataset.eventSlug = event.slug;
      button.setAttribute('aria-label', `${ordinal} of ${events.length}: ${title}; ${event.date}; ${event.city}, ${event.country}`);
      if (event.slug === activeSlug) button.setAttribute('aria-current', 'true');
      const number = document.createElement('span');
      number.className = 'explorer-event-number';
      number.textContent = String(ordinal).padStart(2, '0');
      const copy = document.createElement('span');
      copy.className = 'explorer-event-copy';
      const heading = document.createElement('strong');
      heading.textContent = title;
      const place = document.createElement('small');
      place.textContent = `${event.date} · ${event.city}, ${event.country}`;
      copy.append(heading, place);
      button.append(number, copy);
      button.addEventListener('click', () => {
        close();
        trigger.focus({preventScroll: true});
        onSelect(event);
      });
      item.append(button);
      fragment.append(item);
    }
    list.replaceChildren(fragment);
    empty.hidden = visible.length !== 0;
    count.textContent = `${visible.length} of ${events.length}`;
  }

  function close({restoreFocus = false} = {}) {
    if (panel.hidden) return;
    panel.hidden = true;
    journey.removeAttribute('data-explorer-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({preventScroll: true});
  }

  function open() {
    search.value = '';
    render();
    panel.hidden = false;
    journey.setAttribute('data-explorer-open', '');
    trigger.setAttribute('aria-expanded', 'true');
    // On touchscreens the software keyboard would immediately obscure a sheet.
    if (matchMedia('(pointer: coarse)').matches) closeButton.focus({preventScroll: true});
    else search.focus({preventScroll: true});
  }

  trigger.addEventListener('click', () => panel.hidden ? open() : close({restoreFocus: true}));
  closeButton.addEventListener('click', () => close({restoreFocus: true}));
  search.addEventListener('input', render);
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target)) close();
  });
  // Capture before the map's Escape handler, which otherwise closes project
  // details too. Escape here should dismiss only the explorer.
  document.addEventListener('keydown', event => {
    if (panel.hidden || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close({restoreFocus: true});
  }, true);
  render();
  return {close, sync: render};
}
