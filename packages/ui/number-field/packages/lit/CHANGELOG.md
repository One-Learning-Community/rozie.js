# @rozie-ui/number-field-lit

## 0.1.7

### Patch Changes

- e9e5f05: First npm release of the React, Vue, Svelte, Angular and Lit packages. The Solid package has been on npm since September 2026; this version brings all six targets to the same component revision.
- e9e5f05: Regenerated with the Lit nullable model prop typing fix: the two-way `modelValue` property is now typed `number | null` (its default is `null`, so the narrower `number` was never true), which a strict TypeScript consumer reading `element.modelValue` now sees. Rendered markup and runtime behaviour are unchanged.
- e9e5f05: Regenerated with kebab-case attributes for multi-word props: a prop such as `idBase` is now observed as `id-base` (it was the lowercased `idbase`), matching the model props and what a Rozie consumer writes. **If you set one of these from raw HTML with the lowercased or camelCase name, switch to the kebab attribute** (or set the property). Single-word props are unchanged.

## 0.1.2

### Patch Changes

- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
