# @rozie-ui/flatpickr-solid

## 0.1.10

### Patch Changes

- b084200: Declare `@rozie/runtime-*` as `workspace:^` instead of `workspace:*`.

  `workspace:*` publishes as an **exact** pin on the runtime version, so every toolchain bump forced a republish of every leaf that carried one — 76 of the 92 packages in the previous release wave had no source change at all. `workspace:^` publishes as `^<version>`, which a later patch-level runtime still satisfies, so an unchanged leaf stays valid instead of being dragged along.

  This is not a new policy: it is the caret policy already documented and applied by nine family codegen scripts ("bake the caret policy now so `workspace:*` is normalized to `workspace:^`"). It was simply never applied to the leaves whose codegen does not write `package.json`. The Svelte leaves were already fully aligned; the Vue leaves were aligned apart from three. This brings the React, Solid, Lit, and Angular leaves in line, so all six targets now state the dependency the same way.

  The `@rozie/*` toolchain packages keep `workspace:*` deliberately — they are a changesets `fixed` group and always version in lockstep, so an exact pin is correct there.

  This release still republishes these leaves, because their published `package.json` genuinely changes. The benefit is on every release after it.
  - @rozie/runtime-solid@0.7.4

## 0.1.9

### Patch Changes

- @rozie/runtime-solid@0.7.3

## 0.1.8

### Patch Changes

- @rozie/runtime-solid@0.7.2

## 0.1.7

### Patch Changes

- @rozie/runtime-solid@0.7.1

## 0.1.6

### Patch Changes

- @rozie/runtime-solid@0.7.0

## 0.1.5

### Patch Changes

- @rozie/runtime-solid@0.6.0

## 0.1.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The `splitProps` skip-list now correctly excludes emit-handler props from the root DOM fallthrough spread — previously a consumer's handler fired twice per emit. No API surface change.

## 0.1.3

### Patch Changes

- @rozie/runtime-solid@0.2.1

## 0.1.2

### Patch Changes

- @rozie/runtime-solid@0.2.0
