# Authorization Flows

## Hybrid Flow (default eFaas flow for server-side apps)

The hybrid flow is the standard eFaas integration pattern. It uses `response_type=code id_token` with `response_mode=form_post` to deliver both an authorization code and an ID token directly to your server via a POST callback.

```
GET /connect/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://yourapp.com/callback&
  response_type=code id_token&
  response_mode=form_post&
  scope=openid efaas.profile efaas.email&
  nonce=RANDOM_NONCE&
  state=RANDOM_STATE
```

```mermaid
sequenceDiagram
    participant App as Your App
    participant Browser
    participant neFaas as neFaas Server

    App->>Browser: Redirect to /connect/authorize
    Browser->>neFaas: GET /connect/authorize?response_type=code id_token&...
    neFaas->>Browser: 302 Redirect to /efaas/Account/Login
    Browser->>neFaas: GET /efaas/Account/Login
    neFaas->>Browser: Login page HTML
    Browser->>neFaas: POST /efaas/Account/Login (username + hidden params)
    neFaas->>neFaas: Authenticate user, generate code + id_token
    neFaas->>Browser: Auto-submitting HTML form (form_post)
    Browser->>App: POST redirect_uri with code, id_token, state
    App->>neFaas: POST /connect/token (grant_type=authorization_code, code, client_secret)
    neFaas->>App: { access_token, id_token, refresh_token? }
    App->>neFaas: GET /connect/userinfo (Bearer access_token)
    neFaas->>App: { sub, first_name, email, ... }
```

The hybrid flow delivers the `id_token` immediately in the callback, so your app can verify the user's identity without a round-trip to the token endpoint. The `code` can then be exchanged for an `access_token` to call the userinfo endpoint.

## Authorization Code Flow + PKCE (SPAs, mobile apps)

The pure authorization code flow with PKCE is recommended for public clients (SPAs, mobile apps) that cannot securely store a client secret.

```
GET /connect/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://yourapp.com/callback&
  response_type=code&
  scope=openid efaas.profile&
  state=RANDOM_STATE&
  code_challenge=BASE64URL_SHA256_HASH&
  code_challenge_method=S256
```

```mermaid
sequenceDiagram
    participant App as Your App (SPA)
    participant Browser
    participant neFaas as neFaas Server

    App->>App: Generate code_verifier + code_challenge (S256)
    App->>Browser: Redirect to /connect/authorize
    Browser->>neFaas: GET /connect/authorize?response_type=code&code_challenge=...
    neFaas->>Browser: 302 Redirect to /efaas/Account/Login
    Browser->>neFaas: GET /efaas/Account/Login
    neFaas->>Browser: Login page HTML
    Browser->>neFaas: POST /efaas/Account/Login (username + hidden params)
    neFaas->>neFaas: Authenticate user, generate code (store code_challenge)
    neFaas->>Browser: 302 Redirect to redirect_uri?code=...&state=...
    Browser->>App: GET redirect_uri?code=...&state=...
    App->>neFaas: POST /connect/token (code, code_verifier, no client_secret)
    neFaas->>neFaas: Verify SHA256(code_verifier) == stored code_challenge
    neFaas->>App: { access_token, id_token }
    App->>neFaas: GET /connect/userinfo (Bearer access_token)
    neFaas->>App: { sub, first_name, email, ... }
```

PKCE replaces the client secret: the `code_verifier` proves that the same client that initiated the flow is exchanging the code.

## Implicit Flow (legacy)

Tokens are returned directly from the authorization endpoint with no code exchange step. Supported for backwards compatibility but not recommended.

```
GET /connect/authorize?
  response_type=id_token token&
  response_mode=form_post&
  ...
```

```mermaid
sequenceDiagram
    participant App as Your App
    participant Browser
    participant neFaas as neFaas Server

    App->>Browser: Redirect to /connect/authorize
    Browser->>neFaas: GET /connect/authorize?response_type=id_token token&...
    neFaas->>Browser: 302 Redirect to /efaas/Account/Login
    Browser->>neFaas: GET /efaas/Account/Login
    neFaas->>Browser: Login page HTML
    Browser->>neFaas: POST /efaas/Account/Login (username + hidden params)
    neFaas->>neFaas: Authenticate user, build access_token + id_token directly
    neFaas->>Browser: Auto-submitting HTML form (form_post)
    Browser->>App: POST redirect_uri with access_token, id_token, state
    Note over App: No token endpoint call needed
```

Supported `response_type` values: `token`, `id_token`, `id_token token`.

## Client Credentials Flow (machine-to-machine)

For server-to-server authentication where no user is involved. Requires a registered client with `client_credentials` in its `allowed_grant_types`.

```mermaid
sequenceDiagram
    participant Client as Your Server
    participant neFaas as neFaas Server

    Client->>neFaas: POST /connect/token (grant_type=client_credentials, client_id, client_secret)
    neFaas->>neFaas: Validate client_secret, check allowed_grant_types
    neFaas->>Client: { access_token, token_type: "Bearer", expires_in: 3600 }
    Note over Client: No id_token or refresh_token issued
```

Register a client first via the mock admin API:

```bash
curl -X POST http://localhost:36445/mock/clients \
  -H "Content-Type: application/json" \
  -d '{"client_id":"my-service","client_secret":"secret","allowed_grant_types":["client_credentials"]}'
```

## Refresh Token Flow

Request the `offline_access` scope to receive a refresh token. neFaas uses **token rotation** — each refresh issues a new refresh token and invalidates the old one.

```mermaid
sequenceDiagram
    participant App as Your App
    participant neFaas as neFaas Server

    Note over App: Initial auth with scope=offline_access
    App->>neFaas: POST /connect/token (grant_type=authorization_code, code)
    neFaas->>App: { access_token, id_token, refresh_token_1 }

    Note over App: Later, when access_token expires...
    App->>neFaas: POST /connect/token (grant_type=refresh_token, refresh_token_1)
    neFaas->>neFaas: Delete refresh_token_1 (one-time use)
    neFaas->>App: { access_token (new), refresh_token_2 (new) }

    Note over App: Use refresh_token_2 for the next refresh
```

```bash
curl -X POST http://localhost:36445/connect/token \
  -d "grant_type=refresh_token&refresh_token=REFRESH_TOKEN&client_id=YOUR_CLIENT_ID"
```

## One-Tap Login Flow (headless testing)

A mock-only flow for automated testing that bypasses the login UI. Generate a one-tap code, then pass it via `acr_values` to skip the login page entirely.

```mermaid
sequenceDiagram
    participant Test as Test Suite
    participant neFaas as neFaas Server
    participant Browser

    Test->>neFaas: POST /mock/one-tap-codes { "user_sub": "uuid" }
    neFaas->>Test: { "efaas_login_code": "CODE" }

    Test->>Browser: Redirect to /connect/authorize?acr_values=efaas_login_code:CODE&...
    Browser->>neFaas: GET /connect/authorize?acr_values=efaas_login_code:CODE&...
    neFaas->>neFaas: Validate one-tap code, delete (one-time use)
    neFaas->>neFaas: Authenticate user directly, generate auth code
    Note over neFaas: Login page is skipped entirely
    neFaas->>Browser: Redirect to redirect_uri with code (+ id_token if hybrid)
    Browser->>Test: Callback with code/tokens
```

## UserInfo

```bash
curl http://localhost:36445/connect/userinfo \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Returns claims filtered by the scopes granted during authorization.

## Token Revocation & Introspection

```mermaid
sequenceDiagram
    participant App as Your App
    participant neFaas as neFaas Server

    Note over App: Revoke a token
    App->>neFaas: POST /connect/revocation (token, token_type_hint)
    neFaas->>App: 200 OK (always succeeds per RFC 7009)

    Note over App: Check if a token is still valid
    App->>neFaas: POST /connect/introspect (token, token_type_hint)
    neFaas->>App: { active: true/false, sub, client_id, scope, exp }
```

## End Session (Logout)

```mermaid
sequenceDiagram
    participant App as Your App
    participant Browser
    participant neFaas as neFaas Server

    App->>Browser: Redirect to /connect/endsession
    Browser->>neFaas: GET /connect/endsession?post_logout_redirect_uri=...&state=...
    neFaas->>Browser: "Logged Out" page with auto-redirect
    Browser->>App: Redirect to post_logout_redirect_uri?state=...
```
