# shopify-pilot Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `openclaw-shopify` skill with a new `shopify-pilot` skill that is channel-agnostic, uses 3 env vars, and covers 8 use cases.

**Architecture:** Four files — a hub `SKILL.md` that routes to three reference files covering auth, use cases, and report delivery. No code, no tests — pure skill content authoring.

**Tech Stack:** Markdown skill files following the prompt-circle-skills conventions.

---

### Task 1: Create skill directory and SKILL.md

**Files:**
- Create: `skills/shopify-pilot/SKILL.md`

**Step 1: Create the directory**

```bash
mkdir -p skills/shopify-pilot/references
```

**Step 2: Write SKILL.md**

```markdown
---
name: shopify-pilot
description: >
  Connect OpenClaw to the Shopify Admin API and run agent-driven store workflows.
  Covers authentication setup (client credentials grant), token management, and
  eight ready-to-run use cases: PDP rewrite, weekly store digest, competitive
  intelligence, abandoned cart recovery, flash sale planner, low stock alert,
  customer VIP report, and product launch prep. Use this skill when the user asks
  about connecting OpenClaw to Shopify, automating any Shopify store task, setting
  up Shopify API credentials, or running any of the eight use cases.
---

# Shopify Pilot

Connect OpenClaw to your Shopify store and run agent-driven workflows from any
channel — Slack, Telegram, or Discord.

Reference files:
- `references/auth.md` — API auth, 3 env vars, token helper, scope table
- `references/use-cases.md` — All 8 use cases with prompts and expected outputs
- `references/report-server.md` — How to serve HTML reports from your OpenClaw host

---

## Architecture

```
You (Slack / Telegram / Discord)
        ↓
   OpenClaw Agent
        ↓
  Shopify Admin API
        ↓
  HTML Report (optional)
        ↓
  Link posted back to your channel
```

---

## Quick Start Checklist

**1. Set 3 environment variables**
```
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
```

**2. Verify auth works**
Run the token check in `references/auth.md`. A successful response returns a
`shpat_...` token. `401` = wrong credentials. `403` = missing scope.

**3. Grant the right scopes for your use case**

| Use case | Required scopes |
|---|---|
| PDP Rewrite | `read_products`, `write_products` |
| Weekly Digest | `read_orders`, `read_products`, `read_inventory` |
| Competitive Intel | `read_products`, `read_price_rules` |
| Abandoned Cart Recovery | `read_checkouts`, `read_customers` |
| Flash Sale Planner | `read_products`, `read_inventory`, `write_price_rules`, `write_discounts` |
| Low Stock Alert | `read_inventory`, `read_products` |
| Customer VIP Report | `read_customers`, `read_orders` |
| Product Launch Prep | `read_products`, `write_products`, `read_inventory` |

**4. Register the report route (for use cases that generate HTML output)**
See `references/report-server.md`.

---

## Use Case Routing

| You say... | Run |
|---|---|
| "rewrite my product description" / "improve my PDP" | UC1 — PDP Rewrite |
| "weekly digest" / "how did my store do" / "Monday briefing" | UC2 — Weekly Digest |
| "check my competitors" / "pricing gaps" / "what should I charge" | UC3 — Competitive Intel |
| "abandoned carts" / "recover lost sales" / "cart recovery" | UC4 — Abandoned Cart Recovery |
| "flash sale" / "move slow stock" / "run a promo" | UC5 — Flash Sale Planner |
| "low stock" / "what needs restocking" / "inventory alert" | UC6 — Low Stock Alert |
| "top customers" / "VIP list" / "who spends the most" | UC7 — Customer VIP Report |
| "launch this product" / "is this ready to publish" / "product checklist" | UC8 — Product Launch Prep |

---

## Token Lifecycle

Shopify access tokens expire after **24 hours**. Request a fresh token at the
start of each workflow run — never reuse a token across days. See
`references/auth.md` for the token helper.

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Wrong client ID or secret | Check env vars against Shopify Dev Dashboard |
| `403 Forbidden` | Missing API scope | Add scope in Dev Dashboard, reinstall app |
| `404 on /reports/` | Report route not registered | See `references/report-server.md` |
| `Token expired` | Token older than 24h | Request a new token — see `references/auth.md` |
| Empty product list | Wrong store domain | Confirm `SHOPIFY_STORE_DOMAIN` in your env |
```

**Step 3: Commit**

```bash
git add skills/shopify-pilot/SKILL.md
git commit -m "feat: add shopify-pilot skill hub"
```

---

### Task 2: Write references/auth.md

**Files:**
- Create: `skills/shopify-pilot/references/auth.md`

**Step 1: Write the file**

```markdown
# Shopify API Authentication

## Overview

Shopify uses the **client credentials grant** for apps built in the Dev Dashboard
and installed on stores you own. No browser redirect, no user consent screen —
you generate a short-lived access token programmatically.

**Constraints:**
- Only works for apps you developed AND stores you own
- Tokens expire after 24 hours — request a fresh one each session
- For apps serving other merchants, use managed OAuth instead

---

## Environment Setup

Add these three variables to your OpenClaw environment:

```env
SHOPIFY_CLIENT_ID=your_client_id_here
SHOPIFY_CLIENT_SECRET=your_client_secret_here
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
```

Where to find them:
1. Go to partners.shopify.com → Apps → your app
2. Client ID and Client Secret are in the "App credentials" section
3. Store domain is your `.myshopify.com` URL — not your custom domain

---

## Requesting an Access Token

### curl (quick test)

```bash
curl -X POST "https://$SHOPIFY_STORE_DOMAIN/admin/oauth/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$SHOPIFY_CLIENT_ID" \
  --data-urlencode "client_secret=$SHOPIFY_CLIENT_SECRET"
```

Successful response:
```json
{
  "access_token": "shpat_xxxxxxxxxxxxxxxxxxxx",
  "scope": "read_products,write_products,read_orders",
  "expires_in": 86399
}
```

### Python helper

Drop this into your OpenClaw agent code:

```python
import os
import requests
from datetime import datetime, timedelta

_token_cache = {"token": None, "expires_at": None}

def get_shopify_token() -> str:
    now = datetime.utcnow()
    if (
        _token_cache["token"]
        and _token_cache["expires_at"]
        and now < _token_cache["expires_at"] - timedelta(minutes=5)
    ):
        return _token_cache["token"]

    store_domain = os.environ["SHOPIFY_STORE_DOMAIN"]
    response = requests.post(
        f"https://{store_domain}/admin/oauth/access_token",
        data={
            "grant_type": "client_credentials",
            "client_id": os.environ["SHOPIFY_CLIENT_ID"],
            "client_secret": os.environ["SHOPIFY_CLIENT_SECRET"],
        },
    )
    response.raise_for_status()
    data = response.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + timedelta(seconds=data["expires_in"])
    return _token_cache["token"]


def shopify_headers() -> dict:
    return {
        "X-Shopify-Access-Token": get_shopify_token(),
        "Content-Type": "application/json",
    }
```

### Usage

```python
store = os.environ["SHOPIFY_STORE_DOMAIN"]
headers = shopify_headers()

products = requests.get(
    f"https://{store}/admin/api/2024-01/products.json",
    headers=headers
).json()["products"]
```

---

## Full Scope Reference

Add scopes in Dev Dashboard → your app → Configuration → Scopes.
After adding scopes you must reinstall the app on your store.

| Scope | Used by |
|---|---|
| `read_products` | UC1, UC2, UC3, UC5, UC6, UC8 |
| `write_products` | UC1, UC8 |
| `read_orders` | UC2, UC7 |
| `read_inventory` | UC2, UC5, UC6, UC8 |
| `write_inventory` | UC6 (optional — for reorder workflows) |
| `read_customers` | UC4, UC7 |
| `read_checkouts` | UC4 |
| `read_price_rules` | UC3 |
| `write_price_rules` | UC5 |
| `read_discounts` | UC5 |
| `write_discounts` | UC5 |

---

## Verifying Your Setup

```bash
curl -s -X POST \
  "https://$SHOPIFY_STORE_DOMAIN/admin/oauth/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$SHOPIFY_CLIENT_ID" \
  --data-urlencode "client_secret=$SHOPIFY_CLIENT_SECRET" \
  | python3 -m json.tool
```

- `access_token` starts with `shpat_` → working
- `{"error":"invalid_client"}` → wrong client ID or secret
- `{"error":"invalid_scope"}` → scope mismatch — check app config
```

**Step 2: Commit**

```bash
git add skills/shopify-pilot/references/auth.md
git commit -m "feat: add shopify-pilot auth reference"
```

---

### Task 3: Write references/use-cases.md

**Files:**
- Create: `skills/shopify-pilot/references/use-cases.md`

**Step 1: Write the file**

```markdown
# Shopify Pilot — Use Case Reference

Eight production-ready workflows. Each ends with a channel message,
an HTML report link, or both.

---

## UC1 — PDP Rewrite (Competitive-Backed)

### What it does
1. Fetches current product description from Shopify
2. Researches top-ranking competitor listings for the same product type
3. Extracts what makes those listings effective (keywords, structure, hooks)
4. Rewrites the description using those insights and your brand voice
5. Pushes the updated description back to Shopify
6. Posts before/after summary to your channel

### API calls
```python
GET  /admin/api/2024-01/products/{product_id}.json
PUT  /admin/api/2024-01/products/{product_id}.json
     body: { "product": { "id": id, "body_html": "<p>New description</p>" } }
```

### Prompt
```
Look up the top 5 Shopify/Amazon listings for "[your product name]".
Identify what makes their product descriptions effective —
keywords used, structure, emotional hooks, length.
Then rewrite my current product description for [product URL or paste description]
using those insights. Keep my brand voice but optimise for SEO and conversion.
Show me: current description, competitor insights, new description.
Then push the new description to Shopify.
```

### Expected output
```
✅ PDP Rewrite complete — [Product Name]

📋 Current description: [2-3 line summary]

🔍 Competitor insights:
• Top listings use: [keyword 1], [keyword 2], [keyword 3]
• Average length: ~180 words
• Common hooks: benefit-first opening, social proof, sensory language

✨ New description pushed to Shopify:
[First 2 sentences of new description]...

📊 SEO improvements: title keyword moved to line 1, added 3 long-tail
terms, increased from 45 to 167 words.
```

---

## UC2 — Weekly Store Digest

### What it does
1. Pulls 7 days of orders, revenue, products, refunds, inventory
2. Synthesises a narrative Monday briefing
3. Identifies one "watch item" — something actionable today
4. Generates a formatted HTML report
5. Posts link to your channel

### API calls
```python
GET /admin/api/2024-01/orders.json?status=any&created_at_min={7_days_ago}
GET /admin/api/2024-01/products.json?limit=250
GET /admin/api/2024-01/inventory_levels.json?limit=250
GET /admin/api/2024-01/orders.json?status=any&financial_status=refunded
    &created_at_min={7_days_ago}
```

### Prompt
```
Pull my Shopify store data for the last 7 days and give me a Monday morning digest.
Include: total revenue and % change vs last week, number of orders and AOV,
top 3 products by revenue, any product with 0 sales this week,
refund rate, and one "watch item" — something I should act on today.
Then save the full report as HTML and post the link.
```

### Expected output
```
📊 Weekly Digest — [Date Range]

💰 Revenue: $4,240 (+18% vs last week)
📦 Orders: 87 · AOV: $48.74
⭐ Top products: Midnight Matte Lip Set ($1,100), Glow Serum ($890), Tinted SPF ($640)
⚠️  0 sales this week: Hydra Mist Toner, Rose Hip Oil
🔄 Refund rate: 2.3% (normal range)

👀 Watch item: Hydra Mist Toner has had 0 sales for 14 days.
   Consider a 15% promo or featured placement.

📄 Full report → https://YOUR_OPENCLAW_HOST/reports/digest-2026-03-17.html
```

---

## UC3 — Competitive Intelligence + Pricing Gaps

### What it does
1. Takes a product category and optional competitor names/URLs
2. Searches the web for competitor pricing, variants, and review scores
3. Pulls your current Shopify catalog and pricing
4. Identifies where you can raise prices and catalog gaps to fill
5. Generates a pricing comparison HTML report
6. Posts link to your channel

### API calls
```python
GET /admin/api/2024-01/products.json?limit=250
GET /admin/api/2024-01/price_rules.json
```

### Prompt
```
I sell [product category] on Shopify. Research my top 5 competitors:
[list names or URLs, or say "find them"].
For each competitor pull: price range, product variants offered,
average review score, and any obvious gaps in their catalog.
Compare against my current pricing and catalog.
Then give me:
(1) products where I can raise my price without losing customers,
(2) catalog gaps I could fill,
(3) a pricing comparison table.
Save as HTML and send me the link.
```

### Expected output
```
🔍 Competitive Analysis — [Product Category]

Researched: Brand A, Brand B, Brand C, Brand D, Brand E

💡 Price raise opportunities (3 found):
• Glow Serum: you charge $34, competitors avg $41 → raise to $38
• Tinted SPF: you charge $28, market rate $35 → raise to $32

🕳️  Catalog gaps (2 found):
• No overnight mask — all 5 competitors carry one
• No travel-size SKUs — 3 competitors offer them, high review scores

📊 Full pricing comparison → https://YOUR_OPENCLAW_HOST/reports/competitive-intel-2026-03-17.html
```

---

## UC4 — Abandoned Cart Recovery

### What it does
1. Pulls checkouts abandoned more than 1 hour ago with no completed order
2. Segments by cart value (high / medium)
3. Drafts personalised recovery messages per segment
4. Posts draft messages for your review before sending

### API calls
```python
GET /admin/api/2024-01/checkouts.json?status=open&created_at_max={1_hour_ago}
GET /admin/api/2024-01/customers/{customer_id}.json
```

### Prompt
```
Find all abandoned Shopify carts from the last 24 hours worth more than $20.
Group them by cart value: high ($100+) and medium ($20–99).
For each group, draft a short recovery message I could send —
personalised with the customer's first name and the specific products
they left behind. Show me the drafts before sending anything.
```

### Expected output
```
🛒 Abandoned Carts — Last 24 Hours

Found: 12 open checkouts (8 medium, 4 high-value)

💎 High-value drafts (4 carts, avg $142):
---
Hi Sarah, you left something behind — your Glow Serum + Midnight Lip Set
are still waiting. Grab them before they sell out: [link]
---

📦 Medium-value drafts (8 carts, avg $54):
---
Hey James, your cart misses you. Complete your order today: [link]
---

Reply "send" to push these, or paste edits first.
```

---

## UC5 — Flash Sale Planner

### What it does
1. Identifies products with low sell-through rate over the past 30 days
2. Suggests discount percentage based on margin headroom and age
3. Creates a Shopify price rule and discount code with expiry
4. Posts the live discount code to your channel

### API calls
```python
GET /admin/api/2024-01/products.json?limit=250
GET /admin/api/2024-01/orders.json?status=any&created_at_min={30_days_ago}
GET /admin/api/2024-01/inventory_levels.json?limit=250
POST /admin/api/2024-01/price_rules.json
POST /admin/api/2024-01/price_rules/{id}/discount_codes.json
```

### Prompt
```
Find products in my Shopify store that haven't sold well in the last 30 days
and have more than 10 units in stock. Suggest a flash sale discount for each —
aim to clear stock without going below 20% margin.
Create a discount code for the top 3 candidates, valid for 48 hours.
Show me what you created.
```

### Expected output
```
⚡ Flash Sale — 3 discount codes created

1. Hydra Mist Toner — 25% off → FLASH-MIST25 (expires 48h)
   Stock: 34 units · Last sold: 18 days ago · Est. margin at sale price: 28%

2. Rose Hip Oil — 20% off → FLASH-ROSE20 (expires 48h)
   Stock: 22 units · Last sold: 21 days ago · Est. margin: 31%

3. Vitamin C Eye Cream — 15% off → FLASH-EYE15 (expires 48h)
   Stock: 19 units · Last sold: 16 days ago · Est. margin: 35%

Codes are live in Shopify. Share them when ready.
```

---

## UC6 — Low Stock Alert

### What it does
1. Pulls inventory levels across all products and variants
2. Flags any SKU below a configurable threshold (default: 10 units)
3. Groups by urgency: critical (≤3), warning (4–10)
4. Suggests reorder quantities based on 30-day sales velocity

### API calls
```python
GET /admin/api/2024-01/inventory_levels.json?limit=250
GET /admin/api/2024-01/products.json?limit=250
GET /admin/api/2024-01/orders.json?status=any&created_at_min={30_days_ago}
```

### Prompt
```
Check my Shopify inventory and flag anything running low.
Use a threshold of 10 units. Group by urgency: critical (3 or fewer),
warning (4–10). For each item, tell me how many days of stock I have left
based on recent sales, and suggest how many units to reorder.
```

### Expected output
```
📦 Inventory Alert — [Date]

🔴 Critical (≤3 units):
• Glow Serum 30ml — 2 units left · ~3 days of stock · Reorder: 60 units
• Midnight Lip Set — 1 unit left · ~1 day of stock · Reorder: 40 units

🟡 Warning (4–10 units):
• Tinted SPF 50ml — 7 units left · ~9 days of stock · Reorder: 30 units
• Vitamin C Serum — 5 units left · ~7 days of stock · Reorder: 25 units

4 SKUs need attention. Reorder the critical ones today.
```

---

## UC7 — Customer VIP Report

### What it does
1. Pulls all customers ordered by lifetime value
2. Identifies top 10% by spend and purchase frequency
3. Flags high-value customers who haven't ordered in 60+ days (at-risk)
4. Suggests loyalty actions per segment
5. Generates HTML report

### API calls
```python
GET /admin/api/2024-01/customers.json?order=total_spent+desc&limit=250
GET /admin/api/2024-01/orders.json?status=any&created_at_min={90_days_ago}
```

### Prompt
```
Pull my Shopify customer data and give me a VIP report.
Show me: top 10 customers by lifetime spend, any VIP customers
who haven't ordered in 60+ days (at-risk), and a one-line
suggested action for each at-risk customer.
Save as HTML and send me the link.
```

### Expected output
```
👑 Customer VIP Report — [Date]

Top 10 by lifetime spend:
1. Sarah M. — $2,840 · 14 orders · last order 8 days ago
2. James T. — $1,990 · 9 orders · last order 22 days ago
...

⚠️  At-risk VIPs (high spend, 60+ days inactive):
• Emma R. — $1,450 LTV · last order 73 days ago
  → Suggest: personal re-engagement with 15% loyalty code

📄 Full report → https://YOUR_OPENCLAW_HOST/reports/vip-report-2026-03-17.html
```

---

## UC8 — Product Launch Prep

### What it does
1. Validates a product is ready to go live: title, description, images, price, inventory
2. Flags missing or weak fields with specific fixes
3. Checks for SEO basics: meta description, URL handle, alt text on images
4. Gives a go / no-go verdict with a prioritised fix list

### API calls
```python
GET /admin/api/2024-01/products/{product_id}.json
GET /admin/api/2024-01/inventory_levels.json?inventory_item_ids={item_id}
```

### Prompt
```
I'm about to publish [product name or ID] on my Shopify store.
Run a pre-launch checklist on it. Check: title (clear and keyword-rich?),
description (complete, benefit-led, right length?), images (present, alt text set?),
price (set, variant pricing consistent?), inventory (stock > 0?),
SEO fields (meta description, URL handle).
Give me a go / no-go verdict and a prioritised fix list.
```

### Expected output
```
🚀 Product Launch Checklist — Glow Serum 30ml

✅ Title: clear, contains primary keyword
✅ Price: $34.00 set across all variants
✅ Inventory: 45 units in stock
⚠️  Description: 38 words — too short, recommend 150+ words
❌ Images: 2 images, no alt text set on either
⚠️  Meta description: missing — Shopify will default to truncated body

Verdict: NO-GO — fix 2 blockers before publishing

Priority fixes:
1. Add alt text to both images (5 min)
2. Expand description to 150+ words with benefit-led copy (15 min)
3. Add meta description (3 min)
```

---

## Chaining Use Cases

**UC3 → UC1 (find underpriced product, justify the new price):**
```
Run a competitive analysis for my [product category]. Find the product where
I'm most underpriced. Rewrite its description to match premium positioning,
then update both the description and price in Shopify. Show me everything.
```

**UC6 → UC5 (restock alert triggers flash sale to clear old stock first):**
```
Check my inventory for low stock. Before I reorder, identify any slow-moving
variants of those same products that I should clear with a flash sale first.
Create discount codes for those, then tell me what to reorder.
```
```

**Step 2: Commit**

```bash
git add skills/shopify-pilot/references/use-cases.md
git commit -m "feat: add shopify-pilot use cases reference (8 use cases)"
```

---

### Task 4: Write references/report-server.md

**Files:**
- Create: `skills/shopify-pilot/references/report-server.md`

**Step 1: Write the file**

```markdown
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
    _reports[filename] = html
    host = os.environ.get("OPENCLAW_PUBLIC_URL", "https://YOUR_OPENCLAW_HOST")
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
    _reports[filename] = html
    host = os.environ.get("OPENCLAW_PUBLIC_URL", "https://YOUR_OPENCLAW_HOST")
    return f"{host}/reports/{filename}"
```

---

## Report Filename Convention

Use a timestamped slug for unique, readable URLs:

```python
from datetime import datetime

def report_filename(prefix: str) -> str:
    date = datetime.utcnow().strftime("%Y-%m-%d")
    return f"{prefix}-{date}.html"

# Examples:
# report_filename("digest")      → "digest-2026-03-17.html"
# report_filename("vip-report")  → "vip-report-2026-03-17.html"
# report_filename("competitive") → "competitive-2026-03-17.html"
```

---

## Storage Options

### In-memory (default — fine for personal use)

Reports live in a Python dict. Zero config, fast.

Caveat: reports disappear when the process restarts. For personal or demo
use this is fine. For shared team use, prefer disk storage.

### Disk storage (recommended for production)

```python
import os

REPORTS_DIR = os.environ.get("REPORTS_DIR", "/data/reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

def save_report(filename: str, html: str) -> str:
    path = os.path.join(REPORTS_DIR, filename)
    with open(path, "w") as f:
        f.write(html)
    host = os.environ.get("OPENCLAW_PUBLIC_URL", "https://YOUR_OPENCLAW_HOST")
    return f"{host}/reports/{filename}"

@app.get("/reports/{filename}", response_class=HTMLResponse)
async def serve_report(filename: str):
    path = os.path.join(REPORTS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not found")
    with open(path) as f:
        return HTMLResponse(content=f.read())
```

Set `REPORTS_DIR` in your env and ensure the path is on persistent storage.
On Fly.io this means a mounted Volume; on Render/Railway use a persistent disk.

---

## Testing Your Route

```bash
# Should return 404 (correct — no report saved yet)
curl -I https://YOUR_OPENCLAW_HOST/reports/test.html

# If you get connection refused: your app's port or public URL is misconfigured
```

---

## Environment Variable

Add this to your OpenClaw env so report URLs point to the right host:

```
OPENCLAW_PUBLIC_URL=https://your-openclaw-host.example.com
```
```

**Step 2: Commit**

```bash
git add skills/shopify-pilot/references/report-server.md
git commit -m "feat: add shopify-pilot report server reference"
```

---

### Task 5: Remove old openclaw-shopify skill and update registry

**Files:**
- Delete: `skills/openclaw-shopify/` (entire directory)
- Modify: `skills/` index or registry if one exists

**Step 1: Check for a registry file**

```bash
ls skills/
cat skills/README.md 2>/dev/null || echo "no readme"
```

**Step 2: Remove old skill**

```bash
rm -rf skills/openclaw-shopify
```

**Step 3: Verify new skill is in place**

```bash
ls skills/shopify-pilot/
ls skills/shopify-pilot/references/
```

Expected:
```
SKILL.md  references/
auth.md  report-server.md  use-cases.md
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: replace openclaw-shopify with shopify-pilot skill"
```

---

### Task 6: Package into zip

**Step 1: Create the zip**

```bash
cd /Users/ugochukwuosuji/Youtube/prompt-circle-skills
mkdir -p packages/shopify-pilot
cd skills && zip -r ../packages/shopify-pilot/shopify-pilot-skill.zip shopify-pilot/
```

**Step 2: Verify contents**

```bash
unzip -l packages/shopify-pilot/shopify-pilot-skill.zip
```

Expected: 4 files — `SKILL.md`, `references/auth.md`, `references/use-cases.md`, `references/report-server.md`

**Step 3: Commit**

```bash
git add packages/shopify-pilot/
git commit -m "feat: package shopify-pilot skill zip"
```
