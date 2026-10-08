---
version: 1
slug: "src-views-home-html"
primary_target: "src/views/home.html"
related_targets: ["src/views/login.html","src/views/templates.ts"]
---

# Surface brief: neFaas home page (and login page)

Scope: the home page tool (Overview, Endpoints, Clients, Users, Settings) plus the login, logged-out and error pages. Visitor mode: Operate.

Audience and job: developers wiring an app to eFaas; occasionally a client demo. They copy connection details, find or edit a test user, register a client, flip a setting, and sign in repeatedly.

Constraints: keep the neFaas logo, eFaas blue, the eFaas-style login, and the five tabs. No generic SaaS dashboard, no dark terminal look, nothing playful. Light theme: daylight offices and projector demos.

## Direction contract

THESIS: Every test user is an identity document. neFaas is set in the fine-line security print of Maldivian ID cards and passports, refusing the stat-card admin dashboard.

OWN-WORLD: eFaas blue #12469a shell carrying a white guilloche band; pale security-paper ground #f3f6f5; white work surfaces; ink #14213d; security teal #2f7f86 for verified/ok; one fixed status ramp. Identifiers set in an OCR-style uppercase monospace, everything else in the system sans.

STORY: The visitor sees how to connect their app, recognises the test identities as real documents, and gets to the user, client or setting they need in one click.

FIRST VIEWPORT: Blue top bar, logo left, tabs right, guilloche band behind. Overview: left, "Connect your app" definition list (issuer, discovery, client ID, secret, redirect URI, password), each with a copy button; right, three ID-card previews (one per user type) with guilloche field, English and Dhivehi names, ID number and a two-line MRZ strip, each opening that user. Signature move: claims rendered as a machine-readable zone.

FORM: Identity document, my top-ranked grounded candidate (pick card), seed key 6dab85d3.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
