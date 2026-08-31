# @rozie-ui/cropper-vue

## 0.1.4

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

## 0.1.3

### Patch Changes

- Regenerated with the toolchain's Vue `$watch` flush:'post' fix: all `$watch`-driven prop/data reconcilers now run post-flush (after the DOM update, matching the React/Solid/Svelte/Angular/Lit leaves' timing) instead of Vue's default pre-flush. This closes the portal re-entrancy class (a portal fill mounting from inside an engine update can no longer synchronously flush a pending sibling watcher into the same engine mid-update) and the pre-flush `$refs`-read-too-early class (e.g. the embla runtime `thumbnails` toggle previously failed to build its thumb engine on Vue). No API surface change.

## 0.1.2

### Patch Changes

- A genuine patch roll since the published `0.1.1`, not a bookkeeping alignment: emitter reblessing for the between-imports comment-doubling fix (`d62b9325`), the ref tag→element-type map extension (`850833d6`), self-documenting prop descriptions from the codegen type-prop guard widening (`c3c748e7`), and the license/copyright header refresh (`a7733874`). No API change, no breaking change — the props/emits/slots/expose surface is unchanged, verified by the `tests/surface.test.ts` gate.
- This release also marks the debut of `@rozie-ui/cropper` as a complete all-six-targets release line: `-react`/`-solid`/`-lit`/`-svelte`/`-angular` now publish alongside `-vue` for the first time, all aligned at `0.1.2`.
