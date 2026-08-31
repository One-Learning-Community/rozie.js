# @rozie-ui/captcha-vue

## 0.1.5

### Patch Changes

- a113f0e: Vue leaves: `@example` snippets in prop documentation now use Vue syntax

  The published tarballs for these seven leaves still carried Rozie authoring
  notation inside their `@example` JSDoc blocks — `r-model:data="crop"` where a
  Vue consumer should see `v-model:data="crop"`. Hovering a prop in an editor
  showed markup that is not valid in the framework you are actually using.

  The fix landed in source on 2026-08-24 but these seven were never bumped, so
  npm kept serving the old bytes (`pnpm publish` silently skips an already-
  published version). Documentation comments only — no runtime code, type
  signature, or import changed.

## 0.1.4

### Patch Changes

- Stale-publish reconciliation. The published `0.1.3` tarball predates several regenerations that landed on `main` without a version bump, so the registry kept serving stale bytes; the package had never even shipped a `CHANGELOG.md` before this release. This release republishes the current generated output:
  - Adds JSDoc across every prop of both `Captcha` and `RecaptchaV3` (0 blocks in the published tarball), so IDE tooltips/completion now describe each prop's semantics and, for `RecaptchaV3`, its `execute()`/`executeOnMount` behavior.
  - `LICENSE` copyright holder corrected from `Dan Krieger and Rozie.js contributors` to `One Learning Community LTD` (the repo's current holder — the worktree file was already correct; only the stale published tarball needed reconciling).
  - Internal-only: the `disposed` async-load guard local is now scoped correctly per emitter-hardening backlog item #2 (mount-local where only the mount closure's own async callbacks and its teardown read it; top-level only where an `$expose`'d imperative verb — `execute()`, `reset()`, `getResponse()` — must read it after unmount). `RecaptchaV3.execute()`'s optional `action` parameter is now emitted as a genuinely optional TS parameter (`action?: any`) rather than requiring a caller-visible `= null` default. No observable behavior change from either.
  - No prop/event/emit surface change (Vue does not use a shadow host, so unlike the Angular leaf there is no `display: contents` host style involved here).
