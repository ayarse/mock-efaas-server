---
name: neFaas
description: A mock eFaas sign-in server whose home page treats every test user as a security-printed identity document.
colors:
  efaas-blue: "#12469a"
  blue-deep: "#0c3170"
  blue-tint: "#e6edf7"
  security-paper: "#f3f6f5"
  surface: "#ffffff"
  line: "#d8dfe2"
  line-strong: "#b6c2c8"
  ink: "#14213d"
  ink-2: "#3b4759"
  ink-3: "#566273"
  verified-teal: "#1f6f75"
  verified-tint: "#e1f0ef"
  guilloche-teal: "#2f7f86"
  warn: "#8a5300"
  warn-tint: "#fbefd9"
  danger: "#b42318"
  danger-tint: "#fdecea"
  code-well: "#10213f"
typography:
  headline:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title-sm:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  body:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  label-caps:
    fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.04em"
  identifier:
    fontFamily: "OCR-B, ui-monospace, SF Mono, Cascadia Mono, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    letterSpacing: "0.04em"
  mrz:
    fontFamily: "OCR-B, ui-monospace, SF Mono, Cascadia Mono, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.1em"
  code:
    fontFamily: "ui-monospace, SF Mono, Cascadia Mono, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  pill: "999px"
  tag: "4px"
  sm: "8px"
  md: "12px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
    height: "36px"
  button-primary:
    backgroundColor: "{colors.efaas-blue}"
    textColor: "{colors.surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.blue-deep}"
    textColor: "{colors.surface}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-danger-hover:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger}"
  copy-button:
    textColor: "{colors.efaas-blue}"
    rounded: "6px"
    padding: "4px 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  badge:
    backgroundColor: "{colors.blue-tint}"
    textColor: "{colors.blue-deep}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  method-get:
    backgroundColor: "{colors.verified-tint}"
    textColor: "{colors.verified-teal}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  method-post:
    backgroundColor: "{colors.blue-tint}"
    textColor: "{colors.blue-deep}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.s5}"
  identity-card:
    backgroundColor: "{colors.security-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px 16px 0"
  navbar:
    backgroundColor: "{colors.efaas-blue}"
    textColor: "{colors.surface}"
    height: "64px"
    padding: "0 24px"
---

# Design System: neFaas

## Overview

**Creative North Star: "The Security-Printed Document"**

neFaas is set in the fine-line security print of Maldivian ID cards and passports. Every test user is an identity document: a card with a guilloche rosette, a photo slot, an OCR-B identifier, and a two-line machine-readable zone built from the user's real claims. Around those documents sits a working tool in plain daylight: an eFaas-blue top bar carrying a faint white guilloche band, a pale security-paper ground, and white work surfaces with hairline borders.

The system is quiet, light, and dense enough to operate quickly. The ornament lives in exactly two places, the top bar band and the identity cards, and is drawn as hairline line-work, never as illustration. Everything else is tables, definition lists, forms, and cards in the system sans. It rejects the stat-card SaaS admin dashboard, the dark terminal look, and anything playful; it stays visibly connected to the official eFaas service through the blue, the logo, and an eFaas-style login.

Three pages share the palette at different fidelity: the home page (the full system), the login page (kept close to the real eFaas login by brand commitment, sharing the blue and the paper ground), and the logged-out/error message pages (a single centered card with a blue top rule).

**Key Characteristics:**
- eFaas blue shell, white guilloche band at 14% opacity behind logo and tabs.
- Pale green-grey security paper ground; white surfaces with 1px hairline borders.
- Identity cards as the signature: rosette guilloche, OCR-B ID, MRZ strip, microprint line.
- OCR-B only for identifiers and the MRZ; the system sans for everything else.
- One status ramp (teal / amber / red) used for verified states, HTTP methods, and errors.
- Flat surfaces; shadow is reserved for the modal and the navbar's bottom hairline.

## Colors

A cool, paper-and-ink palette anchored by eFaas blue, with teal as the only second hue and a fixed status ramp.

### Primary
- **eFaas Blue** (efaas-blue): the brand. Fills the top bar, primary buttons, links, copy buttons, focus outlines, `accent-color` and `caret-color`, and the top rule of message pages.
- **Deep Blue** (blue-deep): hover for primary buttons; text on blue-tint chips, inline code and POST method tags; selection text.
- **Blue Tint** (blue-tint): user-type badges, inline code wells, copy-button hover, photo slot fill, text selection background.

### Secondary
- **Verified Teal** (verified-teal): the "ok" state. Verified users (table cell and the Verified value on identity cards) and GET method tags. Paired with **Verified Tint** (verified-tint) as its tag background.
- **Guilloche Teal** (guilloche-teal): ink for the rosette line-work on identity cards only, at 22% opacity. It is security print, not a state color.

### Tertiary (status)
- **Warn Amber** (warn) on **Warn Tint** (warn-tint): PUT method tags.
- **Danger Red** (danger) on **Danger Tint** (danger-tint): delete buttons, field errors, invalid-field borders, the error summary box, DELETE method tags.

### Neutral
- **Security Paper** (security-paper): the page ground on all three pages.
- **Surface** (surface): cards, the connect panel, tables, dialogs, inputs.
- **Line** (line): hairline borders on panels, table rules, definition list rules, footer rule.
- **Line Strong** (line-strong): input and button borders, identity card border, scrollbar thumb.
- **Ink** (ink): body text and headings. **Ink 2** (ink-2): field labels, definition terms, supporting text. **Ink 3** (ink-3): hints, subtitles, table header labels, footer, off states.
- **Code Well** (code-well): the dark block behind the quick-start command snippet, with pale blue text (#dfe8f5). The only dark surface in the system.

### Named Rules
**The One Ramp Rule.** Status colors come from one fixed ramp: teal for ok, amber for warn, red for danger, each with its tint. Method tags, verified states and errors all draw from it; no other status hues exist.

**The Two Teals Rule.** Verified Teal carries meaning (verified, GET); Guilloche Teal is decoration ink for the rosette. Never swap them: the verified state uses the darker teal so it reads as text at AA contrast.

## Typography

**Body Font:** Segoe UI (with system-ui, -apple-system, sans-serif)
**Identifier Font:** OCR-B, self-hosted from `assets/fonts/ocrb10.otf` via `@font-face` (falls back to the mono stack)
**Code Font:** ui-monospace, SF Mono, Cascadia Mono, Consolas, monospace

**Character:** A plain system sans does the work; OCR-B is the document's voice, appearing only where a real ID or passport would print machine-readable characters.

### Hierarchy
- **Headline** (700, 26px, 1.2, -0.015em): the one page title on Overview.
- **Title** (700, 22px, 1.25, -0.01em): tab section titles (Endpoints, Clients, Users, Settings). Subsection titles step down to 17px; panel and card headings to 16px; dialog headings to 18px.
- **Lead** (400, 16px, ink-2, max 64ch): the Overview introduction.
- **Body** (400, 15px, 1.5): page default. **Body small** (14px) for table cells, inputs, buttons and panel intros.
- **Label** (600, 13px, ink-2): field labels, legends, definition terms. Hints and subtitles are 13 to 14px in ink-3, capped at 72ch.
- **Table header** (600, 12px, uppercase, 0.04em): column labels in endpoint, client and user tables only.
- **Identifier** (OCR-B 400, 13 to 14px, 0.04em): ID numbers on identity cards and login IDs under names in the users table.
- **MRZ** (OCR-B 400, 14px, 1.4, 0.1em, preserved whitespace): the two-line machine-readable zone.
- **Microprint** (600, 9.5px, uppercase, 0.14em, ink-3): the single "neFaas test identity · not a real document" line under each MRZ.
- **Code** (mono 13px; 12.5px inline in hints): URLs, endpoint paths, client URIs, secrets.

### Named Rules
**The OCR-B Rule.** OCR-B is reserved for identifiers and the MRZ. Names, dates, verification values, labels and all other data use the sans; numeric values use `tabular-nums`.

**The Thaana Rule.** Dhivehi names render in their own line (`lang="dv"`, `direction: rtl`, `unicode-bidi: plaintext`) at 14px in ink-2, and are omitted entirely when the user has none. Never show an empty Dhivehi slot.

## Layout

A single centered column (max 1040px) under a sticky 64px top bar, padded 32px top, 24px sides, 48px bottom. Tabs are anchor links on the right of the bar; one panel shows at a time.

Spacing follows a 4px-based scale (s1 4px to s7 48px). Panels and cards pad at 24px; fields stack at 12px gaps; grids gap 12px by 16px.

- **Overview:** two columns (1.05fr / 1fr) at 24px gap: the "Connect your app" definition list on the left (term / value / copy button, rows ruled by hairlines), three stacked identity cards on the right.
- **Forms:** auto-fit grids of 260px (two-up) and 200px (three-up) minimum columns; checkbox choices in auto-fill 220px columns.
- **Settings:** auto-fit cards of 300px minimum.
- **Dialogs:** up to 780px wide, inset 16px from the viewport, with a sticky action bar at the bottom.

Responsive: below 860px the Overview collapses to one column. Below 640px the top bar wraps (logo above, tabs spread full width at 13px), content padding drops to 24px / 16px, table cells tighten to 12px sides, the definition list stacks term above value, and low-priority columns hide.

## Elevation & Depth

Flat by default. Depth comes from tone (paper ground, white surface) and 1px hairlines, not shadow.

### Shadow Vocabulary
- **Bar hairline** (`box-shadow: 0 1px 0 rgba(10, 30, 70, 0.4)`): the bottom edge of the blue top bar.
- **Modal** (`box-shadow: 0 24px 64px rgba(12, 32, 70, 0.28)`, backdrop `rgba(12, 32, 70, 0.45)`): dialogs only.

The login page carries its own lighter shadows (card `0 4px 24px rgba(0,0,0,0.08)`, dropdown `0 8px 24px rgba(0,0,0,0.12)`) as part of its eFaas-style look.

### Named Rules
**The Hairline Rule.** Surfaces on the home page separate by a 1px line, never by shadow. The only lift is a 1px rise on identity-card hover.

## Shapes

Gently rounded throughout: 12px on panels, cards, tables, identity cards and dialogs; 8px on buttons, inputs, fieldsets, details and the code well; 6px on copy buttons and the photo slot; 4px on method tags and inline code; full pills on badges. The active tab carries a 3px white underline with 3px top-rounded ends. Identity cards clip their rosette and run the MRZ strip edge to edge across the card's bottom, separated by a hairline.

## Components

### Buttons
Restrained and solid; one primary per area.
- **Shape:** 8px radius, 36px minimum height, 600 weight at 14px.
- **Default:** white with a line-strong border and ink text; hover tints to #f4f7f6 and darkens the border to ink-3.
- **Primary:** eFaas blue fill, white text; hover to deep blue.
- **Danger:** white with red text and a #f0b6b0 border; hover fills danger tint with a red border.
- **Icon:** 36px square for dialog close.
- **Copy:** borderless text button in blue (12px, 600) beside each connection value; hover fills blue tint.
- **Focus:** 3px outline in blue at 45% mix, 1px offset, border turns blue. Transitions are 120ms ease-out on background and border.

### Identity Card (signature)
A test user rendered as an ID document. A 64px photo column (blue-tint slot with a person silhouette) beside the fields: name (15px, 700, single line with ellipsis) with the user-type badge, optional Dhivehi name, then a three-column meta grid (1.4fr / 1fr / 1fr) of ID (OCR-B), Born, and Verified (verified teal when true). Below runs the MRZ strip on a 72% white wash with the microprint line. The background is a 135deg gradient from #fbfdfc to #eef5f3 under a guilloche rosette (14 offset rings, 0.7 stroke, guilloche teal at 22%) anchored top right. As a button it lifts 1px and turns its border blue on hover (160ms ease-out), with a 3px blue focus outline; in the editor preview it is static.

### Navigation
Sticky eFaas-blue bar, 64px tall, logo left (32px), tabs right. Tabs are 14px / 600 in white at 82%, full white on hover and when current, with a 3px white underline for the current tab. Focus shows a 2px white inset outline. A generated guilloche band (16 interleaved sine lines) fills the bar at 14% white.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** surface, on the paper ground.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px line.
- **Internal Padding:** 24px (16px on small screens for the connect panel).

### Tables
White, 12px-rounded, hairline-ruled. Header row on #f8faf9 with uppercase 12px ink-3 labels; cells 10px by 16px at 14px; row hover tints to #f9fbfa. User rows stack name (600) over the OCR-B login ID. Row actions are compact buttons (13px, 30px tall) aligned right.

### Chips and Tags
- **Badge:** pill, blue tint with deep blue text, 12px / 600 (11px inside identity cards). Marks user type.
- **Method tag:** 4px radius, mono 11px / 700, 0.04em. GET teal, POST blue, PUT amber, DELETE red, each on its tint.

### Inputs / Fields
- **Style:** white, 1px line-strong border, 8px radius, 8px by 10px padding at 14px. Textareas use the mono stack at 13px.
- **Focus:** shared blue outline treatment with buttons.
- **Error:** 2px red border on `aria-invalid`, 13px red error text, and a red-bordered danger-tint error summary at the top of the form.
- **Disabled:** #eef2f1 fill, ink-3 text.

### Message Pages
Logged-out and error pages: one centered white card (48px padding, 12px radius, line border, 6px eFaas-blue top rule, max 560px) on the paper ground, with a blue 24px heading. Notices use amber (#92400e text on #fef3c7, #fcd34d border).

### Login Page
Kept close to the real eFaas login: white header bar with the logo, a centered 420px white card with a soft shadow, an amber "mock" banner, underline tabs in eFaas blue, full-width blue sign-in button, and a searchable user combo box. It shares the blue, ink and paper ground with the home page but keeps its own gray scale and 10px/6px radii.

## Do's and Don'ts

### Do:
- **Do** set ID numbers and the MRZ in OCR-B, and every other value (names, dates, verification) in the system sans.
- **Do** use Verified Teal for verified and ok states, and the one status ramp for every status or method color.
- **Do** keep guilloche line-work to the top bar band and identity cards, drawn as hairline strokes in currentColor at low opacity.
- **Do** separate surfaces with 1px hairlines on the paper ground; reserve shadow for modals.
- **Do** give every identity card its MRZ strip and microprint line marking it a test identity.
- **Do** keep the login page resembling the real eFaas login, sharing eFaas blue.

### Don't:
- **Don't** build a stat-card SaaS admin dashboard, a dark terminal look, or anything playful (mascots, jokes, decorative illustration).
- **Don't** use OCR-B for names, labels, or body text.
- **Don't** use Guilloche Teal for meaning or Verified Teal for decoration.
- **Don't** add a small uppercase label above names or headings on identity cards.
- **Don't** render an empty Dhivehi line when a user has no Dhivehi name.
- **Don't** lay identity-card meta out as loose inline text; keep it on its three-column grid.
