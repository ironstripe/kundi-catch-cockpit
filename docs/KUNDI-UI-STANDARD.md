# Kundi UI Standard — Family Standard v1 (Snapshot)

- Source project: KundiMKT (`68567b0e-879b-44cc-b1d3-fd601459542a`)
- Source commit: `da4d83eb028a433687f5a4ec2cf07932c2e0f5e8`
- Snapshot date: 2026-09-27
- Status: verbatim copy of the supplied reference. Food Catch adaptation is documented separately in `FOOD-CATCH-FAMILY-ADOPTION.md`.

## Light core tokens

```css
:root {
  --radius: 0.5rem;
  --background: oklch(0.982 0.008 92);
  --foreground: oklch(0.205 0.024 160);
  --card: oklch(0.997 0.003 92);
  --card-foreground: oklch(0.22 0.025 165);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.025 165);
  --primary: oklch(0.345 0.078 161);
  --primary-foreground: oklch(0.99 0.004 95);
  --secondary: oklch(0.945 0.014 95);
  --secondary-foreground: oklch(0.27 0.035 165);
  --muted: oklch(0.952 0.009 92);
  --muted-foreground: oklch(0.48 0.024 160);
  --accent: oklch(0.938 0.025 157);
  --accent-foreground: oklch(0.27 0.055 165);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.984 0.003 247.858);
  --border: oklch(0.86 0.014 92);
  --input: oklch(0.84 0.015 92);
  --ring: oklch(0.52 0.08 165);
  --success: oklch(0.49 0.13 143);
  --warning: oklch(0.61 0.14 67);
  --info: oklch(0.48 0.07 226);
  --canvas: oklch(0.958 0.011 92);
}
```

Typography theme:

```css
--font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;
--text-page-title: 1.5rem; --text-section-title: 1.125rem;
--text-ui: .9375rem; --text-control: .875rem; --text-meta: .75rem;
```

---

# Kundi UI Standard — Family Standard v1

Reference implementation: KundiMKT (tokens in `src/styles.css`). Other Kundi apps adopt this language later; nothing is propagated automatically.

## 1. Shared language, variable navigation
The visual and interaction language is shared. The navigation *model* may vary per app.
- **Topbar**: apps with few (≤5) top-level destinations and deep single-object workspaces (KundiMKT).
- **Sidebar**: apps with many peer modules or persistent lists (e.g. Kundivent).
- Both use the same active state: subtle accent background + foreground text, never primary fill.

## 2. Typography (Manrope)
| Role | Size | Weight |
|---|---|---|
| Page title | 24px (`--text-page-title`) | 600 |
| Section / work area | 18px (`--text-section-title`) | 600 |
| Body | 15px (14–16) | 400 |
| Tables / controls | 14px | 400–500 |
| Meta | 12–13px | 400 |
Tabular numerals for costs, dates, metrics. No all-caps labels except rare micro-status. No landing-page display type.

## 3. Semantic colors
- Primary: dark Kundi green — primary action and brand only.
- Background warm off-white; card near-white; border subtle.
- Success green (distinct from CTA fill), Warning amber, Destructive red, Info neutral, Paused muted.
- No gradients, no decorative color. Color never the only carrier of meaning (always text/icon).

## 4. Spacing, radius, surfaces
Spacing scale 4/8/12/16/24/32/48. Radius 6–8px. Subtle borders, minimal/no shadow, clear horizontal dividers, no card-in-card.

## 5. Control sizing
Button/Input/Select 36px desktop, compact 32px; **≥44px touch target on mobile** (including icon buttons and switches' hit area). Icons 16–18px. App icon ~32px. Table rows 60–68px.

## 6. Tables and lists
Desktop: clear header, horizontal dividers, whole row clickable, first column strongest, numbers right-aligned CHF with tabular numerals, attention column only when needed. Mobile: two-line rows.

## 7. Work areas and disclosure
Numbered header (01, 02 …), compact summary, one affordance on the right, anchored content, key/value rows for settings. Chevron = disclosure only.

## 8. Entity titles and detail links
Page titles and section titles are never clickable. The name/title of a concrete object (campaign, event, catch …) IS clickable when a detail/workspace exists. In tables/lists with whole-row click, add no separate link styling to the title — the row click + chevron is enough. In standalone summary/teaser blocks, the entity title itself is the detail link; remove any redundant generic "Details ansehen" action for the same destination. Affordance: pointer cursor, subtle hover underline/text emphasis, clear keyboard focus; no button/chip styling.

## 9. Icon semantics
Pencil = enter direct edit of the visible thing · Plus = add · Chevron = disclose · Circular arrow = refresh · Trash = remove · Switch = binary state. No icon used with another meaning.

## 10. Primary-action rule
At most one visually dominant (primary) action per visible context.

## 11. Ask Kundi control
"Frag KundiMKT" (app-named): one neutral outline control with icon, never primary-filled; dialog uses standard card dialog styles.

## 12. Status and warnings
Status is information, not a button. No badge floods. Warnings state impact and next step in plain language (e.g. "Kauftracking noch nicht bestätigt — blockiert spätere Aktivierung").

## 13. Save model
- **Atomic action** (add, remove, select-commit, switch, match type, confirm): persists immediately, quiet confirmation, no global dirty banner; on error keep state, show concise error + retry.
- **Freeform edit session**: local until **Fertig**; Fertig validates and persists. **Ctrl/Cmd+Enter = Fertig**, **Escape = cancel and restore opening values**. Shortcuts yield to open dialogs/menus/selects. Warn when leaving with unsaved edits.
- **Multi-field form/step**: the CTA is the commit.
- Never ask the user to confirm the same intent twice.

## 14. Responsive breakpoints
390 (mobile baseline) · 768 (tablet, still compact nav) · **1024 (`lg`, desktop shell switch)** · 1440 (wide). No horizontal overflow at 390px.

## 15. App-specific (NOT family standard)
- KundiMKT two-tile root launcher.
- Google Ads specifics: ad preview, Google-Varianten, approval/validateOnly panel, divergence banner wording.
- KundiMKT accent usage and "KM" app icon.
- Candy Salmon deep-analysis report layout (density not yet settled).
