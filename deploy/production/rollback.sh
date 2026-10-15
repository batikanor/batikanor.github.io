#!/usr/bin/env bash
# Atomically restore an existing Hetzner production artifact. No DNS, staging,
# edge configuration or unrelated container is changed.
set -euo pipefail
[[ "${1:-}" == '--to' && $# -eq 2 ]] || {
  echo 'Usage: deploy/production/rollback.sh --to RELEASE_ID' >&2
  exit 2
}
RELEASE="$2"
[[ "$RELEASE" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{10}-[0-9a-f]{6}$ ]] || {
  echo 'Invalid production release ID.' >&2
  exit 2
}
KEY="$HOME/.ssh/maptheory-hetzner/id_ed25519"
[[ -f "$KEY" ]] || { echo 'Hetzner SSH identity is unavailable.' >&2; exit 1; }
NONCE="$(openssl rand -hex 8)"
ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes \
  -o StrictHostKeyChecking=yes -o ConnectTimeout=15 \
  deploy@157.180.20.129 bash -s -- "$RELEASE" "$NONCE" <<'REMOTE'
set -euo pipefail
release="$1"; nonce="$2"
[[ "$release" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{10}-[0-9a-f]{6}$ ]]
[[ "$nonce" =~ ^[0-9a-f]{16}$ ]]
base=/srv/apps/batikanor-production
releases="$base/releases"
site="$releases/$release"
exec 9>"$base/.deploy.lock"
flock -n 9 || { echo 'Another production deployment is active.' >&2; exit 1; }
test -d "$site" && test ! -L "$site"
test "$(realpath "$site")" = "$site"
test -L "$releases/current"
previous="$(readlink "$releases/current")"
[[ "$previous" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{10}-[0-9a-f]{6}$ ]]
test -d "$releases/$previous" && test ! -L "$releases/$previous"
test -f "$site/index.html" && test -f "$site/assets/earth-current.json"
test -f "$site/CNAME" && test -f "$site/robots.txt" && test -f "$site/sitemap.xml"
grep -Eq '^(www\.)?batikanor\.com$' "$site/CNAME"
grep -Fq 'rel="canonical" href="https://batikanor.com/"' "$site/index.html"
if grep -Eiq 'name="robots"[^>]*content="[^"]*noindex|Disallow:[[:space:]]*/[[:space:]]*$' \
  "$site/index.html" "$site/robots.txt"; then
  echo 'Refusing a non-indexable production rollback artifact.' >&2
  exit 1
fi
python3 - "$site" <<'PY'
import json, pathlib, re, sys
site = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads((site / 'assets/earth-current.json').read_text())
for key in ('entry', 'mapEntry', 'roomEntry'):
    value = manifest.get(key)
    if key == 'roomEntry' and value is None:
        continue
    assert isinstance(value, str) and re.fullmatch(r'/assets/[A-Za-z0-9_-]+\.js', value), key
    asset = site / value.lstrip('/')
    assert asset.is_file() and asset.resolve().is_relative_to(site), value
PY
test "$(docker inspect -f '{{.Config.Image}}' batikanor-production-web)" = 'caddy:2.10.2-alpine'
test "$(docker inspect -f '{{.State.Running}}' batikanor-production-web)" = 'true'
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/releases"}}{{.Source}}:{{.RW}}{{end}}{{end}}' batikanor-production-web)" = "$releases:false"
expected_manifest="$(sha256sum "$site/assets/earth-current.json" | cut -d' ' -f1)"
expected_index="$(sha256sum "$site/index.html" | cut -d' ' -f1)"
link="$releases/.rollback-$nonce"
switched=0
restore_on_failure() {
  status=$?
  trap - EXIT
  if [[ "$status" != 0 && "$switched" == 1 ]]; then
    if [[ "$(readlink "$releases/current" 2>/dev/null || true)" == "$release" ]]; then
      rm -f "$link"
      if ln -s "$previous" "$link" && mv -Tf "$link" "$releases/current"; then
        echo "Rollback verification failed; restored production release $previous." >&2
      else
        echo 'ERROR: Could not restore the previous production pointer.' >&2
      fi
    fi
  fi
  rm -f "$link"
  exit "$status"
}
trap restore_on_failure EXIT
ln -s "$release" "$link"
mv -Tf "$link" "$releases/current"
switched=1
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if actual_manifest="$(docker exec batikanor-production-web wget -q -O - http://127.0.0.1:8080/assets/earth-current.json | sha256sum | cut -d' ' -f1)" \
    && actual_index="$(docker exec batikanor-production-web wget -q -O - http://127.0.0.1:8080/ | sha256sum | cut -d' ' -f1)" \
    && [[ "$actual_manifest" == "$expected_manifest" && "$actual_index" == "$expected_index" ]]; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Production rollback content check failed.' >&2; exit 1; }
echo "production release: $release"
echo "previous Hetzner release: $previous"
echo 'Verified manifest and homepage bytes from the production service.'
REMOTE
