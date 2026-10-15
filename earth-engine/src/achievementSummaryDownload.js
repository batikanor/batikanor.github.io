const FILE_NAME = 'batikan-achievements-summary.pdf';
const PREVIEW_PHOTO = '/photos/tesla-gigathon/tesla-gigathon-2026-first-place-prize.jpg';
let dialogSequence = 0;

/** Keep the PDF engine, sample image and options dialog out of gallery startup. */
export function bindAchievementSummaryDownload(button, {
  status,
  signal,
  loadExporter = () => import('./exportProjectsPdf.js')
} = {}) {
  if (!button) return () => {};
  const document = button.ownerDocument ?? globalThis.document;
  const original = {
    disabled: button.disabled,
    busy: button.getAttribute('aria-busy'),
    popup: button.getAttribute('aria-haspopup'),
    controls: button.getAttribute('aria-controls'),
    expanded: button.getAttribute('aria-expanded')
  };
  let disposed = false;
  let busy = false;
  let noticeTimer = null;
  let dialog;
  let ui;
  let open = false;
  let previousFocus;
  let job = 0;
  let jobController;
  let sample;
  let previewUrl;
  let previewSerial = 0;

  if (status) {
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function restoreAttribute(name, value) {
    if (value === null) button.removeAttribute(name);
    else button.setAttribute(name, value);
  }

  function restoreButton() {
    button.disabled = original.disabled;
    restoreAttribute('aria-busy', original.busy);
  }

  function clearNoticeTimer() {
    if (noticeTimer !== null) clearTimeout(noticeTimer);
    noticeTimer = null;
  }

  function clearNotice() {
    clearNoticeTimer();
    if (status) { status.hidden = true; status.textContent = ''; }
  }

  function announce(message) {
    if (disposed) return;
    const target = open ? ui.status : status;
    if (target) { target.hidden = false; target.textContent = message; }
  }

  function timedNotice(message) {
    announce(message);
    if (!status) return;
    clearNoticeTimer();
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      if (disposed) return;
      status.hidden = true;
      status.textContent = '';
    }, 3000);
  }

  function releasePreview() {
    previewSerial++;
    if (previewUrl) (document.defaultView?.URL ?? URL).revokeObjectURL(previewUrl);
    previewUrl = null;
    sample = null;
    if (ui) { ui.preview.removeAttribute('src'); ui.previewGroup.hidden = true; }
  }

  function settings() {
    return {
      includeImages: ui.images.checked,
      imageScale: Math.max(0.2, Math.min(1, Number(ui.scale.value) / 100 || 1)),
      compressPdf: ui.compress.checked,
      compressionStrength: Math.max(0.1, Math.min(0.9, Number(ui.strength.value) / 100 || 0.1))
    };
  }

  function renderControls() {
    const options = settings();
    ui.fields.setAttribute('data-images', String(options.includeImages));
    ui.scaleGroup.hidden = !options.includeImages;
    ui.strengthGroup.hidden = !options.includeImages || !options.compressPdf;
    ui.scaleValue.value = `${Math.round(options.imageScale * 100)}%`;
    ui.scaleValue.textContent = ui.scaleValue.value;
    ui.strengthValue.value = `${Math.round(options.compressionStrength * 100)}%`;
    ui.strengthValue.textContent = ui.strengthValue.value;
    ui.previewGroup.hidden = !options.includeImages || !previewUrl;
  }

  async function renderPreview() {
    const serial = ++previewSerial;
    const options = settings();
    if (disposed || !open || !options.includeImages) {
      ui.previewGroup.hidden = true;
      return;
    }
    try {
      if (!sample) {
        const Image = document.defaultView?.Image ?? globalThis.Image;
        sample = new Image();
        sample.decoding = 'async';
        sample.src = PREVIEW_PHOTO;
      }
      const image = sample;
      await image.decode();
      if (disposed || !open || serial !== previewSerial) return;
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 560 / Math.max(image.naturalWidth, image.naturalHeight)) * options.imageScale;
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', options.compressPdf ? 1 - options.compressionStrength : 1));
      if (!blob || disposed || !open || serial !== previewSerial) return;
      const urlApi = document.defaultView?.URL ?? URL;
      if (previewUrl) urlApi.revokeObjectURL(previewUrl);
      previewUrl = urlApi.createObjectURL(blob);
      ui.preview.src = previewUrl;
      ui.previewLabel.textContent = `Sample preview · ${Math.max(1, Math.round(blob.size / 1024))} KB`;
      ui.previewGroup.hidden = false;
    } catch {
      // A failed preview must never prevent downloading the report.
      if (!disposed && serial === previewSerial) ui.previewGroup.hidden = true;
    }
  }

  function setBusy(value) {
    busy = value;
    ui.fields.disabled = value;
    ui.download.disabled = value;
    ui.download.textContent = value ? 'Preparing PDF…' : 'Download PDF';
    ui.close.textContent = value ? 'Cancel' : 'Close';
    if (value) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      dialog.setAttribute('aria-busy', 'true');
    } else {
      restoreButton();
      dialog.removeAttribute('aria-busy');
    }
  }

  function closeDialog({cancel = true, restoreFocus = true} = {}) {
    if (!dialog || !open) return;
    const wasBusy = busy;
    open = false;
    if (cancel) {
      job++;
      jobController?.abort();
      jobController = null;
    }
    setBusy(false);
    ui.progress.hidden = true;
    releasePreview();
    button.setAttribute('aria-expanded', 'false');
    if (dialog.open) dialog.close();
    if (restoreFocus && !disposed) {
      const target = previousFocus?.isConnected === false ? button : previousFocus ?? button;
      target.focus?.({preventScroll: true});
    }
    if (cancel && wasBusy && !disposed) timedNotice('PDF download cancelled.');
  }

  async function download(event) {
    event?.preventDefault();
    if (disposed || !open || busy) return;
    clearNotice();
    const currentJob = ++job;
    const exportOptions = settings();
    jobController = new AbortController();
    const exportSignal = jobController.signal;
    setBusy(true);
    ui.progress.hidden = false;
    ui.progress.removeAttribute('value');
    announce('Preparing achievements summary…');
    try {
      const {exportProjectsPdf} = await loadExporter();
      if (disposed || currentJob !== job || exportSignal.aborted) return;
      const pdf = await exportProjectsPdf({
        ...exportOptions,
        save: false,
        fileName: FILE_NAME,
        signal: exportSignal,
        onProgress: ({index, total}) => {
          if (disposed || currentJob !== job || exportSignal.aborted) return;
          ui.progress.max = total;
          ui.progress.value = index;
          announce(index < total
            ? `Preparing achievement ${index + 1} of ${total}…`
            : 'Saving achievements summary…');
        }
      });
      if (disposed || currentJob !== job || exportSignal.aborted) return;
      await pdf.save(FILE_NAME, {returnPromise: true});
      if (disposed || currentJob !== job || exportSignal.aborted) return;
      jobController = null;
      closeDialog({cancel: false});
      timedNotice('Achievements summary downloaded.');
    } catch {
      if (!disposed && currentJob === job && !exportSignal.aborted) {
        announce('Could not download the summary. Please try again.');
      }
    } finally {
      if (!disposed && currentJob === job) {
        jobController = null;
        setBusy(false);
        ui.progress.hidden = true;
      }
    }
  }

  function createDialog() {
    const prefix = `achievement-summary-${++dialogSequence}`;
    dialog = element('dialog', 'achievement-summary-dialog');
    dialog.id = `${prefix}-dialog`;
    dialog.setAttribute('aria-labelledby', `${prefix}-title`);
    const form = element('form', 'achievement-summary-form');
    const header = element('div', 'achievement-summary-header');
    const title = element('h2', 'achievement-summary-title', 'Achievements summary');
    title.id = `${prefix}-title`;
    const close = element('button', 'achievement-summary-close', 'Close');
    close.type = 'button';
    header.append(title, close);
    const fields = element('fieldset', 'achievement-summary-fields');
    const legend = element('legend', 'achievement-summary-visually-hidden', 'PDF options');
    fields.append(legend);

    function checkbox(name, text, checked) {
      const label = element('label', 'achievement-summary-checkbox');
      const input = element('input');
      input.type = 'checkbox'; input.name = name; input.checked = checked;
      label.append(input, element('span', null, text));
      return {input, label};
    }
    function range(name, text, min, max, value) {
      const group = element('div', 'achievement-summary-range-group');
      const row = element('div', 'achievement-summary-range-label');
      const label = element('label', null, text);
      const input = element('input', 'achievement-summary-range');
      input.type = 'range'; input.name = name; input.id = `${prefix}-${name}`;
      input.min = String(min); input.max = String(max); input.step = '10'; input.value = String(value);
      label.htmlFor = input.id;
      const output = element('output');
      output.setAttribute('for', input.id);
      row.append(label, output); group.append(row, input);
      return {input, group, output};
    }
    const images = checkbox('include-images', 'Include images', true);
    const scale = range('image-size', 'Image size', 20, 100, 100);
    const compress = checkbox('compress-pdf', 'Compress PDF', true);
    const strength = range('compression-strength', 'Compression strength', 10, 90, 10);
    const options = element('div', 'achievement-summary-options');
    options.append(images.label, scale.group, compress.label, strength.group);
    const previewGroup = element('figure', 'achievement-summary-preview');
    previewGroup.hidden = true;
    const preview = element('img');
    preview.alt = 'Preview of the selected image size and compression quality';
    const previewLabel = element('figcaption');
    previewGroup.append(preview, previewLabel);
    fields.append(options, previewGroup);
    const progress = element('progress', 'achievement-summary-progress');
    progress.hidden = true;
    progress.setAttribute('aria-label', 'Achievements exported');
    const innerStatus = element('p', 'achievement-summary-status');
    innerStatus.hidden = true;
    innerStatus.setAttribute('role', 'status');
    innerStatus.setAttribute('aria-live', 'polite');
    innerStatus.setAttribute('aria-atomic', 'true');
    const footer = element('div', 'achievement-summary-footer');
    const downloadButton = element('button', 'achievement-summary-download', 'Download PDF');
    downloadButton.type = 'submit';
    footer.append(downloadButton);
    form.append(header, fields, progress, innerStatus, footer);
    dialog.append(form);
    ui = {close, fields, images: images.input, scale: scale.input, scaleGroup: scale.group,
      scaleValue: scale.output, compress: compress.input, strength: strength.input,
      strengthGroup: strength.group, strengthValue: strength.output,
      preview, previewGroup, previewLabel, progress, status: innerStatus, download: downloadButton};
    for (const input of [ui.images, ui.scale, ui.compress, ui.strength]) {
      input.addEventListener('input', () => { renderControls(); void renderPreview(); });
    }
    form.addEventListener('submit', download);
    close.addEventListener('click', () => closeDialog());
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
    dialog.addEventListener('close', () => { if (open) closeDialog(); });
    dialog.addEventListener('keydown', event => {
      // Preserve native checkbox/range/Tab behavior without moving the room.
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
    });
    document.body.append(dialog);
    button.setAttribute('aria-controls', dialog.id);
    renderControls();
  }

  function showOptions() {
    if (disposed || button.disabled || open) return;
    clearNotice();
    if (!dialog) createDialog();
    previousFocus = document.activeElement ?? button;
    open = true;
    ui.status.hidden = true;
    ui.status.textContent = '';
    ui.progress.hidden = true;
    button.setAttribute('aria-expanded', 'true');
    dialog.showModal();
    ui.images.focus({preventScroll: true});
    renderControls();
    void renderPreview();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearNoticeTimer();
    job++;
    jobController?.abort();
    closeDialog({restoreFocus: false});
    releasePreview();
    dialog?.remove();
    button.removeEventListener('click', showOptions);
    signal?.removeEventListener('abort', dispose);
    restoreButton();
    restoreAttribute('aria-haspopup', original.popup);
    restoreAttribute('aria-controls', original.controls);
    restoreAttribute('aria-expanded', original.expanded);
  }

  if (signal?.aborted) dispose();
  else {
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', showOptions);
    signal?.addEventListener('abort', dispose, {once: true});
  }
  return dispose;
}
