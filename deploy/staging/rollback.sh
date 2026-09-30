#!/usr/bin/env bash
# Restore an existing Batikanor *staging* release by atomic symlink swap.
set -euo pipefail

[[ "${1:-}" == "--to" && $# -eq 2 ]] || {
  echo "Usage: deploy/staging/rollback.sh --to RELEASE_ID" >&2
  exit 2
}
RELEASE="$2"
[[ "$RELEASE" =~ ^[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9-]{1,64}$ ]] || {
  echo "Invalid staging release ID." >&2
  exit 2
}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ "$BRANCH" == staging/* ]] || { echo "Use a staging branch to roll back staging." >&2; exit 1; }
KEY="$HOME/.ssh/maptheory-hetzner/id_ed25519"
SSH_OPTIONS=(-i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)
if [[ -n "${STAGING_SSH_JUMP:-}" ]]; then
  [[ "$STAGING_SSH_JUMP" =~ ^[A-Za-z0-9_.@-]+$ ]] || { echo "Invalid staging SSH jump host." >&2; exit 2; }
  SSH_OPTIONS+=(-J "$STAGING_SSH_JUMP")
fi
ssh "${SSH_OPTIONS[@]}" deploy@157.180.20.129 bash -s -- "$RELEASE" <<'REMOTE'
set -euo pipefail
release="$1"
[[ "$release" =~ ^[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9-]{1,64}$ ]] || exit 2
base=/srv/apps/batikanor-staging/releases
exec 9>/srv/apps/batikanor-staging/.deploy.lock
flock -n 9 || { echo 'Another staging deployment is active.' >&2; exit 1; }
test -f "$base/$release/index.html"
test ! -e "$base/$release/CNAME"
grep -Fq 'name="robots" content="noindex,nofollow"' "$base/$release/index.html"
previous="$(readlink "$base/current")"
link="$base/.current-rollback-$release"
ln -s "$release" "$link"
mv -Tf "$link" "$base/current"
docker exec batikanor-earth-staging-web test -f /releases/current/index.html
echo "Staging reverted from $previous to $release"
REMOTE
