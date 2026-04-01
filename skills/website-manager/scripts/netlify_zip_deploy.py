#!/usr/bin/env python3
"""
Deploy a prepared site directory to Netlify as a zip upload.

Requires:
- NETLIFY_AUTH_TOKEN
- NETLIFY_SITE_ID

Example:
  NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... \
  python3 scripts/netlify_zip_deploy.py ./site-output
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path


API_ROOT = "https://api.netlify.com/api/v1"


def build_zip(source_dir: Path) -> Path:
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    tmp.close()
    zip_path = Path(tmp.name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source_dir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source_dir))
    return zip_path


def request(method: str, url: str, token: str, body: bytes | None = None, content_type: str | None = None) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as response:
        raw = response.read()
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def create_deploy(site_id: str, token: str, zip_bytes: bytes, draft: bool) -> dict:
    url = f"{API_ROOT}/sites/{site_id}/deploys"
    if draft:
        url += "?draft=true"
    return request("POST", url, token, zip_bytes, "application/zip")


def poll_deploy(deploy_id: str, token: str, timeout_seconds: int) -> dict:
    url = f"{API_ROOT}/deploys/{deploy_id}"
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        payload = request("GET", url, token)
        state = payload.get("state")
        if state in {"ready", "error"}:
            return payload
        time.sleep(3)
    raise TimeoutError(f"Timed out waiting for deploy {deploy_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy a site directory to Netlify as a zip upload.")
    parser.add_argument("site_dir", help="Built site directory to deploy")
    parser.add_argument("--draft", action="store_true", help="Create a draft deploy")
    parser.add_argument("--timeout", type=int, default=300, help="Polling timeout in seconds")
    args = parser.parse_args()

    token = os.environ.get("NETLIFY_AUTH_TOKEN")
    site_id = os.environ.get("NETLIFY_SITE_ID")
    if not token or not site_id:
        print("ERROR: NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID must be set.", file=sys.stderr)
        return 2

    site_dir = Path(args.site_dir).resolve()
    if not site_dir.exists() or not site_dir.is_dir():
        print(f"ERROR: {site_dir} is not a directory.", file=sys.stderr)
        return 2

    zip_path = build_zip(site_dir)
    try:
        zip_bytes = zip_path.read_bytes()
        deploy = create_deploy(site_id, token, zip_bytes, args.draft)
        deploy_id = deploy.get("id")
        if not deploy_id:
            print("ERROR: Netlify did not return a deploy id.", file=sys.stderr)
            return 1
        final = poll_deploy(deploy_id, token, args.timeout)
        state = final.get("state", "unknown")
        print(json.dumps({
            "deploy_id": deploy_id,
            "state": state,
            "deploy_url": final.get("deploy_url"),
            "ssl_url": final.get("ssl_url"),
        }, indent=2))
        return 0 if state == "ready" else 1
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"HTTP ERROR {exc.code}: {detail}", file=sys.stderr)
        return 1
    finally:
        zip_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
