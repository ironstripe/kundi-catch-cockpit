<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Daily-use disclosures keep their children mounted; reveal ancestor details for hashes and validation focus so local editors, uploads and navigation guards survive collapsing.
- Mass-price comparison is a local gross-retail scratch calculation separate from persisted financial inputs; caller identity keys reset it between Catches.
- Quality UI writes only passed/pending through authenticated existing Catch access, never overwrites notes; inactive Sounding mutation helpers reject before database access and historic review routes remain read-only.
- Session-upload cleanup goes through `useSessionUploads` (deferred, replay-safe): React StrictMode/Fast Refresh replays effect cleanup on mounted editors, so never delete storage objects directly in an effect cleanup.
- Private images render via `SignedImage`, which shows an explicit load error with retry instead of a broken image or endless spinner.
- Preparation navigation is an explicit form-save intent independent of Catch status; use draft validation for it so optional quality workflows cannot gate WhatsApp preparation.
- WhatsApp post text is generated only from the saved `whatsapp_template` setting (normalised via `normalizeTemplate`); the workspace waits for it and the signature carries a template content tag, so template edits flag saved posts without rewriting them.
- Catch image rows are synchronised only through the transactional `sync_catch_images` RPC (security invoker, per-catch advisory lock, demote-before-promote); storage objects are removed only from its committed `removed_paths`, because the one-primary unique index and partial failures made client-side multi-step writes unsafe.
