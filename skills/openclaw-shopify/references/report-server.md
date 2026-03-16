# Report Server — Serving HTML Reports from Fly.io

## Overview

Since OpenClaw is hosted on Fly.io and already has a public URL
(`yourapp.fly.dev`), it can serve generated HTML reports directly from
its own server. No third-party hosting needed.

The pattern:
1. Agent generates HTML string
2. Saves it (in-memory or to Fly Volume)
3. Returns the public URL to Slack
4. User clicks link → report opens in browser

---

## Minimal Route Setup

Add this to your FastAPI or Flask app. This is all you need.

### FastAPI

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
import os

app = FastAPI()

# In-memory store: { "filename": "html_content" }
_reports: dict[str, str] = {}

@app.get("/reports/{filename}", response_class=HTMLResponse)
async def serve_report(filename: str):
    html = _reports.get(filename)
    if not html:
        raise HTTPException(status_code=404, detail="Report not found")
    return HTMLResponse(content=html)

def save_report(filename: str, html: str) -> str:
    """
    Saves an HTML report and returns its public URL.
    Call this from your agent after generating the HTML.
    """
    _reports[filename] = html
    domain = os.environ.get("FLY_APP_NAME", "openclaw")
    return f"https://{domain}.fly.dev/reports/{filename}"
```

### Flask

```python
from flask import Flask, abort

app = Flask(__name__)
_reports = {}

@app.route("/reports/<filename>")
def serve_report(filename):
    html = _reports.get(filename)
    if not html:
        abort(404)
    return html, 200, {"Content-Type": "text/html"}

def save_report(filename, html):
    _reports[filename] = html
    import os
    domain = os.environ.get("FLY_APP_NAME", "openclaw")
    return f"https://{domain}.fly.dev/reports/{filename}"
```

---

## Generating a Report Filename

Use a timestamped slug so each report has a unique, readable URL:

```python
from datetime import datetime

def report_filename(prefix: str) -> str:
    """
    Examples:
      report_filename("digest")   → "digest-2026-03-17.html"
      report_filename("pdp-rewrite") → "pdp-rewrite-2026-03-17.html"
      report_filename("competitive") → "competitive-2026-03-17.html"
    """
    date = datetime.utcnow().strftime("%Y-%m-%d")
    return f"{prefix}-{date}.html"
```

---

## Full Agent Flow Example

```python
from datetime import datetime

async def run_weekly_digest(store_domain: str) -> str:
    """
    Runs the weekly digest workflow.
    Returns the Slack message string including the report link.
    """
    # 1. Fetch data from Shopify
    headers = shopify_headers()
    orders = fetch_orders_last_7_days(headers, store_domain)
    products = fetch_products(headers, store_domain)

    # 2. Build narrative + metrics
    summary = synthesize_digest(orders, products)  # Your LLM call here

    # 3. Generate HTML report
    html = render_digest_html(summary)

    # 4. Save and get URL
    filename = report_filename("digest")
    report_url = save_report(filename, html)

    # 5. Return Slack message
    return f"""📊 Weekly Digest — {summary['date_range']}

💰 Revenue: ${summary['revenue']:,.0f} ({summary['revenue_change']:+.0f}% vs last week)
📦 Orders: {summary['order_count']} · AOV: ${summary['aov']:.2f}
⭐ Top products: {', '.join(summary['top_products'])}
👀 Watch item: {summary['watch_item']}

📄 Full report → {report_url}"""
```

---

## Persistence: In-Memory vs Fly Volumes

### In-memory (default, fine for demos)

Reports live in a Python dict. Fast, zero config.

**Caveat:** Reports disappear when the Fly machine restarts. For a video
demo this is fine — you control when it runs. For production, use a Volume.

### Fly Volume (persistent, recommended for production)

```bash
# Create a volume (3GB free on Fly)
fly volumes create reports_data --size 3 --region iad

# Mount it in fly.toml
[mounts]
  source = "reports_data"
  destination = "/data/reports"
```

Then write reports to disk instead of memory:

```python
import os

REPORTS_DIR = "/data/reports"
os.makedirs(REPORTS_DIR, exist_ok=True)

def save_report(filename: str, html: str) -> str:
    path = os.path.join(REPORTS_DIR, filename)
    with open(path, "w") as f:
        f.write(html)
    domain = os.environ.get("FLY_APP_NAME", "openclaw")
    return f"https://{domain}.fly.dev/reports/{filename}"

@app.get("/reports/{filename}", response_class=HTMLResponse)
async def serve_report(filename: str):
    path = os.path.join(REPORTS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not found")
    with open(path) as f:
        return HTMLResponse(content=f.read())
```

---

## Confirming Your Route is Live

After deploying, test with:

```bash
# Should return your HTML
curl -I https://yourapp.fly.dev/reports/test.html

# Expected: 404 (no report saved yet — that's correct)
# If you get connection refused: check fly.toml [services] section
```

Your `fly.toml` must expose port 8080 (or wherever your app listens):

```toml
[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
```
