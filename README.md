# neFaas Mock OIDC Server

A mock [eFaas](https://efaas.gov.mv) (Maldives National Single Sign-On) server for local development and testing. Implements the full eFaas OpenID Connect spec including all scopes, claims, authorization flows, and a login UI.

## Quick Start

```bash
bun install
bun src/index.ts
```

Server starts at `http://localhost:8080`. Configure with environment variables:

```bash
PORT=9000 HOST=0.0.0.0 bun src/index.ts
```

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/.well-known/openid-configuration` | GET | OIDC Discovery Document |
| `/.well-known/jwks` | GET | JSON Web Key Set |
| `/connect/authorize` | GET | Authorization (redirects to login) |
| `/connect/token` | POST | Token exchange |
| `/connect/userinfo` | GET | User info claims |
| `/connect/endsession` | GET | Logout / end session |
| `/connect/revoke` | POST | Token revocation |
| `/connect/introspect` | POST | Token introspection |
| `/efaas/Account/Login` | GET/POST | Login page UI |
| `/user/photo` | GET | Mock user photo |

## Authorization Flows

### Hybrid Flow (server-side apps)

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

After login, the server returns an auto-submitting HTML form that POSTs `code`, `id_token`, and `state` to your `redirect_uri`.

### Authorization Code + PKCE (SPAs, mobile apps)

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

After login, redirects to `redirect_uri?code=...&state=...`.

### Token Exchange

```bash
curl -X POST http://localhost:8080/connect/token \
  -d "grant_type=authorization_code&code=AUTH_CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_SECRET&redirect_uri=https://yourapp.com/callback"
```

For PKCE, include `code_verifier` instead of `client_secret`.

### Refresh Tokens

Request `offline_access` scope to receive a refresh token, then:

```bash
curl -X POST http://localhost:8080/connect/token \
  -d "grant_type=refresh_token&refresh_token=REFRESH_TOKEN&client_id=YOUR_CLIENT_ID"
```

### User Info

```bash
curl http://localhost:8080/connect/userinfo \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## Scopes & Claims

| Scope | Claims |
|---|---|
| `openid` | `sub` |
| `efaas.profile` | `first_name`, `middle_name`, `last_name`, `first_name_dhivehi`, `middle_name_dhivehi`, `last_name_dhivehi`, `gender`, `idnumber`, `verified`, `verification_type`, `last_verified_date`, `user_type_description`, `updated_at` |
| `efaas.email` | `email` |
| `efaas.mobile` | `mobile`, `country_dialing_code` |
| `efaas.birthdate` | `birthdate` |
| `efaas.photo` | `photo` |
| `efaas.work_permit_status` | `is_workpermit_active` |
| `efaas.passport_number` | `passport` |
| `efaas.country` | `country_name`, `country_code`, `country_code_alpha3`, `country_dialing_code` |
| `efaas.permanent_address` | `permanent_address` (JSON string) |
| `offline_access` | Enables refresh tokens |
| `profile` | Legacy alias for `efaas.profile` |

## Mock Users

The login page shows selectable mock users. Any unrecognized input defaults to the first user.

| ID Number | Name | Type |
|---|---|---|
| `A000111` | Mariyam Ahmed Rasheed | Maldivian |
| `A098765` | Ahmed Ali | Maldivian |
| `WP941123` | James Wilson | Work Permit Holder |

## Integration Example

Point your OIDC client library at the mock server:

```
Authority / Issuer:  http://localhost:8080
Discovery URL:       http://localhost:8080/.well-known/openid-configuration
Client ID:           any-value-works
Client Secret:       any-value-works
```

### Next.js (next-auth)

```ts
providers: [
  {
    id: "efaas",
    name: "eFaas",
    type: "oidc",
    issuer: "http://localhost:8080",
    clientId: "my-app",
    clientSecret: "my-secret",
  },
]
```

### .NET

```csharp
services.AddAuthentication().AddOpenIdConnect("efaas", options =>
{
    options.Authority = "http://localhost:8080";
    options.ClientId = "my-app";
    options.ClientSecret = "my-secret";
    options.ResponseType = "code id_token";
    options.ResponseMode = "form_post";
});
```

## Full eFaas Spec

See [EFAAS_SPEC.md](./EFAAS_SPEC.md) for the complete eFaas SSO integration specification extracted from the official documentation.
