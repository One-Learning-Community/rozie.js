# @rozie-ui/flatpickr-vue

## 0.1.3

### Patch Changes

- Regenerated with the toolchain's Vue `$watch` flush:'post' fix: all `$watch`-driven prop/data reconcilers now run post-flush (after the DOM update, matching the React/Solid/Svelte/Angular/Lit leaves' timing) instead of Vue's default pre-flush. This closes the portal re-entrancy class (a portal fill mounting from inside an engine update can no longer synchronously flush a pending sibling watcher into the same engine mid-update) and the pre-flush `$refs`-read-too-early class (e.g. the embla runtime `thumbnails` toggle previously failed to build its thumb engine on Vue). No API surface change.

## 0.1.2

### Patch Changes

- Stale-publish reconciliation. The published `0.1.1` tarball predates several regenerations that landed on `main` without a version bump, so the registry kept serving stale bytes; the package had never even shipped a `CHANGELOG.md` before this release. This release republishes the current generated output:
  - Adds JSDoc across the component's props (0 blocks in the published tarball), so IDE tooltips/completion now describe each prop's semantics, runtime-vs-construction-time mutability, and defaults.
  - `LICENSE` copyright holder corrected from `Dan Krieger and Rozie.js contributors` to `One Learning Community LTD` (the repo's current holder — the worktree file was already correct; only the stale published tarball needed reconciling).
  - No prop/event/emit surface change (Vue does not use a shadow host, so unlike the Angular leaf there is no `display: contents` host style involved here).
