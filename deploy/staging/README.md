# Batıkan portfolio staging on Hetzner

## Owner hosting policy — 12 October 2026

All hosting must use Hetzner, including production, staging, previews, demos,
public review/evidence URLs, application runtimes, databases, uploads and assets.
Vercel hosting or managed services require direct owner approval for the exact
project, environment and service; existing configuration is not approval.
The scoped `AGENTS.md` preserves the full instruction. Historical GitHub Pages
production instructions describe the existing legacy delivery and recovery
material; future production delivery must use Hetzner. Preserve exact artifacts,
environment differences, data and historical review links, and verify delivery
and rollback before any migration cutover. Preserve unrelated DNS and services.

## Single-wall gallery prototype — 13 October 2026

The isolated `staging/gallery-room-prototype` branch adds a skylit 3D gallery
with 32 project stations, full authored story boards and native media screens.
The satellite geographic globe sits in a larger bottom-left dock with chronology
directly below.
The homepage opens with the same introductory dossier as production, using the
gallery's charcoal, stone and bronze colors. Its content, layout, CV, Email and
LinkedIn links remain intact. The room prepares behind the introduction with
input disabled; only Enter reveals it and focuses the gallery stage. Direct
project and CV links bypass the introduction. Retired list links normalize to the regular site. The Batıkan brand returns
to the homepage introduction. Intro and map typography are served from Hetzner
using local copies of the same openly licensed font families.
Select a project to teleport, tap a board to approach, drag to look, use WASD
to walk between neighboring project walls, Space to jump, and Escape or ↶
to return to the whole wall. The walls share a continuous corridor with a
3.6-unit gap for each sculpture. Walking across the midpoint selects the next
project and updates the globe and current URL without moving the camera or
adding history entries. The active wall and its immediate neighbors display
text, references and photos; only the active wall connects video/iframe viewers.
Jumps preserve horizontal movement, land at the original eye height, and reset
when framing a board, switching projects or leaving the browser window.
Phone layouts use a smaller type scale: 16px project titles (14px for long
titles), 9px tags and 11.5px story copy with 11px minimum projected reading text.
Section headings, media captions, map arrows and object controls are reduced
to match. The same map footprint, full two-line location and original media
proportions remain; desktop/tablet typography is unchanged.

Every project's title, original story, photos and embeds occupy one front-facing
wall. The physical layout maps directly to the viewport, reserving the header,
bottom-left globe and small right-side hints. An adaptive composition chooses
the story/media balance and native-aspect image grid from the actual content.
All 66 media sources and 36 original photo proportions are preserved. One
References panel per project groups all 107 original links; long text remains
scrollable inside its board. There are no side-wall screens or angled wings.
References boards size their height from the actual column breakpoints and
wrapped labels, including link arrows, padding, header and controls. They use
available wall height before introducing a scroll area. Wall controls retain
their intended compact size on phones as well as desktop.
Selecting a project opens the whole wall on desktop and phone. An approach
enlarges its existing native screen; Escape/↶ returns to the wall without a modal.
Reflow updates physical frames, masks and existing HTML surfaces together, so
resizing retains native viewer objects and their active navigation.

Each top title contains only the heading and a compact technologies box
(stacked on narrow screens). Project numbering appears in the map selector,
with the date and full recorded venue/address plus city/country beneath it.
Locations wrap across two lines at the existing font size, spanning the dock
width. The count and date share the space between the arrows, leaving two full
location lines below them within the 78px desktop / 58px phone navigation strip. The
selector opens the full searchable achievement picker, with larger arrows on
either side. There is no title or bottom-right counter or engraved station/city
plaque. Photo and monitor approach controls are 80% transparent at rest, with
clear keyboard focus and no full-image tint or shadow. Stories omit inline
media-placement prompts and the redundant references shortcut, since every
source already has its own wall screen. Four obsolete placement phrases are
adjusted only in the room presentation; original source data and legacy prose
remain available. Approaching a component leaves the other active boards' text
visible; camera framing alone determines what remains in view.

The coordinated charcoal/stone palette uses shared vertex-color gradients to
blend floor, walls and ceiling, with soft neutral light and matte bronze details.
The globe zooms into selected projects at city scale and flies out and back in
between locations. Numbered clusters, individual choices, +/−/reset, wheel,
arrow-key rotation and Home remain available inside its fixed dock.

Satellite imagery is genuine Sentinel-2 cloudless 2016/17 from EOX/Copernicus,
licensed under CC BY 4.0. It is a historical basemap rather than contemporary
venue photography. All 38 generated images are served by Hetzner; browsers make
no imagery requests to EOX. A small global layer loads first, followed by lazy
regional/city images, with a three-entry detail cache. The 18 distinct city
groups cover all 32 project locations. Attribution and the source year are
available through the small map imagery info control, whose panel is closed
by default. `earth-engine/scripts/build-gallery-satellite.py` performs
finite build-time exports and records exact bounds, source URLs and hashes;
newer non-commercial EOX mosaics are excluded from this public release.

Build with `EARTH_ROOM_PROTOTYPE=true ./deploy/staging/build.sh` to make the
room the staging entry point. The overlay rejects this flag for production.
CV routes retain their lightweight viewer, and all legacy links,
downloads and original project text/media are preserved. The classic Earth
experience remains available at `/?experience=earth`.

Prototype code is intentionally separate from the production map modules.
The release evidence and frozen source are in
`release-handoffs/gallery-single-wall-20261013` in the project workspace.
The follow-up title/progress release is recorded in
`release-handoffs/gallery-title-refinement-20261013`.
The description and compact map navigation follow-up is recorded in
`release-handoffs/gallery-clean-wall-20261013`.
The minimal title and under-map metadata follow-up is recorded in
`release-handoffs/gallery-minimal-title-20261013`.
The continuous walking and Space jump follow-up is recorded in
`release-handoffs/gallery-walk-jump-20261013`.
The restored introduction follow-up is recorded in
`release-handoffs/gallery-intro-20261014`.
The wrapped-reference sizing correction is recorded in
`release-handoffs/gallery-reference-fit-20261014`.
The full recorded location beneath the map is recorded in
`release-handoffs/gallery-full-location-20261014`.
The smaller mobile type and controls are recorded in
`release-handoffs/gallery-mobile-scale-20261014`.

The shared site styling follow-up is recorded in
`release-handoffs/gallery-shared-style-20261014`. The introduction, gallery,
achievement reading pages, CV viewer, fallback list and legacy projects index
use `earth-engine/src/portfolioTheme.css` for their stone/charcoal surfaces,
bronze accents, pale blue links, local DM Sans/Playfair typography, focus rings,
frame corners and shadows. Keep that file as the shared source when changing
the palette. Generated reading pages include the same theme and local font
definitions so their no-JavaScript views also match. The original CV document
keeps its white paper. The compact phone scale and all native media proportions
remain intact; font-aware References sizing prevents avoidable new scrolling.

The initial gallery loading placeholder contains no visible text. Three small
bronze/pale-blue frames gently lift and fade against the shared stone backdrop.
Its critical CSS is inline, needs no assets, and becomes static for reduced
motion. It is limited to the existing direct-gallery pending state; the normal
homepage introduction and the CV/list paths keep their existing behavior.
The release is recorded in `release-handoffs/gallery-loading-mark-20261014`.

Standalone CV routes (`/cv/`, `/cv/en/`, `?view=cv` and `#cv`) now use an
explicit page presentation: all available viewport width and height, PDF paper
fitted to that width, zoom in/out, document links, download and Home. Safe-area
insets are reserved once. Floating move/resize/Expand controls remain available
for CV windows opened inside the classic map; they are omitted from the page.
The early route classifier hides legacy map controls before CV startup, and
no-JavaScript CV pages also use the full available width. The fallback list
returns to a centered full-width layout when details close, and its open desktop
column now matches the actual 70% reading window with a 16px gap.
The release is recorded in `release-handoffs/gallery-cv-page-20261014`.

The mobile compact follow-up is recorded in
`release-handoffs/gallery-mobile-compact-20261014`. Below 700px, story and
summary text uses 13px (12–13px when approached), section headings 12px,
References links 11px (12px when approached), and References headings 12px.
The map navigator is 188×64px with 28px arrows and a 20px current count;
full locations still wrap to two lines. The mobile walking hint is hidden and
its unused layout reservation is removed. The separate Text view button,
list runtime and its styles are removed. Old list bookmarks normalize to the
regular experience, preserving project/CV targets and unrelated URL parameters.
Devices without WebGL use the existing authored achievement/index pages;
CV/download routes remain GPU-independent and homepage entry still waits for Enter.
This supersedes the historical fallback-list notes above.

The mobile reading and view-lock follow-up is recorded in
`release-handoffs/gallery-mobile-lock-20261014`. The gallery starts with its
view locked on desktop and mobile. A small padlock in the top bar enables free
WASD walking and drag-to-look when unlocked. Relocking freezes the current view,
clears held movement keys and an active drag, and preserves jumping. Space works
while locked; project/globe navigation and approaching boards remain available.
The lock retains its state between project selections and resets on a fresh visit.

Below 700px, description/summary copy uses 11.5px (11–11.5px approached), section
headings 10px, and References 8.5px (9px approached). Titles use 16px/14px and tags
9px. Smaller padding and 20px board controls accompany actual layout changes:
compact References panels release space for the original description, whose
phone-only scoring prioritizes useful reading height. Both screenshot photos
retain their native proportions. Navigation is 188×58px with 24px arrows; the
globe stays its previous size, with 20px tools. Desktop/tablet compositions and
typography remain unchanged. Gallery text-size-adjust is fixed at 100% to keep
mobile browsers from inflating the carefully measured board copy.

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

The current explorer/Home release is `20260930T080937Z-e8ea00ff16-3112f8`;
the previous staging release is `20260930T065530Z-2985445d5b-f29a3b`
for rollback. This describes the staging server only, not a production release.

Two achievement-index treatments are available for design review:

- [Raised “All 32” tab](https://staging.batikanor.com/?explore=tab) (default)
- [Compact ellipsis](https://staging.batikanor.com/?explore=more)

Both open the same searchable, newest-first index of the 32 authored
achievements and keep the selected variant as visitors open stories. Home,
immediately right of the settings wheel, returns to the dossier without a page
reload. The map already initializes and requests its initial globe tiles behind
the introduction; it remains warm on a Home/Enter round trip. A small, bounded
set of destination overview tiles is now warmed during the dossier. Preloading
every high-zoom destination would consume substantial bandwidth and evict
useful tile cache entries, so this release deliberately avoids that.

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

The overlay also generates lightweight `/achievements/<slug>/` reading pages
for all 32 authored achievements. They use the same title, summary, full
description, captions, media URLs and source links as the map; local photos
appear inline, while external Drive/video media are linked instead of loaded
as heavy iframes. They provide crawlable and no-JavaScript access without
adding a second project list to the interactive map. The production sitemap
lists every article, CV and projects; staging has **no sitemap** and every
exported HTML page is verified `noindex`. The HTML-only pages have independent
canonical and structured-data URLs and can be opened on the map with one link.

After local desktop/mobile QA, publish **only** the staging artifact:

```sh
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/batikanor-earth-release
./deploy/staging/deploy.sh --publish
```

If SSH port 22 is unreachable from the current network but an already trusted
SSH jump host can reach Hetzner, use `STAGING_SSH_JUMP=roof-ms-a2` with that
same publish command. The private key stays on the local machine. The same
optional variable works for `rollback.sh`.

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

1. Inspect the single full-screen dossier introduction at mobile and desktop
   widths. **Enter** must be the only transition to the map. Old `?intro=1`
   and `?intro=2` links should show this same design, not a layout switcher.
   Deep links such as `/?event=decarbon-days-climathon-2025` must still open
   the correct story directly.
2. Confirm the globe imagery and selected Cottbus/Berlin/Munich 3D chapters
   actually load; check network/console for tile CORS or failed lazy assets.
3. Navigate achievements, resize/drag a popup, open CV and projects routes,
   download the CV and configure/export the achievements PDF. Test phone and
   desktop layouts. Check `/sui/` and a certificate/media URL as regressions.
4. Check `curl -I https://staging.batikanor.com/` and a representative
   `/achievements/<slug>/` page for a valid certificate and
   `X-Robots-Tag: noindex`; its HTML must also include `noindex` and its
   staging canonical. `robots.txt` must disallow `/`; `CNAME` must be 404.
5. Check `https://batikanor.com/` and `https://www.batikanor.com/` still serve
   the unchanged production site. Do not promote this branch to `main` until
   explicitly requested.

ESA WMTS was checked with `Origin: https://staging.batikanor.com` and returned
HTTP 200 with a matching `Access-Control-Allow-Origin`; the old `sslip.io`
origin returned HTTP 400. A browser check is still required after DNS/HTTPS.

## Roll back

Staging releases are immutable snapshots. Uploads checksum and hard-link
unchanged files from the captured previous release (`--link-dest`, without
preserving export timestamps), and inherit older fingerprinted assets by
hard link. Never upload with `--inplace` or edit a published asset in place:
its inode may be shared by several rollback snapshots. Failed uploads remove
only their own unpublished directory; the active release remains untouched.
The upload refuses to start with less than 1 GiB of free server storage.

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

## Live-project studio — 15 October 2026

The entry screen now offers **Explore achievements** and **Explore live projects**.
The latter opens `/?view=live-projects`, a lightweight studio with no map/globe,
map preload or WebGL requirement. Its project shelf selects Maptheory, Space
Cottbus and boomtown cottbus; each has an original interactive illustration,
short factual description and a direct link to its live site. Project selections
are addressable through the `project` query parameter. Keyboard navigation and
reduced motion are supported. CV/download aliases retain priority.

Embed/media labels use compact body typography, including focused and mobile
views. Original project prose, captions, credits and photo proportions remain.
Current evidence: `release-handoffs/gallery-live-projects-20261015`. This is a
staging-only refinement; the production Pages release pin remains unchanged.

### Actual website previews — 15 October 2026

The owner rejected the illustrative project sculptures. The live-project view
now embeds each selected site's real entry screen instead. Only one iframe is
mounted at a time, with a 1280×800 viewport scaled to the available preview
space. A native full-preview link opens the normal website in a new tab; iframe
interaction is disabled so the preview cannot capture that click. Keep actual
site previews rather than introducing substitute illustrations.

Space Cottbus uses `https://spacecottbus.com/?portfolio-preview=1` only inside
the iframe. Its Hetzner edge allows that root-query variant to be framed only
by `https://staging.batikanor.com`; normal pages/assets keep their original
frame-deny policy. Preview clicks still go to `https://spacecottbus.com/`.
When a future production promotion is explicitly requested, verify and extend
this narrow preview-only allowlist to the canonical production portfolio origin
before release, without permitting arbitrary framing or changing normal pages.
Evidence: `release-handoffs/gallery-live-site-previews-20261015`.

### Concise project marketing — 15 October 2026

Live-project panels now show a project name, a short native bullet list and its
URL beside the actual website preview. Category lines, redundant section labels,
mottos and narrative marketing paragraphs are removed. Cottbus is labelled
**Map of Cottbus** in the portfolio. Space Cottbus uses the owner's requested
points: the biggest space event in Cottbus's history, an official NASA Space Apps
hackathon, and the owner's ongoing organisation as Cottbus Local Lead.
Evidence: `release-handoffs/gallery-project-marketing-20261015`.
