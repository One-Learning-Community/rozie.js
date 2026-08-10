# @rozie-ui/codemirror-solid

## 0.1.3

### Patch Changes

- Re-entrancy-safe compartment reconfigures: all eight prop-driven reconfigure
  paths (`language`/`theme`/`readOnly`/`placeholder`/`extensions`/`basicSetup`/
  `gutterLines`/`decorations`) now route through a microtask-deferred batcher
  that coalesces same-tick prop changes into one dispatch. Changing two
  reconfigurable props in the same tick (e.g. `gutterLines` + `decorations`
  together) could previously dispatch into an in-progress editor update on Vue
  ("Calls to EditorView.update are not allowed while an update is in progress")
  when a portal-slot fill mounted mid-update. The `value` write path is
  unchanged (synchronous, echo-guarded).

- Debut release of `@rozie-ui/codemirror` — Rozie's cross-framework port of
  [CodeMirror 6](https://codemirror.net/), the de-facto modular code editor for
  the web. One `.rozie` source compiles to six idiomatic packages
  (`@rozie-ui/codemirror-{react,vue,svelte,solid,lit,angular}`), each shipping
  the same 10-prop surface, a two-way `value` binding (`r-model:value` — the
  sole change channel, no events by design), a uniform 12-verb imperative
  handle (`getView`/`focus`/`getValue`/`replaceValue`/`dispatch`/`insertText`/
  `getSelection`/`setSelection`/`undo`/`redo`/`selectAll`/`scrollToPos`), and
  five extension-mounted portal slots (`panel`/`topPanel` mount-once, `tooltip`
  reactive, `gutter`/`decoration` reactive multi-instance). Every runtime-
  reconfigurable prop (`language`/`theme`/`readOnly`/`placeholder`/
  `extensions`/`basicSetup`/`gutterLines`/`decorations`) is wired to its own
  CodeMirror `Compartment`, so prop changes reconfigure the live editor without
  a remount — cursor, history, and scroll position are preserved.

  Each leaf declares 6 REQUIRED CodeMirror engine peers (`@codemirror/state`,
  `@codemirror/view`, `@codemirror/commands`, `@codemirror/theme-one-dark`, the
  `codemirror` meta-package, and `@codemirror/lang-javascript`) plus its
  framework peer, and 10 OPTIONAL `@codemirror/lang-*` preset peers
  (`peerDependenciesMeta` `optional: true`) — install only the language presets
  you use via the curated `/languages` subpath. `codemirror-vue` ships a
  JetBrains `web-types.json` and `codemirror-lit` ships a Custom Elements
  Manifest (`custom-elements.json`), both generated from the same lowered IR
  the READMEs use.

  This release also closes a deep audit (see
  `.planning/quick/260810-d7s-shore-up-rozie-ui-codemirror-for-first-n/AUDIT.md`)
  performed ahead of the debut: two documentation-drift fixes (the Solid
  `panel` slot's actual prop name is `panelSlot`, not `panel`; the
  handle-manifest header prose was missing 4 of 12 verb names), a real family
  unit-test suite (previously absent — `vitest run --passWithNoTests` silently
  passed with zero assertions), and expanded VR behavioral coverage for the
  `theme`/`readOnly`/`basicSetup` compartment reconfigures and the `gutter`/
  `decoration` reactive multi-instance slots. No public-surface change — this
  is a patch, not a feature release.

## 0.1.2

### Patch Changes

- @rozie/runtime-solid@0.2.1

## 0.1.1

### Patch Changes

- @rozie/runtime-solid@0.2.0
