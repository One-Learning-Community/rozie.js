# @rozie/runtime-lit

## 0.2.0

### Minor Changes

- 364f4c5: Add the `r-portal="<container-expr>"` element-level teleport directive. Distinct from the pre-existing `<slot portal />` slot-content-INTO-container primitive (`$portals.NAME(...)`, untouched by this change): `r-portal` relocates an ORDINARY template element's own rendered subtree OUT to a container the expression resolves to, using each target's native teleport construct — React `createPortal`, Vue `<Teleport :to :disabled>` (emitter-only; authors still cannot write `<Teleport>` directly, `ROZ926` gates author input only), Solid `<Portal>` under `<Show>`, a new Svelte `roziePortal` action (`@rozie/runtime-svelte`), an AOT-safe Angular `effect()`/`viewChild()` field pair, and a new Lit `RoziePortalController` ReactiveController (`@rozie/runtime-lit`) driving a cached `@query(..., true)` ref.

  A falsy container expression renders the subtree in place — byte-behavior-identical to omitting the directive — so a consumer-facing `appendTo`-style prop can safely default off with zero churn for existing consumers.

  Three new diagnostics (`ROZ990`–`ROZ992`) reject `r-portal` on a `<slot>` (redirect to the boolean `portal` attribute), on a `<components>`-registered child component (v1 limitation — only plain/host elements may portal), and with an empty value.

  Lit is the one target with a real correctness gap to close: `static styles`' shadow-scoped CSS never reaches a light-DOM-relocated element, so the Lit emitter now also pushes the component's own scoped CSS through the existing `injectGlobalStyles` sink whenever `r-portal` is in use — the relocated element already carries the component's scope attribute, so the globally-injected rules match only that component's own elements.

### Patch Changes

- @rozie/runtime-keynav-core@0.2.0
