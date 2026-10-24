const mounts = new WeakMap();
const DAY = 86400000;

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid npm statistics date.');
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) throw new Error('Invalid npm statistics date.');
  return timestamp;
}

function validateCount(payload, packageName) {
  if (!payload || payload.package !== packageName || !Number.isSafeInteger(payload.downloads) || payload.downloads < 0) throw new Error('Invalid npm download count.');
  parseDay(payload.start);
  parseDay(payload.end);
  return payload;
}

export function mountNpmDownloads(node, { fetch: fetcher = globalThis.fetch } = {}) {
  if (!node) return null;
  if (mounts.has(node)) return mounts.get(node);
  const countNode = node.querySelector?.('[data-npm-count]');
  let request = null;
  let disposed = false;
  const controller = {
    async refresh() {
      if (disposed) return;
      request?.abort();
      const current = new AbortController();
      request = current;
      const active = () => !disposed && request === current && !current.signal.aborted;
      const write = (text, title = '', count = text) => {
        if (!active() || node.isConnected === false) return;
        if (countNode) {
          countNode.textContent = count;
          node.setAttribute('aria-label', text);
        } else {
          node.textContent = text;
        }
        node.title = title;
      };
      write('npm downloads…', '', '…');
      try {
        const packageName = node.dataset.npmPackage;
        const publishedOn = node.dataset.npmPublishedOn;
        if (typeof packageName !== 'string' || !packageName.trim()) throw new Error('Missing npm package.');
        let start = parseDay(publishedOn);
        const load = async period => {
          const response = await fetcher(`https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(packageName)}`, {
            signal: current.signal, credentials: 'omit', cache: 'no-cache',
          });
          if (!response.ok) throw new Error('npm statistics unavailable.');
          return validateCount(await response.json(), packageName);
        };
        const latest = await load('last-day');
        if (!active()) return;
        if (latest.start !== latest.end) throw new Error('Invalid latest npm statistics date.');
        const end = parseDay(latest.end);
        if (end < start) throw new Error('npm statistics precede publication.');
        let downloads = 0;
        while (start <= end) {
          const chunkEnd = Math.min(start + 364 * DAY, end);
          const startDay = new Date(start).toISOString().slice(0, 10);
          const endDay = new Date(chunkEnd).toISOString().slice(0, 10);
          const chunk = await load(`${startDay}:${endDay}`);
          if (!active()) return;
          if (chunk.start !== startDay || chunk.end !== endDay || !Number.isSafeInteger(downloads + chunk.downloads)) throw new Error('Invalid npm statistics range.');
          downloads += chunk.downloads;
          start = chunkEnd + DAY;
        }
        const count = downloads.toLocaleString('en-US');
        write(`${count} npm downloads`, `npm downloads since publication: ${publishedOn}–${latest.end}. Fetched from npm.`, count);
      } catch {
        write('npm downloads unavailable', '', '—');
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      request?.abort();
      mounts.delete(node);
    },
  };
  mounts.set(node, controller);
  void controller.refresh();
  return controller;
}
