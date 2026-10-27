#!/usr/bin/env bash
# Publish only the portfolio's fixed-repository feed on its existing Hetzner host.
set -euo pipefail

[[ "${1:-}" == "--publish" && $# -eq 1 ]] || {
  echo 'Usage: deploy/stats/deploy.sh --publish' >&2
  exit 2
}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
BRANCH="$(git branch --show-current)"
[[ "$BRANCH" == staging/* ]] || {
  echo "Refusing feed deployment from non-staging branch: $BRANCH" >&2
  exit 1
}
KEY="$HOME/.ssh/maptheory-hetzner/id_ed25519"
[[ -f "$KEY" ]] || { echo 'Staging SSH identity is unavailable.' >&2; exit 1; }
HOST='deploy@157.180.20.129'
SSH_OPTIONS=(-i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)
if [[ -n "${STAGING_SSH_JUMP:-}" ]]; then
  [[ "$STAGING_SSH_JUMP" =~ ^[A-Za-z0-9_.@-]+$ ]] || exit 2
  SSH_OPTIONS+=(-J "$STAGING_SSH_JUMP")
fi
STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 3)"
BASE='/srv/apps/batikanor-github-stars'
INCOMING="$BASE/incoming/$STAMP"
FILES=(publish_github_stars.py patch_caddy.py Caddyfile.github-stars batikanor-github-stars.service batikanor-github-stars.timer)
for file in "${FILES[@]}"; do test -f "$ROOT/deploy/stats/$file"; done

ssh "${SSH_OPTIONS[@]}" "$HOST" bash -s -- "$STAMP" <<'REMOTE'
set -euo pipefail
stamp="$1"
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{6}$ ]]
base=/srv/apps/batikanor-github-stars
test ! -L "$base"
mkdir -p "$base/incoming"
test ! -e "$base/incoming/$stamp"
mkdir "$base/incoming/$stamp"
REMOTE
for file in "${FILES[@]}"; do
  scp "${SSH_OPTIONS[@]}" "$ROOT/deploy/stats/$file" "$HOST:$INCOMING/$file"
done

ssh "${SSH_OPTIONS[@]}" "$HOST" bash -s -- "$STAMP" <<'REMOTE'
set -euo pipefail
stamp="$1"
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{6}$ ]]
base=/srv/apps/batikanor-github-stars
incoming="$base/incoming/$stamp"
artifact=/srv/apps/batikanor-release-artifacts
config="$artifact/Caddyfile"
feed_dir="$artifact/public/stats/github/batikanor"
container=batikanor-release-artifacts
test -d "$incoming" && test ! -L "$incoming"
test -f "$config" && test ! -L "$config"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/artifacts"}}{{.Source}}:{{.RW}}{{end}}{{end}}' "$container")" = "$artifact/public:false"
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}:{{.RW}}{{end}}{{end}}' "$container")" = "$config:false"
sudo -n true
command -v python3 >/dev/null
command -v timeout >/dev/null
exec 9>"$base/.deploy.lock"
flock -n 9 || { echo 'Another star-feed deployment is active.' >&2; exit 1; }
mkdir -p "$base/data" "$base/backups/$stamp" "$feed_dir"
chmod 700 "$base/data"
backup="$base/backups/$stamp"
candidate="$incoming/Caddyfile.candidate"
python3 "$incoming/patch_caddy.py" "$config" "$incoming/Caddyfile.github-stars" "$candidate"
docker run --rm --network none --read-only \
  -v "$candidate:/etc/caddy/Caddyfile:ro" \
  caddy:2.10.2-alpine caddy validate --config /etc/caddy/Caddyfile >/dev/null

cp "$config" "$backup/Caddyfile"
for name in publish_github_stars.py patch_caddy.py Caddyfile.github-stars; do
  if test -e "$base/$name"; then cp "$base/$name" "$backup/$name"; fi
done
for unit in batikanor-github-stars.service batikanor-github-stars.timer; do
  if test -e "/etc/systemd/system/$unit"; then cp "/etc/systemd/system/$unit" "$backup/$unit"; fi
done
timer_enabled=false
timer_active=false
if systemctl is-enabled --quiet batikanor-github-stars.timer 2>/dev/null; then timer_enabled=true; fi
if systemctl is-active --quiet batikanor-github-stars.timer 2>/dev/null; then timer_active=true; fi
printf 'enabled=%s\nactive=%s\n' "$timer_enabled" "$timer_active" > "$backup/timer-state.txt"
config_changed=false
units_changed=false
installed=false
rollback() {
  status=$?
  [[ "$status" -eq 0 ]] && return
  trap - EXIT
  if $units_changed; then
    sudo -n systemctl stop batikanor-github-stars.timer || true
    if ! $timer_enabled; then sudo -n systemctl disable batikanor-github-stars.timer 2>/dev/null || true; fi
    for unit in batikanor-github-stars.service batikanor-github-stars.timer; do
      if test -f "$backup/$unit"; then
        sudo -n install -m 644 "$backup/$unit" "/etc/systemd/system/$unit" || true
      else
        sudo -n rm -f -- "/etc/systemd/system/$unit" || true
      fi
    done
    sudo -n systemctl daemon-reload || true
    if $timer_enabled; then sudo -n systemctl enable batikanor-github-stars.timer || true; fi
    if $timer_active; then sudo -n systemctl start batikanor-github-stars.timer || true; fi
  fi
  if $config_changed; then
    cat "$backup/Caddyfile" > "$config"
    docker exec "$container" caddy reload --config /etc/caddy/Caddyfile || true
  fi
  if $installed; then
    for name in publish_github_stars.py patch_caddy.py Caddyfile.github-stars; do
      if test -f "$backup/$name"; then
        cp "$backup/$name" "$base/.$name.rollback-$stamp"
        mv -f "$base/.$name.rollback-$stamp" "$base/$name"
      else
        rm -f -- "$base/$name"
      fi
    done
  fi
  echo "Feed deployment failed; prior dedicated configuration restored. Backup: $backup" >&2
  exit "$status"
}
trap rollback EXIT

# Atomic source replacement keeps a concurrently starting timer from reading
# a partly copied script. No source or private state enters the public root.
installed=true
for name in publish_github_stars.py patch_caddy.py Caddyfile.github-stars; do
  install -m 644 "$incoming/$name" "$base/.$name.next-$stamp"
  mv -f "$base/.$name.next-$stamp" "$base/$name"
done
# A real successful GitHub response is mandatory before enabling this timer.
# An existing rate-limit window fails safely and can be retried after it expires.
timeout --signal=TERM 45s python3 "$base/publish_github_stars.py" --require-refresh
if ! cmp -s "$candidate" "$config"; then
  config_changed=true
  cat "$candidate" > "$config" # retain the existing bind-mounted inode
  docker exec "$container" caddy reload --config /etc/caddy/Caddyfile
fi
units_changed=true
for unit in batikanor-github-stars.service batikanor-github-stars.timer; do
  sudo -n install -m 644 "$incoming/$unit" "/etc/systemd/system/$unit"
done
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now batikanor-github-stars.timer
systemctl is-active --quiet batikanor-github-stars.timer
test -s "$feed_dir/gralobe.json"
printf 'GitHub feed published: https://batikanor-releases.157.180.20.129.sslip.io/stats/github/batikanor/gralobe.json\n'
printf 'Dedicated configuration backup: %s\n' "$backup"
systemctl list-timers batikanor-github-stars.timer --no-pager
trap - EXIT
rm -rf -- "$incoming"
REMOTE
