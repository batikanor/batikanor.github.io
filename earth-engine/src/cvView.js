import './cvView.css';
import { portfolioLinks } from './portfolioData.js';
import { bindCvDownload, fetchCvPdfBlob } from './cvDownload.js';
import { getProject } from './projectContent.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Same live Google document used by batikanor.com/cv. Its current PDF is
// rendered in-page via a lazily loaded PDF.js module; neither Google Docs
// iframe permissions nor the browser's optional PDF plugin are required.
const CV_PREVIEW_URL = 'https://docs.google.com/document/d/1WJrlmn0cTgHiylnJaGbDYt_AX4li0fC8VFtORVIkh8w/preview?rm=minimal';

/**
 * Mount the current CV as an in-site, accessible document view.
 *
 * @param {{root?: HTMLElement, onProjectLink?: (slug: string) => void}} options
 * @returns {{open: () => void, close: () => void, isOpen: () => boolean}}
 */
export function createCvView({ root = document.body, onProjectLink } = {}) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError('createCvView requires an HTMLElement root');
  }

  const dialog = document.createElement('dialog');
  dialog.id = 'cv-view';
  dialog.className = 'cv-view';
  dialog.setAttribute('aria-labelledby', 'cv-view-title');
  dialog.innerHTML = `
    <div class="cv-view-shell">
      <header class="cv-view-header">
        <div class="cv-view-heading">
          <span class="cv-view-kicker">CURRICULUM VITAE</span>
          <h2 id="cv-view-title">Batıkan Bora Ormancı</h2>
        </div>
        <div class="cv-view-actions">
          <a class="cv-view-link" href="${CV_PREVIEW_URL}" target="_blank" rel="noopener noreferrer" aria-label="Open CV in Google Drive">OPEN IN DRIVE ↗</a>
          <a class="cv-view-link cv-view-download" href="${portfolioLinks.cvPdf}" target="_blank" rel="noopener noreferrer" aria-label="Download the latest CV as PDF">DOWNLOAD PDF ↓</a>
          <button class="cv-view-zoom" type="button" data-cv-zoom="out" aria-label="Zoom CV out">−</button>
          <button class="cv-view-zoom" type="button" data-cv-zoom="in" aria-label="Zoom CV in">+</button>
          <button class="cv-view-close" type="button" aria-label="Close CV">×</button>
        </div>
      </header>
      <div class="cv-view-document">
        <p class="cv-view-loading" role="status">Loading the latest CV…</p>
        <div class="cv-view-pages" role="document" aria-label="Batıkan Bora Ormancı’s CV"></div>
      </div>
      <p class="cv-view-help">The CV is displayed from the same live Google document as batikanor.com. If your browser cannot show it here, use <strong>Open in Drive</strong> or <strong>Download PDF</strong>.</p>
    </div>
  `;
  root.append(dialog);

  const documentViewport = dialog.querySelector('.cv-view-document');
  const pages = dialog.querySelector('.cv-view-pages');
  const loading = dialog.querySelector('.cv-view-loading');
  const closeButton = dialog.querySelector('.cv-view-close');
  let previousFocus = null;
  let abortController = null;
  let pdfTask = null;
  let pdfDocument = null;
  let cvPdfBlob = null;
  let previewTimeout = null;
  let zoomIndex = 0;
  const zoomLevels = [1, 1.5, 2.2];

  function updatePageLayout() {
    const baseWidth = Math.min(820, Math.max(280, documentViewport.clientWidth - 24));
    const pageWidth = Math.round(baseWidth * zoomLevels[zoomIndex]);
    pages.style.width = `${Math.max(documentViewport.clientWidth, pageWidth + 24)}px`;
    pages.querySelectorAll('.cv-view-page').forEach((page) => {
      page.style.width = `${pageWidth}px`;
    });
    dialog.querySelector('[data-cv-zoom="out"]').disabled = zoomIndex === 0;
    dialog.querySelector('[data-cv-zoom="in"]').disabled = zoomIndex === zoomLevels.length - 1;
  }

  dialog.querySelectorAll('[data-cv-zoom]').forEach((button) => {
    button.addEventListener('click', () => {
      zoomIndex = Math.max(0, Math.min(zoomLevels.length - 1, zoomIndex + (button.dataset.cvZoom === 'in' ? 1 : -1)));
      updatePageLayout();
    });
  });
  window.addEventListener('resize', () => { if (dialog.open) updatePageLayout(); });
  closeButton.addEventListener('click', () => dialog.close());
  bindCvDownload(dialog.querySelector('.cv-view-download'), { getBlob: () => cvPdfBlob });

  // A map's global keyboard controls must not interpret keys pressed while
  // scrolling the CV or while its dialog is open. Escape retains native dialog
  // behaviour because propagation is stopped only after the default is chosen.
  dialog.addEventListener('keydown', (event) => event.stopPropagation());

  dialog.addEventListener('close', () => {
    abortController?.abort();
    abortController = null;
    if (previewTimeout) clearTimeout(previewTimeout);
    previewTimeout = null;
    // The loading task owns the PDF.js worker lifetime. PDFDocumentProxy is a
    // rendered document handle, not the reliable place to destroy the task.
    if (pdfTask) Promise.resolve(pdfTask.destroy()).catch(() => {});
    pdfTask = null;
    pdfDocument = null;
    cvPdfBlob = null;
    pages.replaceChildren();
    loading.hidden = false;
    loading.textContent = 'Loading the latest CV…';
    zoomIndex = 0;
    const target = previousFocus?.isConnected && !previousFocus.closest('[hidden]')
      ? previousFocus
      : document.getElementById('portfolio-toggle');
    target?.focus();
    previousFocus = null;
  });

  async function renderCurrentPdf(pdf, signal) {
    const [{ getDocument, GlobalWorkerOptions }, bytes] = await Promise.all([
      import('pdfjs-dist'),
      pdf.arrayBuffer(),
    ]);
    if (signal.aborted) return;
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    pdfTask = getDocument({ data: new Uint8Array(bytes) });
    pdfDocument = await pdfTask.promise;
    if (signal.aborted) return;

    for (let number = 1; number <= pdfDocument.numPages; number += 1) {
      const pdfPage = await pdfDocument.getPage(number);
      if (signal.aborted) return;

      // One high-resolution canvas is responsive at normal size and retains
      // enough pixels for the zoom controls on phones and laptops alike.
      const viewport = pdfPage.getViewport({ scale: 2.5 });
      const pageElement = document.createElement('div');
      pageElement.className = 'cv-view-page';
      pageElement.setAttribute('aria-label', `CV page ${number} of ${pdfDocument.numPages}`);
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      pageElement.append(canvas);

      const context = canvas.getContext('2d', { alpha: false });
      await pdfPage.render({ canvasContext: context, viewport }).promise;
      if (signal.aborted) return;

      // Preserve the document's live external hyperlinks rather than leaving
      // its rendered pages as a purely decorative image.
      const annotations = await pdfPage.getAnnotations();
      for (const annotation of annotations) {
        if (!annotation.url || !/^(https?:|mailto:)/i.test(annotation.url)) continue;
        let projectSlug = null;
        try {
          const destination = new URL(annotation.url);
          if (['batikanor.com', 'www.batikanor.com'].includes(destination.hostname)
            && (destination.pathname === '/' || /^\/projects\/?$/.test(destination.pathname))) {
            const candidate = decodeURIComponent(destination.hash.slice(1));
            if (/^[a-z0-9][a-z0-9-]*$/.test(candidate) && getProject(candidate)) projectSlug = candidate;
          }
        } catch { /* Keep the source PDF URL unchanged when it cannot be parsed. */ }
        const [a, b, c, d, e, f] = viewport.transform;
        const [left, bottom, right, top] = annotation.rect;
        const x1 = a * left + c * bottom + e;
        const y1 = b * left + d * bottom + f;
        const x2 = a * right + c * top + e;
        const y2 = b * right + d * top + f;
        const link = document.createElement('a');
        link.className = 'cv-view-document-link';
        const localUrl = new URL(window.location.href);
        if (projectSlug) { localUrl.searchParams.set('event', projectSlug); localUrl.hash = ''; }
        link.href = projectSlug ? localUrl.href : annotation.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', projectSlug ? `Open project in this map: ${projectSlug}` : `Open CV link: ${annotation.url}`);
        if (projectSlug && onProjectLink) {
          link.addEventListener('click', event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            dialog.close();
            onProjectLink(projectSlug);
          });
        }
        link.style.left = `${Math.min(x1, x2) / viewport.width * 100}%`;
        link.style.top = `${Math.min(y1, y2) / viewport.height * 100}%`;
        link.style.width = `${Math.abs(x2 - x1) / viewport.width * 100}%`;
        link.style.height = `${Math.abs(y2 - y1) / viewport.height * 100}%`;
        pageElement.append(link);
      }

      const textContent = await pdfPage.getTextContent();
      const accessibleText = document.createElement('span');
      accessibleText.className = 'sr-only';
      accessibleText.textContent = textContent.items.map((item) => item.str || '').join(' ');
      pageElement.append(accessibleText);

      pages.append(pageElement);
      updatePageLayout();
    }
    if (!signal.aborted) loading.hidden = true;
  }

  return {
    open() {
      if (dialog.open) return;
      previousFocus = document.activeElement;
      loading.hidden = false;
      loading.textContent = 'Loading the latest CV…';
      dialog.showModal();
      closeButton.focus();
      abortController = new AbortController();
      const { signal } = abortController;
      previewTimeout = setTimeout(() => {
        if (!dialog.open || loading.hidden) return;
        abortController?.abort();
        loading.textContent = 'The CV preview timed out. Open it in Drive or download the PDF above.';
      }, 20000);
      fetchCvPdfBlob({ signal })
        .then((pdf) => {
          if (signal.aborted || !dialog.open) return;
          cvPdfBlob = pdf;
          return renderCurrentPdf(pdf, signal).then(() => {
            if (previewTimeout) clearTimeout(previewTimeout);
            previewTimeout = null;
          });
        })
        .catch((error) => {
          if (signal.aborted || !dialog.open) return;
          if (previewTimeout) clearTimeout(previewTimeout);
          previewTimeout = null;
          console.warn('In-site CV PDF preview unavailable.', error);
          loading.textContent = 'The CV preview is unavailable. Open it in Drive or download the PDF above.';
        });
    },
    close() {
      if (dialog.open) dialog.close();
    },
    isOpen() {
      return dialog.open;
    },
  };
}
