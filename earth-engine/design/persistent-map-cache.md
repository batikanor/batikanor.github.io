# Persistent Earth asset cache — staging performance experiment

The ordinary map/provider HTTP path remains the fallback. This worker is not
an offline/PWA application shell. A site visit starts registration without
awaiting it; the introduction and map must never be gated on browser storage.

## Integration

```js
import {createPersistentCache} from './persistentCache.js';

// Pass the hashed Vite map-runtime URL, not a permanently fixed version string.
const persistent = createPersistentCache({version: import.meta.url});
void persistent.prefetch(nearbyAssetUrls, {priority: 'urgent'});
void persistent.prefetch(allRemainingArrivalUrls, {priority: 'idle'});
```

The preload scheduler should provide **exact URLs used by map/fetch callers**.
`prefetch` resolves when accepted/queued, not when every transfer completes.
`stats()` queries actual worker transfer/cache counters. `snapshot()` is the
nonblocking local registration state. `cancel()` discards the current page's
speculation without interrupting foreground requests. `dispose()` cancels
speculation; it does not unregister the reusable reactive cache.

Copy `earth-engine/dist/earth-cache-sw.js` into the release root during the
Earth overlay. Registration is `/earth-cache-sw.js?v=<release-token>` with root
scope and `updateViaCache: 'none'`. A different unrelated root worker will not
be replaced. The optional accelerator degrades silently on insecure origins,
unsupported browsers, denied/private storage, unavailable scripts or quota
errors. Do not await `ready` in bootstrap. A bounded client queue retains
predictions while activation is pending. State/controller/update listeners remain
active after the bounded ready timeout: a slow first installation is adopted
when it finally activates, and predictions flush once without a page refresh.
Only this origin, worker path and exact release are accepted; disposal removes
all listeners. Maps can immediately load using
the usual network path in the meantime.

## Deliberately narrow resource policy

- Same-origin versioned `/data/*-vN.{bin,json,geojson,webp}` and
  `/assets/isometric/*-vN[-half].{bin,json,geojson,webp}` regional source assets.
- Same-origin fingerprinted `/assets/arrival/{esa,landing}-Z-X-Y-HASH.webp` offline
  packaged, sourced ESA tiles and per-destination landing imagery.
- Same-origin source-audited `/assets/destination-orthophotos/ortho-SOURCE-LON-LAT-{2048,1024}-HASH.webp` photographs. The exact filename must include six-decimal coordinate tokens, valid geographic ranges, a bounded image-size token and a 12-digit hexadecimal content fingerprint. Arbitrary `.jpg`/`.webp` photos elsewhere remain excluded. The required Lands Department credit logo is admitted only as the exact reviewed `lands-department-logo-97fc83e2643b.jpg` file.
- The exact authored ESA WorldCover 2021 WMTS layer/time/matrix/query; valid
  z6–14 coordinates only.
- Bavaria DOP20 XYZ z12–19 tiles only.
- Official Mapterhorn Terrarium 512 px WebP XYZ tiles z0–16 only (not TileJSON).

No navigation HTML, app JS/CSS, release manifests, photographs/project media,
PDFs, private/authenticated data, arbitrary URLs, range requests or embed
responses are cached. Request `no-store` and response `no-store`, `private`,
`no-cache`, opaque/error/HTML responses are excluded. Arbitrary Vary fields
are excluded; only Origin/Accept-Encoding may vary for these public assets.
NASA's global mosaic and Berlin TrueDOP WMS explicitly send `no-store`, so their bytes must not be
retained in this cache. Other providers retain their normal behavior. On 2026-09-30, the official
[Mapterhorn data access](https://mapterhorn.com/data-access/) page and current
TileJSON both give `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`; z13/z16
Munich responses had `image/webp`, CORS `*`, public `max-age=604800`. The
cache caps these dynamic DEM tiles at one day, with visible upstream Age
subtracted from provider max-age when exposed. `MAPTERHORN_CACHE_TILE` is the
exported preload template; retain the existing Mapterhorn attribution.

This precision matters: [CacheStorage does not automatically enforce the
HTTP cache's freshness policy](https://developer.mozilla.org/en-US/docs/Web/API/Cache).
We enforce a TTL ourselves, capped by a visible provider `max-age` when
supplied, and reject private/no-store policies. Cross-origin bytes must be
CORS-readable; the accelerator never changes a fetch to `no-cors` to work
around a provider. An opaque payload's size and type cannot be safely checked.

## Budgets and lifecycle

| Limit | Desktop | Phone / 3G / low-memory |
| --- | ---: | ---: |
| Encoded disk bytes | 96 MB | 48 MB |
| Disk records | 768 | 512 |
| Speculative transfers in parallel | 2 | 1 |
| Speculative bytes per worker session | 64 MB | 24 MB |
| Maximum individual payload | 10 MB | 10 MB (demand) |

These ceilings were enlarged for the **actual source photography**, not to
trade image quality for faster placeholder arrival. The full destination
photography bundle is about 45.5 MB encoded; corresponding 1024-pixel images
are about 14.8 MB. Both fit their preparation tiers alongside selected nearby
assets. The larger allowance is compressed CacheStorage only: the worker
still performs **no image decoding or GPU allocation**. Display quality,
resolution-aware framing, one-active-bitmap lifecycle and device-safe atlas
selection belong to the renderer. This cache must not choose a smaller image
or treat coarse ESA arrival pixels as a final high-quality venue.

Parallel speculation remains **two desktop / one mobile**; record limits,
768-URL queue, 10 MB per-asset ceiling, strict source/MIME/security policies,
8-second idle speculative timeout and Save Data opt-out are unchanged.
Foreground selected resources can bypass the speculative transfer cap, but
remain under the encoded disk and per-asset ceilings. Disk quota recovery
can lower our own cache cap further without changing display resolution.

The stricter mobile tier is persisted in a tiny synthetic bookkeeping record
inside this release's own cache. It survives ordinary browser worker termination
and restart, and stays conservative even if a desktop-looking tab connects
later. The policy is excluded from asset byte/entry totals and is removed with
the release namespace. `stats()` rebuilds disk totals on worker restart; request
counters still describe the current worker lifetime, not historical analytics.

Speculation additionally has a 768-URL worker queue and eight-message client
queue. There is no unbounded all-world tile crawl. Remaining speculative bytes
are reserved before starting transfers; an unexpectedly large streaming body
is stopped at the reservation, with at most a transport chunk of overshoot.
Explicit user-selected resources are not restricted by the speculative budget,
but still obey disk and per-resource caps. Save Data/2G disable speculation;
reactive caching still saves data when revisiting a selected city. Dynamic
Save Data is checked again at each preload message. Disk storage is compressed
payload only; this module creates no WebGL contexts, image decodes or GPU
allocations. Foreground requests can join a speculative network transfer.

Regional assets expire after seven days; external imagery after at most one
day or its shorter `max-age`. Expired responses are never used as a silent
fallback, including during network failure. Records are evicted by in-session
least-recently-used order; persisted insert times approximate that order after
a browser restart. Both byte and record ceilings are checked before each write,
under a serialized commit lock. A quota error drops our own oldest entries and
retries once under a smaller cap; it never clears another application's cache.

Origin isolation prevents staging bytes from leaking into production. The
release namespace additionally isolates nonfingerprinted regional assets. The
first cache miss for a nonfingerprinted regional file revalidates/reloads its HTTP-cache entry,
rather than copying a previous release into the new disk namespace. Fingerprinted arrival and destination photography (including the exact credit logo) may safely reuse their matching HTTP-cache bytes across releases; their immutable content hash prevents stale imagery being hidden under a mutable name. Authored
asset versions must still be bumped when their contents change; a returning
page can initially be controlled by its previous worker before new activation.
Activation removes previous **Earth-only** release namespaces before claiming
clients. HTML and the fresh release manifest remain online and independent,
preventing an old cached app shell from trapping users on a previous release.
The registration/update behavior follows the [ServiceWorkerContainer register
documentation](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).

## Verification

```sh
node --test earth-engine/scripts/persistentCache.test.mjs
```

Tests execute the actual worker source with a small CacheStorage/fetch harness:
policy allow/deny cases (including both quality resolutions, coordinate/hash validation and the exact required credit logo), complete owned quality-package fit, repeated disk hits, freshness ceilings, release
cleanup, denied storage, both 96/48 MB LRU bounds, actual 64/24 MB transfer stopping and unchanged 2/1 parallelism, Save Data, foreground
joining, cancellation/restart and optional client registration behavior.
Runtime staging QA must additionally inspect the worker registration and repeat
an achievement jump after an initial visit. Cold arrivals benefit primarily
from the local arrival pyramid; this persistent cache helps repeat/neighbor
navigation and revisits, not impossible instantaneous first downloads.
