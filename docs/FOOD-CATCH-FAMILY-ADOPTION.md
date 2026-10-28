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
- Quality now uses a compact «Qualität geprüft · Ja/Nein» checkbox; legacy passed/pending/failed records remain truthful, historical notes stay reachable.
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
| Catch form, existing ready | same | "Änderungen speichern" → keeps ready, with existing commercial validation and critical-calculation confirmation; quality records are optional | same | same |
| Catch form, published | same | "Änderungen speichern"; `saveCatch` keeps published | same | same |
| Catch form, prepare CTA | separate intent | "Speichern und WhatsApp-Post vorbereiten" → draft/current status, draft validation, opens publication without a quality or calculation prerequisite | never | – |
| Dossier fields | multi-field form | "Änderungen speichern" | same | confirm, then restore opening values (no write) |
| Dossier title | pencil session | "Fertig", closes only on success | same | restores the opening value; ignored while saving |
| WhatsApp text | freeform | "Text sichern" (text only) | same | restores the session opening text |
| Instagram text | freeform | "Text speichern" (text only) | same | same |
| Settings › interner Aufwand | single field | "Änderungen speichern" | same | restores the stored value |
| Settings › "Auf CHF 2.50 zurücksetzen" | atomic | persists immediately (version check, audit) | – | – |
| Other settings (thresholds, VAT, template, brand, categories, suppliers, locations, Instagram, users) | explicit form/dialog CTAs, unchanged | existing buttons | **not added** | **not added** |
| Quality checkbox | atomic, no confirmation | deliberate checkbox writes passed/pending only; no note edit or status transition | never | – |
| Internal-handling apply, assign/merge/archive, image transfer, conversion, publish, reconciliation close/cancel | explicit atomic intents | unchanged | never | – |
| Sounding | inactive, historical reads only | no normal workflow/settings entry; mutation helpers reject | never | – |

Refetch and identity:
- The dossier page is keyed by `caseId`, and the WhatsApp/Instagram workspaces by `item.id`. Switching to another object resets local state, so no values carry over from one object to another.
- On a refetch of the same object, local edits are kept, and the Esc snapshot stays the value from when editing began.
- Only after a confirmed save (`markSaved`) may a refetch replace the submitted snapshot, and only if nothing was typed after submitting. A failed save never allows a reset.

Conversion: the misleading hint is gone. The final CTA is "Catch-Entwurf erstellen" and uses the displayed values. Navigation after a successful conversion or save is allowed.

History (§8): the whole row navigates. The product name is the only link and the only tab stop for the row. The row has hover and focus-within states and a chevron. "Post ansehen" stays a separate destination, and clicks on it do not trigger the row.

Verification:
- Daily-use 2026-10-28: 286 tests pass in 24 files, including 30 focused price/quality/disclosure/draft tests. Existing transactional image DB tests, StrictMode second-photo, safe cleanup, templates, calculation and reconciliation regressions remain green.
- Multi-image product photos (2026-10-23): the Catch form manages the full `catch_images` collection — append-only uploads, main-image choice, reordering, individual removal; persistence and cleanup happen only on confirmed save (discard preserves saved images), and a partially created Catch is retried via its remembered id. Detail, review, and publication show all images in order; "Alle Bilder herunterladen" fetches every image for manual WhatsApp attachment (text clipboard never implies images). Converted dossiers can append selected photos without touching existing Catch images.
- CatchForm fields are frozen (`fieldset disabled`) during the ordinary save; the leave guard stays active.
- Consumer tests render the real `CaseTitleEditor`: focus, commit once, rejected/failed save, Esc while pending.
- Hook tests cover `useSyncedDraft` (same-id vs different-id, save sequencing) and the pure `ordinarySaveStatus`/`ordinarySaveLabel`.
- Router-harness tests cover `useUnsavedChangesGuard`: block/stay/proceed/post-save, title-only dirty, aggregated second source standing in for Instagram.
- CatchForm and PublicationWorkspace are now rendered together in isolated consumer tests: pending/failed/passed sample without Sounding, save/open/copy/text save, separate publication confirmation, omitted unknown customer data, two-image preservation, current-status preservation, and Viewer/closed/cancelled read-only. The dossier page and Instagram workspace are not rendered as whole-page tests.
- The actual new migration runs in isolated PostgreSQL tests: draft→published with no quantity/reviews, truthful sample state/audit, optional quality on ready, positive quantity for ready/close, cancelled immutability and admin/reason checks for reopening. Production RLS is unchanged (verified by read-only inspection); these isolated tests are not authenticated production E2E.
- Touched-file lint: 0 errors, 0 warnings. Automatic preview build reports build OK; no manual production build or typecheck was run (managed by the platform).
- No authenticated browser session was available, so real Catch and supplier-image E2E flows and signed-in widths are **not** verified.

## Daily-use simplification (2026-10-28)
- Dashboard: short running summary, aligned compact Catch rows with product-name and separate Post links; all aggregate metrics remain in a same-page disclosure. Completed access is unchanged.
- Detail/form: full product name, EK net / VP gross / purchased quantity, local mass comparison and DB I/II net with margins. Detailed calculation and secondary facts are disclosures on the existing pages.
- Native details content stays mounted, including closed WhatsApp/Instagram editors. Hashes reveal their ancestors (#publikation, #nachkalkulation, #interner-aufwand); validation reveals and focuses hidden fields.
- Info help uses installed Popover: hover/focus/tap and Escape, ≥44px mobile targets. Missing-customer-data, outdated-post and Instagram failure notices remain outside the collapsed workspace and link to actionable content.
- Comparison starts empty, uses known net pack weights only, gross retail prices on kg/100g basis; Stk/Portion require explicit known weight. It never updates Normalpreis, commercial inputs or calculations and resets on Catch identity change.
- Quality: checked iff passed; legacy failed/pending stay unchecked until deliberate action. Uncheck writes pending, never a fabricated failed result. Notes are omitted from the write and historical notes/time are retained. Existing identity-invalidation triggers remain untouched and may archive/reset the old note on genuine product-identity edits as before.
- Sounding is inactive in the app: no start/workflow/settings entry, all three mutation helpers reject before DB access, historic review route reads every round and feedback without controls. Tables/RLS/triggers/history remain unchanged; this is app-path deactivation, not a new database permission policy.
- No migration, dependency change, production data writes, deployment or sending. Image RPC/migrations, financial formulas, template signatures and ordinary save intents are unchanged.
- Touched lint: zero errors, one Fast Refresh warning for the component/helper co-export. Automatic platform type/build: build OK. Separate manual production build/typecheck were not run (platform-managed). Browser reached only sign-in at 390/768/1024/1440, without overflow or console errors; core signed-in visual/E2E checks unavailable.

### Targeted final review (2026-10-28)
- Visible row labels are DB I max. / DB II max. with a compact Netto group label; amounts and unknown handling are unchanged.
- Existing same-page anchor clicks reveal their disclosure even when the hash is unchanged, without cancelling native/router navigation or unmounting editors. The real WhatsApp workspace regression closes and reopens the same hash with the same dirty textarea instance.
- Hover help closes after 150ms outside trigger/content; moving into the content cancels closing. Deliberate click/tap pins it until outside interaction/Escape; keyboard focus remains accessible. No dependency added.
- Executed `bunx vitest run`: 24 files, 288 tests passed. Executed `bunx eslint src/components/catch/catch-row.tsx src/components/layout/mounted-disclosure.tsx src/components/ui/info-help.tsx src/components/catch/whatsapp-draft-flow.test.tsx src/components/catch/quantity-price-comparison.test.tsx`: 0 errors, 1 existing Fast Refresh co-export warning.
- Automatic preview check at 19:44:46 UTC: build OK. No separate manual typecheck or production build command ran: platform instructions prohibit those; the available log does not establish a separately measured typecheck/production bundle result.
- No authenticated browser acceptance attempted, no auth impersonation/token reuse/user creation, data writes, schema/package changes, sends or deployment. Old alias/current preview authentication differences remain a visual-acceptance limitation, not an auth-code change.
