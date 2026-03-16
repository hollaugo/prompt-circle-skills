# OpenClaw × Shopify — Use Case Reference

Three production-ready use cases with full prompts, required API calls,
and expected output formats. Each is designed to be triggered live via Slack
and ends with either a Slack message or an HTML report link.

---

## UC1 — PDP Rewrite (Competitive-Backed)

### What it does
1. Takes the current product description from Shopify (or pasted by user)
2. Searches the web for top-ranking competitor listings for the same product type
3. Extracts what makes those listings effective (keywords, structure, hooks)
4. Rewrites the description using those insights + the store's brand voice
5. Pushes the new description back to Shopify via API
6. Shows before/after in Slack

### Shopify API calls required
```python
# Step 1: Fetch current product
GET /admin/api/2024-01/products/{product_id}.json

# Step 5: Push updated description
PUT /admin/api/2024-01/products/{product_id}.json
Body: {
  "product": {
    "id": product_id,
    "body_html": "<p>New SEO-optimized description here...</p>"
  }
}
```

### Slack prompt (type this live on camera)
```
Look up the top 5 Shopify/Amazon listings for "[your product name]".
Identify what makes their product descriptions effective —
keywords used, structure, emotional hooks, length.
Then rewrite my current product description for [product URL or paste description]
using those insights. Keep my brand voice but optimize for SEO and conversion.
Show me: current description, competitor insights, new description.
Then push the new description to Shopify.
```

### Expected Slack output structure
```
✅ PDP Rewrite complete — [Product Name]

📋 Current description: [2-3 line summary of what it said]

🔍 Competitor insights:
• Top listings use: [keyword 1], [keyword 2], [keyword 3]
• Average length: ~180 words
• Common hooks: benefit-first opening, social proof, sensory language

✨ New description pushed to Shopify:
[First 2 sentences of new description]...

📊 SEO improvements: title keyword moved to line 1, added 3 long-tail
terms, increased from 45 to 167 words.
```

### On-camera tip
Paste a genuinely weak product description into the prompt — the worse it is,
the more dramatic the before/after. Point out the competitor insights section
explicitly: "it actually went and looked at what's working for competitors
before rewriting — that's the difference from just asking ChatGPT to rewrite."

---

## UC2 — Weekly Store Digest (Reporting)

### What it does
1. Pulls 7 days of Shopify data: orders, revenue, products, refunds
2. Synthesizes it into a narrative Monday briefing
3. Identifies one "watch item" — something actionable
4. Generates a formatted HTML report
5. Saves it to the report server and posts the link to Slack

### Shopify API calls required
```python
# Orders for last 7 days
GET /admin/api/2024-01/orders.json?status=any&created_at_min={7_days_ago}

# Products (for zero-sales check)
GET /admin/api/2024-01/products.json?limit=250

# Inventory levels (for low stock)
GET /admin/api/2024-01/inventory_levels.json?limit=250

# Refunds (for refund rate)
GET /admin/api/2024-01/orders.json?status=any&financial_status=refunded
    &created_at_min={7_days_ago}
```

### Slack prompt (type this live on camera)
```
Pull my Shopify store data for the last 7 days and give me a Monday morning digest.
Include: total revenue and % change vs last week, number of orders and AOV,
top 3 products by revenue, any product with 0 sales this week,
refund rate, and one "watch item" — something I should act on today.
Format it clean for Slack. Then save the full report as HTML
and post the link back here.
```

### Expected Slack output structure
```
📊 Weekly Digest — [Date Range]

💰 Revenue: $4,240 (+18% vs last week)
📦 Orders: 87 · AOV: $48.74
⭐ Top products: Midnight Matte Lip Set ($1,100), Glow Serum ($890), Tinted SPF ($640)
⚠️  0 sales this week: Hydra Mist Toner, Rose Hip Oil
🔄 Refund rate: 2.3% (normal range)

👀 Watch item: Hydra Mist Toner has had 0 sales for 14 days.
   Consider a 15% promo or featured placement.

📄 Full report → https://openclaw.fly.dev/reports/digest-2026-03-17.html
```

### HTML report sections
The HTML report should include:
- Hero metric (revenue + % change) in large type at top
- Orders, AOV, new vs returning customers
- Product performance table (all products, sorted by revenue)
- Inventory alerts (low stock threshold: < 10 units)
- Refund breakdown by product
- Watch item callout box with recommended action

### On-camera tip
After the Slack message appears, click the HTML report link live — the browser
opening to a polished report is the payoff shot. Scroll to the "watch item"
section and say: "This is the thing dashboards don't do — it tells you what
to *act on*, not just what happened."

---

## UC3 — Competitive Intelligence + Pricing Gaps

### What it does
1. Takes a product category and optional list of competitor names/URLs
2. Searches the web for competitor pricing, product variants, and review scores
3. Pulls your current Shopify catalog and pricing
4. Compares and identifies: where you can raise prices, catalog gaps to fill
5. Generates a pricing comparison table in HTML
6. Posts link to Slack

### Shopify API calls required
```python
# Your current products and pricing
GET /admin/api/2024-01/products.json?limit=250
# Returns: title, variants[].price, variants[].inventory_quantity

# Current price rules / discounts
GET /admin/api/2024-01/price_rules.json
```

### Web research (agent runs autonomously)
The agent searches for each competitor using web search tools:
- `"{competitor name}" site:pricing OR "buy" "{product category}"`
- Scrapes product listing pages for price ranges and variant counts
- Checks review aggregators for average scores

### Slack prompt (type this live on camera)
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
Save as an HTML report and send me the link.
```

### Expected Slack output structure
```
🔍 Competitive Analysis — [Product Category]

Researched: Brand A, Brand B, Brand C, Brand D, Brand E

💡 Price raise opportunities (3 found):
• Glow Serum: you charge $34, competitors avg $41 → raise to $38
• Tinted SPF: you charge $28, market rate $35 → raise to $32
• Lip Set: you charge $22, comps range $25–$45 → raise to $27

🕳️  Catalog gaps (2 found):
• No overnight mask in your line — all 5 competitors carry one
• No travel-size SKUs — 3 competitors offer them, high review scores

📊 Full pricing comparison →
https://openclaw.fly.dev/reports/competitive-intel-2026-03-17.html
```

### HTML report sections
- Competitor summary table: name, price range, variant count, avg review
- Your catalog vs competitor catalog side-by-side
- Price gap visualization (your price vs market average per product)
- Recommended price changes with estimated revenue impact
- Catalog gap recommendations with competitor evidence

### On-camera tip
This prompt takes the longest — ~60–90 seconds while OpenClaw does web
research. Narrate through it: "It's hitting competitor sites right now,
pulling pricing data, cross-referencing with my catalog..."
The pricing comparison table in the HTML report is the hero visual.
Point to one specific recommendation: "Right here — it's saying I can
charge $4 more for my Glow Serum and still be below market. That's
found money."

---

## Chaining Use Cases

For advanced demos, chain UC1 after UC3:
1. UC3 identifies a product you're underpricing
2. UC1 rewrites its description to justify the higher price point
3. The agent pushes the new description AND updates the price in one flow

Combined prompt:
```
Run a competitive analysis for my [product category]. Find any products
where I can raise my price. For the top opportunity, rewrite the product
description to match the premium positioning, then update both the
description and price in Shopify. Show me everything.
```
