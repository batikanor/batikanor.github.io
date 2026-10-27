# Shared Gralobe star feed on Hetzner

The portfolio reads one public feed, independently of a visitor's ability to
reach GitHub:

`https://staging.batikanor.com/site-data/gralobe-stars.json`

The dedicated staging Caddy proxies this exact path internally to the existing
artifact container. This first-party data endpoint stays independent of
application release files and is shared with future production clients. Its
backend feed is also available at
`https://batikanor-releases.157.180.20.129.sslip.io/stats/github/batikanor/gralobe.json`.

The existing dedicated `batikanor-release-artifacts` Caddy container serves the
feed from `/srv/apps/batikanor-release-artifacts/public`. No DNS, shared edge
routing, production Pages release or immutable archive is changed. The exact
feed path allows credential-free CORS and has `Cache-Control: public, max-age=30`.
Existing hash-named `.tar.gz` archives retain their one-year immutable policy.

Hosting stays on Hetzner under the owner's hosting policy. This feed does not
authorize Vercel or any other hosting service. Production remains GitHub Pages
under its specific exception; promoting new application code still requires
the normal staging-first process and an explicit production request.

## Refresh and durable data

`publish_github_stars.py` fetches only the fixed official GitHub repository API
for `batikanor/gralobe`. It validates the exact repository and a nonnegative safe
integer star count, then atomically publishes:

```json
{"full_name":"batikanor/gralobe","stargazers_count":127,"verified_at":"2026-10-27T10:00:00Z"}
```

The example is illustrative; deployment requires a real fresh response. The
last successful JSON remains on disk through API errors, invalid responses,
timeouts, restarts and subsequent site releases. Errors never replace its count
or enter the public JSON. GitHub retry/reset windows live privately in
`/srv/apps/batikanor-github-stars/data/state.json`. No visitor or server token is
needed, and the updater accepts no upstream URL or repository argument.

The dedicated systemd oneshot runs as `deploy` every two minutes, at most about
30 GitHub requests per hour, with a 15-second request timeout and 45-second
service deadline. The timer starts again after a host reboot. Source, locks,
state and configuration backups live in `/srv/apps/batikanor-github-stars`,
outside the public artifact directory. There is no applicable Docker-only rule
at this project's scope; the small host Python job writes the file served by
the existing read-only container mount.

## Release snapshot

Before freezing a new staging release, run
`node earth-engine/scripts/update-github-stars-snapshot.mjs`. It fetches this
verified feed and synchronizes the bundled snapshot and entrance markup.
Builds and production promotion must retain those reviewed bytes; they must
not fetch a replacement snapshot after source is frozen. Browsers continue
refreshing from the stable feed and keep verified cached data quietly.

## Verify and deploy

From the repository's dedicated `staging/*` checkout:

```sh
python3 -m unittest discover -s deploy/stats -p 'test_*.py'
bash -n deploy/stats/deploy.sh
bash deploy/stats/deploy.sh --publish
```

Deployment uses the existing Hetzner SSH identity with strict known-host
verification and optional `STAGING_SSH_JUMP`. It requires an initial fresh
GitHub response before enabling the timer. Existing private backoff can defer a
redeployment; retry after that window. Existing units, script and Caddy config
are backed up before changes. Unexpected artifact Caddy configuration stops
deployment for review. The candidate is validated in a disposable Caddy
container; reload failure restores the previous bind-mounted config.

Remote paths and container:

- Source/state: `/srv/apps/batikanor-github-stars`.
- Public JSON: `/srv/apps/batikanor-release-artifacts/public/stats/github/batikanor/gralobe.json`.
- Dedicated Caddy config: `/srv/apps/batikanor-release-artifacts/Caddyfile`.
- Container: `batikanor-release-artifacts`; config is mounted as
  `/etc/caddy/Caddyfile:ro`, public directory as `/artifacts:ro`.
- Units: `/etc/systemd/system/batikanor-github-stars.service` and `.timer`.

After deployment, fetch the JSON with both staging and production Origin
headers. Verify a real numeric count, `verified_at`, CORS, cache policy, timer
status and another successful scheduled refresh. Confirm the existing health
route and pinned immutable production archive still work. Application staging
verification must include successful browser feed fetching and preserved native
repository links. No production promotion happens through this script.

Useful read-only checks on Hetzner:

```sh
systemctl status batikanor-github-stars.timer --no-pager
systemctl list-timers batikanor-github-stars.timer --no-pager
journalctl -u batikanor-github-stars.service -n 15 --no-pager
cat /srv/apps/batikanor-release-artifacts/public/stats/github/batikanor/gralobe.json
```

## Rollback

The deploy output identifies `/srv/apps/batikanor-github-stars/backups/<stamp>`.
Keep the current last-success feed available while restoring an updater; never
replace it with zero, an error response or a made-up count.

1. Stop only `batikanor-github-stars.timer`. Restore the prior publisher and
   its recorded service/timer unit files from that backup, then run
   `sudo systemctl daemon-reload`. Restore the timer's previous enabled/active
   state. The deployment script performs this automatically on installation
   failure.
2. If undoing CORS/configuration too, validate the backed-up `Caddyfile` first
   using `caddy:2.10.2-alpine`, then copy its contents into the existing
   `/srv/apps/batikanor-release-artifacts/Caddyfile` inode and reload only
   `batikanor-release-artifacts`. Do not replace that bind-mounted inode with
   `mv`. The public JSON can remain as the last verified value.
3. Verify archive delivery and health again. Do not touch shared edge config,
   DNS, staging/production release symlinks or any unrelated container.

For first-install removal, disable the dedicated timer and remove only the two
new unit files after stopping it. Retain the public last-success JSON until no
deployed application uses it. Private state/backups are not public evidence.
