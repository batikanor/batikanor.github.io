#!/usr/bin/env bash
# Build a standalone preview artifact from the current staging branch.
# This has no network deployment side effects and never changes out/CNAME.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
BRANCH="$(git branch --show-current)"
[[ "$BRANCH" == staging/* ]] || {
  echo "Refusing a staging build from non-staging branch: $BRANCH" >&2
  exit 1
}

EARTH_DEPLOY_TARGET=staging pnpm build
npm --prefix earth-engine run verify
VITE_PUBLIC_RELEASE=true npm --prefix earth-engine run build
EARTH_DEPLOY_TARGET=staging node scripts/overlay-earth-homepage.mjs

test -f staging-dist/index.html
test -f staging-dist/assets/earth-current.json
test ! -e staging-dist/CNAME
test ! -e staging-dist/sitemap.xml
grep -Fq 'name="robots" content="noindex,nofollow"' staging-dist/index.html
grep -Fq 'rel="canonical" href="https://staging.batikanor.com/"' staging-dist/index.html
grep -Fq 'Disallow: /' staging-dist/robots.txt
for route in cv projects sui; do test -f "staging-dist/$route/index.html"; done

echo "Isolated staging artifact ready: $ROOT/staging-dist"
