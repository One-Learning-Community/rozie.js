# @rozie/core

## 0.3.0

### Minor Changes

- Add the `$memo(fn, keyFn)` core primitive for memoizing an expensive derived computation against an explicit dependency key, plus the `ROZ146` misuse diagnostic (rejects `$memo` calls that don't fit the `(fn, keyFn)` shape). The cache is strict-null-safe — a `null`-keys sentinel plus a locally-captured, property-cast cache shape so a `null`/`undefined` key never collides with "no cache yet".
- Add the `ROZ147` Lit inherited-DOM-property prop-name validator, which rejects a Lit-targeted prop name that collides with a property Lit's base `ReactiveElement`/`HTMLElement` already defines (shadowing hazard). The `ROZ142` known-safe corpus (already-vetted DOM-method-shaped prop names) is exempted so existing components don't regress.
- Retire `ROZ144` — array-form `:style` (`:style="[{color},{fontSize}]"`) is now uniformly supported across every target, including the Angular `[attr.style]="__rozieMergeStyle(...)"` merge path and the react/solid/lit/svelte runtime normalizers. What was previously a hard compile error is now a supported author pattern.
- Narrow `ROZ207` to exempt the covered nested-`$data` subset (a `$data` object literal whose nested member is read-and-written in the same tick), with reactive lowering for that subset on react, vue, svelte, solid, angular, and lit — previously this shape either mis-lowered or was rejected outright depending on target.
- Scope `ROZ208` down to `$refs`/`$slots` sigils specifically inside `<data>` initializers, with per-target data-init sigil lowering on all six targets (angular/lit lowered first, then react/vue/svelte/solid) — other `<data>` initializer shapes that were incorrectly caught by the old, broader `ROZ208` now compile.
- Synthesize Lit slot scope-param types via a shared helper rather than leaving them typed as `unknown`.
- Rewrite the Angular `new URL(lit, import.meta.url)` pattern to a hoisted `?url` import — `import.meta.url` breaks Angular AOT (`project_angular_aot_no_import_meta_url`), so the emitter now avoids emitting it at all.
- Dedup the last-import / hoisted-type-decl boundary comment (previously duplicated onto both the last top-level import and the first hoisted type declaration) and the vue/svelte splice-seam boundary dedups (after-side + leading splice, entangled trailing splice) that produced duplicate or malformed seams in some `<script>` rewrite shapes.
- **This series' 8 emitter seam fixes**, closing gaps found while regenerating the `otp`/`embla` leaves and auditing their neighbors:
  - React: map `autocorrect` correctly (was dropped/miscased) and keep `spellcheck` native-cased on Solid.
  - React + Solid: keep emit-handler props (`onChange`/`onComplete`-style) out of the root DOM fallthrough spread — previously a declared emit handler landed in both the direct prop call and the attrs/rest spread, firing every consumer handler twice.
  - Lit: drop a nullish attribute for a nullable provably-primitive prop read instead of rendering the literal string `null` through the attribute binding.
  - Lit: strip `r-for` loop keys from the emitted element instead of leaking them as literal DOM attributes.
  - React + Lit: dep a derived-getter `$watch` on its tracked read path, not the base prop's identity, so the watcher actually fires on the value it derives from.
  - React: stop typing unresolved `r-for` slot-context params as callable (`() => void`) in the emitted public `.d.ts` — they're now `unknown`, matching what the runtime actually hands the caller.
  - Angular: the same nullish-attribute-drop fix as the Lit case, applied to Angular's `[attr.*]` property-binding path.

  The target emitters are bundled into `@rozie/core` and inlined into `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin` — every one of these fixes changes the emitted output for every consumer compiling through any of those entry points.

## 0.2.1

### Patch Changes

- c279a7e: Fix the `@rozie/target-lit` emitter's `$attrs` auto-fallthrough skip-list to always exclude the reserved `data-rozie-ref` attribute (compiler bookkeeping, never a consumer prop). Without this fix, a parent-assigned `ref=` on a compiled Lit component's own host tag could clobber that component's own internal `data-rozie-ref` markers via attribute fallthrough re-application. The Lit emitter is bundled into `@rozie/core` (and therefore inlined into `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin`, all of which compile `.rozie` through core) — this patch corrects the emitted Lit output for every consumer compiling through any of those entry points.

## 0.2.0

### Minor Changes

- 364f4c5: Add the `r-portal="<container-expr>"` element-level teleport directive. Distinct from the pre-existing `<slot portal />` slot-content-INTO-container primitive (`$portals.NAME(...)`, untouched by this change): `r-portal` relocates an ORDINARY template element's own rendered subtree OUT to a container the expression resolves to, using each target's native teleport construct — React `createPortal`, Vue `<Teleport :to :disabled>` (emitter-only; authors still cannot write `<Teleport>` directly, `ROZ926` gates author input only), Solid `<Portal>` under `<Show>`, a new Svelte `roziePortal` action (`@rozie/runtime-svelte`), an AOT-safe Angular `effect()`/`viewChild()` field pair, and a new Lit `RoziePortalController` ReactiveController (`@rozie/runtime-lit`) driving a cached `@query(..., true)` ref.

  A falsy container expression renders the subtree in place — byte-behavior-identical to omitting the directive — so a consumer-facing `appendTo`-style prop can safely default off with zero churn for existing consumers.

  Three new diagnostics (`ROZ990`–`ROZ992`) reject `r-portal` on a `<slot>` (redirect to the boolean `portal` attribute), on a `<components>`-registered child component (v1 limitation — only plain/host elements may portal), and with an empty value.

  Lit is the one target with a real correctness gap to close: `static styles`' shadow-scoped CSS never reaches a light-DOM-relocated element, so the Lit emitter now also pushes the component's own scoped CSS through the existing `injectGlobalStyles` sink whenever `r-portal` is in use — the relocated element already carries the component's scope attribute, so the globally-injected rules match only that component's own elements.
