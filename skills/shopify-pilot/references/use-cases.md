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
1. Pulls 7 days of orders, revenue, products, refunds, and inventory
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

📄 Full report → https://your-openclaw-host.example.com/reports/digest-2026-03-17.html
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

📊 Full pricing comparison → https://your-openclaw-host.example.com/reports/competitive-intel-2026-03-17.html
```

---

## UC4 — Abandoned Cart Recovery

### What it does
1. Pulls checkouts abandoned more than 1 hour ago with no completed order
2. Segments by cart value: high ($100+) and medium ($20–$99)
3. Drafts personalised recovery messages per segment
4. Posts draft messages for your review before anything is sent

### API calls
```python
GET /admin/api/2024-01/checkouts.json?status=open&created_at_max={1_hour_ago}
GET /admin/api/2024-01/customers/{customer_id}.json
```

### Prompt
```
Find all abandoned Shopify carts from the last 24 hours worth more than $20.
Group them by cart value: high ($100+) and medium ($20–$99).
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
1. Identifies products with low sell-through over the past 30 days
2. Suggests discount percentages based on stock age and margin headroom
3. Creates Shopify price rules and discount codes with 48-hour expiry
4. Posts the live discount codes to your channel

### API calls
```python
GET  /admin/api/2024-01/products.json?limit=250
GET  /admin/api/2024-01/orders.json?status=any&created_at_min={30_days_ago}
GET  /admin/api/2024-01/inventory_levels.json?limit=250
GET  /admin/api/2024-01/price_rules.json
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
2. Flags SKUs below a configurable threshold (default: 10 units)
3. Groups by urgency: critical (≤3 units) and warning (4–10 units)
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
4. Suggests a loyalty action for each at-risk customer
5. Generates an HTML report

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

📄 Full report → https://your-openclaw-host.example.com/reports/vip-report-2026-03-17.html
```

---

## UC8 — Product Launch Prep

### What it does
1. Validates a product is ready to publish: title, description, images, price, inventory
2. Flags missing or weak fields with specific fixes
3. Checks SEO basics: meta description, URL handle, image alt text
4. Returns a go / no-go verdict with a prioritised fix list

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

**UC3 → UC1** — Find an underpriced product, then justify the higher price with a rewritten description:
```
Run a competitive analysis for my [product category]. Find the product where
I'm most underpriced. Rewrite its description to match premium positioning,
then update both the description and price in Shopify. Show me everything.
```

**UC6 → UC5** — Check inventory before reordering, clear slow stock with a flash sale first:
```
Check my inventory for low stock. Before I reorder, identify any slow-moving
variants of those same products I should clear with a flash sale first.
Create discount codes for those, then tell me what to reorder.
```
