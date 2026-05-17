# Cross-Framework Parity & Known Limitations

Rozie's goal is **high-percentage cross-framework parity** — one `.rozie`
definition that compiles to idiomatic React, Vue, Svelte, Angular, Solid, and
Lit. "High-percentage", not 100%: each target framework has its own
capabilities and constraints, and a small set of documented edge cases is the
honest, deliberate trade-off for a single author-side API.

Every component behavior that matters — reactive state, two-way binding,
events, lifecycle, slots, listeners — behaves identically across all six
targets. The limitations below are about *how a consumer authors against* a
slot, or about a target framework's own runtime semantics — never about a
component rendering wrong state or firing a broken event.

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

The `renderHeader` prop signature is exported via the `.d.ts` sidecar
(Phase 7 producer-side emit), so the `close` param is fully typed — the only
ergonomic friction is the function-prop authoring shape (vs Vue's
`<template #header="{ close }">`). This is the documented v1 acceptable edge
case per the project's "high-percentage parity, not 100%" stance; an RFC for a
render-prop ergonomic improvement (e.g., a small JSX-element wrapper that
compiles to render-prop dispatch) is a candidate v2 enhancement.

The canonical example is `tests/slot-matrix/fixtures/consumer-dynamic-name/expected.tsx`
and the Phase 07.2 Plan 06 dogfood at `examples/ModalConsumer.rozie` →
`tests/dist-parity/fixtures/ModalConsumer.tsx`.

### Dynamic slot names (R5) — per-target consumer-side divergences

A Rozie consumer using `<template #[expr]>` (dynamic slot name, where `expr`
evaluates at runtime to the slot name) dispatches differently per target:

| Target  | Consumer-side dispatch                                                                                       | Producer-side acceptance needed?            |
| ------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Vue     | `<template #[<expr>]>body</template>` — Vue 3.4+ native scoped-slot bracketed form                            | No — native scoped-slot dispatch handles it |
| Lit     | `<div slot="${<expr>}">body</div>` — shadow-DOM native projection routes on the runtime `slot=` value         | No — shadow DOM native projection           |
<!-- VitePress (Vue compiler-sfc) parses `{{ ... }}` as interpolation even inside markdown inline-code spans inside table cells. Use HTML entities to render literal `{{` and `}}` without triggering the parser. -->
| React   | `<Producer slots=&#123;&#123; [<expr>]: () => <>body</> &#125;&#125; />` — additive `slots` prop with object dispatch             | Yes — producer must accept `slots?: Record<string, (ctx: Ctx) => ReactNode>` |
| Solid   | `<Producer slots=&#123;&#123; [<expr>()]: () => <>body</> &#125;&#125; />` — signal-auto-called key                               | Yes — producer must accept `slots?: ...`     |
| Svelte  | `<Producer snippets=&#123;&#123; [<expr>]: __rozieDynSlot_N &#125;&#125;>&#123;#snippet __rozieDynSlot_N()&#125;body&#123;/snippet&#125;</Producer>`  | Yes — producer must accept `snippets?: Record<string, Snippet<[Ctx]>>` |
| Angular | `<Producer><ng-template #__dynSlot_N>body</ng-template><ng-container *ngTemplateOutlet="templates[<expr>]" /></Producer>` + class-body `@ViewChild` + `templates` getter | Yes — producer must accept `@Input() templates?: Record<string, TemplateRef<Ctx>>` |

For Vue + Lit a Rozie author writing `<template #[name]>` will get correct
runtime dispatch out of the box. For React / Solid / Svelte / Angular, the
**producer-side acceptance of the slots/snippets/templates input prop** is the
hand-off contract — see the per-target dispatch chains documented in Plan
07.2-04 SUMMARY for the recommended runtime dispatch order
(`slots?.[name]?.(ctx) ?? renderNamed?.(ctx) ?? defaultContent`).

### Lit — scoped slot params arrive via a data attribute

Web Components have no native scoped-slot mechanism. For the Lit target, scoped
slot params are exposed on the projected `<slot>` element via a
`data-rozie-params` attribute (a JSON-serialized context object), readable from
the consumer side with the small `observeRozieSlotCtx` helper. Default and
named slots without params use native `<slot>` projection unchanged.

Phase 07.2 Plan 03 added a first-paint smoke check
(`tests/visual-regression/specs/lit-scoped-fill-firstpaint.spec.ts`) that
verifies the observed ctx is wired correctly on the first paint — no flicker,
no `undefined` reference in the body's `this._headerCtx?.close` access.

### Consumer-side two-way binding

A producer prop declared `model: true` emits the per-target two-way machinery
(`defineModel`, `$bindable`, `useControllableState`, `model<T>()`,
`createControllableSignal`, Lit custom-event pair) on the **producer** side.
The consumer side opts in to the matching two-way wiring via the
**`r-model:propName="<writable-lvalue>"` directive** (Phase 07.3 — Vue 3
`v-model:argName=` analog, parallel to the existing form-input
`r-model="$data.draft"` sugar).

```rozie
<!-- consumer.rozie — engaging the producer's model: true machinery -->
<Modal r-model:open="$data.dialogOpen">
  <template #footer="{ close }">
    <button @click="close">×</button>
  </template>
</Modal>
```

#### Per-target emit

The directive lowers to each target's idiomatic two-way binding shape:

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

#### LHS rules (D-03 permissive)

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
| **ROZ951** | RHS is not a writable lvalue per the D-03 rules above | Hint suggests bind to `$data.X` or, in a wrapper component, `$props.X` declared with `model: true` |

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

### Lit — scoped + dynamic slot names (deferred combination)

The Lit static-name scoped fill IR pre-transform (`rewriteScopedParamRefs`)
requires a stable `_<name>Ctx` class field name derived from the slot's name.
For a dynamic name (only known at runtime), there's no stable name to
synthesise the field from. Mixing scoped + dynamic in Lit (e.g.,
`<template #[someName]="{ ctx }">…</template>`) is therefore a documented v1
limitation. No fixture exercises the combination, and no consumer pattern in
the dogfood examples needs it. If real-world usage surfaces a need, the
resolution path is a Map-keyed ctx observer + class-body Map field instead of
the per-name field shape — a candidate v2 RFC.

## Target-framework lifecycle semantics

### Lit / Solid — lifecycle hooks colocated with an always-rendered component

When a component's **root** element is conditionally rendered
(`r-if="$props.open"`) and the component also declares `$onMount` / `$onUnmount`
hooks, the timing differs by target:

- **React, Vue, Svelte** — the conditional unmount collapses the whole
  component subtree, so `$onMount` / `$onUnmount` effectively fire with the
  condition.
- **Lit, Solid** — the compiled custom element / component instance stays
  alive across the condition toggle (only its rendered output changes), so
  `$onMount` fires once when the element/component first connects, not each
  time the root condition flips.

The cleanup itself is always symmetric (no leaks, no double-fire). If a
lifecycle side effect must track a *prop* rather than component connect, gate
it on the prop inside the hook:

```js
const lockScroll = () => {
  if (!$props.open) return   // prop-coupled, not connect-coupled
  document.body.style.overflow = 'hidden'
}
$onMount(lockScroll)
```

The reference `Modal.rozie` already follows this pattern for its
`lockBodyScroll` prop.

## Tooling notes

### Angular — visual-regression rig host cell

The Angular emitter is fully supported and validated end-to-end: the
`angular-analogjs` consumer demo builds with real Ahead-of-Time compilation and
its Playwright e2e suite passes. One internal tooling harness — the uniform
cross-target *visual-regression* rig that mounts all six targets in a single
synthetic host — does not yet render the Angular cell, because dynamically
mounting an AnalogJS-compiled standalone component into a non-AnalogJS host is
a build-harness wiring problem still being resolved. The rig's build
orchestrator (`tests/visual-regression/scripts/build-cells.mjs`) soft-fails the
Angular sub-build, and the matrix spec (`specs/matrix.spec.ts`) correspondingly
gates the 8 Angular cells with `test.fixme` whenever `dist/angular/` is absent —
so the column is reported as known-pending rather than failing CI. The gate
lifts automatically once the Angular sub-build succeeds. This affects only that
one internal screenshot rig, not the Angular emitter or the `angular-analogjs`
demo. Angular is a first-class v1 target.

---

These are the *complete* set of documented limitations as of v1. Everything
else — props, **producer-side** `model:` two-way machinery, **consumer-side**
two-way binding (`r-model:propName=`), `<data>` reactive state, `$computed`,
`<listeners>` with modifiers, `r-for` / `r-if` / form-input `r-model`,
default + named slots, `$emit`, refs — behaves identically across all six
targets.
