#!/usr/bin/env bash
# Enable the staging vhost only after Namecheap's staging A record exists.
# Adds one dedicated Caddy fragment; never rewrites the existing sites.
set -euo pipefail

[[ "${1:-}" == "--enable" && $# -eq 1 ]] || {
  echo "Usage: deploy/staging/enable-domain.sh --enable" >&2
  exit 2
}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ "$BRANCH" == staging/* ]] || { echo "Use a staging branch." >&2; exit 1; }
IP='157.180.20.129'
DOMAIN='staging.batikanor.com'
for nameserver in dns1.registrar-servers.com dns2.registrar-servers.com; do
  if ! dig +short "@$nameserver" "$DOMAIN" A | grep -Fxq "$IP"; then
    echo "Namecheap authoritative $nameserver does not yet point $DOMAIN to $IP." >&2
    echo "Add only A host 'staging' -> $IP; do not change apex/www." >&2
    exit 1
  fi
done

KEY="$HOME/.ssh/maptheory-hetzner/id_ed25519"
HOST='deploy@157.180.20.129'
NONCE="$(openssl rand -hex 6)"
SITES='/srv/apps/maptheory/shared/caddy-sites'
TEMP="$SITES/.batikanor-staging-domain.candidate-$NONCE"
scp -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
  "$ROOT/deploy/staging/edge-site.caddy" "$HOST:$TEMP"

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o ConnectTimeout=15 "$HOST" bash -s -- "$NONCE" <<'REMOTE'
set -euo pipefail
nonce="$1"
[[ "$nonce" =~ ^[0-9a-f]{12}$ ]] || exit 2
sites=/srv/apps/maptheory/shared/caddy-sites
candidate="$sites/.batikanor-staging-domain.candidate-$nonce"
dest="$sites/batikanor-staging-domain.caddy"
exec 9>"$sites/.batikanor-domain.lock"
flock -n 9 || { echo 'Another staging domain operation is active.' >&2; exit 1; }
test -f "$candidate"
installed_new=0
if test -e "$dest"; then
  if cmp -s "$candidate" "$dest"; then
    rm "$candidate"
    echo 'Staging domain fragment already installed; validating/reloading again.'
  else
    echo 'Existing staging domain fragment differs; inspect manually before replacement.' >&2
    exit 1
  fi
else
  mv "$candidate" "$dest"
  installed_new=1
fi
if ! docker exec maptheory-edge-caddy-1 caddy validate --config /etc/caddy/Caddyfile; then
  if [[ "$installed_new" == 1 ]]; then rm "$dest"; fi
  echo 'Whole-edge Caddy validation failed; reverted any newly added staging-only fragment.' >&2
  exit 1
fi
if ! docker exec maptheory-edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile; then
  if [[ "$installed_new" == 1 ]]; then
    rm "$dest"
    docker exec maptheory-edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile || true
  fi
  echo 'Whole-edge Caddy reload failed; restored previous imported sites if this run added the fragment.' >&2
  exit 1
fi
echo 'Staging-only Caddy vhost installed.'
REMOTE

for attempt in 1 2 3 4 5 6; do
  # The workstation or home router may retain a negative DNS response for
  # nearly an hour even after both authoritative Namecheap servers update.
  # Resolve explicitly only for this validation: TLS still verifies $DOMAIN.
  if curl --resolve "$DOMAIN:443:$IP" -fsSI --max-time 15 "https://$DOMAIN/" >/dev/null; then break; fi
  if [[ "$attempt" == 6 ]]; then
    echo "Caddy reloaded but $DOMAIN is not yet reachable over HTTPS; check ACME/DNS." >&2
    exit 1
  fi
  sleep 10
done
curl --resolve "$DOMAIN:443:$IP" -fsSI --max-time 15 "https://$DOMAIN/" | grep -i 'x-robots-tag: noindex'
curl -fsSI --max-time 15 https://maptheory.org/ >/dev/null
curl -fsSI --max-time 15 https://gralobe.maptheory.org/ >/dev/null
curl -fsSI --max-time 15 https://spacecottbus.com/ >/dev/null
echo "Staging hostname and existing Hetzner sites are responding."
