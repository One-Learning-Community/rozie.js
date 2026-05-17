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
| `<listeners>` block with reactive `when` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<style>` scoped + `:root { }` global escape hatch | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Template directives

| Feature | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `r-if` / `r-else-if` / `r-else` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `r-show` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `r-for` with `:key` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `r-model` (form-input sugar) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| `$onMount` / `$onUnmount` | ✅ | ✅ | ✅ | ✅ | [⚠︎](/parity#lit-solid-—-lifecycle-hooks-colocated-with-an-always-rendered-component) | [⚠︎](/parity#lit-solid-—-lifecycle-hooks-colocated-with-an-always-rendered-component) |

## Two-way binding

| Feature | React | Vue | Svelte | Angular | Solid | Lit |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Producer-side `model: true` → idiomatic two-way machinery | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| Scoped + dynamic slot name combination | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | ✅ | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | [⚠︎](/parity#dynamic-slot-names-r5-—-per-target-consumer-side-divergences) | [❌](/parity#lit-—-scoped-dynamic-slot-names-deferred-combination) |

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

The only `❌` in the matrix is the Lit-specific scoped + dynamic slot name
combination — a deferred v1 limitation pending a Map-keyed ctx-observer RFC.

Everything else — props, `<data>`, `<listeners>`, `$computed`, `$watch`,
modifier grammar, two-way binding machinery, default + named slots, refs,
`$emit` — is byte-locked identical across all six targets, with dist-parity
fixtures in `tests/dist-parity/fixtures/` verifying each entrypoint
(compile / cli / babel-plugin / unplugin) emits the same output.
