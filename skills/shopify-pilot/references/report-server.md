# Report Server — Serving HTML Reports

## Overview

For use cases that generate HTML reports (UC2, UC3, UC7), the agent saves the
HTML to your OpenClaw host and returns a public URL to your channel.

No third-party hosting needed — OpenClaw serves reports directly from wherever
it's deployed.

```
Agent generates HTML → saves to OpenClaw host → posts link to your channel
```

---

## Minimal Route Setup

Add a `/reports/{filename}` route to your OpenClaw app.

### FastAPI

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
import os

app = FastAPI()
_reports: dict[str, str] = {}

@app.get("/reports/{filename}", response_class=HTMLResponse)
async def serve_report(filename: str):
    html = _reports.get(filename)
    if not html:
        raise HTTPException(status_code=404, detail="Report not found")
    return HTMLResponse(content=html)

def save_report(filename: str, html: str) -> str:
    """Saves an HTML report and returns its public URL."""
    _reports[filename] = html
    host = os.environ.get("OPENCLAW_PUBLIC_URL", "http://localhost:8080")
    return f"{host}/reports/{filename}"
```

### Flask

```python
from flask import Flask, abort
import os

app = Flask(__name__)
_reports = {}

@app.route("/reports/<filename>")
def serve_report(filename):
    html = _reports.get(filename)
    if not html:
        abort(404)
    return html, 200, {"Content-Type": "text/html"}

def save_report(filename, html):
    """Saves an HTML report and returns its public URL."""
    _reports[filename] = html
    host = os.environ.get("OPENCLAW_PUBLIC_URL", "http://localhost:8080")
    return f"{host}/reports/{filename}"
```

---

## Report Filename Convention

Use a timestamped slug for unique, readable URLs:

```python
from datetime import datetime, timezone

def report_filename(prefix: str) -> str:
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"{prefix}-{date}.html"

# Examples:
# report_filename("digest")      → "digest-2026-03-17.html"
# report_filename("vip-report")  → "vip-report-2026-03-17.html"
# report_filename("competitive") → "competitive-2026-03-17.html"
```

---

## Storage Options

### In-memory (default — fine for personal use)

Reports live in a Python dict. Zero config, instant.

**Caveat:** Reports disappear when the process restarts. For personal use
this is fine. For shared team use or production, use disk storage.

### Disk storage (recommended for production)

```python
import os

REPORTS_DIR = os.environ.get("REPORTS_DIR", "/data/reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

def save_report(filename: str, html: str) -> str:
    filename = os.path.basename(filename)  # prevent path traversal
    path = os.path.join(REPORTS_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    host = os.environ.get("OPENCLAW_PUBLIC_URL", "http://localhost:8080")
    return f"{host}/reports/{filename}"

@app.get("/reports/{filename}", response_class=HTMLResponse)
async def serve_report(filename: str):
    path = os.path.join(REPORTS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not found")
    with open(path, encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
```

Set `REPORTS_DIR` in your env and point it at persistent storage.

---

## Environment Variable

Add to your OpenClaw env so report URLs point to the right host:

```
OPENCLAW_PUBLIC_URL=https://your-openclaw-host.example.com
```

If not set, the helper defaults to `http://localhost:8080` — useful for local testing.

---

## Testing Your Route

After deploying, confirm the route is reachable:

```bash
# Expected: 404 (correct — no report saved yet)
curl -I https://your-openclaw-host.example.com/reports/test.html

# If you get connection refused: check your app's port config
```
