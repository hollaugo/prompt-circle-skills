# Design: shopify-pilot Skill

**Date:** 2026-03-18
**Status:** Approved

## Summary

Redesign the `openclaw-shopify` skill into a generic, production-quality skill called `shopify-pilot` for OpenClaw users who already have OpenClaw running and want to connect it to Shopify.

## Goals

- Remove Slack-only and Fly.io-specific assumptions — work for any OpenClaw channel and any deployment
- Reduce env vars from 4 to 3 (drop redundant `SHOPIFY_API_KEY`)
- Rename skill to `shopify-pilot`
- Expand from 3 to 8 use cases

## Non-Goals

- OpenClaw setup/installation guidance (covered by `openclaw-manager`)
- Shopify storefront API (Admin API only)

## File Structure

```
skills/shopify-pilot/
  SKILL.md
  references/auth.md
  references/use-cases.md
  references/report-server.md
```

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

## Environment Variables (3 only)

```
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
```

`SHOPIFY_API_KEY` is dropped — identical to `CLIENT_ID`, adds confusion.

## Use Cases

| # | Name | Key scopes |
|---|---|---|
| UC1 | PDP Rewrite | `read_products`, `write_products` |
| UC2 | Weekly Store Digest | `read_orders`, `read_products`, `read_inventory` |
| UC3 | Competitive Intelligence | `read_products`, `read_price_rules` |
| UC4 | Abandoned Cart Recovery | `read_checkouts`, `read_customers` |
| UC5 | Flash Sale Planner | `read_products`, `read_inventory`, `write_price_rules`, `write_discounts` |
| UC6 | Low Stock Alert | `read_inventory`, `read_products` |
| UC7 | Customer VIP Report | `read_customers`, `read_orders` |
| UC8 | Product Launch Prep | `read_products`, `write_products`, `read_inventory` |

## Key Design Decisions

- **Channel-agnostic language**: All prompts and output examples use "your channel" not "Slack"
- **Hosting-agnostic report server**: `references/report-server.md` uses `YOUR_OPENCLAW_HOST` placeholder, mentions Fly.io as one option
- **Token helper**: Python helper in `auth.md` kept — it's correct and reusable
- **Scope table**: Consolidated master scope table in `auth.md` covering all 8 use cases
