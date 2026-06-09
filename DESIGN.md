---
name: SP AirDee Design System
description: Clean, high-contrast, slate-blue design system for professional air conditioning services.
colors:
  primary: "#1e40af"
  accent: "#0284c7"
  neutral-bg: "#ffffff"
  neutral-surface: "#f8fafc"
  neutral-border: "#e2e8f0"
  ink: "#0f172a"
  ink-muted: "#475569"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "#1e3a8a"
  card:
    backgroundColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "20px"
---

# Design System: SP AirDee

## 1. Overview

**Creative North Star: "The Cool Breeze Ledger"**

A crisp, high-contrast visual design system designed specifically for administrative and on-site operational efficiency in air conditioning services. The primary focus of this design system is functional utility: clean screens, clear type sizing, and strict contrast to ensure the app is highly usable on desktop in the shop and on mobile under direct sunlight on site.

This system rejects low-contrast decorative text, soft cream/beige backgrounds, and unnecessary visual nesting. Layout density is kept clean and structured.

**Key Characteristics:**
- **High-Contrast Slate and Pure White**: Direct legibility with deep slate ink on pure white.
- **Precise Hierarchy**: No fluid type scaling; text sizes are stable to ensure consistent layout boundaries.
- **Familiar Controls**: Native form and modal layouts with clear state indicators (hover, focus, disabled).

## 2. Colors

A Restrained color strategy where a primary slate blue handles actions, and neutrals define surfaces, ensuring that status changes (accent blue/green/red) are immediately visible.

### Primary
- **Slate Blue** (#1e40af / oklch(0.45 0.15 250.0)): Used for primary action buttons, active sidebar icons, and core brand identifiers.

### Accent
- **Ice Blue** (#0284c7 / oklch(0.60 0.14 210.0)): Used for links, current selection highlights, and subtle accent boundaries.

### Neutral
- **Pure White** (#ffffff / oklch(1.000 0.000 0)): The default layout background. Ensures maximum contrast.
- **Slate White** (#f8fafc / oklch(0.98 0.005 250.0)): Sidebar, panel, and card backgrounds to establish structure.
- **Cool Gray Border** (#e2e8f0 / oklch(0.92 0.01 250.0)): Standard container borders, tab dividers, and table borders.
- **Deep Slate Ink** (#0f172a / oklch(0.15 0.02 250.0)): Primary body text and headers.
- **Muted Slate Gray** (#475569 / oklch(0.45 0.02 250.0)): Secondary descriptions, placeholder text, and timestamps.

### Named Rules
**The Restrained Surface Rule.** The primary background remains pure white. Tonal nesting is limited to one level deep using Slate White (#f8fafc) for sidebars/panels. Secondary cards are flat with a simple border, never stacked.

## 3. Typography

**Display Font:** system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
**Body Font:** system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif

**Character:** Clean, readable geometric sans-serif system fonts that perform perfectly across iOS, Android, and Windows systems with maximum rendering speed.

### Hierarchy
- **Display** (Bold (700), 2rem (32px), line-height 1.15): Used for main page headers (e.g. Dashboard Title, Customer Name).
- **Headline** (Semibold (600), 1.5rem (24px), line-height 1.2): Used for primary section titles.
- **Title** (Semibold (600), 1.25rem (20px), line-height 1.25): Used for card headings and subsection titles.
- **Body** (Regular (400), 1rem (16px), line-height 1.5): Used for tabular records, notes, description text, capped at 75ch.
- **Label** (Medium (500), 0.875rem (14px), line-height 1.2): Used for form labels, table column headers, and small badges.

## 4. Elevation

Depth is conveyed through clean borders and subtle color layering, avoiding heavy fuzzy shadows that can cause visual muddying under sunlight.

### Shadow Vocabulary
- **Ambient Low** (`box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08)`): Used for hovering/active card states and input active states.
- **Overlay Drop** (`box-shadow: 0 12px 24px -4px rgba(15, 23, 42, 0.12)`): Used exclusively for modals and dropdown menus.

### Named Rules
**The Border-First Rule.** Depth is established first by borders (Cool Gray Border) and background color changes. Shadows are secondary and are applied only to floating overlays (like modals and dropdowns) or as interactive hover feedback.

## 5. Components

### Buttons
- **Shape:** Soft square (6px radius)
- **Primary:** Background `#1e40af`, text `#ffffff`, padding `10px 18px`
- **Hover / Focus:** Background `#1e3a8a` on hover. Focus adds a 2px offset border outline with color `#0284c7`.
- **Secondary:** Background `#ffffff`, border `1px solid #e2e8f0`, text `#0f172a`, hover background `#f8fafc`.

### Chips / Badges
- **Style:** Background `#f1f5f9`, text `#475569`, border-radius `9999px` (fully rounded), padding `4px 10px`, typography Label.
- **Status Pills:** 
  - *Completed/Success:* Background `#dcfce7` (oklch(0.96 0.06 140)), text `#15803d` (oklch(0.50 0.11 140)).
  - *Pending/Warning:* Background `#fef9c3` (oklch(0.97 0.06 90)), text `#a16207` (oklch(0.52 0.10 80)).
  - *Alert/Overdue:* Background `#fee2e2` (oklch(0.94 0.05 25)), text `#b91c1c` (oklch(0.48 0.14 25)).

### Cards / Containers
- **Corner Style:** Rounded (10px radius)
- **Background:** Pure White (`#ffffff`) at rest, Slate White (`#f8fafc`) for panels.
- **Border:** `1px solid #e2e8f0`
- **Internal Padding:** 16px to 24px depending on screen width.

### Inputs / Fields
- **Style:** Stroke `1px solid #cbd5e1`, background `#ffffff`, radius `6px`, padding `10px 14px`.
- **Focus:** Outline `2px solid #0284c7`, outline-offset `0`.

### Navigation
- **Sidebar (Desktop):** Slate White `#f8fafc` background, right border `1px solid #e2e8f0`. Active items have a solid Slate Blue `#1e40af` text and matching icon with a light blue `#f0f9ff` highlight background.
- **Bottom Navigation (Mobile):** Pure White `#ffffff` background with top border `1px solid #e2e8f0`. Touch target height is at least 48px.

## 6. Do's and Don'ts

### Do:
- **Do** maintain a minimum contrast of 4.5:1 (ideally 7:1) for all body text against the background.
- **Do** check mobile responsive layouts down to 320px viewport width, collapsing tables to card lists.
- **Do** use native dialogs or explicit backdrop-overlay overlays for modals.
- **Do** make all primary action buttons consistent across all modules (Customers, Services, Appointments).

### Don't:
- **Don't** use warm cream/beige backgrounds (`#faf7f2` or similar) as the default layout.
- **Don't** use side-stripe borders (e.g. `border-left: 4px solid blue`) on cards or alerts.
- **Don't** use gradient text under any circumstances.
- **Don't** animate image transformations on hover.
- **Don't** use arbitrary z-index values (e.g. 9999). Follow the scale: dropdown (100) -> sticky nav (200) -> modal backdrop (300) -> modal (400) -> toast (500).
