# @rozie/runtime-lit

## 0.4.0

### Minor Changes

- `r-keynav`'s tabindex focus model no longer steals DOM focus or scrolls on a
  cold page load, or on any mount/re-appearance while focus sits on an
  unrelated element elsewhere on the page. Previously the first focus/scroll
  pass after mount (or a conditionally-rendered `r-if` root re-appearing)
  always ran unconditionally, which could yank keyboard focus into a
  just-mounted component even though the user was never interacting with it.

  The new rule is strict component containment: the guarded first/redundant
  pass only focuses and scrolls when DOM focus is already somewhere inside the
  owning component's rendered subtree (not merely "somewhere on the page").
  Arrow-key navigation and every other active-index change are completely
  unaffected — they still focus and scroll unconditionally, exactly as
  before.

  `@rozie/runtime-keynav-core` exports the shared containment predicate
  (`focusIsWithinScope` plus its `composedActiveElement`/`composedContains`/
  `documentHasRealFocus` building blocks) that every target implementation
  calls, so the semantics can never drift between React, Vue, Svelte, Solid,
  Lit, and Angular. React, Vue, Svelte, and Solid thread an additive, OPTIONAL
  runtime option — `getFocusScope` — through to the predicate; Lit derives its
  scope from `this.host` and Angular from an injected `ElementRef`, so neither
  needs the extra field. **Compatibility contract:** a previously-published
  leaf calling this runtime WITHOUT `getFocusScope` (i.e. not yet regenerated)
  degrades to the OLD document-scoped fallback rather than the old
  unconditional-focus behavior — never the reverse, and never a hard
  rejection.

  This release also folds in a drill-continuity fix: a component-internal
  transition that destroys the currently-focused element as part of the same
  render that resolves a sibling attachment's guarded pass (date-picker's
  months → days Escape exit is the concrete case) is treated as "still within
  scope" for a short, bounded window after the removal, so keyboard focus
  correctly lands back on the resolved item instead of falling to `<body>`.
  That window is chained across three animation frames rather than one,
  specifically so it survives a sibling consumer's own
  `requestAnimationFrame`-deferred value resolution (needed on React and
  Solid, whose effect/DOM-commit ordering can otherwise clear the window one
  frame too early — see `@rozie/runtime-keynav-core`'s `focusGuard.ts` module
  doc comment for the full mechanism).

  `@rozie/runtime-lit` additionally ships a previously-unreleased fix
  (`963233d1`): a multi-root `KeynavController` (multiple independent
  `r-keynav` groups sharing one shadow root, e.g. date-picker's day/months/
  years panels) no longer lets an inactive group's controller steal focus
  onto a different, currently-visible group's item at the same
  `data-rozie-keynav-item` index, and a group's root re-appearing with an
  unchanged active index is correctly re-focused instead of silently
  dropped.

  `@rozie/core`, `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin`
  bump because the compiler's five target emitters (bundled into `@rozie/core`
  and, through it, into the other three toolchain packages) now emit the
  `getFocusScope` wiring — one minted ref per top-level template element for
  the four fragment targets, an injected `ElementRef` host reference for
  Angular — alongside every `r-keynav` root's opts object.

### Patch Changes

- Updated dependencies
  - @rozie/runtime-keynav-core@0.4.0

## 0.2.2

### Patch Changes

- Array-form `:style` merge. `rozieStyle` now accepts an **array** of style
  sources (`:style="[a, b]"`) and merges them left-to-right (later wins,
  mirroring Vue's `normalizeStyle`); each element still goes through the
  same single-value logic. Every element is merged into ONE plain object
  (a string element's declarations parsed, keeping original casing since
  `styleMap` itself dispatches per-key on dash-presence) and then
  `styleMap(merged)`. This closed the `ROZ144` restriction — emitters are
  unchanged, the array literal already reached this helper at the existing
  binding site.
- **Republish note:** `0.2.1` was cut before this landed
  (`cbe01eaa`), so the published `0.2.1` tarball does not contain it.
  `0.2.2` is the first published build with the array branch.

## 0.2.1

### Patch Changes

- c279a7e: Add a new public `rozieResolvePortalledRef` helper, consumed by regenerated Lit leaves so author `ref="x"` bindings inside an `r-portal`-relocated subtree resolve correctly after `RoziePortalController` moves the subtree out of `this.renderRoot` (previously such refs resolved to `null` after the first render). Shipped as `patch` for this explicitly-scoped fix wave: the export is additive/non-breaking and is primarily consumed by our own generated leaf code, which pins `@rozie/runtime-lit` via `workspace:*` (resolved to the exact published version at publish time), so no consumer peer-range edit is required. Note for the record: strict semver would treat a new public export as `minor`; because `@rozie/runtime-lit` versions in lockstep with the rest of the fixed toolchain group, a `minor` bump here would rev the whole group from 0.2.0 to 0.3.0. Change this changeset to `minor` if strict-semver is preferred — no other file changes are needed either way.
  - @rozie/runtime-keynav-core@0.2.1

## 0.2.0

### Minor Changes

- 364f4c5: Add the `r-portal="<container-expr>"` element-level teleport directive. Distinct from the pre-existing `<slot portal />` slot-content-INTO-container primitive (`$portals.NAME(...)`, untouched by this change): `r-portal` relocates an ORDINARY template element's own rendered subtree OUT to a container the expression resolves to, using each target's native teleport construct — React `createPortal`, Vue `<Teleport :to :disabled>` (emitter-only; authors still cannot write `<Teleport>` directly, `ROZ926` gates author input only), Solid `<Portal>` under `<Show>`, a new Svelte `roziePortal` action (`@rozie/runtime-svelte`), an AOT-safe Angular `effect()`/`viewChild()` field pair, and a new Lit `RoziePortalController` ReactiveController (`@rozie/runtime-lit`) driving a cached `@query(..., true)` ref.

  A falsy container expression renders the subtree in place — byte-behavior-identical to omitting the directive — so a consumer-facing `appendTo`-style prop can safely default off with zero churn for existing consumers.

  Three new diagnostics (`ROZ990`–`ROZ992`) reject `r-portal` on a `<slot>` (redirect to the boolean `portal` attribute), on a `<components>`-registered child component (v1 limitation — only plain/host elements may portal), and with an empty value.

  Lit is the one target with a real correctness gap to close: `static styles`' shadow-scoped CSS never reaches a light-DOM-relocated element, so the Lit emitter now also pushes the component's own scoped CSS through the existing `injectGlobalStyles` sink whenever `r-portal` is in use — the relocated element already carries the component's scope attribute, so the globally-injected rules match only that component's own elements.

### Patch Changes

- @rozie/runtime-keynav-core@0.2.0
