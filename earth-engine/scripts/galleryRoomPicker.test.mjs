import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGalleryRoomPicker} from '../src/galleryRoomPicker.js';
const projects = JSON.parse(await readFile(new URL('../src/data/achievements.json', import.meta.url), 'utf8'));

function fixture(collection = projects, onSortChange = () => {}) {
  class Target {
    constructor() {this.listeners = new Map();}
    addEventListener(type, callback) {if (!this.listeners.has(type)) this.listeners.set(type, new Set());this.listeners.get(type).add(callback);}
    removeEventListener(type, callback) {this.listeners.get(type)?.delete(callback);}
    dispatch(type, values = {}) {
      const event = {target: this, preventDefault() {this.prevented = true;}, stopPropagation() {this.stopped = true;}, ...values};
      for (let target = this; target && !event.stopped; target = target.parentElement) {
        for (const callback of target.listeners.get(type) || []) callback(event);
      }
      return event;
    }
  }
  const document = new Target();document.activeElement = null;
  class Element extends Target {
    constructor(tag) {super();this.tagName = tag.toUpperCase();this.children = [];this.parentElement = null;this.attributes = new Map();this.dataset = {};this.style = {};this.hidden = false;this.value = '';this.className = '';this.text = '';this.scrollTop = 0;}
    append(...children) {
      for (const child of children) {
        if (child.parentElement) {
          if (child.contains(document.activeElement)) document.activeElement = null;
          child.parentElement.children = child.parentElement.children.filter(item => item !== child);
        }
        this.children.push(child);child.parentElement = this;
      }
    }
    set textContent(value) {this.text = value;this.children = [];}
    get textContent() {return this.text + this.children.map(child => child.textContent).join('');}
    setAttribute(key, value) {this.attributes.set(key, String(value));}
    getAttribute(key) {return this.attributes.get(key) ?? null;}
    contains(child) {for (let target = child; target; target = target.parentElement) if (target === this) return true;return false;}
    focus() {document.activeElement = this;}
    remove() {if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);this.parentElement = null;}
  }
  document.createElement = tag => new Element(tag);
  const selections = [], sortChanges = [];
  const picker = createGalleryRoomPicker({projects: collection, onSelect: slug => selections.push(slug), onSortChange: mode => {sortChanges.push(mode);onSortChange(mode);}, document});
  const host = new Element('aside');host.append(picker.element);
  const descendants = (element = picker.element) => element.children.flatMap(child => [child, ...descendants(child)]);
  const all = className => descendants().filter(element => element.className === className);
  const one = className => all(className)[0];
  return {document, selections, sortChanges, picker, host, all, one, Element};
}

test('compact progress selects among all original titles and cities without rebuilding choices', () => {
  const f = fixture(), options = f.all('gallery-room-picker-option');
  assert.equal(options.length, 32);
  assert.deepEqual(f.all('gallery-room-picker-title').map(element => element.textContent), projects.map(project => project.title));
  assert.deepEqual(f.all('gallery-room-picker-city').map(element => element.textContent), projects.map(project => [project.city, project.country].filter(Boolean).join(', ')));
  assert.equal(f.one('gallery-room-current-number').textContent, '1');
  assert.equal(f.one('gallery-room-current-total').textContent, '32');
  assert.equal(f.one('gallery-room-selector-button').textContent, '1/32⌃');
  assert.equal(f.one('gallery-room-current-date').textContent, projects[0].date);
  assert.equal(f.one('gallery-room-current-place').textContent, `${projects[0].venue} · ${projects[0].city}, ${projects[0].country}`);
  assert.ok(f.one('gallery-room-current-place').title.includes(projects[0].venue));
  f.picker.setActive(projects[21].slug);
  assert.equal(f.one('gallery-room-selector-button').textContent, '22/32⌃');
  assert.equal(f.one('gallery-room-current-date').textContent, projects[21].date);
  assert.equal(f.one('gallery-room-current-place').textContent, `${projects[21].venue} · ${projects[21].city}, ${projects[21].country}`);
  assert.ok(f.one('gallery-room-selector-button').getAttribute('aria-label').includes(projects[21].title));
  assert.equal(options[21].getAttribute('aria-current'), 'true');
  assert.equal(options.filter(option => option.getAttribute('aria-current') === 'true').length, 1);
  assert.ok(f.all('gallery-room-picker-option').every((option, index) => option === options[index]));
  f.picker.setActive('invalid-slug');assert.equal(f.one('gallery-room-current-number').textContent, '22');
  assert.deepEqual(f.selections, []);f.picker.dispose();
  const subset = fixture(projects.slice(0, 3));
  subset.picker.setActive(projects[2].slug);
  assert.equal(subset.one('gallery-room-selector-button').textContent, '3/3⌃', 'the total comes from the actual collection');
  subset.picker.dispose();
});

test('opening, filtering and keyboard choice operate on real projects and restore selector focus', () => {
  const f = fixture(), trigger = f.one('gallery-room-selector-button'), search = f.one('gallery-room-picker-search');
  const panel = f.one('gallery-room-picker');
  assert.equal(panel.hidden, true);assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(trigger.getAttribute('aria-controls'), panel.id);assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
  trigger.dispatch('click');assert.equal(panel.hidden, false);assert.equal(f.document.activeElement, search);
  search.value = 'mÜnich';search.dispatch('input');
  const visible = f.all('gallery-room-picker-option').filter(option => !option.hidden);
  assert.equal(visible.length, projects.filter(project => project.city === 'Munich').length);
  search.dispatch('keydown', {key: 'ArrowDown'});assert.equal(f.document.activeElement, visible[0]);
  visible[0].dispatch('keydown', {key: 'ArrowDown'});assert.equal(f.document.activeElement, visible[1]);
  visible[1].dispatch('keydown', {key: 'ArrowUp'});assert.equal(f.document.activeElement, visible[0]);
  visible[0].dispatch('keydown', {key: 'ArrowUp'});assert.equal(f.document.activeElement, search);
  search.value = 'Japan';search.dispatch('input');
  assert.equal(f.all('gallery-room-picker-option').filter(option => !option.hidden).length,
    projects.filter(project => `${project.title} ${project.city} ${project.country}`.toLowerCase().includes('japan')).length);
  search.value = 'trajectory';search.dispatch('input');
  search.dispatch('keydown', {key: 'Enter'});
  assert.deepEqual(f.selections, ['masters-thesis']);assert.equal(panel.hidden, true);
  assert.equal(f.document.activeElement, trigger);assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  trigger.dispatch('click');assert.equal(search.value, '');assert.equal(f.all('gallery-room-picker-option').filter(option => !option.hidden).length, 32);
  search.value = 'nothing-matches-123';search.dispatch('input');
  assert.equal(f.all('gallery-room-picker-option').filter(option => !option.hidden).length, 0);
  assert.equal(f.one('gallery-room-picker-empty').hidden, false);
  search.dispatch('keydown', {key: 'Enter'});assert.equal(f.selections.length, 1);
  f.picker.dispose();
});

test('Escape stays inside the picker, outside interaction keeps focus, and a native option click selects once', () => {
  const f = fixture(), trigger = f.one('gallery-room-selector-button'), panel = f.one('gallery-room-picker');
  let roomEscapes = 0;f.host.addEventListener('keydown', () => roomEscapes++);
  trigger.dispatch('click');
  const escaped = f.one('gallery-room-picker-search').dispatch('keydown', {key: 'Escape'});
  assert.equal(escaped.prevented, true);assert.equal(roomEscapes, 0);assert.equal(panel.hidden, true);
  assert.equal(f.document.activeElement, trigger);
  trigger.dispatch('click');const outside = new f.Element('button');outside.focus();
  f.document.dispatch('pointerdown', {target: outside});
  assert.equal(panel.hidden, true);assert.equal(f.document.activeElement, outside);
  trigger.dispatch('click');f.all('gallery-room-picker-option')[7].dispatch('click');
  assert.deepEqual(f.selections, [projects[7].slug]);assert.equal(panel.hidden, true);
  assert.equal(f.document.activeElement, trigger);f.picker.dispose();
});

test('disposing removes document and native control listeners and remains safe twice', () => {
  const f = fixture(), trigger = f.one('gallery-room-selector-button'), option = f.all('gallery-room-picker-option')[2];
  trigger.dispatch('click');f.picker.dispose();f.picker.dispose();
  assert.equal(f.host.children.length, 0);assert.equal(f.document.listeners.get('pointerdown').size, 0);
  trigger.dispatch('click');option.dispatch('click');f.picker.setActive(projects[1].slug);
  assert.deepEqual(f.selections, []);
});

test('every chooser option exposes five export-colored stars with exact fractional importance', () => {
  const f = fixture([{...projects[0], importance: 8.5}, {...projects[1], importance: 0}, {...projects[2], importance: 10}]);
  const ratings = f.all('gallery-room-picker-stars');
  assert.deepEqual(ratings.map(rating => rating.getAttribute('aria-label')), ['Importance 4.25 of 5', 'Importance 0 of 5', 'Importance 5 of 5']);
  assert.ok(ratings.every(rating => rating.getAttribute('role') === 'img' && rating.children.length === 5));
  assert.deepEqual(ratings[0].children.map(star => star.children[0].style.width), ['100%', '100%', '100%', '100%', '25%']);
  assert.deepEqual(ratings[1].children.map(star => star.children[0].style.width), ['0%', '0%', '0%', '0%', '0%']);
  assert.deepEqual(ratings[2].children.map(star => star.children[0].style.width), ['100%', '100%', '100%', '100%', '100%']);
  assert.equal(ratings[0].children[0].children[0].style.backgroundColor, 'rgb(245, 158, 11)');
  assert.equal(ratings[0].children[4].children[0].style.backgroundColor, 'rgb(139, 92, 246)');
  assert.ok(f.all('gallery-room-picker-star').every(star => star.getAttribute('aria-hidden') === 'true'));
  f.picker.dispose();
});

test('the adjacent native sort toggle defaults to recent and never selects or forwards movement keys', () => {
  const f = fixture(), toggle = f.one('gallery-room-sort-button'), selector = f.one('gallery-room-selector-button');
  assert.equal(toggle.tagName, 'BUTTON');assert.equal(toggle.type, 'button');
  assert.equal(toggle.parentElement, selector.parentElement);
  assert.deepEqual(toggle.parentElement.children, [toggle, selector]);
  assert.equal(toggle.textContent, '(more recent first)');assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.ok(toggle.getAttribute('aria-label').includes('Switch to more important first'));
  let roomKeys = 0, roomPointers = 0;f.host.addEventListener('keydown', () => roomKeys++);f.host.addEventListener('pointerdown', () => roomPointers++);
  toggle.focus();toggle.dispatch('keydown', {key: 'ArrowRight'});toggle.dispatch('pointerdown');
  assert.equal(roomKeys, 0);assert.equal(roomPointers, 0);
  toggle.dispatch('click');
  assert.equal(toggle.textContent, '(more important first)');assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.ok(toggle.getAttribute('aria-label').includes('Switch to more recent first'));
  assert.deepEqual(f.sortChanges, ['importance']);assert.deepEqual(f.selections, []);
  assert.equal(f.document.activeElement, toggle);assert.equal(f.one('gallery-room-picker').hidden, true);
  assert.equal(f.one('gallery-room-current-number').textContent, '1');
  toggle.dispatch('click');assert.deepEqual(f.sortChanges, ['importance', 'recent']);
  f.picker.setSortMode('importance');assert.equal(toggle.textContent, '(more important first)');
  assert.equal(f.sortChanges.length, 2, 'external state updates do not loop through the change callback');
  assert.throws(() => f.picker.setSortMode('unknown'), TypeError);
  f.picker.dispose();toggle.dispatch('click');assert.equal(f.sortChanges.length, 2);
});

test('reordering preserves the selected project, search, open state, option focus and listeners', () => {
  const f = fixture(), originalOptions = f.all('gallery-room-picker-option'), selected = projects[7];
  const selector = f.one('gallery-room-selector-button'), search = f.one('gallery-room-picker-search');
  f.picker.setActive(selected.slug);selector.dispatch('click');
  search.value = 'Munich';search.dispatch('input');
  const visibleBefore = originalOptions.filter(option => !option.hidden), focused = visibleBefore[1];
  focused.focus();f.one('gallery-room-picker-options').scrollTop = 88;
  const reversed = [...projects].reverse();f.picker.setProjects(reversed);
  const reordered = f.all('gallery-room-picker-option'), visibleAfter = reordered.filter(option => !option.hidden);
  assert.deepEqual(reordered, [...originalOptions].reverse());
  assert.equal(new Set(reordered).size, 32);assert.equal(f.document.activeElement, focused);
  assert.equal(f.one('gallery-room-picker-options').scrollTop, 88);
  assert.equal(search.value, 'Munich');assert.equal(f.one('gallery-room-picker').hidden, false);
  assert.equal(selector.getAttribute('aria-expanded'), 'true');
  assert.equal(f.one('gallery-room-current-number').textContent, String(reversed.indexOf(selected) + 1));
  assert.equal(f.one('gallery-room-current-date').textContent, selected.date);
  assert.deepEqual(reordered.filter(option => option.getAttribute('aria-current') === 'true').map(option => option.dataset.projectSlug), [selected.slug]);
  assert.deepEqual(visibleAfter, [...visibleBefore].reverse());
  focused.dispatch('keydown', {key: 'Home'});assert.equal(f.document.activeElement, visibleAfter[0]);
  visibleAfter[0].dispatch('keydown', {key: 'ArrowDown'});assert.equal(f.document.activeElement, visibleAfter[1]);
  visibleAfter[1].dispatch('keydown', {key: 'End'});assert.equal(f.document.activeElement, visibleAfter.at(-1));
  search.focus();f.picker.setProjects(projects);assert.equal(f.document.activeElement, search);
  search.dispatch('keydown', {key: 'ArrowDown'});assert.equal(f.document.activeElement, visibleBefore[0]);
  assert.deepEqual(f.selections, []);visibleBefore[0].dispatch('click');
  assert.deepEqual(f.selections, [visibleBefore[0].dataset.projectSlug], 'the retained option invokes one listener');
  assert.equal(f.one('gallery-room-picker').hidden, true);assert.equal(f.document.activeElement, selector);
  assert.throws(() => f.picker.setProjects(projects.slice(1)), TypeError);
  assert.throws(() => f.picker.setProjects([...projects.slice(1), projects[1]]), TypeError);
  assert.throws(() => f.picker.setProjects([...projects.slice(1), {...projects[0], slug: 'unknown'}]), TypeError);
  f.picker.dispose();
});
