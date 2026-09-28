import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CV_DOWNLOAD_FILENAME,
  downloadCvPdf,
  fetchCvPdfBlob,
} from '../src/cvDownload.js';
import { portfolioLinks } from '../src/portfolioData.js';

const validPdf = () => new Blob(['%PDF-1.4\ncurrent CV'], { type: 'application/pdf' });

test('fetches the live CV export without credentials or caching and validates PDF bytes', async () => {
  const calls = [];
  const result = await fetchCvPdfBlob({
    fetchImpl: async (...args) => {
      calls.push(args);
      return { ok: true, blob: async () => validPdf() };
    },
  });
  assert.equal(await result.slice(0, 5).text(), '%PDF-');
  assert.equal(calls[0][0], portfolioLinks.cvPdf);
  assert.deepEqual(
    { cache: calls[0][1].cache, credentials: calls[0][1].credentials, mode: calls[0][1].mode, redirect: calls[0][1].redirect },
    { cache: 'no-store', credentials: 'omit', mode: 'cors', redirect: 'follow' },
  );
});

test('rejects non-PDF and unsuccessful Google exports', async () => {
  await assert.rejects(fetchCvPdfBlob({
    fetchImpl: async () => ({ ok: true, blob: async () => new Blob(['<html>Sign in</html>']) }),
  }), /did not return a PDF/);
  await assert.rejects(fetchCvPdfBlob({
    fetchImpl: async () => ({ ok: false, status: 403 }),
  }), /HTTP 403/);
});

test('reuses a preview Blob and saves with the production CV filename', async () => {
  const saved = [];
  const result = await downloadCvPdf({
    blob: validPdf(),
    fetchImpl: () => { throw new Error('Existing Blob should avoid another fetch'); },
    save: (blob, filename) => saved.push([blob, filename]),
    fallback: () => { throw new Error('Success must not use fallback'); },
  });
  assert.equal(result.mode, 'download');
  assert.equal(result.filename, 'Batikan-Bora-Ormanci-CV.pdf');
  assert.equal(CV_DOWNLOAD_FILENAME, result.filename);
  assert.equal(saved[0][1], CV_DOWNLOAD_FILENAME);
  assert.equal(await saved[0][0].slice(0, 5).text(), '%PDF-');
});

test('falls back to the original URL when CORS fetch or Blob save fails', async () => {
  const opened = [];
  const corsFailure = await downloadCvPdf({
    fetchImpl: async () => { throw new TypeError('CORS blocked'); },
    save: () => { throw new Error('Should not save'); },
    fallback: url => opened.push(url),
  });
  const saveFailure = await downloadCvPdf({
    blob: validPdf(),
    save: () => { throw new Error('Object URL unavailable'); },
    fallback: url => opened.push(url),
  });
  assert.equal(corsFailure.mode, 'fallback');
  assert.equal(saveFailure.mode, 'fallback');
  assert.deepEqual(opened, [portfolioLinks.cvPdf, portfolioLinks.cvPdf]);
});
