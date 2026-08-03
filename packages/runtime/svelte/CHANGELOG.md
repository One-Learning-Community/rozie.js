# @rozie/runtime-svelte

## 0.2.2

### Patch Changes

- Array-form `:style` merge. `rozieStyle` now accepts an **array** of style
  sources (`:style="[a, b]"`) and merges them left-to-right (later wins,
  mirroring Vue's `normalizeStyle`); each element still goes through the
  same single-value logic. Every element is normalized to a CSS-declaration
  string, stripping a trailing `;` per element before the `'; '` join so
  concatenation never produces a `;;` empty declaration (the
  `project_angular_style_map_double_semicolon_drop` class of bug); the
  browser's cascade resolves "later wins". This closed the `ROZ144`
  restriction — emitters are unchanged, the array literal already reached
  this helper at the existing binding site.
- **Republish note:** `0.2.1` was cut before this landed
  (`cbe01eaa`), so the published `0.2.1` tarball does not contain it.
  `0.2.2` is the first published build with the array branch.

## 0.2.1

### Patch Changes

- @rozie/runtime-keynav-core@0.2.1

## 0.2.0

### Minor Changes

- 364f4c5: Add the `r-portal="<container-expr>"` element-level teleport directive. Distinct from the pre-existing `<slot portal />` slot-content-INTO-container primitive (`$portals.NAME(...)`, untouched by this change): `r-portal` relocates an ORDINARY template element's own rendered subtree OUT to a container the expression resolves to, using each target's native teleport construct — React `createPortal`, Vue `<Teleport :to :disabled>` (emitter-only; authors still cannot write `<Teleport>` directly, `ROZ926` gates author input only), Solid `<Portal>` under `<Show>`, a new Svelte `roziePortal` action (`@rozie/runtime-svelte`), an AOT-safe Angular `effect()`/`viewChild()` field pair, and a new Lit `RoziePortalController` ReactiveController (`@rozie/runtime-lit`) driving a cached `@query(..., true)` ref.

  A falsy container expression renders the subtree in place — byte-behavior-identical to omitting the directive — so a consumer-facing `appendTo`-style prop can safely default off with zero churn for existing consumers.

  Three new diagnostics (`ROZ990`–`ROZ992`) reject `r-portal` on a `<slot>` (redirect to the boolean `portal` attribute), on a `<components>`-registered child component (v1 limitation — only plain/host elements may portal), and with an empty value.

  Lit is the one target with a real correctness gap to close: `static styles`' shadow-scoped CSS never reaches a light-DOM-relocated element, so the Lit emitter now also pushes the component's own scoped CSS through the existing `injectGlobalStyles` sink whenever `r-portal` is in use — the relocated element already carries the component's scope attribute, so the globally-injected rules match only that component's own elements.

### Patch Changes

- @rozie/runtime-keynav-core@0.2.0
