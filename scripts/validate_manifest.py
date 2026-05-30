#!/usr/bin/env python3
"""
Validate the skills manifest against the filesystem.

This script checks that:
1. All skills in the manifest have corresponding source directories
2. All skills in the manifest have corresponding package files (if published)
3. All source directories have corresponding manifest entries
4. SHA256 checksums are valid (if packages exist)

Usage:
    python3 scripts/validate_manifest.py [--strict]
"""

from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ValidationIssue:
    """A validation issue found during checking."""

    severity: str  # "error" or "warning"
    skill_slug: str
    message: str


@dataclass
class ValidationResult:
    """Result of validation."""

    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        """Check if there are any errors."""
        return not any(issue.severity == "error" for issue in self.issues)

    @property
    def error_count(self) -> int:
        """Count of errors."""
        return sum(1 for issue in self.issues if issue.severity == "error")

    @property
    def warning_count(self) -> int:
        """Count of warnings."""
        return sum(1 for issue in self.issues if issue.severity == "warning")


def compute_sha256(file_path: Path, chunk_size: int = 8192) -> str:
    """Compute SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def validate_manifest(
    manifest_path: Path,
    skills_dir: Path,
    packages_dir: Path,
    strict: bool = False,
) -> ValidationResult:
    """Validate the manifest against the filesystem."""
    result = ValidationResult()

    # Load manifest
    if not manifest_path.exists():
        result.issues.append(
            ValidationIssue(
                severity="error",
                skill_slug="",
                message=f"Manifest file not found: {manifest_path}",
            )
        )
        return result

    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    manifest_skills = manifest.get("skills", [])

    # Build maps for quick lookup
    manifest_by_slug = {s["slug"]: s for s in manifest_skills}

    # Check 1: All manifest skills have source directories
    for skill in manifest_skills:
        slug = skill.get("slug", "")
        source_path = skill.get("source_path", "")

        if not source_path:
            if strict:
                result.issues.append(
                    ValidationIssue(
                        severity="error",
                        skill_slug=slug,
                        message="Missing source_path in manifest",
                    )
                )
            else:
                result.issues.append(
                    ValidationIssue(
                        severity="warning",
                        skill_slug=slug,
                        message="Missing source_path in manifest",
                    )
                )
            continue

        source_dir = Path(source_path)
        if not source_dir.exists():
            result.issues.append(
                ValidationIssue(
                    severity="error",
                    skill_slug=slug,
                    message=f"Source directory not found: {source_dir}",
                )
            )
        elif not (source_dir / "SKILL.md").exists():
            result.issues.append(
                ValidationIssue(
                    severity="error",
                    skill_slug=slug,
                    message=f"SKILL.md not found in source directory: {source_dir}",
                )
            )

    # Check 2: All manifest skills have valid packages (if published)
    for skill in manifest_skills:
        slug = skill.get("slug", "")
        status = skill.get("status", "")
        package_path = skill.get("package_path", "")
        manifest_sha256 = skill.get("sha256", "")

        # Only check packages for published skills
        if status != "published" and not package_path:
            continue

        if package_path:
            package_file = Path(package_path)
            if not package_file.exists():
                result.issues.append(
                    ValidationIssue(
                        severity="error",
                        skill_slug=slug,
                        message=f"Package file not found: {package_file}",
                    )
                )
            elif manifest_sha256:
                # Verify checksum
                actual_sha256 = compute_sha256(package_file)
                if actual_sha256 != manifest_sha256:
                    result.issues.append(
                        ValidationIssue(
                            severity="error",
                            skill_slug=slug,
                            message=f"SHA256 mismatch: expected {manifest_sha256}, got {actual_sha256}",
                        )
                    )

    # Check 3: All source directories have manifest entries
    for skill_dir in sorted(skills_dir.iterdir()):
        if not skill_dir.is_dir() or skill_dir.name.startswith("_"):
            continue

        slug = skill_dir.name
        if slug not in manifest_by_slug:
            result.issues.append(
                ValidationIssue(
                    severity="warning",
                    skill_slug=slug,
                    message=f"Source directory exists but not in manifest: {skill_dir}",
                )
            )

    # Check 4: All packages have manifest entries
    if packages_dir.exists():
        for package_dir in sorted(packages_dir.iterdir()):
            if not package_dir.is_dir():
                continue

            slug = package_dir.name
            if slug not in manifest_by_slug:
                result.issues.append(
                    ValidationIssue(
                        severity="warning",
                        skill_slug=slug,
                        message=f"Package directory exists but not in manifest: {package_dir}",
                    )
                )

    return result


def print_result(result: ValidationResult) -> None:
    """Print validation results."""
    if result.is_valid:
        print("✓ Manifest is valid")
    else:
        print(f"✗ Manifest has {result.error_count} error(s) and {result.warning_count} warning(s)")

    if result.issues:
        print("\nIssues:")
        for issue in result.issues:
            prefix = "ERROR" if issue.severity == "error" else "WARN"
            print(f"  [{prefix}] {issue.skill_slug or '<root>'}: {issue.message}")


def main() -> int:
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate the skills manifest"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as errors",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )

    args = parser.parse_args()

    # Paths
    repo_root = Path(__file__).parent.parent
    manifest_path = repo_root / "manifests" / "skills.json"
    skills_dir = repo_root / "skills"
    packages_dir = repo_root / "packages"

    result = validate_manifest(
        manifest_path=manifest_path,
        skills_dir=skills_dir,
        packages_dir=packages_dir,
        strict=args.strict,
    )

    if args.json:
        output = {
            "valid": result.is_valid,
            "error_count": result.error_count,
            "warning_count": result.warning_count,
            "issues": [
                {
                    "severity": issue.severity,
                    "skill_slug": issue.skill_slug,
                    "message": issue.message,
                }
                for issue in result.issues
            ],
        }
        print(json.dumps(output, indent=2))
    else:
        print_result(result)

    return 0 if result.is_valid else 1


if __name__ == "__main__":
    sys.exit(main())
