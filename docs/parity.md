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

### Lit — scoped slot params arrive via a data attribute

Web Components have no native scoped-slot mechanism. For the Lit target, scoped
slot params are exposed on the projected `<slot>` element via a
`data-rozie-params` attribute (a JSON-serialized context object), readable from
the consumer side with the small `observeRozieSlotCtx` helper. Default and
named slots without params use native `<slot>` projection unchanged.

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
else — props, `model:` two-way binding, `<data>` reactive state, `$computed`,
`<listeners>` with modifiers, `r-for` / `r-if` / `r-model`, default + named
slots, `$emit`, refs — behaves identically across all six targets.
