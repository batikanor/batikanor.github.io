import {exportProjectsPdf} from './exportProjectsPdf.js';

const $ = id => document.getElementById(id);

/** Keep the complete, configurable achievements report inside the Earth site. */
export function installExportControls({announce = () => {}} = {}) {
  const button = $('projects-download');
  const status = $('export-status');
  const progress = $('export-progress');
  const includeImages = $('pdf-include-images');
  const imageOptions = $('pdf-image-options');
  const imageScale = $('pdf-image-scale');
  const imageScaleValue = $('pdf-image-scale-value');
  const compressPdf = $('pdf-compress');
  const compressionOptions = $('pdf-compression-options');
  const compressionStrength = $('pdf-compression-strength');
  const compressionValue = $('pdf-compression-value');
  const preview = $('pdf-image-preview');
  const previewSize = $('pdf-preview-size');
  const options = $('pdf-export-options');
  let sample = null;
  let previewUrl = null;
  let previewSerial = 0;

  function renderControls() {
    imageOptions.hidden = !includeImages.checked;
    compressionOptions.hidden = !compressPdf.checked;
    imageScaleValue.value = `${Math.round(Number(imageScale.value) * 100)}%`;
    compressionValue.value = `${Math.round(Number(compressionStrength.value) * 100)}%`;
  }

  async function renderPreview() {
    const serial = ++previewSerial;
    if (!options.open || !includeImages.checked) {
      preview.closest('.pdf-export-preview').hidden = true;
      return;
    }
    try {
      // A 516 KB photo and canvas decode have no reason to compete with the
      // homepage map/intro. Only touch them after export options are opened.
      if (!sample) {
        sample = new Image();
        sample.decoding = 'async';
        sample.src = '/photos/tesla-gigathon/tesla-gigathon-2026-first-place-prize.jpg';
      }
      await sample.decode();
      if (serial !== previewSerial) return;
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 560 / Math.max(sample.naturalWidth, sample.naturalHeight)) * Number(imageScale.value);
      canvas.width = Math.max(1, Math.round(sample.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(sample.naturalHeight * scale));
      canvas.getContext('2d').drawImage(sample, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', compressPdf.checked ? 1 - Number(compressionStrength.value) : 1));
      if (!blob || serial !== previewSerial) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      preview.src = previewUrl;
      preview.closest('.pdf-export-preview').hidden = false;
      previewSize.textContent = `Sample photo · ${Math.max(1, Math.round(blob.size / 1024))} KB`;
    } catch {
      preview.closest('.pdf-export-preview').hidden = true;
    }
  }

  for (const control of [includeImages, imageScale, compressPdf, compressionStrength]) {
    control.addEventListener('input', () => { renderControls(); void renderPreview(); });
  }
  options.addEventListener('toggle', () => {
    if (options.open) void renderPreview();
    else {
      previewSerial++;
      preview.closest('.pdf-export-preview').hidden = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      preview.removeAttribute('src');
      sample = null;
    }
  });
  renderControls();

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.textContent = 'Preparing the complete achievements PDF…';
    progress.hidden = false;
    progress.value = 0;
    try {
      await exportProjectsPdf({
        includeImages: includeImages.checked,
        imageScale: Number(imageScale.value),
        compressPdf: compressPdf.checked,
        compressionStrength: Number(compressionStrength.value),
        onProgress: ({index, total}) => {
          progress.max = total;
          progress.value = index;
          status.textContent = index < total ? `Exporting achievement ${index + 1} of ${total}…` : 'Achievements PDF ready.';
        }
      });
      announce('Achievements summary PDF downloaded from this site.');
    } catch (error) {
      console.error('Achievements PDF export failed:', error);
      status.textContent = 'Could not export the PDF. Please try again.';
      announce('Achievements PDF export failed. Please try again.');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      progress.hidden = true;
    }
  });
}
