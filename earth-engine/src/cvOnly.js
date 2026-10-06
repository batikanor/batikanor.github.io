import './style.css';
import {createCvView} from './cvView.js';
import {bindCvDownload} from './cvDownload.js';
import {portfolioLinks} from './portfolioData.js';
import {cvDestinationUrl} from './portfolioRoute.js';

/** A map-free entry for the live CV PDF, including deep links from its text. */
export function startCvOnly() {
  const root = document.getElementById('cv-view-root');
  const route = new URL(window.location.href);
  let navigatingToProject = false;
  const cv = createCvView({
    root,
    onProjectLink(slug) {
      navigatingToProject = true;
      const url = cvDestinationUrl(window.location.href, slug);
      window.location.assign(url.href);
    },
  });
  document.getElementById('cv-download').href = portfolioLinks.cvPdf;
  bindCvDownload(document.getElementById('cv-download'));
  document.getElementById('cv-view').addEventListener('close', () => {
    if (navigatingToProject) return;
    const url = cvDestinationUrl(window.location.href);
    window.location.replace(url.href);
  });
  // A project link closes the dialog before leaving. Browser Back can restore
  // that exact document from BFCache without re-running this entry point.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    navigatingToProject = false;
    cv.open();
  });
  cv.open();
  if (route.searchParams.get('download') === 'cv') {
    document.getElementById('cv-download').click();
  }
}
