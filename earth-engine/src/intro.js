import './intro.css';
import {introVariantUrl, readIntroVariant} from './introGate.js';

const $ = id => document.getElementById(id);

/** Resolve only after an explicit activation; never start the map on a timer. */
export function waitForIntroEntry() {
  const screen = $('intro-screen');
  const enter = $('intro-enter');
  const app = $('app');
  app.inert = true;
  screen.inert = false;
  const variants = [...screen.querySelectorAll('[data-intro-variant]')];
  function renderVariant(variant) {
    screen.dataset.variant = variant;
    for (const button of variants) {
      button.setAttribute('aria-pressed', String(button.dataset.introVariant === variant));
    }
  }
  renderVariant(readIntroVariant(location.href));
  for (const button of variants) {
    button.addEventListener('click', () => {
      const variant = button.dataset.introVariant;
      renderVariant(variant);
      history.replaceState(history.state, '', introVariantUrl(location.href, variant));
    });
  }
  // Native focus makes the sole transition discoverable to keyboard users.
  requestAnimationFrame(() => enter.focus({preventScroll:true}));
  return new Promise(resolve => {
    enter.addEventListener('click', () => {
      enter.disabled = true;
      enter.querySelector('.intro-enter-label').textContent = 'Opening map…';
      $('intro-load-status').textContent = 'Opening the interactive map…';
      resolve();
    }, {once:true});
  });
}

export function finishIntro() {
  const screen = $('intro-screen');
  const app = $('app');
  document.documentElement.classList.remove('intro-active');
  screen.inert = true;
  app.inert = false;
  screen.hidden = true;
  $('journey-current')?.focus({preventScroll:true});
}

export function hideIntroForDeepLink() {
  const screen = $('intro-screen');
  document.documentElement.classList.remove('intro-active');
  screen.hidden = true;
  screen.inert = true;
  $('app').inert = false;
}
