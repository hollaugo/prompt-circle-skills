# Shopify API Authentication

## Overview

Shopify uses the **client credentials grant** for apps built in the Dev Dashboard
and installed on stores you own. No browser redirect, no user consent screen —
you generate a short-lived access token programmatically.

**Constraints:**
- Only works for apps you developed AND stores you own
- Tokens expire after 24 hours — the Python helper below handles renewal automatically
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
from datetime import datetime, timedelta, timezone

_token_cache = {"token": None, "expires_at": None}

def get_shopify_token() -> str:
    now = datetime.now(timezone.utc)
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

### Usage example

```python
store = os.environ["SHOPIFY_STORE_DOMAIN"]
headers = shopify_headers()

# Pin your API version — update when Shopify deprecates this release
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
| --- | --- |
| `read_products` | UC1, UC2, UC3, UC5, UC6, UC8 |
| `write_products` | UC1, UC8 |
| `read_orders` | UC2, UC7 |
| `read_inventory` | UC2, UC5, UC6, UC8 |
| `write_inventory` | UC6 (optional — for reorder workflows) |
| `read_customers` | UC4, UC7 |
| `read_checkouts` | UC4 |
| `read_price_rules` | UC3, UC5 |
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
