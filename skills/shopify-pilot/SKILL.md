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

Connect OpenClaw to your Shopify store and run agent-driven workflows from any channel.

Reference files:
- `references/auth.md` — API auth, 3 env vars, token helper, scope table
- `references/use-cases.md` — All 8 use cases with prompts and expected outputs
- `references/report-server.md` — How to serve HTML reports from your OpenClaw host

---

## Architecture

```
You (any channel)
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
