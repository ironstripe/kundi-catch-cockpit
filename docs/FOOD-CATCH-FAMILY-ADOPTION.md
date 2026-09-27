# Food Catch — Kundi Family UI adoption

Reference: `docs/KUNDI-UI-STANDARD.md` (Family Standard v1, KundiMKT `da4d83e`, snapshot 2026-09-27).

## Pass status

| Pass | Scope | Status |
|---|---|---|
| 1 | Visual foundation: tokens, Manrope, type scale, control sizing, shared components | Implemented 2026-09-27, review fixes applied |
| 2 | Interaction rules (§8 entity-title links, §13 save model) | Implemented 2026-09-27 for the consumers listed in the mapping below; other surfaces keep their explicit CTAs. Not verified in an authenticated browser. |

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

## Pass 2 — edit/commit mapping
Helpers:
- `src/hooks/use-edit-session.tsx`: `useEditShortcuts` plus `useUnsavedChangesGuard` / `UnsavedChangesDialog` (TanStack `useBlocker` with resolver).
- `src/hooks/use-synced-draft.ts`: local draft against the server value of the same object.

Shortcut rules:
- Shortcuts work only inside their own `data-edit-scope`.
- They ignore portal events, nested scopes, repeated keys, IME composition, open Radix dialogs/menus/listboxes/poppers and expanded comboboxes.
- While a commit is pending, **both** commit and cancel are ignored.
- A rejected commit is caught and does not lock the helper.

Page guards (one per page):
- Dossier: fields dirty OR title dirty.
- Catch detail: WhatsApp dirty OR Instagram dirty.
- Catch form: dirty. Protection stays active while a save is pending; navigation is allowed only after a confirmed save or an explicit discard.

| Surface | Kind | Visible commit | Ctrl/Cmd+Enter | Esc |
|---|---|---|---|---|
| Catch form, new | multi-field route form | "Als Entwurf speichern" → draft | same ordinary save (draft) | leave with confirmation, no write |
| Catch form, existing draft | same | "Als Entwurf speichern" → draft | same | same |
| Catch form, existing ready | same | "Änderungen speichern" → keeps ready, with the existing ready validation, sample check/Sounding lock and critical-calculation confirmation | same | same |
| Catch form, published | same | "Änderungen speichern"; `saveCatch` keeps published | same | same |
| Catch form, prepare CTA | separate intent | "Speichern und WhatsApp-Post vorbereiten" | never | – |
| Dossier fields | multi-field form | "Änderungen speichern" | same | confirm, then restore opening values (no write) |
| Dossier title | pencil session | "Fertig", closes only on success | same | restores the opening value; ignored while saving |
| WhatsApp text | freeform | "Text sichern" (text only) | same | restores the session opening text |
| Instagram text | freeform | "Text speichern" (text only) | same | same |
| Settings › interner Aufwand | single field | "Änderungen speichern" | same | restores the stored value |
| Settings › "Auf CHF 2.50 zurücksetzen" | atomic | persists immediately (version check, audit) | – | – |
| Other settings (thresholds, VAT, template, brand, categories, suppliers, locations, Sounding, Instagram, users) | explicit form/dialog CTAs, unchanged | existing buttons | **not added** | **not added** |
| Sample check, internal-handling apply, assign/merge/archive, image transfer, conversion, publish, reconciliation close/cancel, Sounding feedback | atomic with confirmation | unchanged | never | – |

Refetch and identity:
- The dossier page is keyed by `caseId`, and the WhatsApp/Instagram workspaces by `item.id`. Switching to another object resets local state, so no values carry over from one object to another.
- On a refetch of the same object, local edits are kept, and the Esc snapshot stays the value from when editing began.
- Only after a confirmed save (`markSaved`) may a refetch replace the submitted snapshot, and only if nothing was typed after submitting. A failed save never allows a reset.

Conversion: the misleading hint is gone. The final CTA is "Catch-Entwurf erstellen" and uses the displayed values. Navigation after a successful conversion or save is allowed.

History (§8): the whole row navigates. The product name is the only link and the only tab stop for the row. The row has hover and focus-within states and a chevron. "Post ansehen" stays a separate destination, and clicks on it do not trigger the row.

Verification:
- 211 vitest tests pass (incl. same-value normalised save acknowledgement via `reconcileSaved`, typing after submit retained, dirty contribution cleared on editor unmount).
- CatchForm fields are frozen (`fieldset disabled`) during the ordinary save; the leave guard stays active.
- Consumer tests render the real `CaseTitleEditor`: focus, commit once, rejected/failed save, Esc while pending.
- Hook tests cover `useSyncedDraft` (same-id vs different-id, save sequencing) and the pure `ordinarySaveStatus`/`ordinarySaveLabel`.
- Router-harness tests cover `useUnsavedChangesGuard`: block/stay/proceed/post-save, title-only dirty, aggregated second source standing in for Instagram.
- CatchForm, the dossier page and the WhatsApp/Instagram workspaces themselves are **not** rendered in tests; button and shortcut share `saveOrdinary()` by code.
- Typecheck is clean.
- No authenticated browser session was available, so real Catch and supplier-image E2E flows and signed-in widths are **not** verified.
