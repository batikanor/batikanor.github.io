import { portfolioLinks } from './portfolioData.js';

// Match the filename used by the current batikanor.com CV download.
export const CV_DOWNLOAD_FILENAME = 'Batikan-Bora-Ormanci-CV.pdf';

/** Fetch the current Google document export, rejecting login/error HTML. */
export async function fetchCvPdfBlob({
  url = portfolioLinks.cvPdf,
  signal,
  fetchImpl = globalThis.fetch,
} = {}) {
  const response = await fetchImpl(url, {
    cache: 'no-store',
    credentials: 'omit',
    mode: 'cors',
    redirect: 'follow',
    signal,
  });
  if (!response.ok) throw new Error(`CV PDF export returned HTTP ${response.status}`);
  const blob = await response.blob();
  if (await blob.slice(0, 5).text() !== '%PDF-') {
    throw new Error('CV export did not return a PDF');
  }
  return blob;
}

/** Use an object URL so cross-origin links retain the intended download name. */
function savePdfBlob(blob, filename) {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // A short delay allows mobile browsers to claim the object URL. This is a
    // one-page CV, so retaining the small Blob briefly is acceptable.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

function openOriginalExport(url) {
  // A new tab opened after an async fetch may be blocked. Same-tab navigation
  // is reliable and Google's attachment response normally leaves this page
  // intact after the browser accepts the download.
  window.location.assign(url);
}

/**
 * Download the current CV with a stable filename, falling back to Google Docs.
 * `blob` lets the CV viewer reuse the identical bytes it already fetched.
 * Injectable side-effect functions make failure paths testable.
 */
export async function downloadCvPdf({
  blob,
  url = portfolioLinks.cvPdf,
  filename = CV_DOWNLOAD_FILENAME,
  fetchImpl = globalThis.fetch,
  save = savePdfBlob,
  fallback = openOriginalExport,
} = {}) {
  try {
    const pdf = blob || await fetchCvPdfBlob({ url, fetchImpl });
    if (await pdf.slice(0, 5).text() !== '%PDF-') throw new Error('CV Blob was not a PDF');
    await save(pdf, filename);
    return { mode: 'download', filename };
  } catch (error) {
    fallback(url);
    return { mode: 'fallback', url, error };
  }
}

/** Attach the same download behaviour to the menu and the in-site CV view. */
export function bindCvDownload(element, { getBlob, onBusy, onResult, fallback } = {}) {
  if (!(element instanceof HTMLAnchorElement)) {
    throw new TypeError('bindCvDownload requires an anchor element');
  }
  // Keep a real destination for copy-link, modified-click, and no-JS users.
  element.href = portfolioLinks.cvPdf;
  element.setAttribute('download', CV_DOWNLOAD_FILENAME);
  let busy = false;
  const handleClick = async (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (busy) return;
    busy = true;
    element.setAttribute('aria-busy', 'true');
    onBusy?.(true);
    try {
      const result = await downloadCvPdf({ blob: getBlob?.(), fallback });
      onResult?.(result);
    } finally {
      busy = false;
      element.removeAttribute('aria-busy');
      onBusy?.(false);
    }
  };
  element.addEventListener('click', handleClick);
  return () => element.removeEventListener('click', handleClick);
}
