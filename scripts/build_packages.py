#!/usr/bin/env python3
"""
Build skill packages from source directories.

This script creates zip packages for all skills and updates the manifest
with SHA256 checksums.

Usage:
    python3 scripts/build_packages.py [--dry-run]
    python3 scripts/build_packages.py --skill skill-name
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


@dataclass
class SkillConfig:
    """Configuration for a skill."""

    slug: str
    name: str
    version: str = "0.1.0"
    status: str = "draft"
    source_path: str = ""
    package_path: str = ""
    sha256: str = ""


@dataclass
class BuildOptions:
    """Build options."""

    dry_run: bool = False
    specific_skill: Optional[str] = None
    verbose: bool = False


def compute_sha256(file_path: Path, chunk_size: int = 8192) -> str:
    """Compute SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def build_zip(source_dir: Path, output_path: Path) -> Path:
    """Create a zip archive from a directory."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source_dir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source_dir))

    return output_path


def get_skill_name_from_slug(slug: str) -> str:
    """Convert a slug to a human-readable name."""
    return slug.replace("-", " ").title()


def extract_version_from_skill_md(skill_dir: Path) -> str:
    """Extract version from SKILL.md frontmatter."""
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return "0.1.0"

    with open(skill_md, "r") as f:
        content = f.read()

    # Try to find version in YAML frontmatter
    import re

    version_match = re.search(r"^version:\s*([\d.]+)", content, re.MULTILINE)
    if version_match:
        return version_match.group(1)

    return "0.1.0"


def load_existing_manifest(manifest_path: Path) -> dict:
    """Load existing manifest or return empty structure."""
    if manifest_path.exists():
        with open(manifest_path, "r") as f:
            return json.load(f)
    return {"generated_at": "", "skills": []}


def build_skill_package(
    skill_dir: Path,
    packages_dir: Path,
    options: BuildOptions,
) -> Optional[SkillConfig]:
    """Build a package for a single skill."""
    slug = skill_dir.name

    if options.specific_skill and slug != options.specific_skill:
        if options.verbose:
            print(f"Skipping {slug} (not matching {options.specific_skill})")
        return None

    # Check if SKILL.md exists
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        print(f"WARNING: {slug} has no SKILL.md, skipping")
        return None

    # Extract version
    version = extract_version_from_skill_md(skill_dir)

    # Build package
    package_dir = packages_dir / slug
    package_path = package_dir / f"{slug}-skill.zip"

    if options.dry_run:
        print(f"[DRY RUN] Would build package for {slug}")
        sha256 = ""
    else:
        if options.verbose:
            print(f"Building package for {slug}...")

        build_zip(skill_dir, package_path)
        sha256 = compute_sha256(package_path)

        if options.verbose:
            print(f"  Package: {package_path}")
            print(f"  SHA256: {sha256}")

    return SkillConfig(
        slug=slug,
        name=get_skill_name_from_slug(slug),
        version=version,
        status="draft",  # Default to draft; can be updated manually
        source_path=f"skills/{slug}",
        package_path=f"packages/{slug}/{slug}-skill.zip",
        sha256=sha256,
    )


def update_manifest(
    manifest_path: Path,
    skills: list[SkillConfig],
    options: BuildOptions,
) -> None:
    """Update the manifest with new skill information."""
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "skills": [],
    }

    # Build a map of existing skills by slug for merging
    existing_skills = {s.slug: s for s in skills}

    # Load existing manifest to preserve any skills not being rebuilt
    if manifest_path.exists():
        with open(manifest_path, "r") as f:
            old_manifest = json.load(f)
        for old_skill in old_manifest.get("skills", []):
            slug = old_skill.get("slug")
            if slug and slug not in existing_skills:
                # Preserve skills not being rebuilt
                manifest["skills"].append(old_skill)

    # Add new/updated skills
    for skill in skills:
        if skill:
            skill_dict = {
                "slug": skill.slug,
                "name": skill.name,
                "version": skill.version,
                "status": skill.status,
                "source_path": skill.source_path,
                "package_path": skill.package_path,
                "sha256": skill.sha256,
            }
            manifest["skills"].append(skill_dict)

    # Sort skills by slug
    manifest["skills"].sort(key=lambda x: x["slug"])

    if options.dry_run:
        print("[DRY RUN] Would update manifest:")
        print(json.dumps(manifest, indent=2))
    else:
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
        print(f"Updated manifest: {manifest_path}")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Build skill packages and update manifest"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--skill",
        type=str,
        default=None,
        help="Build only a specific skill",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show verbose output",
    )

    args = parser.parse_args()
    options = BuildOptions(
        dry_run=args.dry_run,
        specific_skill=args.skill,
        verbose=args.verbose,
    )

    # Paths
    repo_root = Path(__file__).parent.parent
    skills_dir = repo_root / "skills"
    packages_dir = repo_root / "packages"
    manifest_path = repo_root / "manifests" / "skills.json"

    if not skills_dir.exists():
        print(f"ERROR: Skills directory not found: {skills_dir}")
        return 1

    # Find all skill directories (exclude _shared)
    skill_dirs = [
        d for d in skills_dir.iterdir()
        if d.is_dir() and not d.name.startswith("_")
    ]

    if not skill_dirs:
        print(f"ERROR: No skills found in {skills_dir}")
        return 1

    if options.verbose:
        print(f"Found {len(skill_dirs)} skills to process")

    # Build packages
    built_skills: list[Optional[SkillConfig]] = []
    for skill_dir in sorted(skill_dirs):
        skill_config = build_skill_package(skill_dir, packages_dir, options)
        built_skills.append(skill_config)

    # Filter out None values
    built_skills = [s for s in built_skills if s is not None]

    if not built_skills:
        print("No skills were built")
        return 0

    # Update manifest
    update_manifest(manifest_path, built_skills, options)

    if not options.dry_run:
        print(f"\nSuccessfully built {len(built_skills)} skill packages")

    return 0


if __name__ == "__main__":
    sys.exit(main())
