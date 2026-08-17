# Cross-Framework Parity & Known Limitations

Rozie's goal is **high-percentage cross-framework parity** — one `.rozie`
definition that compiles to idiomatic React, Vue, Svelte, Angular, Solid, and
Lit. "High-percentage", not 100%: each target framework has its own
capabilities and constraints, and a small set of documented edge cases is the
deliberate trade-off for a single author-side API.

Every component behavior that matters — reactive state, two-way binding,
events, lifecycle, slots, listeners — behaves identically across all six
targets. The limitations below are about *how a consumer authors against* a
slot, or about a target framework's own runtime semantics — never about a
component rendering wrong state or firing a broken event.

## Text interpolation of non-primitives — unified

Interpolating a non-primitive value (`{{ object }}`, `{{ array }}`) is a place the
six targets historically diverged hard: Vue pretty-printed JSON, Svelte/Angular
comma-joined `[object Object]`, Solid/Lit space-joined it, and **React threw
`Objects are not valid as a React child` and crashed.** Rozie unifies this — a
non-provably-primitive interpolation is wrapped in an internal `rozieDisplay`
helper (Vue `toDisplayString` semantics, crash-safe on circular/BigInt structures)
so the **same portable JSON renders everywhere** and React no longer
crashes. Provably-primitive interpolations (typed `String`/`Number`/`Boolean`
props, `.length`, comparisons, concatenations, boolean HTML attributes, …) stay
raw and byte-identical to per-target hand-written output. Vue is untouched (its
native behavior already matches); Angular inlines the helper as a component method.

This is on by default and reversible: `safeInterpolation: false` (compiler/plugin
option), `--no-safe-interpolation` (CLI), or `<rozie safe-interpolation="false">`
(per-component envelope attribute, precedence: envelope › global › default-on)
restores the old raw per-target emit. Separately, a *bare* whole-object sigil
(`{{ $data }}` rather than `{{ $data.columns }}`) has no portable v1 representation
and is a uniform compile error (**ROZ978**), independent of `safeInterpolation`.
See [Safe non-primitive interpolation](/guide/templates-and-events#safe-non-primitive-interpolation-—-objects-render-as-portable-json-never-crash)
for the full mechanics.

Relatedly, in **attribute position** the targets used to disagree on nullish values: a
whole-value binding like `:data-locked="$data.locked ? 'true' : null"` (or a plain
`:title="$data.note"` that is `null`) dropped the attribute on Vue but rendered `attr=""`
on the other five (they routed through `rozieDisplay`, and `rozieDisplay(null)` is `''`).
Rozie unifies this too — a nullish bound attribute value now **drops the attribute** on all
six targets, matching Vue's native `:attr` binding and the web platform (so `[data-locked]`
presence selectors and `hasAttribute(...)` agree everywhere). The drop predicate is
`value == null` **only** — `false` still stringifies, so `aria-expanded="false"` /
`data-x="false"` are preserved. Text/interpolation position is unchanged (`null` → `''`, the
table above). See [Attribute position — a nullish bound value drops the attribute](/guide/templates-and-events#attribute-position-—-a-nullish-bound-value-drops-the-attribute).

## Slot consumer ergonomics

### React — scoped slots are render-prop function props

React has no native template-slot mechanism. A Rozie scoped slot
(`<slot name="item" :value="x" />`) compiles, for the React target, to a
render-prop function prop:

```tsx
// Rozie scoped slot → React consumer
<List renderItem={(ctx) => <Row label={ctx.value} />} />
```

Every other target gets a native template/snippet/slot binding; React consumers
use the render-prop form. The slot still receives the exact same params — only
the consumer-side authoring shape differs.

### Consumer-side slot fill — third-party React consumers of compiled Rozie components

When one `.rozie` file consumes another (`<Modal><template #header="{ close }">…</template></Modal>`),
Rozie's compiler threads the producer's `SlotDecl.paramTypes` onto the consumer's
`SlotFillerDecl.paramTypes`, then emits the per-target dispatch shape with full
type narrowing. For Rozie-to-Rozie composition this is transparent: a Rozie
consumer authors `<template #header="{ close }">` and the compiler produces a
correctly-typed render-prop, snippet block, template, or native slot per target.

For **third-party React consumers** that import a compiled Rozie component
directly (without going through the Rozie compiler), the React render-prop
divergence applies asymmetrically. The consumer must use the render-prop form:

```tsx
// External React consumer (NOT a .rozie file) — note the function-prop shape
import Modal from '@my-design-system/modal';
<Modal renderHeader={({ close }) => <button onClick={close}>×</button>} />
```

The `renderHeader` prop signature is exported via the `.d.ts` sidecar, so
the `close` param is fully typed — the only ergonomic friction is the
function-prop authoring shape (vs Vue's `<template #header="{ close }">`).
This is the documented v1 acceptable edge case per Rozie's "high-percentage
parity, not 100%" stance.

The canonical example is `examples/ModalConsumer.rozie` and its compiled
output at `tests/dist-parity/fixtures/ModalConsumer.*`.

### Dynamic slot names (R5) — per-target consumer-side divergences

A Rozie consumer using `<template #[expr]>` (dynamic slot name, where `expr`
evaluates at runtime to the slot name) dispatches differently per target:

<!-- VitePress's Vue runtime parses `{{ ... }}` in markdown as interpolation. The HTML-entity escape (`&#123;`) does NOT work inside markdown code spans because markdown-it HTML-escapes `&` to `&amp;`, leaving a literal `&#123;` on the page. The correct workaround is `<span v-pre>…</span>` around the backticked code, which tells Vue to skip interpolation parsing for that subtree. The React/Solid/Svelte rows below need it because their cells contain `{{ }}`. This comment MUST live outside the table — a mid-table HTML comment breaks markdown table containment. -->

| Target  | Consumer-side dispatch                                                                                       | Producer-side acceptance needed?            |
| ------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Vue     | `<template #[<expr>]>body</template>` — Vue 3.4+ native scoped-slot bracketed form                            | No — native scoped-slot dispatch handles it |
| Lit     | `<div slot="${<expr>}">body</div>` — shadow-DOM native projection routes on the runtime `slot=` value         | No — shadow DOM native projection           |
| React   | <span v-pre>`<Producer slots={{ [<expr>]: () => <>body</> }} />`</span> — additive `slots` prop with object dispatch | Yes — producer must accept `slots?: Record<string, (ctx: Ctx) => ReactNode>` |
| Solid   | <span v-pre>`<Producer slots={{ [<expr>()]: () => <>body</> }} />`</span> — signal-auto-called key | Yes — producer must accept `slots?: ...` |
| Svelte  | <span v-pre>`<Producer snippets={{ [<expr>]: __rozieDynSlot_N }}>{#snippet __rozieDynSlot_N()}body{/snippet}</Producer>`</span> | Yes — producer must accept `snippets?: Record<string, Snippet<[Ctx]>>` |
| Angular | `<Producer><ng-template #__dynSlot_N>body</ng-template><ng-container *ngTemplateOutlet="templates[<expr>]" /></Producer>` + class-body `@ViewChild` + `templates` getter | Yes — producer must accept `@Input() templates?: Record<string, TemplateRef<Ctx>>` |

For Vue + Lit a Rozie author writing `<template #[name]>` will get correct
runtime dispatch out of the box. For React / Solid / Svelte / Angular, the
**producer-side acceptance of the slots/snippets/templates input prop** is the
hand-off contract; the recommended runtime dispatch order is
`slots?.[name]?.(ctx) ?? renderNamed?.(ctx) ?? defaultContent`.

### Lit — scoped slot params arrive via a data attribute

Web Components have no native scoped-slot mechanism. For the Lit target, scoped
slot params are exposed on the projected `<slot>` element via a
`data-rozie-params` attribute (a JSON-serialized context object), readable from
the consumer side with the small `observeRozieSlotCtx` helper. Default and
named slots without params use native `<slot>` projection unchanged.

A first-paint smoke check
(`tests/visual-regression/specs/lit-scoped-fill-firstpaint.spec.ts`)
verifies the observed ctx is wired correctly on the first paint — no flicker,
no `undefined` reference in the body's `this._headerCtx?.close` access.

This attribute-based mechanism remains the path for an ordinary statically-named
scoped slot (the shape above) and for a paramless dynamically-named fill. For a
scoped fill that is **also** dynamically named, or matched against a producer's
dynamic-name family, or targets a non-identifier static name, the direct
`rozieSlots` record property is the mechanism instead — no JSON serialization, no
attribute observer. See
[Lit — rozieSlots record dispatch](#lit-—-rozieslots-record-dispatch-for-scoped-dynamic-name-and-family-matched-fills)
for the dispatch order and the third-party direct-binding form.

### Consumer-side two-way binding

A producer prop declared `model: true` emits the per-target two-way machinery
(`defineModel`, `$bindable`, `useControllableState`, `model<T>()`,
`createControllableSignal`, Lit custom-event pair) on the **producer** side.
The consumer side opts in to the matching two-way wiring via the
**`r-model:propName="<writable-lvalue>"` directive** — the Vue 3
`v-model:argName=` analog, parallel to the existing form-input
`r-model="$data.draft"` sugar.

```rozie
<!-- consumer.rozie — engaging the producer's model: true machinery -->
<Modal r-model:open="$data.dialogOpen">
  <template #footer="{ close }">
    <button @click="close">×</button>
  </template>
</Modal>
```

#### Per-target emit

The directive lowers to each target's two-way binding shape:

| Target  | `r-model:open="$data.open"` emit                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Vue     | `<Modal v-model:open="open">`                                                                            |
| Svelte  | `<Modal bind:open={open}>`                                                                               |
| React   | `<Modal open={open} onOpenChange={setOpen}>`                                                             |
| Solid   | `<Modal open={open()} onOpenChange={setOpen}>`                                                            |
| Angular | `<rozie-modal [open]="open()" (openChange)="open.set($event)">` (long-form `[(open)]` banana-in-a-box)  |
| Lit     | `<rozie-modal .open=${this._open.value} @open-change=${(e: CustomEvent) => { this._open.value = e.detail; }}>` |

The byte-locked dist-parity fixtures live at
`tests/dist-parity/fixtures/ModalConsumer.{vue,svelte,tsx,solid.tsx,lit.ts,angular.ts}`
and the matching forwarding-pattern fixtures live at
`tests/dist-parity/fixtures/WrapperModal.*`. All 6 × 4 entrypoints
(compile / cli / babel-plugin / unplugin) emit byte-identical output.

#### LHS rules

The right-hand-side expression must be a **writable lvalue**:

- `$data.X` — top-level reactive state member (most common case)
- `$data.X.Y.Z` — deep member chain rooted in `$data` (validator accepts;
  Lit/React/Solid emit inline reassignment arrow as setter; Vue/Svelte handle
  natively via `v-model`/`bind:` macros)
- `$props.X` — **only when** the consumer's own `<props>` declares `X` with
  `model: true` (the forwarding pattern; see WrapperModal demonstration below)

Literals, ternaries, function calls, `$computed` refs, `$refs.X`, and
`$props.X` without `model: true` are rejected at IR-validation time with
**ROZ951** (LHS not writable).

#### Diagnostic codes

| Code | Trigger | Notes |
| ---- | ------- | ----- |
| **ROZ949** | `r-model:propName=` on a component whose producer prop lacks `model: true` | Dual-frame diagnostic — consumer site + producer decl site, so authors see exactly which prop on which producer needs the `model: true` toggle |
| **ROZ950** | `r-model:` with empty arg (e.g. `r-model:="..."`), OR `r-model:propName=` applied to a non-component HTML tag | Single combined code — both cases share "the directive cannot be applied here" semantics |
| **ROZ951** | RHS is not a writable lvalue per the rules above | Hint suggests bind to `$data.X` or, in a wrapper component, `$props.X` declared with `model: true` |

#### WrapperModal forwarding pattern

A consumer component can ITSELF declare a `model: true` prop and forward it
into a producer's `r-model:propName=` directive. The wrapper's prop becomes
two-way (its consumers can `r-model:open="$data.x"` on the wrapper) and
internally propagates through the inner Modal's controllable-state machinery:

```rozie
<rozie name="WrapperModal">
<components>{ Modal: './Modal.rozie' }</components>
<props>
{
  open: { type: Boolean, default: false, model: true }
}
</props>
<template>
<Modal r-model:open="$props.open" />  <!-- forwards wrapper's own model:true prop -->
</template>
</rozie>
```

The byte-locked emit lives at `tests/dist-parity/fixtures/WrapperModal.*` for
each target. The wrapper's `useControllableState` (React) /
`createControllableSignal` (Solid) / `defineModel` (Vue) / `$bindable`
(Svelte) / `model<T>()` (Angular) / `createLitControllableProperty` (Lit)
instance becomes the bridge between the parent's two-way bind and the inner
Modal's matching machinery.

### Lit — rozieSlots record dispatch for scoped, dynamic-name, and family-matched fills

Lit's static-name scoped-fill mechanism (a per-slot `_<name>Ctx` class field,
[described above](#lit-—-scoped-slot-params-arrive-via-a-data-attribute)) needs a
stable name known at compile time. That broke down for a dynamic name (only known at
runtime) — there was no stable field name to synthesise it from, so mixing a scoped
fill with a dynamic name (e.g. `<template #[someName]="{ ctx }">…</template>`) did
not work on Lit — the only one of the six targets where this pairing fell through.

Lit now gains the same **`rozieSlots` record property** the other five record-capable
targets (`slots?:` / `snippets?:` / `templates?:` — React / Solid / Svelte / Angular)
already had:

```ts
@property({ attribute: false })
rozieSlots?: Record<string, (scope: any) => unknown>;
```

Every qualifying slot fill — scoped, dynamically named, or matched against a
producer's dynamic-name family (`SlotDecl.dynamicNameExpr` / `namePrefix`, see
[Producer-side dynamic slot names](#dynamic-slot-names-r5-—-per-target-consumer-side-divergences))
— now contributes one entry to a single <span v-pre>`.rozieSlots=${{ ... }}`</span> object literal on
the producer's tag, collected in source order. The producer's own dispatch tries,
in order:

1. **Record lookup** — `this.rozieSlots?.[key]?.(scope)`, tried first.
2. **Named function property** — the pre-existing per-slot `@property` receiver, for
   an ordinary statically-named scoped slot that never needed the record.
3. **Native `<slot>` fallback** — for a fill with no scope and no dynamic name, or
   when a consumer left a family member unfilled.

The **legacy `data-rozie-params` + `observeRozieSlotCtx` light-DOM path is retained
unchanged** — a *paramless* dynamic fill (a runtime name with no scoped context to
carry) keeps its original attribute-projection wrapper rather than being forced
through the record. Nothing that worked before this feature landed changed shape.

Backed by `packages/targets/lit/src/emit/__tests__/rozieSlots.test.ts` (19 cases:
record-path routing, dispatch ordering, and a regression guard proving the legacy
paramless-dynamic-fill path is untouched) and
`packages/core/tests/79-09-r12-six-target-compile.test.ts`.

#### Third-party (non-Rozie) Lit consumers — direct record binding

A plain Lit (or any custom-elements) consumer that imports a compiled Rozie
component directly, without going through the Rozie compiler, can now set the
record property directly instead of round-tripping scope data through a
JSON-serialized `data-rozie-params` attribute and an `observeRozieSlotCtx` observer:

```ts
// External Lit consumer (NOT a .rozie file) — direct record binding
import { html, render } from 'lit';
import '@my-design-system/table';

const el = document.querySelector('my-table')!;
(el as any).rozieSlots = {
  'cell-status': (scope: { row: Row; value: unknown }) =>
    html`<span class="badge">${scope.value}</span>`,
  'cell-score': (scope: { row: Row; value: unknown }) =>
    html`<strong>${scope.value}</strong>`,
};
```

Each key is a scope-taking function — no serialization, no attribute observer, no
JSON round-trip. This is the direct form of the `slots`/`snippets`/`templates` props
that third-party React/Solid/Svelte consumers already had; Lit was the one target
still missing a settable record property, and this closes that gap.

## Target-framework lifecycle semantics

### Lit / Solid — lifecycle hooks colocated with an always-rendered component

**`$onMount` is connect-once on every target.** It fires when the component
*instance* mounts — not when a root-level `r-if` flips. That is true of all six
emitters, and it is deliberate:

| Target | `$onMount` lowers to | Root `r-if` lowers to |
| --- | --- | --- |
| React | `useEffect(…, [])` | `open && <div>` inside the same component function |
| Vue | `onMounted(…)` | `v-if` in the template |
| Svelte | `onMount(…)` at instance scope | `{#if}` in the markup |
| Angular | `ngAfterViewInit()` | `@if` in the template |
| Solid | `onMount(…)` at component-body scope | `<Show>` inside the returned JSX |
| Lit | `firstUpdated()` | a `nothing` ternary inside `render()` |

In every case the hook sits *outside* the conditional. Hold the component
mounted and toggle the condition, and React's `useEffect(…, [])` re-fires no
more than Lit's `firstUpdated()`.

**Where you may still observe a difference is the consumer side**, and it is a
property of the host application's template rather than of the emitted
component. A React, Vue, Svelte, or Angular consumer typically writes the
condition *around the component* — `open && <Modal />`, `<Modal v-if="open" />` —
which destroys and recreates the instance, so the hook runs again. A Lit
consumer drives a connected custom element by property (`<rz-modal .open=…>`);
there is no idiomatic way to "unmount" it, so the element stays connected and
the hook does not re-run. Solid behaves the same way whenever the consumer keeps
the component mounted (note that Solid's `open() && <Modal />` does *not*
unmount — `<Show>` is required). Rozie compiles the component, not the page that
hosts it, so it cannot influence this.

The cleanup itself is always symmetric (no leaks, no double-fire).

**For prop-coupled effects, use `$watch` — not `$onMount`.** `$watch` is
supported on all six targets, fires post-flush everywhere (so its callback may
safely read `$refs`), and accepts `{ immediate: true }` when the effect must
also run on the initial value:

```js
$watch(() => $props.open, (isOpen) => {
  if (isOpen) lockScroll()
  else unlockScroll()
})
```

The two primitives are complementary by design: `$onMount` anchors
connect-time setup and its symmetric teardown, `$watch` tracks prop
transitions. The reference `Modal.rozie` pairs them exactly this way for its
`lockBodyScroll` prop.

::: warning Do not rely on `$onMount` re-firing
Because `$onMount` and `$watch` are frequently paired, an effect invoked from
*both* must be idempotent. `Modal.rozie`'s `lockScroll` saves the previous
`document.body.style.overflow` before overwriting it — running it twice for one
open would save the already-locked value and leave the page permanently
unscrollable. Gate such effects so they run once per transition.
:::

---

These are the *complete* set of documented limitations as of v1. Everything
else — props, **producer-side** `model:` two-way machinery, **consumer-side**
two-way binding (`r-model:propName=`), `<data>` reactive state, `$computed`,
`<listeners>` (`<listener>` elements with modifiers + `r-if` conditional attach), `r-for` / `r-if` / form-input `r-model`,
default + named slots, `$emit`, refs — behaves identically.
