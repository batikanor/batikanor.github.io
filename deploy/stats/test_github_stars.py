import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

import patch_caddy
import publish_github_stars as feed


class Response:
    status = 200

    def __init__(self, payload):
        self.body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()

    def read(self, limit):
        return self.body[:limit]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.data = self.root / "private"
        self.data.mkdir()
        self.public = self.root / "public"
        self.public.mkdir()
        self.output = self.public / "gralobe.json"
        self.previous = b'{"full_name":"batikanor/gralobe","stargazers_count":126,"verified_at":"2026-10-26T18:00:00Z"}\n'
        self.output.write_bytes(self.previous)
        self.now = 1793095200

    def publish(self, opener):
        return feed.publish(self.data, self.output, opener=opener, now=lambda: self.now)

    def test_real_response_fields_and_deadline_are_preserved(self):
        calls = []

        def opener(request, timeout):
            calls.append((request, timeout))
            return Response({"full_name": feed.REPOSITORY, "stargazers_count": 127,
                             "description": "not copied into the feed"})

        self.assertTrue(self.publish(opener))
        self.assertEqual(json.loads(self.output.read_text()), {
            "full_name": "batikanor/gralobe", "stargazers_count": 127,
            "verified_at": "2026-10-27T10:00:00Z",
        })
        request, timeout = calls[0]
        self.assertEqual(request.full_url, "https://api.github.com/repos/batikanor/gralobe")
        self.assertEqual(timeout, 15)
        self.assertEqual(self.output.stat().st_mode & 0o777, 0o644)
        self.assertEqual((self.data / "state.json").stat().st_mode & 0o777, 0o600)
        self.assertFalse(self.publish(lambda *args, **kwargs: self.fail("must respect two-minute gate")))

    def test_invalid_counts_and_json_retain_last_verified_feed(self):
        invalid = [b"not json", [], {"full_name": "other/repo", "stargazers_count": 999}]
        invalid.extend({"full_name": feed.REPOSITORY, "stargazers_count": value}
                       for value in [None, True, -1, 1.5, "127", 9007199254740992])
        for value in invalid:
            with self.subTest(value=value):
                (self.data / "state.json").unlink(missing_ok=True)
                with self.assertRaises((ValueError, TypeError)):
                    self.publish(lambda *args, **kwargs: Response(value))
                self.assertEqual(self.output.read_bytes(), self.previous)
                self.assertEqual(sorted(path.name for path in self.public.iterdir()), ["gralobe.json"])

    def test_rate_limit_retains_feed_and_defers_all_requests(self):
        next_time = self.now + 900

        def limited(*args, **kwargs):
            raise urllib.error.HTTPError(feed.API_URL, 403, "rate limited", {
                "X-RateLimit-Reset": str(next_time), "Retry-After": "60",
            }, io.BytesIO(b"private upstream error"))

        with self.assertRaises(urllib.error.HTTPError):
            self.publish(limited)
        self.assertEqual(self.output.read_bytes(), self.previous)
        self.assertEqual(json.loads((self.data / "state.json").read_text()),
                         {"next_attempt_at": next_time})
        self.assertFalse(self.publish(lambda *args, **kwargs: self.fail("rate limit must suppress fetch")))
        self.assertNotIn("error", self.output.read_text())

    def test_timeout_and_oversized_body_retain_feed(self):
        for failure in [TimeoutError("request timed out"), b"x" * (feed.MAX_RESPONSE_BYTES + 1)]:
            with self.subTest(failure=type(failure).__name__):
                (self.data / "state.json").unlink(missing_ok=True)

                def opener(*args, **kwargs):
                    if isinstance(failure, Exception):
                        raise failure
                    return Response(failure)

                with self.assertRaises((TimeoutError, ValueError)):
                    self.publish(opener)
                self.assertEqual(self.output.read_bytes(), self.previous)

    def test_failed_atomic_replace_keeps_original_and_removes_partial_file(self):
        seen = []

        def rejected_replace(source, destination):
            seen.append(json.loads(Path(source).read_text()))
            self.assertEqual(Path(source).parent, self.output.parent)
            self.assertEqual(Path(destination), self.output)
            self.assertEqual(self.output.read_bytes(), self.previous)
            raise OSError("simulated replace failure")

        with patch.object(feed.os, "replace", rejected_replace):
            with self.assertRaises(OSError):
                feed.atomic_json(self.output, {"full_name": feed.REPOSITORY, "stargazers_count": 127})
        self.assertEqual(seen[0]["stargazers_count"], 127)
        self.assertEqual(self.output.read_bytes(), self.previous)
        self.assertEqual(sorted(path.name for path in self.public.iterdir()), ["gralobe.json"])


class CaddyTests(unittest.TestCase):
    def test_only_exact_feed_path_is_added_and_archives_are_unchanged(self):
        block = (Path(__file__).parent / "Caddyfile.github-stars").read_text()
        result = patch_caddy.patched_config(patch_caddy.BASE_CONFIG, block)
        self.assertEqual(result.replace(block, ""), patch_caddy.BASE_CONFIG)
        self.assertEqual(patch_caddy.patched_config(result, block), result)
        self.assertIn('path /stats/github/batikanor/gralobe.json\n', result)
        self.assertIn('Cache-Control "public, max-age=31536000, immutable"', result)
        self.assertIn('Access-Control-Allow-Origin "*"', result)

    def test_unreviewed_config_drift_is_rejected(self):
        block = (Path(__file__).parent / "Caddyfile.github-stars").read_text()
        with self.assertRaises(ValueError):
            patch_caddy.patched_config(patch_caddy.BASE_CONFIG.replace("/artifacts", "/elsewhere"), block)


if __name__ == "__main__":
    unittest.main()
