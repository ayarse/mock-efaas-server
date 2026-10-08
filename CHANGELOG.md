# efaas-mock-server

## 1.1.0

### Minor Changes

- d443ac7: Align with the eFaas integration spec v2.2 and make neFaas zero-config.

  - Validate registered clients (redirect URIs, scopes, grant types, PKCE for public clients, client secrets, post-logout redirect URIs), with lenient handling of unregistered clients unless strict mode is on.
  - Single sign-out: back-channel and front-channel logout tokens, shared eFaas sessions, and a working `check_session_iframe`.
  - Verify token signatures, expiry and revocation in userinfo, photo and introspection.
  - Manage clients, users and settings from the home page; everything is saved to `.nefaas/state.json`, including the signing key, so tokens survive restarts.
  - Seed users from the eFaas developer test accounts (v1.10) with their real claims.

- cde4cf0: Refresh the home page around the eFaas identity: a guilloche eFaas-blue header, a "Connect your app" panel with copy buttons, and test users shown as ID cards with an OCR-B machine-readable zone (also previewed live in the user editor). Verified status uses a consistent teal across cards and the Users table.
