# Switch vs the per-framework alternatives

An accessible on/off toggle — `role="switch"`, a controlled boolean, keyboard support, and a re-skinnable thumb/track — is something every design system re-implements, once per framework. `Switch` is authored **once** in `Switch.rozie` and compiled to all six. Here is what it replaces.

## The native `<input type="checkbox" role="switch">` it improves on

A checkbox with `role="switch"` is the usual platform starting point, but the bare element gives you no track/thumb visual (you restyle the checkbox chrome by hand, per browser), no consistent `disabled` / `readonly` story (`readonly` is not even honoured on checkboxes), and a value model that differs from a plain boolean two-way bind in every framework. `Switch` keeps the platform semantics (`role="switch"`, `aria-checked`, Space/Enter, focus) but owns the visual, the states, and a clean `boolean` two-way value — identical across browsers and frameworks.

## What it replaces per framework

| You were reaching for | `Switch` instead |
| --- | --- |
| **React** — `@radix-ui/react-switch`, `@base-ui/switch`, `@ark-ui/react` Switch, or a hand-rolled `<button role="switch">` + state | One `<Switch>` with `modelValue` / `onModelValueChange`, a typed `SwitchHandle`, a scoped render slot, and the `--rozie-switch-*` token skin. |
| **Vue** — `@ark-ui/vue` Switch, `@headlessui/vue` Switch, or a custom `v-model` wrapper | `<Switch v-model:modelValue="on" ariaLabel="…">` — idiomatic `v-model`, `@change`, a template-ref handle, and a `#default` scoped slot. |
| **Svelte** — `bits-ui` / `melt-ui` Switch, or a `bind:checked` + reactive class | `<Switch bind:modelValue={on} />` with Svelte 5 runes; `onchange`; `bind:this` for the handle. |
| **Angular** — Material `mat-slide-toggle`, a custom `ControlValueAccessor` directive, or `@ng-bootstrap` switch | `<Switch [(modelValue)]>` that **is** a `ControlValueAccessor` out of the box — `[formControl]` / `[(ngModel)]` bind directly. |
| **Solid** — `@ark-ui/solid` Switch, `@kobalte/core` Switch, or a `createSignal` + `<button role="switch">` | `<Switch modelValue={on()} onModelValueChange={setOn} />` with a ref-callback handle. |
| **Lit** — a hand-written custom element wrapping a toggle | `<rozie-switch>` with a reactive `modelValue` property and `model-value-change` / `change` events. |

## What you get in all six, for free

- **Boolean two-way value** — `modelValue` reads and writes a plain `boolean`, no per-framework value adapter.
- **Full keyboard** — Space **and** Enter toggle the switch (the WAI-ARIA switch pattern), Space without scrolling the page.
- **WAI-ARIA `role="switch"`** with `aria-checked` (never dropped on `false`), plus `aria-disabled` / `aria-readonly` for those states and `aria-label` from `ariaLabel`.
- **`disabled` and `readonly`** handled consistently — `disabled` drops focusability and toggling; `readonly` keeps focus but blocks toggling.
- **A scoped default slot** (`{ checked, toggle }`) to render a fully custom thumb/track or a labelled toggle, without re-implementing the accessibility or the binding.
- **Angular `ControlValueAccessor`** so the switch is a first-class form control.
- **Token theming** — the same `--rozie-switch-*` variables and the shadcn / Material / Bootstrap bridges across every framework.

The wedge is the usual Rozie one: you maintain **one** accessible, fully-featured switch, and every framework gets an idiomatic, byte-for-byte-consistent build of it.
