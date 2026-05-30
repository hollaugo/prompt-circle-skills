"""
HTTP utilities for Prompt Circle skills.

Provides consistent HTTP request handling across all skill scripts.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Optional


class RequestError(Exception):
    """Raised when an HTTP request fails."""

    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


def make_request(
    method: str,
    url: str,
    token: Optional[str] = None,
    body: Optional[bytes] = None,
    content_type: Optional[str] = None,
    timeout: int = 60,
    extra_headers: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    """
    Make an HTTP request with consistent error handling.

    Args:
        method: HTTP method (GET, POST, PUT, DELETE, etc.)
        url: The URL to request.
        token: Optional bearer token for Authorization header.
        body: Optional request body as bytes.
        content_type: Optional Content-Type header value.
        timeout: Request timeout in seconds.
        extra_headers: Additional headers to include.

    Returns:
        Parsed JSON response as a dictionary.

    Raises:
        RequestError: If the request fails or returns an error status.

    Example:
        >>> response = make_request(
        ...     method="GET",
        ...     url="https://api.notion.com/v1/pages",
        ...     token=os.environ["NOTION_TOKEN"],
        ...     timeout=30
        ... )
    """
    headers: dict[str, str] = {}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if content_type:
        headers["Content-Type"] = content_type

    if extra_headers:
        headers.update(extra_headers)

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
            if not raw:
                return {}

            try:
                return json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError as e:
                raise RequestError(
                    f"Failed to parse JSON response from {url}",
                    status_code=response.getcode(),
                ) from e

    except urllib.error.HTTPError as e:
        try:
            error_body = e.read().decode("utf-8")
            error_json = json.loads(error_body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            error_json = {}

        raise RequestError(
            f"HTTP {e.code}: {e.reason} - {url}",
            status_code=e.code,
            response=error_json,
        ) from e

    except urllib.error.URLError as e:
        raise RequestError(f"URL error: {e.reason} - {url}") from e

    except TimeoutError as e:
        raise RequestError(f"Request timeout after {timeout}s - {url}") from e
