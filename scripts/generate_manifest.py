#!/usr/bin/env python3
"""Generate manifests/skills.json from the skills/ directory."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

MANIFEST_PATH = Path("manifests/skills.json")
SKILLS_DIR = Path("skills")
PACKAGES_DIR = Path("packages")


def get_skill_metadata(skill_dir: Path) -> dict:
    """Extract metadata from SKILL.md frontmatter."""
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return {}

    content = skill_md.read_text()
    metadata = {}
    in_frontmatter = False
    for line in content.splitlines():
        line = line.strip()
        if line == "---":
            if in_frontmatter:
                break
            in_frontmatter = True
            continue
        if in_frontmatter and ":" in line:
            key, value = line.split(":", 1)
            metadata[key.strip().lower()] = value.strip()

    return metadata


def get_package_sha256(package_path: Path) -> str:
    """Calculate SHA256 hash of a package file."""
    if not package_path.exists():
        return ""
    with open(package_path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def main() -> int:
    """Generate the skills manifest."""
    skills = []

    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        if not skill_dir.is_dir():
            continue

        metadata = get_skill_metadata(skill_dir)
        if not metadata:
            print(f"Warning: No metadata found in {skill_dir}, skipping")
            continue

        slug = metadata.get("slug", skill_dir.name)
        name = metadata.get("name", slug.replace("-", " ").title())
        version = metadata.get("version", "0.0.0")
        status = metadata.get("status", "draft")

        # Check for existing package
        package_dir = PACKAGES_DIR / slug
        package_path = package_dir / f"{slug}-skill.zip"
        sha256 = get_package_sha256(package_path) if package_path.exists() else ""

        skills.append({
            "slug": slug,
            "name": name,
            "version": version,
            "status": status,
            "source_path": f"skills/{slug}",
            "package_path": f"packages/{slug}/{slug}-skill.zip",
            "sha256": sha256,
        })

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "skills": sorted(skills, key=lambda x: x["slug"]),
    }

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"Generated {MANIFEST_PATH} with {len(skills)} skills")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
