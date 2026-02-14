#!/usr/bin/env python3
"""Validate OpenClaw env files for deployment readiness."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

PLACEHOLDER_PATTERNS = (
    "changeme",
    "todo",
    "your-key",
    "your_token",
    "example",
    "replace-me",
    "placeholder",
)

KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def parse_env(env_path: Path):
    values = {}
    duplicates = []
    malformed = []

    for idx, raw_line in enumerate(env_path.read_text().splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if "=" not in line:
            malformed.append((idx, raw_line))
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if not KEY_RE.match(key):
            malformed.append((idx, raw_line))
            continue

        if key in values:
            duplicates.append(key)

        values[key] = value

    return values, duplicates, malformed


def is_placeholder(value: str) -> bool:
    lowered = value.lower()
    return any(pattern in lowered for pattern in PLACEHOLDER_PATTERNS)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate .env file for OpenClaw deployments")
    parser.add_argument("--env-file", required=True, help="Path to .env file")
    parser.add_argument(
        "--require",
        action="append",
        default=[],
        help="Required key (can be passed multiple times)",
    )
    args = parser.parse_args()

    env_path = Path(args.env_file)
    if not env_path.exists():
        print(f"[ERROR] Env file not found: {env_path}")
        return 1

    values, duplicates, malformed = parse_env(env_path)

    missing = [key for key in args.require if key not in values or not values[key]]
    placeholders = [key for key, value in values.items() if value and is_placeholder(value)]

    print(f"Parsed keys: {len(values)}")

    if malformed:
        print("\nMalformed lines:")
        for line_no, line in malformed:
            print(f"  - line {line_no}: {line}")

    if duplicates:
        print("\nDuplicate keys:")
        for key in sorted(set(duplicates)):
            print(f"  - {key}")

    if missing:
        print("\nMissing required keys:")
        for key in missing:
            print(f"  - {key}")

    if placeholders:
        print("\nPotential placeholder values detected:")
        for key in placeholders:
            print(f"  - {key}")

    has_errors = bool(malformed or duplicates or missing or placeholders)

    if has_errors:
        print("\n[FAIL] Env validation failed.")
        return 1

    print("\n[OK] Env validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
