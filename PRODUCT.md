# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Developers integrating eFaas** (primary). They build apps that sign in through eFaas, the Maldives national SSO, and run neFaas locally or in CI instead of the real developer environment. They set up clients, pick test users, and sign in over and over while building and debugging auth flows.
- **People demoing to clients.** neFaas stands in for real eFaas during stakeholder demos, so the sign-in experience is seen by non-developers.

## Product Purpose

neFaas is a mock eFaas OIDC server that follows the eFaas integration spec (v2.2) as closely as possible: the same endpoints, scopes, claims, and authorization flows. It exists so teams can build and test eFaas sign-in without the real developer environment. Success means an app that works against neFaas works against real eFaas, and that setting it up needs no configuration.

## Positioning

A faithful local stand-in for the official eFaas service. It ships with the real eFaas developer test accounts and their real claims, validates registered clients the way eFaas does, and is managed entirely from its own home page with zero config.

## Operating Context

- Runs on a developer's machine (`bun src/index.ts` or Docker) or in CI; opened in a desktop browser next to the app being built.
- The home page is a working tool: Overview, Endpoints, Clients, Users, Settings. Users are searched and edited, clients registered, settings toggled.
- The login page is what the integrating app's users (and demo audiences) see during sign-in.
- State (clients, users, settings, signing key) is saved to `.nefaas/state.json`.

## Capabilities and Constraints

- Authorization code + PKCE, hybrid, refresh, client credentials, one-tap login, end session with back/front-channel single sign-out, check_session iframe.
- 161 seeded users from `docs/eFaas_Developer_Test_Accounts_v1.10.xlsx`; full user editor (names in English and Dhivehi, addresses, passport, verification).
- Lenient mode by default (unregistered clients skip checks); strict mode on the Settings tab.
- Stack: Bun + Hono, server-rendered HTML with inline CSS and vanilla JS; no frontend framework or build step.

## Brand Commitments

- The neFaas logo and wordmark (`assets/nefaas_logo_blue.svg`, `assets/nefaas_logo.svg`).
- eFaas blue (`#12469a` / logo `#174898`) as the brand color.
- The login page keeps resembling the real eFaas login, so integrators see what their users will see.
- The tab structure Overview / Endpoints / Clients / Users / Settings stays the main navigation.
- Must not: look like a generic SaaS admin dashboard, drift away from feeling connected to the official eFaas service, adopt a dark hacker/terminal aesthetic, or turn playful (mascots, jokes, decorative illustration).

## Evidence on Hand

- eFaas integration spec: `docs/eFaas-SSO integration v2.2.pdf`, `docs/EFAAS_SPEC_V2.md`.
- Real test-account data: `src/data/users.json`, spreadsheet in `docs/`.
- No testimonials, adoption numbers or official endorsement exist; never imply neFaas is an official NCIT product.

## Product Principles

1. Fidelity to real eFaas over convenience: if eFaas behaves a certain way, neFaas does too.
2. Zero config: everything a developer needs is reachable from the home page.
3. Honest about being a mock: always clearly labeled for development and testing.
4. Fast to operate: finding a user, a client, or an endpoint takes seconds.

## Accessibility & Inclusion

- Dhivehi (Thaana, right-to-left) content appears in user data and must render correctly.
- WCAG 2.2 AA for the home page and login page.
