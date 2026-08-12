# @rozie/core

## 0.5.3

### Patch Changes

- 003ed52: Angular target: consumer-side event bindings on composed component tags now resolve against the callee's declared `$emit` list, which the compiler threads onto the component-tag IR. Resolution is exact match first, then canonical match in first-declaration order, with literal passthrough when the child component never resolved. A resolved match lowers through the same public-name computation the callee's own output-declaration side uses, so the two seams cannot drift apart. This changes the compiled `(output)` binding names on component composition for direct `.rozie` compiler users and correctly serves BOTH authoring conventions at once: camel-authored emits (`$emit('rangeComplete')`, unaliased — the listener previously compiled to a dead hyphenated binding that never fired) and kebab-authored emits (`$emit('sort-change')`, aliased, the data-table / rete / command-palette convention — the public name stays the raw hyphenated string instead of being wrongly camelized).
- 003ed52: Lit target: multi-word `$emit()` names are now dispatched kebab-cased, so they actually reach the consumer's listener. Compiling a component that calls `$emit('regionIn', payload)` previously emitted `dispatchEvent(new CustomEvent('regionIn', …))` — the raw camelCase source name — while the consumer's `@region-in="…"` template binding compiled to a hyphenated `addEventListener('region-in', …)`. `addEventListener` is case-sensitive, so a multi-word emit never fired its listener; single-word names were immune by construction, which is why this went unnoticed. Both `$emit` lowering sites (script-statement position and template/listener-expression position) now kebab-case the dispatched event name using the same algorithm the Lit two-way model event path already used, so the dispatch side and the model path cannot drift apart.
- React, Svelte, and Solid targets: a kebab-spelled `aria-*`/`data-*` attribute bound on a composed component tag (`:aria-label="expr"` or plain `aria-label="str"`) now resolves against the callee's declared prop names and reaches the declared camelCase prop (`ariaLabel`), matching the behavior Angular, Lit, and Vue already had. Genuine passthrough attributes — no declared match, or a callee the compiler could not resolve — keep the existing hyphen-preserving behavior, and native DOM elements are unaffected.

## 0.5.2

## 0.5.1

### Patch Changes

- Solid emitter fix: `@event` handlers now correctly rewrite a destructured reactive-portal slot-scope parameter. A component consuming a slot scope shape like `#linkEditor="{ setLink, unsetLink, close }"` and wiring `@click="unsetLink()"` previously emitted a bare, un-rewritten `unsetLink` identifier on the Solid target — a runtime `ReferenceError`, since `unsetLink` is only in scope as a property of the slot-scope render-prop argument, not as a free variable. Every other Solid attribute-expression path (bindings, interpolations, spreads) already rewrote such a parameter to the scope accessor; event handlers were the one code path that did not.

  `@rozie/cli`, `@rozie/unplugin`, and `@rozie/babel-plugin` all bundle `@rozie/core`'s compiler and therefore carry this fix too, even though none of their own source changed.

## 0.5.0

### Minor Changes

- `@rozie/runtime-lit` gains a new public export, `RozieSlotDistributor` — a reactive
  controller that performs manual slot assignment for a Lit shadow root, used wherever a
  component needs to route projected children into loop-generated `<slot>` targets
  (e.g. carousel slides). Adopting manual `slotAssignment` turns OFF the browser's
  automatic Text-node projection for that shadow root: raw text children must now be
  assigned to a slot explicitly, and any code reading `assignedNodes()` needs to guard
  for the manual-assignment case. A host that adopts the controller needs its
  `shadowRootOptions` typed as `ShadowRootInit`.

  `@rozie/core` adds two new compile-time diagnostics and one new template sigil:
  - **ROZ148** — flags a prop whose name collides with an emitted callback name, before
    it becomes a runtime shadowing bug on a target that lowers the prop to a method.
  - **ROZ210** — flags a reserved slot name so it can't silently collide with an
    internally-generated one.
  - **`$slotted`** — a new member sigil authors can read inside a loop to get the live,
    reactively-assigned elements projected into that iteration's slot.

  `@rozie/{cli,unplugin,babel-plugin}` bundle `@rozie/core`'s compiler, so this release
  carries the same diagnostics and `$slotted` lowering through to every consumer of
  those packages — the compiler itself moved even though none of these three changed
  their own source. `$slotted` lowers to a reactive assigned-elements signal on the Lit
  target (backed by `RozieSlotDistributor`, gated behind a new `shouldDistributeSlots`
  check so it only emits where a loop actually needs manual slot assignment) and to a
  plain `[]` on the five hostless targets (React, Vue, Svelte, Solid, Angular), where
  there's no shadow root to distribute into.

  `@rozie/runtime-{react,vue,svelte,solid,keynav-core}` are version-aligned to 0.5.0 by
  the changesets `fixed` group riding the `runtime-lit` minor above — this is a
  version-alignment release only; none of these five packages has a source or behavior
  change in this wave.

  `@rozie-ui/date-picker-*` (all six targets) — day and caption labels are now derived
  from `Intl`, with a new `labels` prop for overriding them; range-span selections now
  validate against `disabled` dates; and the calendar header adds drill-in/drill-out
  navigation verbs.

  `@rozie-ui/embla-*` (all six targets) adopts `$slotted` for its carousel slides. On
  the Lit target specifically, this closes a real projection gap: raw `slot="slide"`
  children are now distributed per-iteration instead of only the first iteration
  claiming them.

  `@rozie-ui/{combobox,command-palette,data-table,sortable-list,tags,toast}-lit` are
  regenerated against the new Lit emitter output above — each already used a loop-slot
  pattern that now runs through `RozieSlotDistributor` / `$slotted` instead of the prior
  ad hoc approach, with no observable behavior change for existing consumers of these
  specific leaves.

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

## 0.3.2

### Patch Changes

- **Fixed (React, 3 seams) — `$onMount` staleness.** A callback registered inside `$onMount` runs once, but it used to close over the values present on the FIRST render and keep reading them forever. Three read kinds are now mirrored through synced refs so the mount-registered callback stays live:
  - **Prop reads** — `$props.x` read inside `$onMount` now resolves through a synced ref.
  - **Helper calls** — a `<script>` helper invoked inside `$onMount` now resolves through a synced ref, so the helper's own captured state is current at call time rather than at mount time.
  - **`$emit` handler props** — the emitted `on<Event>` prop read inside `$onMount` is mirrored too, so a consumer that swaps handler identity after mount actually gets called. This is what makes engine-callback components (rete, fullcalendar, embla, flatpickr, sortable-list) deliver events to the CURRENT handler.

  Because the emitted `useEffect` dep array is now honest about what it reads, the accompanying `// eslint-disable-line react-hooks/exhaustive-deps` suppression is no longer emitted on the mount effect.

- **Fixed (React + Solid, 4 seams) — component-tag prop delivery.** Props addressed to a CHILD COMPONENT are no longer renamed through the DOM attribute map. The map exists to translate authored attribute names to their DOM/JSX spellings on native elements; applying it to a component tag silently renamed — and therefore dropped — props the child had actually declared (`readonly`, `tabindex`, `for`, and friends).
  - `r-bind` with **literal** keys on a component tag (React + Solid).
  - `r-bind` with **dynamic** keys on a component tag (React + Solid). The dynamic path routes through the new `normalizeComponentAttrs` runtime helper, which strips the same prototype-pollution key set as `normalizeAttrs` but does **not** apply the DOM alias table — so the security strip survives on every tag kind. No security regression.
  - Solid `:attr` bindings on a component tag are likewise no longer remapped.

- **Fixed:** `reservedNames` — `normalizeComponentAttrs` is now reserved on Solid, so an author `<data>` key cannot shadow the auto-injected bare-name runtime import.

The target emitters are bundled into `@rozie/core` and inlined into `@rozie/cli`, `@rozie/unplugin` and `@rozie/babel-plugin` — every fix above changes emitted output for every consumer compiling through any of those entry points.

## 0.3.1

### Patch Changes

- **Fixed:** slot params that resolve to a script function are typed callable again (`(...args: any[]) => any`), reversing the 0.3.0 regression that typed documented render-prop callbacks (`toggle`, `retry`, `setFilter`, …) as `unknown` in the published `.d.ts`. `r-for` loop vars correctly remain `unknown` — that half of the 0.3.0 change was right and is unchanged. (`inferParamType`/`renderPropsInterface` — consumed by all six targets' `emitTypes.ts`.)
- **Fixed:** Lit no longer swallows a static `key="…"` attribute — the strip is now narrowed to the binding form (`:key="expr"`), matching the Svelte/Angular filter shape. A bound `r-for` loop key is still consumed by `repeat()`'s key function, never emitted as a DOM attribute.
- **Fixed:** Lit derived-`$watch` NaN comparison now matches React (`Object.is`) — a NaN-valued derived getter no longer re-fires the watch callback on every cycle the base prop's setter ran.
- **Fixed:** Lit `:class` bound to a null-defaulted prop drops the attribute instead of rendering `class="null"`, matching React/Vue.
- **Added:** `ROZ209` — an `$emit` event name that cannot lower to a valid JS identifier (e.g. `update:foo`, `a.b`) is now a compile error, with a hint pointing two-way-binding authors at a `model: true` prop instead of Vue's `update:x` convention.
- **Note (0.3.0 behavior change, documented late — no further behavior change in this release):** React `$watch` dep arrays for a derived member-chain getter now evaluate the getter's chain eagerly, including on first render — crash-parity with Vue/Solid/Svelte/Angular. See the [`$watch` guide](https://github.com/rozie-js/rozie/blob/main/docs/guide/features.md#watch-getter-cb--react-to-value-transitions) for the consumer-facing note.

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
