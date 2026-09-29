# Batıkan portfolio staging on Hetzner

`batikanor.com` and `www.batikanor.com` remain on GitHub Pages. This preview
uses the already-running, isolated `batikanor-earth-staging-web` static Caddy
container on the MapTheory Hetzner host. **None of these commands deploys to
GitHub Pages, pushes `main`, changes production DNS, or restarts MapTheory.**

The old `earth-staging.157.180.20.129.sslip.io` hostname is only a technical
fallback: imagery providers reject that browser origin. Use
`https://staging.batikanor.com/` for design sign-off. On 30 September 2026 we
added only the Namecheap **A host `staging` → `157.180.20.129`** and activated a
separate staging Caddy vhost. Apex/`www` remain unchanged. Local recursive DNS
may temporarily retain the earlier negative answer even when the authoritative
Namecheap servers and public resolvers already return the new record.

The first intro release is `20260929T215955Z-140f715048-041eff`; the previous
staging release is `20260928T1644Z-rome-perf` for rollback. This describes the
staging server only, not a production release.

## Prepare and publish

From the dedicated `staging/*` branch checkout:

```sh
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/batikanor-earth-release
./deploy/staging/build.sh
```

This runs the legacy Next export, Earth verification and public-license Vite
build, then overlays Earth into **ignored `staging-dist/`**, not `out/`. The
staging artifact retains CV, projects, games, certificates, media, and the
`/_next` assets; they are served from staging itself. It has no CNAME or
sitemap, has `noindex,nofollow`, blocks crawling in `robots.txt`, points its
canonical/OG URL at staging, and excludes the non-commercial EOX switch. The
normal production workflow still invokes the overlay without
`EARTH_DEPLOY_TARGET` and retains its existing indexable/CNAME behavior.

After local desktop/mobile QA, publish **only** the staging artifact:

```sh
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/batikanor-earth-release
./deploy/staging/deploy.sh --publish
```

The script requires a `staging/*` branch and explicit `--publish`, uploads to a
new `/srv/apps/batikanor-staging/releases/<timestamp>-<commit>-<nonce>` path,
checks HTML/robots/CNAME/legacy routes and the uploaded checksum, retains old
fingerprinted assets for open browser sessions, validates/reloads the
**staging-only** Caddy static config (with rollback on reload failure), then
atomically changes only `/srv/apps/batikanor-staging/releases/current`.
It prints the new and previous release IDs. Partial uploads do not become live.
The stable `earth-current.json` manifest is `no-store`; versioned assets are
immutable and HTML is `no-cache`.

Once the **authoritative Namecheap** A record exists, enable the separate
staging edge vhost:

```sh
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/batikanor-earth-release
dig +short @dns1.registrar-servers.com staging.batikanor.com A
./deploy/staging/enable-domain.sh --enable
```

The script refuses to run before the A record points to Hetzner. It adds a
**new** `batikanor-staging-domain.caddy` fragment without replacing existing
MapTheory/Gralobe/Space Cottbus site fragments, validates the **whole** edge
Caddy config before reloading, and removes only its new fragment if that
validation/reload fails. It checks staging HTTPS plus the existing Hetzner
sites afterward. The edge adds `X-Robots-Tag: noindex, nofollow, noarchive`.

## Public acceptance checks

Do these on the real `staging.batikanor.com` origin, not the `sslip.io` alias:

1. Inspect the full-screen intro at mobile and desktop widths. Both variants
   should be usable; **Enter the map** must be the only automatic transition.
   Deep links such as `/?event=decarbon-days-climathon-2025` must still open
   the correct story directly.
2. Confirm the globe imagery and selected Cottbus/Berlin/Munich 3D chapters
   actually load; check network/console for tile CORS or failed lazy assets.
3. Navigate achievements, resize/drag a popup, open CV and projects routes,
   download the CV and configure/export the achievements PDF. Test phone and
   desktop layouts. Check `/sui/` and a certificate/media URL as regressions.
4. Check `curl -I https://staging.batikanor.com/` for a valid certificate and
   `X-Robots-Tag: noindex`; `robots.txt` must disallow `/`; `CNAME` must be 404.
5. Check `https://batikanor.com/` and `https://www.batikanor.com/` still serve
   the unchanged production site. Do not promote this branch to `main` until
   explicitly requested.

ESA WMTS was checked with `Origin: https://staging.batikanor.com` and returned
HTTP 200 with a matching `Access-Control-Allow-Origin`; the old `sslip.io`
origin returned HTTP 400. A browser check is still required after DNS/HTTPS.

## Roll back

Use the **previous release ID printed by `deploy.sh`**:

```sh
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/batikanor-earth-release
./deploy/staging/rollback.sh --to PREVIOUS_RELEASE_ID
```

This validates that release and atomically changes only the staging symlink.
It does not touch edge sites or production. If a new domain vhost itself is
bad, remove only `/srv/apps/maptheory/shared/caddy-sites/batikanor-staging-domain.caddy`
after inspecting it, then validate and reload the whole edge Caddy config;
leave the pre-existing `batikanor-staging.caddy`/`sslip.io` fragment alone.
