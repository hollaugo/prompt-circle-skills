"""
File utilities for Prompt Circle skills.

Provides file operations commonly used across skill scripts.
"""

from __future__ import annotations

import hashlib
import tempfile
import zipfile
from pathlib import Path
from typing import Optional


def compute_sha256(file_path: Path, chunk_size: int = 8192) -> str:
    """
    Compute the SHA256 hash of a file.

    Args:
        file_path: Path to the file to hash.
        chunk_size: Size of chunks to read at a time (default: 8192 bytes).

    Returns:
        Hexadecimal SHA256 hash string.

    Example:
        >>> hash_value = compute_sha256(Path("package.zip"))
    """
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def build_zip(source_dir: Path, output_path: Optional[Path] = None) -> Path:
    """
    Create a zip archive from a directory.

    Args:
        source_dir: Path to the directory to zip.
        output_path: Optional output path. If not provided, creates a temp file.

    Returns:
        Path to the created zip file.

    Example:
        >>> zip_path = build_zip(Path("site-output"))
    """
    if output_path is None:
        tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
        tmp.close()
        output_path = Path(tmp.name)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source_dir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source_dir))

    return output_path


def ensure_directory(path: Path) -> None:
    """
    Ensure a directory exists, creating it if necessary.

    Args:
        path: Path to the directory.

    Example:
        >>> ensure_directory(Path(".website-manager"))
    """
    path.mkdir(parents=True, exist_ok=True)
