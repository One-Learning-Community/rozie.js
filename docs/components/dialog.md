# Dialog — the cross-framework headless modal on the native `<dialog>`

`Dialog` is Rozie's **headless, fully-accessible** modal dialog — a `@rozie-ui` family with **no third-party engine** behind it. The "engine" is the **platform itself**: the browser's native `<dialog>` element driven by `showModal()`. Every hard part of a modal — top-layer rendering, the scrim, the focus trap, Escape-to-dismiss, and focus restoration — comes from the platform for free, authored once in `Dialog.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

Most modal libraries re-implement those hard parts in JavaScript and a **portal/teleport** to escape `z-index`, `overflow`, and `transform` ancestors. `showModal()` makes the portal obsolete: a modal `<dialog>` renders in the browser's **top layer**, above everything, with no DOM relocation. You get a real `::backdrop` pseudo-element for the scrim, a native focus trap, the `cancel` event for Esc, and automatic focus return to the previously-focused element — none of which Rozie has to ship.

Rozie owns the **author-side API**: the two-way `open` binding, the open↔native reconcile (`showModal()` / `close()` guarded on the native `open` flag), the backdrop- and escape-close policy, optional `<html>` scroll-lock, and the token-themed skin. The component is **fully controlled** — `open` is the sole `model: true` prop, and every close path (backdrop, escape, programmatic) funnels through one site that writes `open = false` and emits `close` with a `reason`.

And because **every cosmetic value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/dialog` packages

`Dialog` ships as six pre-compiled, per-framework packages generated from a single `Dialog.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/dialog-react` | `npm i @rozie-ui/dialog-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/dialog/packages/react/README.md) |
| `@rozie-ui/dialog-vue` | `npm i @rozie-ui/dialog-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/dialog/packages/vue/README.md) |
| `@rozie-ui/dialog-svelte` | `npm i @rozie-ui/dialog-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/dialog/packages/svelte/README.md) |
| `@rozie-ui/dialog-angular` | `npm i @rozie-ui/dialog-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/dialog/packages/angular/README.md) |
| `@rozie-ui/dialog-solid` | `npm i @rozie-ui/dialog-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/dialog/packages/solid/README.md) |
| `@rozie-ui/dialog-lit` | `npm i @rozie-ui/dialog-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/dialog/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Dialog.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Two-way bind `open` to a boolean and put your content in the default slot. A click on a button flips `open`; a backdrop click, the Escape key, or a `hide()` call closes it and fires `@close` with the reason:

```rozie
<components>
{
  Dialog: './Dialog.rozie',
}
</components>

<data>
{
  confirmOpen: false,
}
</data>

<template>
  <button @click="$data.confirmOpen = true">Delete file…</button>

  <Dialog r-model:open="$data.confirmOpen" ariaLabelledby="confirm-title" @close="onClose">
    <h2 id="confirm-title">Delete file?</h2>
    <p>This cannot be undone.</p>
    <button @click="$data.confirmOpen = false">Cancel</button>
    <button @click="remove()">Delete</button>
  </Dialog>
</template>
```

`r-model:open` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer owns the boolean, the component reconciles the native dialog to it (`showModal()` when it flips true, `close()` when it flips false), and writes `false` back on every dismiss — so `open` is always in sync with what's on screen, with no `onClose → setState` glue.

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `open` | `Boolean` | `false` | yes (via `r-model`) | Whether the dialog is shown. The sole `model: true` prop — the component reconciles the native `<dialog>` to it (`showModal()` / `close()`) and writes `false` back on every dismiss. |
| `disableBackdropClose` | `Boolean` | `false` | yes | Opt **out** of backdrop-click-to-dismiss. By default a click on the scrim (the `<dialog>` element itself, outside the content panel) closes with `reason: 'backdrop'`. |
| `disableEscapeClose` | `Boolean` | `false` | yes | Opt **out** of Escape-to-dismiss. By default the native `cancel` event (Esc) closes with `reason: 'escape'`; the component `preventDefault()`s it so the close always flows through the `open` model. |
| `disableScrollLock` | `Boolean` | `false` | yes | Opt **out** of locking `<html>` scroll while open. By default `document.documentElement` `overflow` is set to `hidden` for the duration the dialog is shown. |
| `ariaLabel` | `String` | `null` | yes | Accessible name for the dialog when there is no visible title to point at (sets `aria-label`). |
| `ariaLabelledby` | `String` | `null` | yes | `id` of the element that titles the dialog (sets `aria-labelledby`) — preferred over `ariaLabel` when a visible heading exists. |

### Events

| Event | Description |
| --- | --- |
| `close` | Fired whenever the dialog dismisses — backdrop click, Escape, or a programmatic `hide()`. Payload `{ reason }` where `reason` is `'backdrop'`, `'escape'`, or `'programmatic'`. The two-way `open` model is set to `false` on the same tick, so use this only to learn *why* it closed. |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `show` | Open the dialog imperatively (sets `open = true`; the native `showModal()` runs on the next reconcile). |
| `hide` | Close the dialog imperatively (sets `open = false` and emits `close` with `{ reason: 'programmatic' }`). |

The verbs are **`show` / `hide`, not `open` / `close`** on purpose: an `open` verb would collide with the `open` model prop, and a `close` verb would collide with the `@close` event (ROZ121). `show` / `hide` are clear, collision-free, and — unlike `focus` — not inherited `HTMLElement` members, so there is no ROZ137 warning on the Lit custom element.

### Slots

| Slot | Description |
| --- | --- |
| (default) | The dialog content — your heading, body, and action buttons. It renders inside a `.rozie-dialog-panel` wrapper; backdrop clicks land on the `<dialog>` element itself (outside the panel), so clicks inside your content never close the dialog. |

## Theming

Every cosmetic value the component renders is a `--rozie-dialog-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-dialog {
  --rozie-dialog-radius: 1rem;
  --rozie-dialog-bg: #0b1020;
  --rozie-dialog-color: #e8ebff;
  --rozie-dialog-backdrop-bg: rgba(0, 0, 0, 0.7);
  --rozie-dialog-padding: 2rem;
}
```

The full token vocabulary — box geometry (`width`, `max-width`, `max-height`), box chrome (`border`, `radius`, `bg`, `color`, `shadow`), the scrim (`backdrop-bg`, `backdrop-filter`), the content panel (`padding`, `font`), and the enter/leave `transition` — has documented defaults in `themes/base.css`. Only cosmetic values flow through tokens; the **structural** behaviour (top-layer rendering, the `::backdrop`, UA centering, the focus trap) comes from the native `<dialog>` and is not consumer-overridable.

### Design-system bridges

Each package ships token presets that map the dialog tokens onto a known design system's published CSS variables — so the box and scrim automatically follow that system's light/dark theme:

```ts
import '@rozie-ui/dialog-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --background/--foreground/--border/--radius…
import '@rozie-ui/dialog-react/themes/material.css';  // Material 3 — reads --md-sys-color-* (28dp radius, scrim role)
import '@rozie-ui/dialog-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-* (modal radius, border, backdrop)
import '@rozie-ui/dialog-react/themes/base.css';      // the documented default token set
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/dialog/src/themes/base.css).

## Accessibility

- `showModal()` renders the dialog in the browser's **top layer** with `role="dialog"` and `aria-modal="true"` applied by the UA, a **native focus trap** (Tab cycles within the dialog), and **focus restoration** to the previously-focused element on close — none of which the component has to implement.
- Provide an accessible name with either `ariaLabelledby` (point at a visible heading — preferred) or `ariaLabel` (when there is no visible title).
- Escape fires the native `cancel` event; the component `preventDefault()`s it and drives the close through the `open` model so the binding never desyncs. Set `disableEscapeClose` to opt out (e.g. a required confirmation).
- The scrim is the native `::backdrop` pseudo-element. A click on the `<dialog>` element itself (outside the `.rozie-dialog-panel`) is treated as a backdrop click; set `disableBackdropClose` to require an explicit action.
- A `prefers-reduced-motion: no-preference` enter/leave transition (via `@starting-style` + `allow-discrete`) is applied where supported and is a no-op elsewhere — the dialog simply appears.

## Browser support

The native `<dialog>` element and `showModal()` are supported in all current evergreen browsers (Chrome/Edge 37+, Firefox 98+, Safari 15.4+). The `@starting-style` / `allow-discrete` enter animation degrades gracefully (the dialog appears without the transition) on engines that don't support it. For pre-2022 browsers, load a `<dialog>` polyfill before the component.
