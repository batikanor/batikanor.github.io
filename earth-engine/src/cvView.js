import './cvView.css';
import { portfolioLinks } from './portfolioData.js';
import { bindCvDownload, fetchCvPdfBlob } from './cvDownload.js';
import { getProject } from './projectContent.js';
import { cvDestinationUrl, portfolioProjectSlug } from './portfolioRoute.js';
import { clampPanelRect, expandedPanelRect, largePanelRect, reserveJourneySpace, reserveReadingTopbar, resizePanelRect, withCompactPanelMinimum } from './detailPanel.js';
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
  dialog.className = 'cv-view is-floating is-reading';
  dialog.setAttribute('aria-labelledby', 'cv-view-title');
  dialog.setAttribute('aria-modal', 'false');
  dialog.innerHTML = `
    <div class="cv-view-shell">
      <header class="cv-view-header">
        <div class="cv-view-heading">
          <span class="cv-view-kicker">CURRICULUM VITAE</span>
          <h2 id="cv-view-title">Batıkan Bora Ormancı</h2>
        </div>
        <div class="cv-view-actions">
          <div class="cv-view-document-actions">
          <a class="cv-view-link" href="${CV_PREVIEW_URL}" target="_blank" rel="noopener noreferrer" aria-label="Open CV in Google Drive">OPEN IN DRIVE ↗</a>
          <a class="cv-view-link cv-view-download" href="${portfolioLinks.cvPdf}" target="_blank" rel="noopener noreferrer" aria-label="Download the latest CV as PDF">DOWNLOAD PDF ↓</a>
          <button class="cv-view-zoom" type="button" data-cv-zoom="out" aria-label="Zoom CV out">−</button>
          <button class="cv-view-zoom" type="button" data-cv-zoom="in" aria-label="Zoom CV in">+</button>
          </div>
          <div class="cv-view-window-actions">
          <button class="cv-view-size" type="button" aria-label="Expand CV window" aria-pressed="false">⛶ Expand</button>
          <button class="cv-view-drag" type="button" aria-label="Move CV window" title="Drag or use arrow keys to move · Home restores reading view">⠿</button>
          <button class="cv-view-close" type="button" aria-label="Close CV">×</button>
          </div>
        </div>
      </header>
      <div class="cv-view-document">
        <p class="cv-view-loading" role="status">Loading the latest CV…</p>
        <div class="cv-view-pages" role="document" aria-label="Batıkan Bora Ormancı’s CV"></div>
      </div>
      <p class="cv-view-help">The CV is displayed from the same live Google document as batikanor.com. If your browser cannot show it here, use <strong>Open in Drive</strong> or <strong>Download PDF</strong>.</p>
    </div>
    <button class="cv-view-resize cv-view-resize-left" type="button" aria-label="Resize CV window from lower-left corner" title="Drag or use arrow keys to resize"></button>
    <button class="cv-view-resize cv-view-resize-right" type="button" aria-label="Resize CV window from lower-right corner" title="Drag or use arrow keys to resize"></button>
  `;
  root.append(dialog);

  const documentViewport = dialog.querySelector('.cv-view-document');
  const pages = dialog.querySelector('.cv-view-pages');
  const loading = dialog.querySelector('.cv-view-loading');
  const closeButton = dialog.querySelector('.cv-view-close');
  const sizeButton = dialog.querySelector('.cv-view-size');
  const dragHandle = dialog.querySelector('.cv-view-drag');
  let previousFocus = null;
  let abortController = null;
  let pdfTask = null;
  let pdfDocument = null;
  let cvPdfBlob = null;
  let previewTimeout = null;
  let zoomIndex = 0;
  const zoomLevels = [1, 1.5, 2.2];
  let expanded = false;
  let reading = true;
  let windowRect = null;
  let restoreState = null;
  let geometryFrame = 0;

  function windowBounds({measureChrome = true} = {}) {
    const width = window.innerWidth, height = window.innerHeight;
    const gutter = Math.min(8, width / 4, height / 4);
    const styles = window.getComputedStyle(dialog);
    const safe = edge => Math.max(0, parseFloat(styles.getPropertyValue(`--cv-safe-${edge}`)) || 0);
    const left = Math.min(gutter + safe('left'), width - 1);
    const top = Math.min(gutter + safe('top'), height - 1);
    const chromeHeight = dialog.open && measureChrome
      ? dialog.querySelector('.cv-view-header').getBoundingClientRect().height
        + dialog.querySelector('.cv-view-help').getBoundingClientRect().height
      : 0;
    const area = reserveJourneySpace({
      left, top, right: Math.max(left + 1, width - gutter - safe('right')),
      bottom: Math.max(top + 1, height - gutter - safe('bottom')),
      viewportWidth: width, viewportHeight: height,
      minWidth: 280, minHeight: Math.max(240, chromeHeight + 96 + 2),
    }, document.getElementById('journey'));
    const readingArea = reserveReadingTopbar(area, document.querySelector('.topbar'));
    // A short map has less space than the normal document minimum. Its compact
    // toolbar still leaves32px of scroll space, while standalone views keep240px.
    const compactMinimum = dialog.classList.contains('is-compact') ? Math.max(80, chromeHeight + 34) : 80;
    return withCompactPanelMinimum(readingArea, compactMinimum);
  }

  function measuredWindowRect() {
    const rect = dialog.getBoundingClientRect();
    return {x: rect.left, y: rect.top, width: rect.width, height: rect.height};
  }

  function updateWindowControls() {
    dialog.classList.toggle('is-expanded', expanded);
    dialog.classList.toggle('is-floating', !expanded);
    dialog.classList.toggle('is-reading', reading);
    sizeButton.textContent = expanded ? '↙ Restore' : '⛶ Expand';
    const label = expanded ? 'Restore CV window' : 'Expand CV window';
    sizeButton.setAttribute('aria-label', label);
    sizeButton.title = label;
    sizeButton.setAttribute('aria-pressed', String(expanded));
    dragHandle.disabled = false;
  }

  function writeWindowRect(rect) {
    dialog.classList.toggle('is-compact', rect.height < 320);
    for (const [property, value] of Object.entries({
      left: rect.x, top: rect.y, width: rect.width, height: rect.height,
    })) dialog.style[property] = `${value}px`;
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
  }

  function applyWindowRect(rect) {
    // Choose the destination layout before measuring its toolbar: an expanded
    // header can be taller than the compact window being restored.
    windowRect = clampPanelRect(rect, windowBounds({measureChrome: false}));
    expanded = false;
    reading = false;
    restoreState = null;
    updateWindowControls();
    writeWindowRect(windowRect);
    // A narrower window may wrap the toolbar. Preserve a readable document
    // area after that reflow rather than using the old, wider header's minimum.
    windowRect = clampPanelRect(windowRect, windowBounds());
    writeWindowRect(windowRect);
    updatePageLayout();
  }

  function resetReadingView() {
    expanded = false;
    reading = true;
    restoreState = null;
    windowRect = largePanelRect(windowBounds({measureChrome: false}));
    writeWindowRect(windowRect);
    const area = windowBounds();
    windowRect = clampPanelRect(windowRect, {...area, top: Math.max(area.top, area.readingTop ?? area.top)});
    writeWindowRect(windowRect);
    updateWindowControls();
    if (dialog.open) updatePageLayout();
  }

  function toggleExpanded() {
    if (expanded) {
      const previous = restoreState;
      if (previous?.reading) resetReadingView();
      else applyWindowRect(previous?.rect ?? largePanelRect(windowBounds()));
    } else {
      restoreState = {rect: measuredWindowRect(), reading};
      expanded = true;
      reading = false;
      windowRect = expandedPanelRect(windowBounds());
      writeWindowRect(windowRect);
      updateWindowControls();
      updatePageLayout();
    }
  }

  function bindWindowHandle(handle, mode) {
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const bounds = windowBounds();
      const start = measuredWindowRect();
      const pointer = {x: event.clientX, y: event.clientY};
      let changed = false;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('is-dragging');
      const move = moveEvent => {
        if (moveEvent.pointerId !== event.pointerId) return;
        const dx = moveEvent.clientX - pointer.x, dy = moveEvent.clientY - pointer.y;
        if (!changed && Math.abs(dx) + Math.abs(dy) < 2) return;
        const next = mode === 'move'
          ? {...start, x: start.x + dx, y: start.y + dy}
          : resizePanelRect(start, dx, dy, mode, bounds);
        const clamped = clampPanelRect(next, bounds);
        if (Object.keys(start).every(key => clamped[key] === start[key])) return;
        changed = true;
        applyWindowRect(next);
      };
      const finish = endEvent => {
        if (endEvent.pointerId !== event.pointerId) return;
        handle.classList.remove('is-dragging');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', finish);
        handle.removeEventListener('pointercancel', finish);
        handle.removeEventListener('lostpointercapture', finish);
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
      handle.addEventListener('lostpointercapture', finish);
    });
    handle.addEventListener('keydown', event => {
      if (event.key === 'Home') { event.preventDefault(); resetReadingView(); return; }
      const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
      if (!direction) return;
      event.preventDefault();
      const step = event.shiftKey ? 48 : 16;
      const dx = direction[0] * step, dy = direction[1] * step;
      const current = measuredWindowRect();
      const next = mode === 'move'
        ? {...current, x: current.x + dx, y: current.y + dy}
        : resizePanelRect(current, dx, dy, mode, windowBounds());
      const clamped = clampPanelRect(next, windowBounds());
      if (Object.keys(current).every(key => clamped[key] === current[key])) return;
      applyWindowRect(next);
    });
  }

  sizeButton.addEventListener('click', toggleExpanded);
  dragHandle.addEventListener('dblclick', resetReadingView);
  bindWindowHandle(dragHandle, 'move');
  bindWindowHandle(dialog.querySelector('.cv-view-resize-left'), 'sw');
  bindWindowHandle(dialog.querySelector('.cv-view-resize-right'), 'se');

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
  function reclampWindow() {
    if (!dialog.open) return;
    if (expanded) {
      if (restoreState) restoreState.rect = clampPanelRect(restoreState.rect, windowBounds());
      windowRect = expandedPanelRect(windowBounds());
      writeWindowRect(windowRect);
      updatePageLayout();
    } else if (reading) resetReadingView();
    else applyWindowRect(windowRect);
  }
  function scheduleGeometry() {
    if (geometryFrame) cancelAnimationFrame(geometryFrame);
    geometryFrame = requestAnimationFrame(() => { geometryFrame = 0; reclampWindow(); });
  }
  window.addEventListener('resize', scheduleGeometry);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(scheduleGeometry);
    for (const id of ['journey', 'sources']) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
  }
  closeButton.addEventListener('click', () => dialog.close());
  bindCvDownload(dialog.querySelector('.cv-view-download'), { getBlob: () => cvPdfBlob });

  // A map's global keyboard controls must not interpret keys pressed while
  // scrolling the CV. The modeless window keeps the exposed chronology usable.
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
    event.stopPropagation();
  });

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
        const projectSlug = portfolioProjectSlug(annotation.url, {has: slug => Boolean(getProject(slug))});
        const [a, b, c, d, e, f] = viewport.transform;
        const [left, bottom, right, top] = annotation.rect;
        const x1 = a * left + c * bottom + e;
        const y1 = b * left + d * bottom + f;
        const x2 = a * right + c * top + e;
        const y2 = b * right + d * top + f;
        const link = document.createElement('a');
        link.className = 'cv-view-document-link';
        const localUrl = projectSlug ? cvDestinationUrl(window.location.href, projectSlug) : null;
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
      resetReadingView();
      dialog.show();
      resetReadingView();
      closeButton.focus();
      abortController = new AbortController();
      const { signal } = abortController;
      previewTimeout = setTimeout(() => {
        if (!dialog.open || loading.hidden) return;
        abortController?.abort();
        loading.textContent = 'The CV preview timed out. Open it in Drive or download the PDF above.';
      }, 30000);
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
