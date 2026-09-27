# Food Catch — Kundi Family UI adoption

Reference: `docs/KUNDI-UI-STANDARD.md` (Family Standard v1, KundiMKT `da4d83e`, snapshot 2026-09-27).

## Pass status

| Pass | Scope | Status |
|---|---|---|
| 1 | Visual foundation: tokens, Manrope, type scale, control sizing, shared components | Implemented 2026-09-27, awaiting review |
| 2 | Interaction rules (§8 entity-title links, §13 save model: Fertig, Ctrl/Cmd+Enter, Escape) | **Not implemented** — target rules only |

## Local mappings

- **Light core tokens**: copied exactly into `src/styles.css :root`.
- **Local additions** (not in reference): `--success-foreground`, `--warning-foreground` (dark amber for text on tint), `--info-foreground`, chart palette.
- **Sidebar**: `--sidebar-*` alias family tokens (`--card`, `--foreground`, `--accent`, `--accent-foreground`, `--border`, `--ring`). The stock cool sidebar values from KundiMKT are intentionally not used. Active item = accent background + accent foreground, never primary fill.
- **Navigation model**: Food Catch keeps its collapsible sidebar / icon rail on desktop and the overlay drawer on mobile (existing breakpoint in `use-mobile`, 768px). No topbar, destinations unchanged.
- **Dark mode**: existing `.dark` block retained; primary shifted to a light green of the same hue, `--info` and `--canvas` added. No theme toggle.
- **Typography**: Manrope loaded via Google Fonts `<link>` in `src/routes/__root.tsx` with `display=swap`, fallback `ui-sans-serif, system-ui`. Tokens `text-page-title`, `text-section-title`, `text-ui`, `text-control`, `text-meta` in `@theme inline`. Body 15px, tabular numerals globally. `PageHeader` → `text-page-title`, `PageSection` → `text-section-title`; form subgroups remain small.
- **Controls**: Button/Input/Select 36px desktop (`sm` 32px); below `lg` (1024px) buttons, icon buttons, inputs, selects, sidebar menu items, sidebar trigger and dialog/sheet close get ≥44px; switches get an invisible 44px hit area. Inputs/textareas use 16px text below `lg` to prevent iOS zoom.
- **Surfaces**: cards use 8px radius and no shadow; primary button minimal shadow.

## Preserved domain semantics

- `--catch-deep` / `--catch-teal`: Food Catch identity accent (logo), unchanged hue.
- `--status-*` (Entwurf/Bereit/Publiziert/Abgeschlossen/Abgebrochen) and `--temp-*` (Frisch/TK): distinct hues kept; lightness lowered slightly for readability on warm surfaces. `published` aligned to family `--success`.
- "Bestanden" badge in Musterprüfung keeps explicit black text (user request).
- Logo, German UI with Swiss ss, routes, workflows, calculations, VAT, lifecycle unchanged.

## Verification (pass 1)

See the pass report in chat for measured widths and observed/untested cases. Authenticated screens could not be observed in the browser in this pass because no preview session was available; only the sign-in page was rendered.
