# @rozie/runtime-solid

## 0.4.0

### Minor Changes

- `r-keynav`'s tabindex focus model no longer steals DOM focus or scrolls on a
  cold page load, or on any mount/re-appearance while focus sits on an
  unrelated element elsewhere on the page. Previously the first focus/scroll
  pass after mount (or a conditionally-rendered `r-if` root re-appearing)
  always ran unconditionally, which could yank keyboard focus into a
  just-mounted component even though the user was never interacting with it.

  The new rule is strict component containment: the guarded first/redundant
  pass only focuses and scrolls when DOM focus is already somewhere inside the
  owning component's rendered subtree (not merely "somewhere on the page").
  Arrow-key navigation and every other active-index change are completely
  unaffected — they still focus and scroll unconditionally, exactly as
  before.

  `@rozie/runtime-keynav-core` exports the shared containment predicate
  (`focusIsWithinScope` plus its `composedActiveElement`/`composedContains`/
  `documentHasRealFocus` building blocks) that every target implementation
  calls, so the semantics can never drift between React, Vue, Svelte, Solid,
  Lit, and Angular. React, Vue, Svelte, and Solid thread an additive, OPTIONAL
  runtime option — `getFocusScope` — through to the predicate; Lit derives its
  scope from `this.host` and Angular from an injected `ElementRef`, so neither
  needs the extra field. **Compatibility contract:** a previously-published
  leaf calling this runtime WITHOUT `getFocusScope` (i.e. not yet regenerated)
  degrades to the OLD document-scoped fallback rather than the old
  unconditional-focus behavior — never the reverse, and never a hard
  rejection.

  This release also folds in a drill-continuity fix: a component-internal
  transition that destroys the currently-focused element as part of the same
  render that resolves a sibling attachment's guarded pass (date-picker's
  months → days Escape exit is the concrete case) is treated as "still within
  scope" for a short, bounded window after the removal, so keyboard focus
  correctly lands back on the resolved item instead of falling to `<body>`.
  That window is chained across three animation frames rather than one,
  specifically so it survives a sibling consumer's own
  `requestAnimationFrame`-deferred value resolution (needed on React and
  Solid, whose effect/DOM-commit ordering can otherwise clear the window one
  frame too early — see `@rozie/runtime-keynav-core`'s `focusGuard.ts` module
  doc comment for the full mechanism).

  `@rozie/runtime-lit` additionally ships a previously-unreleased fix
  (`963233d1`): a multi-root `KeynavController` (multiple independent
  `r-keynav` groups sharing one shadow root, e.g. date-picker's day/months/
  years panels) no longer lets an inactive group's controller steal focus
  onto a different, currently-visible group's item at the same
  `data-rozie-keynav-item` index, and a group's root re-appearing with an
  unchanged active index is correctly re-focused instead of silently
  dropped.

  `@rozie/core`, `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin`
  bump because the compiler's five target emitters (bundled into `@rozie/core`
  and, through it, into the other three toolchain packages) now emit the
  `getFocusScope` wiring — one minted ref per top-level template element for
  the four fragment targets, an injected `ElementRef` host reference for
  Angular — alongside every `r-keynav` root's opts object.

### Patch Changes

- Updated dependencies
  - @rozie/runtime-keynav-core@0.4.0

## 0.2.3

### Patch Changes

- **Added: `normalizeComponentAttrs`** — the component-tag sibling of `normalizeAttrs`. It strips the same prototype-pollution key set (so the security guard is identical on every tag kind), but it does **not** apply the DOM alias table. Props that a child COMPONENT declared — `readonly`, `tabindex`, `for`, and friends — therefore survive a dynamic `r-bind` spread verbatim instead of being renamed to their DOM spellings and silently dropped. Solid keeps `class` verbatim, matching Solid's own JSX prop naming.
- **`normalizeAttrs` is frozen.** Its body, its signature, and its exported key-map tables are unchanged in this release. This is guarded by an `it()` in `normalizeAttrs.test.ts` that was green both before and after the addition.
- Additive only. Shipped as a **patch** per repo precedent (`629f8a93`, `cd7c9d9e`, `55a9bb4b` all shipped new runtime exports as patches): these packages are pre-1.0 and their entire consumer surface is compiler-generated, so no human hand-writes these imports.

## 0.2.2

### Patch Changes

- Array-form `:style` merge. `parseInlineStyle` now accepts an **array** of
  style sources (`:style="[a, b]"`) and merges them left-to-right (later
  wins, mirroring Vue's `normalizeStyle`); each element still goes through
  the same single-value logic. Every element is serialized into ONE
  CSS-declaration string (string verbatim, object own-keys unchanged — never
  camelCase-converted, preserving the no-camelCase-parse contract); the
  browser's `cssText` cascade resolves "later wins". This closed the
  `ROZ144` restriction — emitters are unchanged, the array literal already
  reached this helper at the existing binding site.
- **Republish note:** `0.2.1` was cut before this landed
  (`cbe01eaa`), so the published `0.2.1` tarball does not contain it.
  `0.2.2` is the first published build with the array branch.

## 0.2.1

### Patch Changes

- @rozie/runtime-keynav-core@0.2.1

## 0.2.0

### Patch Changes

- @rozie/runtime-keynav-core@0.2.0
