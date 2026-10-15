import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, readdir, lstat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Publish the reviewed bytes, rather than rebuilding a moving working tree.
const release = JSON.parse(await readFile('deploy/production/pages-release.json', 'utf8'));
const url = new URL(release.archiveURL);
if (url.protocol !== 'https:' || url.hostname !== 'batikanor-releases.157.180.20.129.sslip.io'
  || url.pathname !== `/${release.archiveSHA256}.tar.gz`
  || !/^[a-f0-9]{64}$/.test(release.archiveSHA256)) throw new Error('Invalid pinned release URL');
const archive = '.pages-release.tar.gz';
const response = await fetch(url, { signal: AbortSignal.timeout(600_000), redirect: 'error' });
if (!response.ok || !response.body) throw new Error(`Release download failed: ${response.status}`);
await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
if (await sha256(archive) !== release.archiveSHA256) throw new Error('Release archive hash mismatch');
const listing = spawnSync('tar', ['-tzvf', archive], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (listing.status !== 0) throw new Error(listing.stderr);
const expected = new Set(Object.keys(release.files).map(file => `out/${file}`));
for (const line of listing.stdout.trim().split('\n')) {
  // Only regular files, with no links or path traversal.
  const name = line.split(/\s+/).slice(5).join(' ');
  if (line[0] !== '-' || !expected.delete(name) || name.split('/').includes('..')
    || name.includes('\\')) throw new Error(`Unsafe or unexpected archive entry: ${line}`);
}
if (expected.size) throw new Error('Incomplete archive');
await rm('out', { recursive: true, force: true });
const extract = spawnSync('tar', ['-xzf', archive, '--no-same-owner', '--no-same-permissions'], { encoding: 'utf8' });
if (extract.status !== 0) throw new Error(extract.stderr);
const found = new Set();
async function verify(directory) {
  for (const name of await readdir(directory)) {
    const file = path.join(directory, name);
    const stat = await lstat(file);
    if (stat.isDirectory()) await verify(file);
    else {
      const relative = path.relative('out', file).split(path.sep).join('/');
      if (!stat.isFile() || !release.files[relative] || await sha256(file) !== release.files[relative])
        throw new Error(`Unexpected file or hash mismatch: ${relative}`);
      found.add(relative);
    }
  }
}
await verify('out');
if (found.size !== Object.keys(release.files).length) throw new Error('Incomplete extracted release');
const manifest = JSON.parse(await readFile('out/assets/earth-current.json', 'utf8'));
if (JSON.stringify(manifest) !== JSON.stringify(release.manifest)) throw new Error('Reviewed runtime manifest mismatch');
if ((await readFile('out/CNAME', 'utf8')).trim() !== 'www.batikanor.com') throw new Error('Wrong production domain');
await rm(archive);
console.log(`Verified ${found.size} frozen production files from staging ${release.stagingRelease}`);
