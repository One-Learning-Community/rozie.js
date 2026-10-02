# @rozie-ui/sortable-list-solid

## 0.1.16

### Patch Changes

- 4f2148d: **Fixed: published Solid leaves now ship compiled JavaScript for `import`/`require`, with JSX
  kept only under the `solid` export condition.**

  Every `@rozie-ui/*-solid` leaf with markup previously shipped Solid JSX inside
  `dist/index.{mjs,cjs}` under a plain `import`/`require` (`chartjs-solid` renders no markup of its
  own, but ships the same corrected export shape for consistency with its siblings). That is not
  valid JavaScript on its own — a default `vite-plugin-solid` setup
  fails with "JSX syntax is disabled" (the plugin only transforms `.[mc]?[jt]sx` files), and any
  bundler without a Solid plugin fails outright. The only way to consume these packages was to
  manually point `vite-plugin-solid` at the package's `.mjs` files inside `node_modules` — a
  workaround, not a supported shape.

  New export shape (the standard one for a published Solid library):
  - `import` / `require` → `dist/<entry>.{mjs,cjs}`, compiled to plain DOM output by
    `babel-preset-solid`. Any bundler consumes this with no Solid plugin at all.
  - `solid` (export condition) → `dist/source/<entry>.jsx`, JSX kept intact. `vite-plugin-solid`
    and SolidStart resolve this condition first and compile it themselves for their own mode (DOM /
    SSR / hydration).

  **If you were using the `extensions: ['.mjs']` / `node_modules` `include` workaround with
  `vite-plugin-solid` to consume one of these packages, remove it — it is no longer needed** and a
  default `vite-plugin-solid` setup now resolves the `solid` condition correctly on its own. No
  public API change on any of these leaves.

- Updated dependencies [4f2148d]
  - @rozie/runtime-solid@0.7.5

## 0.1.15

### Patch Changes

- b084200: Solid: slot scope values are now passed as lazy getters instead of eager reads.

  A scoped slot invocation used to build its param object as `{ open: open() }`. Because that object is constructed inside the JSX insert that invokes the slot, Solid subscribed the **insert itself** to every signal read while building it — so any change re-ran the insert, re-invoked the consumer's slot function, and replaced the rendered subtree. Emitting `{ get open() { return open(); } }` defers the read into the consumer's own reactive scope, which is Solid's own convention for passing reactive props.

  Observable fix: opening the data-table column menu no longer tears the just-focused trigger out of the DOM, so the documented "Escape returns focus to the trigger" guarantee now holds on Solid as it already did on the other five targets.

  Literals and function-valued expressions are deliberately left as plain properties — neither can read a signal, and wrapping a function would hand the consumer a new identity on every property access.

  Note for consumers: destructuring a slot scope (`({ option, index }) => …`) and spreading it behave exactly as before. The one behavior change is that **assigning** to a scope property now throws `TypeError: Cannot set property x of #<Object> which has only a getter`, where it previously succeeded silently. Writing to a slot scope was never a supported pattern.

  `@rozie/core` is named here even though no file under `packages/core/` changed: the emitter lives in the private `@rozie/target-solid` package, which is bundled into core's published dist (and into `unplugin`, `babel-plugin`, and `cli`). A changeset derived from changed paths alone would ship a toolchain that still emits the bug.
  - @rozie/runtime-solid@0.7.4

## 0.1.14

### Patch Changes

- @rozie/runtime-solid@0.7.3

## 0.1.13

### Patch Changes

- @rozie/runtime-solid@0.7.2

## 0.1.12

### Patch Changes

- @rozie/runtime-solid@0.7.1

## 0.1.11

### Patch Changes

- @rozie/runtime-solid@0.7.0

## 0.1.10

### Patch Changes

- @rozie/runtime-solid@0.6.0

## 0.1.9

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The `splitProps` skip-list now correctly excludes emit-handler props from the root DOM fallthrough spread — previously a consumer's handler fired twice per emit. No API surface change.

## 0.1.8

### Patch Changes

- @rozie/runtime-solid@0.2.1

## 0.1.7

### Patch Changes

- ac09c50: Fix a keyboard hijack when an interactive element (a `<input>`, `<button>`, etc.) is rendered into a sortable row's default slot — the row's `onRowKeyDown` handler previously ran on any keydown that bubbled up to it, hijacking Space/Enter/Escape/Arrow keystrokes typed into the slotted child for lift/drop/move/cancel before the child ever saw them. Reorder keys now apply only when the row element ITSELF is focused; keystrokes originating from a slotted interactive child fall through untouched to that child. No API change, no per-target behavior divergence — the "editable row" pattern (a text input alongside drag-to-reorder) now works as expected.

## 0.1.6

### Patch Changes

- @rozie/runtime-solid@0.2.0
