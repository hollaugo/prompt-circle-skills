"""Tests for shared utilities module."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

from skills._shared.env_utils import EnvironmentError, get_optional_env, get_required_env
from skills._shared.file_utils import build_zip, compute_sha256, ensure_directory
from skills._shared.http_utils import RequestError


class TestEnvUtils:
    """Tests for environment variable utilities."""

    def test_get_required_env_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test getting a required environment variable that exists."""
        monkeypatch.setenv("TEST_TOKEN", "test_value")
        result = get_required_env("TEST_TOKEN")
        assert result == "test_value"

    def test_get_required_env_multiple_names(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test getting a required environment variable from multiple names."""
        monkeypatch.setenv("TOKEN_B", "value_b")
        result = get_required_env("TOKEN_A", "TOKEN_B", "TOKEN_C")
        assert result == "value_b"

    def test_get_required_env_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test getting a required environment variable that doesn't exist."""
        monkeypatch.delenv("MISSING_TOKEN", raising=False)
        with pytest.raises(EnvironmentError) as exc_info:
            get_required_env("MISSING_TOKEN")
        assert "MISSING_TOKEN" in str(exc_info.value)

    def test_get_optional_env_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test getting an optional environment variable that exists."""
        monkeypatch.setenv("OPTIONAL_TOKEN", "optional_value")
        result = get_optional_env("OPTIONAL_TOKEN")
        assert result == "optional_value"

    def test_get_optional_env_missing_with_default(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test getting an optional environment variable with default."""
        monkeypatch.delenv("MISSING_OPTIONAL", raising=False)
        result = get_optional_env("MISSING_OPTIONAL", default="default_value")
        assert result == "default_value"

    def test_get_optional_env_missing_no_default(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test getting an optional environment variable without default."""
        monkeypatch.delenv("MISSING_OPTIONAL", raising=False)
        result = get_optional_env("MISSING_OPTIONAL")
        assert result is None


class TestFileUtils:
    """Tests for file utilities."""

    def test_compute_sha256(self) -> None:
        """Test SHA256 computation."""
        # Create a temporary file with known content
        with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
            f.write("test content")
            temp_path = Path(f.name)

        try:
            # Compute SHA256
            expected = "6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72"
            actual = compute_sha256(temp_path)
            assert actual == expected
        finally:
            temp_path.unlink()

    def test_build_zip(self) -> None:
        """Test zip file creation."""
        # Create a temporary directory with files
        with tempfile.TemporaryDirectory() as tmpdir:
            source_dir = Path(tmpdir) / "source"
            source_dir.mkdir()

            # Create test files
            (source_dir / "file1.txt").write_text("content1")
            (source_dir / "file2.txt").write_text("content2")
            subdir = source_dir / "subdir"
            subdir.mkdir()
            (subdir / "file3.txt").write_text("content3")

            # Build zip
            output_path = Path(tmpdir) / "test.zip"
            build_zip(source_dir, output_path)

            assert output_path.exists()

            # Verify zip contents
            import zipfile

            with zipfile.ZipFile(output_path, "r") as archive:
                names = archive.namelist()
                assert "file1.txt" in names
                assert "file2.txt" in names
                assert "subdir/file3.txt" in names

    def test_ensure_directory(self) -> None:
        """Test directory creation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            test_dir = Path(tmpdir) / "new" / "nested" / "dir"
            ensure_directory(test_dir)
            assert test_dir.exists()
            assert test_dir.is_dir()


class TestHttpUtils:
    """Tests for HTTP utilities."""

    def test_request_error_creation(self) -> None:
        """Test RequestError creation."""
        error = RequestError("Test error", status_code=404, response={"error": "not found"})
        assert str(error) == "Test error"
        assert error.status_code == 404
        assert error.response == {"error": "not found"}

    def test_request_error_no_optional(self) -> None:
        """Test RequestError without optional parameters."""
        error = RequestError("Simple error")
        assert str(error) == "Simple error"
        assert error.status_code is None
        assert error.response is None
