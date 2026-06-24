# Popover — the cross-framework headless floating primitive

`Popover` is Rozie's **headless floating primitive** for tooltips and popovers — a `@rozie-ui` family that wraps [`@floating-ui/dom`](https://floating-ui.com), the de-facto vanilla-JS positioning engine behind Radix Popover, Headless UI, MUI, Mantine, Floating Vue, Tippy, and shadcn/ui. One `Popover.rozie` source compiles to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

You bring the **anchor** (the `anchor` slot, or a trigger element) and the **floating content** (the default slot); `Popover` owns everything else: collision-aware placement (offset → flip → shift → arrow middleware), live `autoUpdate` tracking on scroll / resize / layout shift, the open/close gesture (`trigger`: click, hover, or focus), dismissal (Escape + click-outside), the WAI-ARIA wiring (`role="tooltip"` for hover/focus, `role="dialog"` for click, plus `aria-expanded` / `aria-describedby`), and a two-way `open` model.

Unlike DOM-creating engines (Cropper.js, flatpickr), Floating UI creates **no DOM of its own** — it only writes `left` / `top` position styles onto *your* floating element. So there is no engine-created-node styling problem: the scoped `<style>` reaches everything, every visual value is a `--rozie-popover-*` CSS custom property, and there is no `:root {}` escape hatch.

## The `@rozie-ui/popover` packages

`Popover` ships as six pre-compiled, per-framework packages generated from a single `Popover.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework, plus the `@floating-ui/dom` engine peer — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/popover-react` | `npm i @rozie-ui/popover-react @floating-ui/dom` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/react/README.md) |
| `@rozie-ui/popover-vue` | `npm i @rozie-ui/popover-vue @floating-ui/dom` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/vue/README.md) |
| `@rozie-ui/popover-svelte` | `npm i @rozie-ui/popover-svelte @floating-ui/dom` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/svelte/README.md) |
| `@rozie-ui/popover-angular` | `npm i @rozie-ui/popover-angular @floating-ui/dom` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/angular/README.md) |
| `@rozie-ui/popover-solid` | `npm i @rozie-ui/popover-solid @floating-ui/dom` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/solid/README.md) |
| `@rozie-ui/popover-lit` | `npm i @rozie-ui/popover-lit @floating-ui/dom` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/popover/packages/lit/README.md) |

Each package carries its framework peer plus the shared `@floating-ui/dom` engine peer. The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Popover.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Two-way bind `open`, project a trigger into the `anchor` slot and the content into the default slot. `Popover` positions the content, tracks it, and toggles `open` on the chosen gesture:

```rozie
<components>
{
  Popover: './Popover.rozie',
}
</components>

<data>
{
  open: false,
}
</data>

<template>
  <Popover r-model:open="$data.open" trigger="click" placement="bottom" :offset="8" arrow @change="onChange">
    <template #anchor="{ toggle }">
      <button @click="toggle">Menu</button>
    </template>
    <div class="menu">Floating content</div>
  </Popover>
</template>
```

`r-model:open` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Popover` a boolean, `Popover` writes the new state back whenever the trigger or a dismissal toggles it — no `onChange → setState` wiring. The `anchor` slot exposes `{ open, toggle, show, hide }` so you can build any trigger element.

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `open` | `Boolean` | `false` | yes (via `r-model`) | Whether the floating content is open — the sole `model: true` prop. Two-way bind it; `Popover` writes the new state back on every trigger/dismissal/programmatic toggle. |
| `placement` | `String` | `"bottom"` | yes | Floating UI placement (`top`/`right`/`bottom`/`left`, optionally `-start`/`-end`). May flip to the opposite side on overflow unless `disableFlip` is set. |
| `trigger` | `String` | `"click"` | no | Open gesture: `'click'` (toggle, popover dialog), `'hover'` or `'focus'` (tooltip). Also drives the floating `role`. |
| `offset` | `Number` | `8` | yes | Gap in pixels between anchor and content (the `offset` middleware). |
| `disableFlip` | `Boolean` | `false` | yes | Disable the `flip` middleware (keep the content pinned to `placement`). |
| `disableShift` | `Boolean` | `false` | yes | Disable the `shift` middleware (keep the content strictly aligned to the anchor). |
| `arrow` | `Boolean` | `false` | yes | Opt in to a positioned arrow element + the `arrow` middleware. |
| `disabled` | `Boolean` | `false` | yes | Disable the control entirely: the trigger no longer opens, and open content is suppressed. |

### Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the open state changes — a trigger gesture, an Escape / click-outside dismissal, or a programmatic `show`/`hide`/`toggle`. Payload is the new `open` boolean. (Named `change`, not `open`, to avoid the model-prop==emit-name collapse.) |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `show` | Open the floating content (no-op when `disabled`). Emits `change`. |
| `hide` | Close the floating content. Emits `change`. |
| `toggle` | Flip the open state (no-op when `disabled`). Emits `change`. |
| `reposition` | Recompute the floating position immediately (`computePosition`). **Named `reposition`, not `update`**, because `update` is a reserved Lit `ReactiveElement` lifecycle method. |

## Accessibility

The floating element carries `role="tooltip"` when `trigger` is `hover`/`focus`, or `role="dialog"` (with `aria-modal`) when `trigger` is `click`. The anchor carries `aria-haspopup="dialog"` and `aria-expanded` (stringified, never dropped on `false`); in tooltip mode it also gains `aria-describedby` pointing at the open content. Project an interactive, focusable element (e.g. a `<button>`) into the `anchor` slot so the keyboard story works; Escape dismisses while open.
