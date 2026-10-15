#!/usr/bin/env bash
# Publish a prepared production artifact to a separate Hetzner static service.
# No DNS, GitHub Pages, staging release or unrelated container is changed.
set -euo pipefail
[[ "${1:-}" == "--publish" && $# -eq 3 ]] || {
  echo 'Usage: deploy/production/deploy.sh --publish ARTIFACT REVIEWED_STAGING_RELEASE' >&2
  exit 2
}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE="$(realpath "$2")"
REVIEWED="$3"
[[ "$REVIEWED" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{10}-[0-9a-f]{6}$ ]] || exit 2
[[ -f "$SITE/index.html" && -f "$SITE/assets/earth-current.json" && -f "$SITE/CNAME" && -f "$SITE/sitemap.xml" ]] || exit 1
grep -Fq 'name="robots" content="index,follow"' "$SITE/index.html"
grep -Fq 'rel="canonical" href="https://batikanor.com/"' "$SITE/index.html"
grep -Fq 'data-portfolio-experience="gallery"' "$SITE/index.html"
grep -Fq 'Sitemap: https://batikanor.com/sitemap.xml' "$SITE/robots.txt"
KEY="$HOME/.ssh/maptheory-hetzner/id_ed25519"
HOST='deploy@157.180.20.129'
SSH_ARGS=(-i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NONCE="$(openssl rand -hex 3)"
RELEASE="$STAMP-${REVIEWED:17:10}-$NONCE"
BASE='/srv/apps/batikanor-production'
INDEX_SHA="$(sha256sum "$SITE/index.html" | cut -d' ' -f1)"
MANIFEST_SHA="$(sha256sum "$SITE/assets/earth-current.json" | cut -d' ' -f1)"

ssh "${SSH_ARGS[@]}" "$HOST" bash -s -- "$RELEASE" "$REVIEWED" "$MANIFEST_SHA" <<'REMOTE'
set -euo pipefail
release="$1"; reviewed="$2"; expected="$3"
base=/srv/apps/batikanor-production
stage=/srv/apps/batikanor-staging/releases
test "$(readlink "$stage/current")" = "$reviewed"
test "$(sha256sum "$stage/$reviewed/assets/earth-current.json" | cut -d' ' -f1)" = "$expected"
test "$(df -Pk /srv/apps | awk 'NR==2 {print $4}')" -ge 1048576
mkdir -p "$base/releases"
test ! -e "$base/releases/$release"
mkdir "$base/releases/$release"
REMOTE

rsync -az --checksum --no-times --delete \
  --link-dest="/srv/apps/batikanor-staging/releases/$REVIEWED" \
  -e "ssh -i $KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15" \
  "$SITE/" "$HOST:$BASE/releases/$RELEASE/"
scp "${SSH_ARGS[@]}" "$ROOT/deploy/production/Caddyfile" "$HOST:$BASE/Caddyfile.candidate-$RELEASE"

ssh "${SSH_ARGS[@]}" "$HOST" bash -s -- "$RELEASE" "$INDEX_SHA" "$MANIFEST_SHA" "$REVIEWED" <<'REMOTE'
set -euo pipefail
release="$1"; index_sha="$2"; manifest_sha="$3"; reviewed="$4"
base=/srv/apps/batikanor-production
site="$base/releases/$release"
exec 9>"$base/.deploy.lock"
flock -n 9 || { echo 'Another production deployment is active.' >&2; exit 1; }
test "$(sha256sum "$site/index.html" | cut -d' ' -f1)" = "$index_sha"
test "$(sha256sum "$site/assets/earth-current.json" | cut -d' ' -f1)" = "$manifest_sha"
for route in cv cv/en projects projects/en sui achievements/tesla-gigathon-2026; do test -f "$site/$route/index.html"; done
grep -Fq 'name="robots" content="index,follow"' "$site/index.html"
test -f "$site/sitemap.xml"
docker run --rm --network none --read-only \
  -v "$base/Caddyfile.candidate-$release:/etc/caddy/Caddyfile:ro" \
  caddy:2.10.2-alpine caddy validate --config /etc/caddy/Caddyfile >/dev/null
if test -f "$base/Caddyfile"; then
  cmp -s "$base/Caddyfile.candidate-$release" "$base/Caddyfile" || {
    echo 'Existing production Caddy config differs; review before changing it.' >&2; exit 1;
  }
else
  mv "$base/Caddyfile.candidate-$release" "$base/Caddyfile"
fi
previous='(none)'
if test -L "$base/releases/current"; then
  previous="$(readlink "$base/releases/current")"
  [[ "$previous" != */* ]]
  cp -aln "$base/releases/$previous/assets/." "$site/assets/"
  if test -d "$base/releases/$previous/_next/static"; then
    mkdir -p "$site/_next/static"
    cp -aln "$base/releases/$previous/_next/static/." "$site/_next/static/"
  fi
fi
if docker container inspect batikanor-production-web >/dev/null 2>&1; then
  test "$(docker inspect -f '{{.Config.Image}}' batikanor-production-web)" = 'caddy:2.10.2-alpine'
  test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/releases"}}{{.Source}}:{{.RW}}{{end}}{{end}}' batikanor-production-web)" = "$base/releases:false"
  test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}:{{.RW}}{{end}}{{end}}' batikanor-production-web)" = "$base/Caddyfile:false"
  docker inspect -f '{{json .NetworkSettings.Networks}}' batikanor-production-web | grep -Fq '"maptheory-edge"'
fi
test "$(readlink /srv/apps/batikanor-staging/releases/current)" = "$reviewed"
test "$(sha256sum /srv/apps/batikanor-staging/releases/current/assets/earth-current.json | cut -d' ' -f1)" = "$manifest_sha"
switched=0; created=0
restore_on_failure() {
  status=$?
  if [[ "$status" != 0 && "$switched" == 1 ]]; then
    if [[ "$previous" == '(none)' ]]; then
      test "$(readlink "$base/releases/current")" != "$release" || rm "$base/releases/current"
    else
      ln -s "$previous" "$base/releases/.rollback-$release"
      mv -Tf "$base/releases/.rollback-$release" "$base/releases/current"
    fi
    if [[ "$created" == 1 ]]; then docker stop batikanor-production-web >/dev/null 2>&1 || true; fi
    echo 'Restored the prior production release pointer.' >&2
  fi
}
trap restore_on_failure EXIT
ln -s "$release" "$base/releases/.current-$release"
mv -Tf "$base/releases/.current-$release" "$base/releases/current"
switched=1
if docker container inspect batikanor-production-web >/dev/null 2>&1; then
  docker start batikanor-production-web >/dev/null
else
  docker run -d --name batikanor-production-web --restart unless-stopped \
    --network maptheory-edge --read-only --cap-drop ALL --cap-add NET_BIND_SERVICE --security-opt no-new-privileges \
    --memory 256m --cpus 1 --pids-limit 128 --tmpfs /tmp:rw,noexec,nosuid,size=16m \
    --tmpfs /config:rw,noexec,nosuid,size=16m --tmpfs /data:rw,noexec,nosuid,size=16m \
    -v "$base/releases:/releases:ro" -v "$base/Caddyfile:/etc/caddy/Caddyfile:ro" \
    caddy:2.10.2-alpine >/dev/null
  created=1
fi
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec batikanor-production-web wget -q -O /dev/null http://127.0.0.1:8080/assets/earth-current.json; then ready=1; break; fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo 'Production service check failed.' >&2; exit 1
fi
rm -f "$base/Caddyfile.candidate-$release"
echo "production release: $release"
echo "previous Hetzner release: $previous"
echo 'Production artifact is on Hetzner. DNS/edge cutover is a separate verified step.'
REMOTE
