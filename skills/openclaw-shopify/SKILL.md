---
name: openclaw-shopify
description: >
  Full setup and execution guide for running OpenClaw as a Shopify AI agent.
  Covers Shopify API authentication (client credentials grant), token management,
  and ready-to-run agent workflows for three core use cases: PDP rewrite with
  competitive research, weekly store digest with HTML report, and competitive
  intelligence with pricing gap analysis. Use this skill whenever the user asks
  about connecting an AI agent to Shopify, automating Shopify tasks, setting up
  Shopify API credentials, or running any of the three demo use cases. Also
  triggers for questions about OpenClaw + Shopify setup, Shopify access tokens,
  or agent-driven store management.
---

# OpenClaw × Shopify Skill

This skill covers everything needed to connect OpenClaw to Shopify and run the
three flagship use cases demonstrated in the Prompt Circle video series.

Read the reference files when you need detail on a specific area:
- `references/auth.md` — Shopify API auth, token flow, env setup
- `references/use-cases.md` — Full prompts + expected outputs for all 3 demos
- `references/report-server.md` — How OpenClaw serves HTML reports via Fly.io

---

## Architecture Overview

```
You (Slack) → OpenClaw (Fly.io) → Shopify API
                    ↓
             HTML Report Server
             openclaw.fly.dev/reports/
                    ↓
             Link posted back to Slack
```

OpenClaw receives prompts via Slack, calls the Shopify API with a short-lived
access token, generates results, optionally saves an HTML report to its own
report server, and posts the link back to the Slack channel.

---

## Quick Start Checklist

Before running any use case, verify these four things are in place.

**1. Environment variables set**
```
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
SHOPIFY_API_KEY=your_api_key
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
```

**2. Access token can be generated**
Run the auth check in `references/auth.md`. You should get back a `shpat_...`
token. If you get a 401, your client ID or secret is wrong. If you get a 403,
your app is missing the required scopes.

**3. Scopes cover your use cases**
| Use case | Required scopes |
|---|---|
| PDP rewrite | `read_products`, `write_products` |
| Weekly digest | `read_orders`, `read_products`, `read_inventory` |
| Competitive intelligence | `read_products`, `read_price_rules` |

**4. Report server route exists on Fly.io**
See `references/report-server.md`. The `/reports/{filename}` route must be
registered before any use case that generates an HTML output.

---

## Deciding Which Use Case to Run

| User says... | Run |
|---|---|
| "rewrite my product description" / "improve my PDP" | UC1 — PDP Rewrite |
| "weekly digest" / "how did my store do" / "Monday briefing" | UC2 — Reporting |
| "check my competitors" / "pricing gaps" / "what should I charge" | UC3 — Competitive Intel |

For full prompts, expected outputs, and on-camera tips for each use case,
read `references/use-cases.md`.

---

## Token Lifecycle

Shopify access tokens from the client credentials grant expire after **24 hours**.
OpenClaw must request a fresh token at the start of each session or workflow run.
Never cache a token across days. See `references/auth.md` for the full token
request flow and a Python helper function you can drop into your agent code.

---

## Common Errors

| Error | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` | Wrong client ID or secret | Check `.env` values against Dev Dashboard |
| `403 Forbidden` | Missing API scope | Add scope in Dev Dashboard, reinstall app |
| `404 on /reports/` | Route not registered | See `references/report-server.md` |
| `Token expired` | Token > 24h old | Request a new token — see `references/auth.md` |
| Empty product list | Wrong store domain | Confirm `SHOPIFY_STORE_DOMAIN` in `.env` |
