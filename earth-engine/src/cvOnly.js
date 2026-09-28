import './style.css';
import {createCvView} from './cvView.js';
import {bindCvDownload} from './cvDownload.js';
import {portfolioLinks} from './portfolioData.js';

/** A map-free entry for the live CV PDF, including deep links from its text. */
export function startCvOnly() {
  const root = document.getElementById('cv-view-root');
  const route = new URL(window.location.href);
  let navigatingToProject = false;
  const cv = createCvView({
    root,
    onProjectLink(slug) {
      navigatingToProject = true;
      const url = new URL(window.location.href);
      url.searchParams.set('event', slug);
      url.searchParams.delete('view');
      url.searchParams.delete('download');
      url.hash = '';
      window.location.assign(url.href);
    },
  });
  document.getElementById('cv-download').href = portfolioLinks.cvPdf;
  bindCvDownload(document.getElementById('cv-download'));
  document.getElementById('cv-view').addEventListener('close', () => {
    if (navigatingToProject) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    url.searchParams.delete('download');
    url.hash = '';
    window.location.replace(url.href);
  });
  cv.open();
  if (route.searchParams.get('download') === 'cv') {
    document.getElementById('cv-download').click();
  }
}
