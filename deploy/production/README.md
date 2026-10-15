# Production releases

Production runs on GitHub Pages. Staging and release-artifact storage run on
Hetzner. Keep the existing apex GitHub Pages A records and the www CNAME to
batikanor.github.io; the earlier pending Hetzner DNS cutover is superseded.

## Exact staging promotion

The Pages workflow downloads the immutable static archive pinned by SHA256 in
`pages-release.json`. It validates the archive, every extracted file, the
reviewed gallery entrypoints, production CNAME and SEO before publishing.
Application JavaScript, CSS, fonts and media are the exact reviewed staging
bytes. Production-only HTML/RSC origins, robots, canonicals and sitemap are
prepared by `prepare.mjs`; never publish staging noindex output directly.
Retain historical fingerprinted assets for visitors with cached HTML.

To promote a future release, first deploy and verify it on staging. Freeze the
source and static artifact, prepare production metadata, verify the artifact,
then update the pinned archive and file manifest in this directory. Store the
public-site archive on the isolated Hetzner release-artifact host; never upload
private source, agent notes, credentials or internal evidence into that archive.
Commit the reviewed source and release pin together. Main pushes run
`.github/workflows/nextjs.yml`; its deploy job publishes the verified artifact.
No later working-tree edits may be included accidentally.

## Recovery

Previous release manifests and source are retained in Git history. To roll back,
restore the prior release pin and publish it through the same workflow, following
the workspace commit-time policy. Preserve the prior immutable archive.

The prepared Hetzner production service and review origin remain recovery
material. `deploy.sh`, `rollback.sh` and `enable-domain.sh` describe that service;
they are not the active production deployment path. Do not enable an apex/www
Hetzner vhost or change production DNS without a separately approved migration.
Staging deployment continues through `deploy/staging/deploy.sh`.
