# @rozie/runtime-solid

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
