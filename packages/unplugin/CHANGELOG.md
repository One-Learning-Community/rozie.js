# @rozie/unplugin

## 0.3.1

### Patch Changes

- Compiles through `@rozie/core@0.3.1`: fixes the 0.3.0 slot-param-callable regression (script-function slot params — `toggle`, `retry`, `setFilter`, … — type callable again in the public `.d.ts`; `r-for` loop vars correctly stay `unknown`), narrows the Lit `key` strip to the binding form (a static `key="…"` renders again), Lit derived-`$watch` `Object.is` NaN parity with React, Lit `:class` nullish-drop parity with React/Vue, and the new `ROZ209` `$emit`-name charset validator. The target emitters are bundled into `@rozie/core` and inlined here, so every Vite/Rollup/Webpack/esbuild/Rolldown/Rspack build emits the corrected output for every target.
- Updated dependencies
  - @rozie/core@0.3.1

## 0.3.0

### Minor Changes

- Compiles through `@rozie/core@0.3.0`: adds the `$memo(fn, keyFn)` primitive plus its `ROZ146` misuse diagnostic, the `ROZ147` Lit inherited-DOM-property validator, `ROZ144` retirement (array-form `:style` now uniformly supported), the `ROZ207`/`ROZ208` narrowing plus their per-target reactive/sigil lowering, Lit slot scope-param type synthesis, the Angular `?url` import rewrite for `new URL(lit, import.meta.url)`, boundary-comment/splice-seam dedups, and this series' 8 emitter seam fixes (react/solid emit-handler fallthrough, react `autocorrect` + solid `spellcheck` attribute mapping, lit nullish-attribute-drop + `r-for` key leak, react/lit derived-getter `$watch` dep correctness, react `.d.ts` unresolved slot-param typing, angular nullish-attribute-drop). The target emitters are bundled into `@rozie/core` and inlined here, so every Vite/Rollup/Webpack/esbuild/Rolldown/Rspack build emits the corrected output for every target.
- Updated dependencies
  - @rozie/core@0.3.0

## 0.2.1

### Patch Changes

- c279a7e: Fix the `@rozie/target-lit` emitter's `$attrs` auto-fallthrough skip-list to always exclude the reserved `data-rozie-ref` attribute (compiler bookkeeping, never a consumer prop). Without this fix, a parent-assigned `ref=` on a compiled Lit component's own host tag could clobber that component's own internal `data-rozie-ref` markers via attribute fallthrough re-application. The Lit emitter is bundled into `@rozie/core` (and therefore inlined into `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin`, all of which compile `.rozie` through core) — this patch corrects the emitted Lit output for every consumer compiling through any of those entry points.
- Updated dependencies [c279a7e]
  - @rozie/core@0.2.1

## 0.2.0

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/core@0.2.0
