# @rozie-ui/tags-lit

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. A nullable attribute bound to a null-valued primitive prop read is now dropped instead of rendered (previously the literal string `null` could render through the attribute binding). `r-for` loop keys are no longer leaked as literal DOM attributes on emitted elements. No API surface change.

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/tags` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps.
- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
