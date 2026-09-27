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

## Pass 1 review fixes (2026-09-27)
- Collapsed sidebar rail: menu buttons 44×44 below lg (`max-lg:…!size-11`), rail widened to 3.75rem so they fit; desktop stays 32px.
- Icon-only `size="sm"` buttons (e.g. account menu) get `max-lg:min-w-11`; Toggle/ToggleGroup (Frisch/TK), Select items and DropdownMenu items are ≥44px high below lg.
- Long CTAs (Catch form "Speichern und WhatsApp-Post vorbereiten", dossier side actions) use `h-auto whitespace-normal` so they wrap instead of overflowing at 390px. Verified in markup only; no authenticated render.
- SectionShell and main workspace `CardTitle`s use `text-section-title` (18px). The field groups in the offer form stay compact on purpose.
- Detail-link rule (§8): Catch cards show a hover/focus underline on the title (the whole card is the link). The History table no longer has two links in one row: the product name is the link, and the catch number is plain text. The offer inbox keeps its row click plus action button.
- `src/integrations/supabase/previewAuthStorage.ts`: this is a platform-generated file. It changed in commit a889ed0 ("Work in progress"), before Pass 1, and appears in the merge diff only because dd5b264 lacked it. Pass 1 did not touch it, so it was left as is.

## Pass 2 — edit/commit mapping (implemented)
Helper: `src/hooks/use-edit-session.tsx` (`useEditShortcuts`, `useUnsavedChangesGuard` + `UnsavedChangesDialog` on TanStack `useBlocker` with resolver). Shortcuts only work inside their own `data-edit-scope`. They ignore portal events, nested scopes, repeated keys, IME composition, open Radix dialogs/menus/listboxes/poppers and expanded comboboxes. A second commit is blocked while one is still pending.

| Surface | Type | Commit | Ctrl/Cmd+Enter | Esc | Guard |
|---|---|---|---|---|---|
| Catch form (new) | multi-field route form | "Als Entwurf speichern" / "Speichern und WhatsApp-Post vorbereiten" | saves draft | none (leave confirmation) | router + unload |
| Catch form (edit) | multi-field route form | same | ordinary save, keeps status (draft/published). Exception: a ready Catch shows a hint instead of saving, so the shortcut never sets or re-validates "Bereit" | none | router + unload |
| Dossier fields | multi-field form | "Änderungen speichern" | same save | none | router + unload |
| Dossier title | pencil session | "Fertig" | same | restores opening value | – |
| WhatsApp text | freeform | "Text sichern" | text only | restores base text | router + unload (only for real user edits; unsaved generated text does not count) |
| Instagram text | freeform | "Text speichern" | text only | restores base text | – |
| Settings › interner Aufwand | single field | "Änderungen speichern" | same | restores stored value | – |
| "Auf CHF 2.50 zurücksetzen" | atomic | persists default immediately (version check, audit) | – | – | – |
| Sample check, internal-handling apply, assign/merge/archive, image transfer, conversion, publish, reconciliation close/cancel | atomic with confirmation | unchanged | never | – | – |

Refetch safety: dossier fields, WhatsApp/Instagram text and the settings rate re-sync only when the local value still matches the last synced value. The dossier resets after its own successful save. The title editor closes only after a successful rename; if it fails, the value stays in the field for a retry.
Conversion: the misleading "eintragen und speichern" hint is gone. The final CTA is "Catch-Entwurf erstellen" and uses the displayed values. Navigating after a successful conversion or save is not blocked.
Domain exceptions: reconciliation, sample result, Sounding feedback and template reset have no generic keyboard save.

Verification: 199 vitest tests pass, including 8 consumer tests (title editor focus/commit-once/failure/Esc, scoping, overlay priority, router block/stay/proceed/post-save). There is no consumer test for dossier refetch retention; that logic was reviewed only. Typecheck is clean. No authenticated browser session was available, so real Catch and supplier-image E2E flows are **not** verified.
