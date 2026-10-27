#!/usr/bin/env python3
"""Refresh the portfolio's one public GitHub-star feed, retaining last success."""
import argparse
import datetime
import email.utils
import fcntl
import json
import math
import os
from pathlib import Path
import tempfile
import time
import sys
import urllib.error
import urllib.request


REPOSITORY = "batikanor/gralobe"
API_URL = "https://api.github.com/repos/" + REPOSITORY
DATA_DIRECTORY = Path("/srv/apps/batikanor-github-stars/data")
PUBLIC_FEED = Path("/srv/apps/batikanor-release-artifacts/public/stats/github/batikanor/gralobe.json")
REFRESH_SECONDS = 120
REQUEST_TIMEOUT_SECONDS = 15
MAX_RESPONSE_BYTES = 262144
MAX_SAFE_INTEGER = 9007199254740991


def atomic_json(path, value, mode=0o644):
    """Readers see either complete old JSON or complete new JSON."""
    path = Path(path)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=".github-stars-", delete=False) as output:
            temporary = Path(output.name)
            os.fchmod(output.fileno(), mode)
            json.dump(value, output, separators=(",", ":"), allow_nan=False)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
        temporary = None
        descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def retry_at(headers, now):
    """Respect GitHub's advertised retry/reset without publishing its errors."""
    headers = headers or {}
    result = now + REFRESH_SECONDS
    retry = headers.get("Retry-After")
    if retry:
        try:
            seconds = float(retry)
            if math.isfinite(seconds):
                result = max(result, now + max(0, seconds))
        except (TypeError, ValueError):
            try:
                parsed = email.utils.parsedate_to_datetime(retry)
                result = max(result, parsed.timestamp())
            except (TypeError, ValueError, OverflowError):
                pass
    try:
        reset = float(headers.get("X-RateLimit-Reset", "0"))
        if math.isfinite(reset):
            result = max(result, reset)
    except (TypeError, ValueError):
        pass
    return result


def verified_payload(response, now):
    if getattr(response, "status", None) != 200:
        raise ValueError("GitHub returned an unsuccessful response")
    raw = response.read(MAX_RESPONSE_BYTES + 1)
    if len(raw) > MAX_RESPONSE_BYTES:
        raise ValueError("GitHub returned an oversized response")
    payload = json.loads(raw)
    if not isinstance(payload, dict) or payload.get("full_name") != REPOSITORY:
        raise ValueError("GitHub returned an unexpected repository")
    count = payload.get("stargazers_count")
    if type(count) is not int or not 0 <= count <= MAX_SAFE_INTEGER:
        raise ValueError("GitHub returned an invalid star count")
    return {
        "full_name": REPOSITORY,
        "stargazers_count": count,
        "verified_at": datetime.datetime.fromtimestamp(now, datetime.timezone.utc)
            .isoformat(timespec="seconds").replace("+00:00", "Z"),
    }


def load_next_attempt(path):
    try:
        value = json.loads(path.read_text()).get("next_attempt_at", 0)
        return value if type(value) in (int, float) and math.isfinite(value) else 0
    except (OSError, ValueError, TypeError, AttributeError):
        return 0


def publish(data_directory=DATA_DIRECTORY, public_feed=PUBLIC_FEED,
            opener=urllib.request.urlopen, now=time.time):
    """Return False during backoff; raise on failure without replacing the feed."""
    data_directory, public_feed = Path(data_directory), Path(public_feed)
    state_file = data_directory / "state.json"
    with (data_directory / ".refresh.lock").open("a") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        started = now()
        if started < load_next_attempt(state_file):
            return False
        next_attempt = started + REFRESH_SECONDS
        try:
            request = urllib.request.Request(API_URL, headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "batikanor-portfolio-github-stars",
                "X-GitHub-Api-Version": "2022-11-28",
                "Cache-Control": "no-cache",
            })
            with opener(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                payload = verified_payload(response, now())
            atomic_json(public_feed, payload)
        except urllib.error.HTTPError as error:
            if error.code in (403, 429):
                next_attempt = retry_at(error.headers, now())
            error.close()
            atomic_json(state_file, {"next_attempt_at": next_attempt}, mode=0o600)
            raise
        except Exception:
            atomic_json(state_file, {"next_attempt_at": next_attempt}, mode=0o600)
            raise
        atomic_json(state_file, {"next_attempt_at": next_attempt}, mode=0o600)
        return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-refresh", action="store_true",
                        help="Fail if a fresh GitHub response could not be published.")
    args = parser.parse_args()
    try:
        updated = publish()
    except Exception:
        print("GitHub star feed refresh failed; the last verified feed was retained.",
              file=sys.stderr)
        return 1
    if args.require_refresh and not updated:
        print("GitHub refresh is deferred by its existing retry window.",
              file=sys.stderr)
        return 1
    print(json.dumps({"updated": updated, "repository": REPOSITORY}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
