# Toaster — the cross-framework headless toast / notification host

`Toaster` is Rozie's **headless, accessible** toast / notification host — a `@rozie-ui` family with **no third-party engine** behind it. Every behaviour (the toast queue, per-toast auto-dismiss timers, hover-to-pause, the six corner positions, the live-region ARIA wiring, and the per-toast close button) is authored once in `Toaster.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

It is **deliberately not** the heavyweight shape — a global singleton plus a context/provider system. Instead the `<Toaster>` owns the queue and the auto-dismiss timers as internal state and exposes an imperative **`show` / `dismiss` / `clear`** handle that you drive through your framework's native `ref` mechanism. "Call from anywhere" then becomes your app's wiring concern (stash the ref where your code can reach it) — Rozie owns the *component*, not your app's global plumbing. This keeps it captcha-simple and side-steps the "context doesn't cross a portal" limitation entirely.

There are **no events**: a notification host has nothing to bind two-way and nothing to emit upward — the handle *is* the API, and a per-toast close button calls the internal `dismiss` for you. And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/toast` packages

`Toaster` ships as six pre-compiled, per-framework packages generated from a single `Toaster.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/toast-react` | `npm i @rozie-ui/toast-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/toast/packages/react/README.md) |
| `@rozie-ui/toast-vue` | `npm i @rozie-ui/toast-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/toast/packages/vue/README.md) |
| `@rozie-ui/toast-svelte` | `npm i @rozie-ui/toast-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/toast/packages/svelte/README.md) |
| `@rozie-ui/toast-angular` | `npm i @rozie-ui/toast-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/toast/packages/angular/README.md) |
| `@rozie-ui/toast-solid` | `npm i @rozie-ui/toast-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/toast/packages/solid/README.md) |
| `@rozie-ui/toast-lit` | `npm i @rozie-ui/toast-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/toast/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Toaster.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Mount the host **once** (typically near your app root), grab a ref to it, and call `show()` from anywhere you can reach that ref. A non-sticky toast auto-dismisses after `duration` ms; the host renders nothing until the first `show()`:

```rozie
<components>
{
  Toaster: './Toaster.rozie',
}
</components>

<template>
  <button @click="$refs.toaster.show({ message: 'Saved', type: 'success' })">Save</button>
  <button @click="$refs.toaster.show({ message: 'Something failed', type: 'error' })">Fail</button>

  <!-- Mount the host once. -->
  <Toaster ref="toaster" position="bottom-right" :duration="4000" />
</template>
```

`show({ message, type, duration, id })` enqueues a toast and returns its `id`; `dismiss(id)` removes one; `clear()` removes them all. Pass `duration: 0` (or set the `duration` prop to `0`) for a sticky toast that only goes away on dismiss. Hovering the stack pauses the auto-dismiss timers (opt out with `disablePauseOnHover`).

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `position` | `String` | `"bottom-right"` | yes | Stack corner: `'top-left'`, `'top-right'`, `'top-center'`, `'bottom-left'`, `'bottom-right'`, or `'bottom-center'`. |
| `duration` | `Number` | `4000` | yes | Default auto-dismiss in ms applied to toasts that don't pass their own `duration`. `0` (or a per-toast `duration` of `0`) makes a toast sticky. |
| `max` | `Number` | `0` | yes | Maximum visible toasts (`0` = unlimited). When exceeded, the oldest toasts drop off. |
| `disablePauseOnHover` | `Boolean` | `false` | yes | Opt **out** of pausing the auto-dismiss timers while the pointer is over the stack (default: hovering pauses, restarting the timers on leave). |
| `ariaLabel` | `String` | `null` | yes | Accessible name for the live region (`role="region"`). Defaults to `'Notifications'` when not set. |
| `disableSwipe` | `Boolean` | `false` | yes | Opt **out** of pointer swipe-to-dismiss. By default, dragging a toast past 45% of its own width/height (direction auto-derived from `position`) or a fast flick dismisses it with reason `'swipe'`; a short drag springs back. A drag starting on the close button (or any button/link) never swipes. |

### Imperative handle

`Toaster` has **no events** — the imperative handle is its primary API. Declared once in the source via `$expose`; obtained through each framework's native ref mechanism. None of the verbs overrides an inherited host-element member, so the Lit custom element emits no ROZ137 warning.

| Method | Description |
| --- | --- |
| `show` | Enqueue a toast. Accepts `{ message, type, duration, id }` (all optional — `message` defaults to `''`, `type` to `'info'`, `duration` to the `duration` prop). Returns the toast `id`. A non-sticky toast (duration > 0) schedules a `window.setTimeout` to auto-dismiss. |
| `dismiss` | Remove a single toast by the `id` returned from `show` (also clears that toast's auto-dismiss timer). |
| `clear` | Remove every visible toast at once and clear all pending auto-dismiss timers. |

### Slots

| Slot | Params | Description |
| --- | --- | --- |
| `toast` | `toast, dismiss` | Custom per-toast rendering. The scope gives you the `toast` record (`{ id, message, type, duration }`) and the `dismiss` function so your chrome can close itself. Without it, each toast renders the message text plus a close button. |

### Events

`Toaster` emits **no events**. A notification host has nothing to bind two-way and nothing to surface upward — the imperative `show` / `dismiss` / `clear` handle is the entire write surface, and the built-in close button calls `dismiss` internally. (There is consequently no `model: true` prop and no Angular `ControlValueAccessor` — correct for a host that is not a form control.)

## Theming

Every value the component renders is a `--rozie-toast-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-toaster {
  --rozie-toast-bg: #1e293b;
  --rozie-toast-radius: 0.75rem;
  --rozie-toast-gap: 0.75rem;
  --rozie-toast-success-bg: #16a34a;
  --rozie-toast-error-bg: #dc2626;
}
```

The full token vocabulary — the region layout (`z`, `gap`, `region-padding`, `max-width`, `font`), the per-toast box model (`content-gap`, `min-width`, `toast-max-width`, `padding`, `color`, `bg`, `radius`, `shadow`), the per-type accents (`success-bg`, `error-bg`, `warning-bg`, `info-bg`), and the message + close button (`font-size`, `close-size`, `close-opacity`) — has documented defaults in `themes/base.css`. Only cosmetic values flow through tokens; the structural rules (the fixed-corner region, the flex stack, the per-toast box model) compile per-leaf and are not consumer-overridable.

### Design-system bridges

Each package ships token presets that map the toast tokens onto a known design system's published CSS variables — so the host automatically follows that system's light/dark theme and accent:

```ts
import '@rozie-ui/toast-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --background/--foreground/--destructive…
import '@rozie-ui/toast-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/toast-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
import '@rozie-ui/toast-react/themes/base.css';      // the documented default token set
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/toast/src/themes/base.css).

## Accessibility

- The host is a `role="region"` with the `ariaLabel` you supply as its `aria-label` (defaulting to `'Notifications'`), so assistive tech can navigate to the toast stack as a landmark.
- Each toast is a `role="status"` with `aria-live` chosen by its `type`: `'error'` and `'warning'` toasts announce `assertive` (interrupt), while everything else announces `polite` (wait for a gap).
- The close button is a real `<button type="button">` with `aria-label="Dismiss"`, so it is keyboard- and screen-reader-operable.
- The region is `position: fixed` with `pointer-events: none`, and only the individual toasts re-enable pointer events — so an empty stack never intercepts clicks on the page beneath it.

## SSR

Every timer call is `typeof window`-guarded, so the component renders on the server without scheduling a `setTimeout`. Timers start when a toast is shown in the browser, and `$onUnmount` clears them all on teardown.
