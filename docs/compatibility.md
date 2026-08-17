# Compatibility

At-a-glance feature × target compatibility for every Rozie feature, across all
six compile targets. Use this page for "does feature X work on target Y."
For the narrative behind each ⚠︎, follow the link to the matching section in
[Cross-Framework Parity](/parity).

## Legend

| Symbol | Meaning |
| --- | --- |
| ✅ | Full parity — feature works identically to the other targets, no consumer-side authoring difference |
| [⚠︎](/parity) | Works, but with a documented divergence in consumer-side authoring or runtime semantics. Click for the full explanation. |
| ❌ | Not supported in v1; documented limitation in the [Parity](/parity) page |

## Authoring blocks

| Feature | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `<props>` with JS expression values | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<data>` reactive state | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<components>` block (incl. self-recursion) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<listeners>` block of `<listener>` elements (reactive `r-if` conditional attach) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<style>` scoped + `:root { }` global escape hatch | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<style lang="scss">` SCSS preprocessing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<script lang="ts">` TypeScript in the `<script>` block | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Template directives

| Feature | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `r-if` / `r-else-if` / `r-else` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `r-match` / `r-case` / `r-default` (switch-style conditionals) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `r-show` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `r-for` with `:key` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `r-model` (form-input sugar) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `r-model` modifiers (`.lazy`, `.number`, `.trim`, custom) | [⚠︎](/guide/props-and-two-way#r-model-modifiers-—-lazy-number-trim) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `:prop="…"` binding | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `{{ }}` interpolation in text | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| <span v-pre>`{{ }}`</span> interpolation in attribute values | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| HTML comments inside `<template>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Event handling

| Feature | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `@event="handler"` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bare modifiers (`.stop`, `.prevent`, `.self`, `.capture`, `.passive`, `.once`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Parameterized modifiers (`.debounce(ms)`, `.throttle(ms)`, `.outside($refs.a, …)`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Key modifiers (`.enter`, `.escape`, `.tab`, `.space`, `.arrow{Up,Down,Left,Right}`, `.delete`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Reactivity & lifecycle

| Feature | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `$props` reads | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `$data` reads + writes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `$computed(() => …)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `$watch(() => getter, cb)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `$emit(name, …)` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `$refs.name` from `ref="name"` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `$snapshot(x)` — crossing into untyped JS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `$clone(x)` — independent deep copy of reactive state | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `$onMount` / `$onUnmount` | ✅ | ✅ | ✅ | ✅ | [⚠︎](/parity#lit-solid-—-lifecycle-hooks-colocated-with-an-always-rendered-component) | [⚠︎](/parity#lit-solid-—-lifecycle-hooks-colocated-with-an-always-rendered-component) |
| `$expose({ … })` — consumer-callable imperative handle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

The per-target handle idiom (and how a consumer obtains the handle in each framework) is
documented in [`$expose`](/guide/composition#expose-→-a-consumer-callable-imperative-handle-everywhere).

## Two-way binding

| Feature | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Producer-side `model: true` → native two-way machinery | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Producer-side `$model.x` two-way write sigil | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Consumer-side `r-model:propName="…"` directive | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Producer + consumer emit shapes per target are documented in
[Consumer-side two-way binding](/parity#consumer-side-two-way-binding).

## Slots

| Feature | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Default slot | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Named slots (`#header`, `#footer`, …) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fallback content inside `<slot>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scoped slot params (`<slot :ctx="x">` + `#name="{ ctx }"`) | [⚠︎](/parity#react-—-scoped-slots-are-render-prop-function-props) | ✅ | ✅ | ✅ | ✅ | [⚠︎](/parity#lit-—-scoped-slot-params-arrive-via-a-data-attribute) |
| Third-party (non-Rozie) consumer slot fill | [⚠︎](/parity#consumer-side-slot-fill-—-third-party-react-consumers-of-compiled-rozie-components) | ✅ | ✅ | ✅ | ✅ | [⚠︎](/parity#lit-—-scoped-slot-params-arrive-via-a-data-attribute) |
| Dynamic slot names (`#[expr]`) | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | ✅ | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | ✅ |
| Scoped + dynamic slot name combination (consumer-side) | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | ✅ | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | [✅ ¹](/parity#lit-—-rozieslots-record-dispatch-for-scoped-dynamic-name-and-family-matched-fills) |
| Producer-side dynamic slot names (`<slot :name="...">`) | ✅ ² | ✅ ² | ✅ ² | ✅ ² | ✅ ² | ✅ ² |

¹ **Lit — scoped + dynamic slot name, consumer-side.** A *consumer* fills a slot with
both a runtime-chosen name (`#[someName]`) and a scoped destructure (`="{ ctx }"`)
together. Previously unsupported on Lit alone — there was no stable class-field name
to synthesize for a name only known at runtime. Now dispatches through the
`rozieSlots` record property (see [Lit — `rozieSlots` record dispatch](/parity#lit-—-rozieslots-record-dispatch-for-scoped-dynamic-name-and-family-matched-fills))
instead of a per-name class field. Backed by `packages/targets/lit/src/emit/__tests__/rozieSlots.test.ts`
(19 cases, including the dynamic-and-scoped fill) and `packages/core/tests/79-09-r12-six-target-compile.test.ts`.

² **Producer-side dynamic slot names.** This is a *different* capability from the
"Dynamic slot names" / "Scoped + dynamic slot name combination" rows above, which are
about a *consumer* choosing a runtime slot name against a producer's ordinary static
`<slot>`. Here the *producer* itself declares the slot's name dynamically —
`<slot :name="`cell-${column.key}`">` — and consumers fill the resulting family with
plain static named fills (`#cell-status="{ row, value }"`) that the compiler routes
via family matching (`SlotFillerDecl.matchedFamily`). Backed by the
`DynamicSlots` / `DynamicSlotsConsumer` dist-parity fixture pair (byte-identity at 6
targets by 4 entrypoints — `tests/dist-parity/fixtures/DynamicSlots*`), the `Table`
Docker VR cell (`tests/visual-regression/specs/matrix.spec.ts`, six-target
per-column render proof, exercised by `examples/Table.rozie`'s per-column
`cell-${column.key}` family), and
`tests/regressions/dynamic-slot-name-rfor.test.ts` (24 positive + 24 negative
emitted-record-key invariants across the four `loop-mustache-*-slot-rfor` fixtures).

## Tooling

| Feature | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `.rozie` per-statement source maps | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Visual-regression rig (internal screenshot harness) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## How to read the caveats

Every ⚠︎ cell links to the exact parity section explaining the divergence.
The pattern across them is consistent:

- **Slot ⚠︎** — the feature works at runtime; the consumer-side *authoring shape* differs (render prop, `data-rozie-params` attribute, additive `slots?:` / `snippets?:` / `templates?:` prop).
- **Lifecycle ⚠︎** — the hooks fire; the *timing* differs on conditionally-rendered component roots (Lit / Solid keep the instance alive across the toggle).
- **`r-model` modifiers ⚠︎ (React only)** — `.number`/`.trim`/custom value transforms behave identically across all six targets. The one divergence is React's `.lazy`: React has no true `change` event, so `r-model.lazy` emits an **uncontrolled `defaultValue` + `onBlur`** input (the idiomatic React deferred-commit pattern) instead of a controlled `value` + `onChange`. The trade-off — programmatic writes to the bound state mid-edit are not reflected by the uncontrolled input — is a documented parity gap, consistent with the render-prop-slot precedent. See [`r-model` modifiers](/guide/props-and-two-way#r-model-modifiers-—-lazy-number-trim).

There are no `❌` cells left in the matrix — the last one (Lit's scoped + dynamic
slot name combination) closed when Lit gained the `rozieSlots` record property; see
the footnotes under the Slots table above for what backs the flip.

Every feature not flagged above behaves identically across all six targets;
[Cross-Framework Parity](/parity) carries the complete narrative, including the
per-target determinism guarantee (for a given target, all four entrypoints emit
identical bytes).
