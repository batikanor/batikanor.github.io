#!/usr/bin/env bash
# Add only an isolated Batikan vhost; never replace the shared edge config.
set -euo pipefail
[[ $# -eq 1 && ( "$1" == '--review' || "$1" == '--production' ) ]] || {
  echo 'Usage: deploy/production/enable-domain.sh --review|--production' >&2; exit 2;
}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="$1"
if [[ "$MODE" == '--review' ]]; then
  SOURCE="$ROOT/deploy/production/review-site.caddy"
  NAME='batikanor-production-review.caddy'
else
  SOURCE="$ROOT/deploy/production/edge-site.caddy"
  NAME='batikanor-production.caddy'
fi
KEY="$HOME/.ssh/maptheory-hetzner/id_ed25519"
HOST='deploy@157.180.20.129'
SSH_ARGS=(-i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)
NONCE="$(openssl rand -hex 6)"
SITES='/srv/apps/maptheory/shared/caddy-sites'
scp "${SSH_ARGS[@]}" "$SOURCE" "$HOST:$SITES/.$NAME.candidate-$NONCE"
ssh "${SSH_ARGS[@]}" "$HOST" bash -s -- "$NAME" "$NONCE" <<'REMOTE'
set -euo pipefail
name="$1"; nonce="$2"
[[ "$name" == 'batikanor-production-review.caddy' || "$name" == 'batikanor-production.caddy' ]]
[[ "$nonce" =~ ^[0-9a-f]{12}$ ]]
sites=/srv/apps/maptheory/shared/caddy-sites
dest="$sites/$name"; candidate="$sites/.$name.candidate-$nonce"
exec 9>"$sites/.batikanor-domain.lock"
flock -n 9 || { echo 'Another Batikan domain operation is active.' >&2; exit 1; }
test -f "$candidate"
docker exec batikanor-production-web wget -q -O /dev/null http://127.0.0.1:8080/assets/earth-current.json
new=0
if test -e "$dest"; then
  cmp -s "$candidate" "$dest" || { echo 'Existing domain fragment differs; review it before replacement.' >&2; exit 1; }
  rm "$candidate"
else
  mv "$candidate" "$dest"; new=1
fi
revert_fragment() {
  if [[ "$new" == 1 ]]; then
    rm "$dest"
    docker exec maptheory-edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
  fi
}
if ! docker exec maptheory-edge-caddy-1 caddy validate --config /etc/caddy/Caddyfile; then
  revert_fragment; exit 1
fi
if ! docker exec maptheory-edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile; then
  revert_fragment; exit 1
fi
echo "Installed isolated vhost: $name"
REMOTE
