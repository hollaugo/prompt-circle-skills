# Shopify API Authentication — Client Credentials Grant

## Overview

For apps built in Shopify's Dev Dashboard and installed on stores you own,
authentication uses the **client credentials grant** — not the traditional
OAuth redirect flow used for third-party apps.

This means: no browser redirect, no user consent screen, no stored long-lived
token in the UI. You generate a short-lived access token programmatically using
your app's client ID and client secret.

**Important constraints:**
- This flow only works for apps you developed AND stores you own
- Tokens expire after 24 hours — request a fresh one each session
- For apps serving other merchants, use managed OAuth instead

---

## Environment Setup

Your `.env` file needs these four variables:

```env
SHOPIFY_CLIENT_ID=your_client_id_here
SHOPIFY_CLIENT_SECRET=your_client_secret_here
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
```

Where to find these values in Shopify:
1. Go to partners.shopify.com → Apps → your app
2. Client ID and Client Secret are in the "App credentials" section
3. API Key is the same as Client ID in most cases
4. Store domain is your myshopify.com URL (not your custom domain)

---

## Requesting an Access Token

### curl (for testing)

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

### Python helper (drop into your agent code)

```python
import os
import requests
from datetime import datetime, timedelta

_token_cache = {"token": None, "expires_at": None}

def get_shopify_token() -> str:
    """
    Returns a valid Shopify access token, requesting a new one if
    the cached token is expired or missing.
    """
    now = datetime.utcnow()

    # Return cached token if still valid (with 5 min buffer)
    if (
        _token_cache["token"]
        and _token_cache["expires_at"]
        and now < _token_cache["expires_at"] - timedelta(minutes=5)
    ):
        return _token_cache["token"]

    # Request a new token
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

    # Cache it
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + timedelta(seconds=data["expires_in"])

    return _token_cache["token"]


def shopify_headers() -> dict:
    """Returns headers dict ready to use in any Shopify API request."""
    return {
        "X-Shopify-Access-Token": get_shopify_token(),
        "Content-Type": "application/json",
    }
```

### Usage example

```python
import requests

store = os.environ["SHOPIFY_STORE_DOMAIN"]
headers = shopify_headers()

# Fetch all products
products = requests.get(
    f"https://{store}/admin/api/2024-01/products.json",
    headers=headers
).json()["products"]
```

---

## Required Scopes by Use Case

When setting up your app in the Dev Dashboard, grant at minimum:

| Scope | Required for |
|---|---|
| `read_products` | PDP rewrite, competitive intel, digest |
| `write_products` | PDP rewrite (to push the updated description back) |
| `read_orders` | Weekly digest (revenue, order count, AOV) |
| `read_inventory` | Weekly digest (low stock flags) |
| `read_customers` | Customer use cases (VIP, churn) |
| `read_checkouts` | Cart recovery (abandoned checkouts) |
| `read_price_rules` | Competitive intel (current pricing) |

Add scopes in Dev Dashboard → your app → Configuration → Scopes.
After adding scopes you must reinstall the app on your store for them to take effect.

---

## Verifying Your Setup

Run this one-liner to confirm everything is working:

```bash
curl -s -X POST \
  "https://$SHOPIFY_STORE_DOMAIN/admin/oauth/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$SHOPIFY_CLIENT_ID" \
  --data-urlencode "client_secret=$SHOPIFY_CLIENT_SECRET" \
  | python3 -m json.tool
```

Expected: JSON with `access_token` starting with `shpat_`
Got `{"error":"invalid_client"}`: wrong client ID or secret
Got `{"error":"invalid_scope"}`: scope mismatch — check app config

---

## Official Shopify References

- [Get API access tokens for Dev Dashboard apps](https://shopify.dev/apps/build/dev-dashboard/get-api-access-tokens)
- [Client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant)
- [About client secrets](https://shopify.dev/docs/apps/build/authentication-authorization/client-secrets)
