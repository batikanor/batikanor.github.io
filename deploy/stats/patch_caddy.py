#!/usr/bin/env python3
"""Add one exact-path feed block to the known dedicated artifact Caddyfile."""
from pathlib import Path
import sys

BASE_CONFIG = """:8080 {
    root * /artifacts
    @health path /healthz
    respond @health "ok" 200
    @archive path_regexp archive ^/[0-9a-f]{64}\\.tar\\.gz$
    header @archive Cache-Control "public, max-age=31536000, immutable"
    file_server
}
"""
BEGIN = "    # BEGIN batikanor GitHub stars feed\n"
END = "    # END batikanor GitHub stars feed\n"


def patched_config(current, block):
    if not block.startswith(BEGIN) or not block.endswith(END):
        raise ValueError("Unexpected feed configuration block")
    baseline = current
    if BEGIN in baseline or END in baseline:
        if baseline.count(BEGIN) != 1 or baseline.count(END) != 1:
            raise ValueError("Ambiguous existing feed block")
        start, finish = baseline.index(BEGIN), baseline.index(END) + len(END)
        if finish <= start:
            raise ValueError("Invalid existing feed block")
        baseline = baseline[:start] + baseline[finish:]
    if baseline != BASE_CONFIG:
        raise ValueError("Artifact Caddyfile changed; review it before deployment")
    return baseline.replace("    file_server\n", block + "    file_server\n")


if __name__ == "__main__":
    current, block, candidate = map(Path, sys.argv[1:])
    candidate.write_text(patched_config(current.read_text(), block.read_text()))
