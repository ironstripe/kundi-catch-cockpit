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
- Session-upload cleanup goes through `useSessionUploads` (deferred, replay-safe): React StrictMode/Fast Refresh replays effect cleanup on mounted editors, so never delete storage objects directly in an effect cleanup.
- Private images render via `SignedImage`, which shows an explicit load error with retry instead of a broken image or endless spinner.
- Preparation navigation is an explicit form-save intent independent of Catch status; use draft validation for it so optional quality workflows cannot gate WhatsApp preparation.
- WhatsApp post text is generated only from the saved `whatsapp_template` setting (normalised via `normalizeTemplate`); the workspace waits for it and the signature carries a template content tag, so template edits flag saved posts without rewriting them.
