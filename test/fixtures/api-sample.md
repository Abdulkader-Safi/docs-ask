---
title: Acme API reference
description: Endpoints, auth and errors for the Acme REST API.
tags: [api, rest]
---

Welcome to the **Acme API**. Use v2.1 of the API for all new work.
This page covers authentication, rate limits and errors.

# Authentication

All requests need a bearer token. Tokens expire after 60 minutes.

## Access tokens

Request a token with `POST /auth/token`. Send your client ID and secret.

```bash
curl -X POST https://api.acme.dev/auth/token \
  -d client_id=abc -d client_secret=xyz
```

## Refresh tokens

Call e.g. `POST /auth/refresh` before the access token expires. See docs/errors.md for 401s.

| Param | Type | Required | Description |
|-------|------|:--------:|-------------|
| `refresh_token` | string | yes | The token from the login response. |
| `scope` | string | no | Space separated scopes, e.g. `read write`. |
| `pipe` | string | no | Escaped \| pipe inside a cell |

### Examples

- Refresh on a 401 response.
- Refresh proactively 5 minutes before expiry.
  - Nested: use a mutex so only one refresh runs.
1. Numbered list right after (starts a new list).

> **Note:** refresh tokens are single use.

# Rate limits

Setext heading below
--------------------

You get 1,000 requests per hour. Headers: `X-RateLimit-Remaining`.

## Examples

Duplicate heading name on purpose. The slug should be `examples-1`.

<div align="center">raw html block</div>

    indented code block
    line two

***

Final paragraph after a thematic break.
