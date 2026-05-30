"""
Environment variable utilities for Prompt Circle skills.

Provides consistent environment variable handling across all skill scripts.
"""

from __future__ import annotations

import os
from typing import Optional


class EnvironmentError(ValueError):
    """Raised when required environment variables are missing."""

    pass


def get_required_env(*names: str) -> str:
    """
    Get a required environment variable from multiple possible names.

    Args:
        *names: Environment variable names to check in order.

    Returns:
        The value of the first set environment variable.

    Raises:
        EnvironmentError: If none of the specified environment variables are set.

    Example:
        >>> token = get_required_env("NOTION_ACCESS_TOKEN", "NOTION_TOKEN")
    """
    for name in names:
        value = os.environ.get(name)
        if value:
            return value

    raise EnvironmentError(
        f"One of the following environment variables must be set: {', '.join(names)}"
    )


def get_optional_env(*names: str, default: Optional[str] = None) -> Optional[str]:
    """
    Get an optional environment variable from multiple possible names.

    Args:
        *names: Environment variable names to check in order.
        default: Default value to return if none are set.

    Returns:
        The value of the first set environment variable, or the default value.

    Example:
        >>> site_id = get_optional_env("NETLIFY_SITE_ID", default="")
    """
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return default
