#!/usr/bin/env bash
# Publish only a prepared, non-indexable static preview to the existing
# isolated Hetzner container. Never edits GitHub Pages or production DNS.
set -euo pipefail

[[ "${1:-}" == "--publish" && $# -eq 1 ]] || {
  echo "Usage: deploy/staging/deploy.sh --publish (build staging-dist/ first)" >&2
  exit 2
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
BRANCH="$(git branch --show-current)"
[[ "$BRANCH" == staging/* ]] || {
  echo "Refusing to deploy from non-staging branch: $BRANCH" >&2
  exit 1
}

SITE="$ROOT/staging-dist"
[[ -f "$SITE/index.html" && -f "$SITE/assets/earth-current.json" ]] || {
  echo "Missing staging export. Run deploy/staging/build.sh first." >&2
  exit 1
}
[[ ! -e "$SITE/CNAME" && ! -e "$SITE/sitemap.xml" ]] || {
  echo "Staging export must not contain a production CNAME or sitemap." >&2
  exit 1
}
grep -Fq 'name="robots" content="noindex,nofollow"' "$SITE/index.html"
grep -Fq 'rel="canonical" href="https://staging.batikanor.com/"' "$SITE/index.html"
grep -Fq 'Disallow: /' "$SITE/robots.txt"
for route in cv projects sui; do test -f "$SITE/$route/index.html"; done

HOST='deploy@157.180.20.129'
KEY="$HOME/.ssh/maptheory-hetzner/id_ed25519"
[[ -f "$KEY" ]] || { echo "Staging SSH identity is unavailable." >&2; exit 1; }
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)
SCP=(scp -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes)
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REV="$(git rev-parse --short=10 HEAD)"
NONCE="$(openssl rand -hex 3)"
RELEASE="$STAMP-$REV-$NONCE"
BASE='/srv/apps/batikanor-staging'
INDEX_SHA="$(shasum -a 256 "$SITE/index.html" | awk '{print $1}')"

"${SSH[@]}" "$HOST" bash -s -- "$RELEASE" <<'REMOTE'
set -euo pipefail
release="$1"
[[ "$release" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{10}-[0-9a-f]{6}$ ]] || exit 2
base=/srv/apps/batikanor-staging
test -d "$base/releases"
test ! -e "$base/releases/$release"
mkdir "$base/releases/$release"
REMOTE

rsync -az --delete -e "ssh -i $KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15" \
  "$SITE/" "$HOST:$BASE/releases/$RELEASE/"
"${SCP[@]}" "$ROOT/deploy/staging/Caddyfile" "$HOST:$BASE/Caddyfile.candidate-$RELEASE"

"${SSH[@]}" "$HOST" bash -s -- "$RELEASE" "$INDEX_SHA" <<'REMOTE'
set -euo pipefail
release="$1"
expected_sha="$2"
[[ "$release" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{10}-[0-9a-f]{6}$ ]] || exit 2
[[ "$expected_sha" =~ ^[0-9a-f]{64}$ ]] || exit 2
base=/srv/apps/batikanor-staging
site="$base/releases/$release"
config="$base/Caddyfile"
candidate="$base/Caddyfile.candidate-$release"
exec 9>"$base/.deploy.lock"
flock -n 9 || { echo 'Another staging deployment is active.' >&2; exit 1; }

test -f "$site/index.html" && test -f "$site/assets/earth-current.json"
test ! -e "$site/CNAME" && test ! -e "$site/sitemap.xml"
test "$(sha256sum "$site/index.html" | cut -d' ' -f1)" = "$expected_sha"
grep -Fq 'name="robots" content="noindex,nofollow"' "$site/index.html"
grep -Fq 'Disallow: /' "$site/robots.txt"
for route in cv projects sui; do test -f "$site/$route/index.html"; done

# Keep prior fingerprinted assets for an already-open preview page. The current
# manifest in the new release is never overwritten.
if [[ -L "$base/releases/current" ]]; then
  previous="$(readlink "$base/releases/current")"
  [[ "$previous" != */* && -d "$base/releases/$previous/assets" ]] || exit 1
  cp -an "$base/releases/$previous/assets/." "$site/assets/"
else
  previous='(none)'
fi

# Validate the new *staging-only* static server config in a disposable Caddy
# container, then reload the existing staging web container with rollback.
docker run --rm --network none --read-only \
  -v "$candidate:/etc/caddy/Caddyfile:ro" \
  caddy:2.10.2-alpine caddy validate --config /etc/caddy/Caddyfile >/dev/null
if ! cmp -s "$candidate" "$config"; then
  backup="$base/Caddyfile.backup-$release"
  cp "$config" "$backup"
  cat "$candidate" > "$config" # preserve the inode of the bind-mounted file
  if ! docker exec batikanor-earth-staging-web caddy reload --config /etc/caddy/Caddyfile; then
    cat "$backup" > "$config"
    docker exec batikanor-earth-staging-web caddy reload --config /etc/caddy/Caddyfile || true
    echo 'Staging Caddy reload failed; restored its prior config.' >&2
    exit 1
  fi
fi
rm -f "$candidate"

# Switching a symlink within the staging release directory is atomic. No
# MapTheory container, production checkout, or GitHub Pages path is touched.
link="$base/releases/.current-$release"
ln -s "$release" "$link"
mv -Tf "$link" "$base/releases/current"
docker exec batikanor-earth-staging-web test -f /releases/current/index.html
echo "staging release: $release"
echo "previous release: $previous"
REMOTE

echo "Uploaded isolated staging release $RELEASE."
echo "Public preview: https://staging.batikanor.com/ (after its DNS/Caddy activation)."
