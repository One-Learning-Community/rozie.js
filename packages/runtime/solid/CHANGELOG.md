# @rozie/runtime-solid

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
