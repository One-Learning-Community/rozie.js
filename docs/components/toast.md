# Toaster — the cross-framework headless toast / notification host

`Toaster` is Rozie's **headless, accessible** toast / notification host — a `@rozie-ui` family with **no third-party engine** behind it. Every behaviour (the toast queue, precise remaining-time hover-to-pause, promise/loading toasts, pointer swipe-to-dismiss, an opt-in animated collapsed stack, the six corner positions, the live-region ARIA wiring, and the per-toast close button) is authored once in `Toaster.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

It is **deliberately not** the heavyweight shape — a global singleton plus a context/provider system. Instead the `<Toaster>` owns the queue and the auto-dismiss timers as internal state and exposes an imperative **`show` / `dismiss` / `clear` / `patch` / `promise`** handle that you drive through your framework's native `ref` mechanism. "Call from anywhere" then becomes your app's wiring concern (stash the ref where your code can reach it) — Rozie owns the *component*, not your app's global plumbing. This keeps it captcha-simple and side-steps the "context doesn't cross a portal" limitation entirely.

The imperative handle is still the primary write surface, but the family now has its **first event**: `@dismissed { toast, reason }`, fired once per toast at dismissal initiation (`clear()` stays bulk and fires nothing). And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

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

`show({ message, type, duration, id })` enqueues a toast and returns its `id`; `dismiss(id)` removes one; `clear()` removes them all. Pass `duration: 0` (or set the `duration` prop to `0`) for a sticky toast that only goes away on dismiss. Hovering the stack pauses the auto-dismiss timers **precisely** — leaving resumes exactly where it paused, not a full restart (opt out with `disablePauseOnHover`).

### Promise / loading toasts

`promise(p, { loading, success, error })` is sugar over `show()` + `patch()` for an async operation — one call replaces the imperative "show a loading toast, then flip it to success/error" dance:

```rozie
<script>
const save = () => {
  $refs.toaster.promise(saveDoc(), {
    loading: 'Saving…',
    success: (doc) => `Saved "${doc.title}"`,
    error: (e) => `Failed: ${e.message}`,
  })
}
</script>
```

It shows a `{ type: 'loading', duration: 0 }` toast (a decorative spinner) and returns the toast `id` **synchronously**; on resolve it `patch()`es the *same* toast to `{ type: 'success', message: … }` with the `duration` prop's auto-dismiss timer starting **at settle**, not at show. `success`/`error` accept a string or a `(value) => string` function. If the toast is dismissed while the promise is still pending, the eventual settle is a no-op (never resurrected) — and `promise()` never returns a derived promise, so your own `.then`/`.catch` on the original promise still fire normally.

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
| `stacked` | `Boolean` | `false` | yes | Opt **in** to a sonner-style collapsed stack: a single-cell grid overlay with depth-driven transforms (toasts at depth 3+ fade to invisible), newest on top. Hovering the region or moving keyboard focus into it expands to the normal flex-column stack; leaving re-collapses. `false` (default) renders the plain flex column at all times. |

### Imperative handle

The imperative handle is the primary write API. Declared once in the source via `$expose`; obtained through each framework's native ref mechanism. None of the verbs overrides an inherited host-element member (`patch`, not `update`, sidesteps the LitElement `update()` lifecycle method), and none collides with the `dismissed` event, so the Lit custom element emits no ROZ137/ROZ121 warning.

| Method | Description |
| --- | --- |
| `show` | Enqueue a toast. Accepts `{ message, type, duration, id }` (all optional — `message` defaults to `''`, `type` to `'info'`, `duration` to the `duration` prop; `type` also accepts `'loading'`, see below). Returns the toast `id`. A non-sticky toast (duration > 0) schedules a `window.setTimeout` to auto-dismiss. |
| `dismiss` | Remove a single toast by the `id` returned from `show`. Routes through the exit lifecycle with reason `'api'` — fires `dismissed`, plays the exit animation, then removes it. |
| `clear` | Remove every visible toast at once **immediately** (no exit animation) and clear all pending auto-dismiss timers. Does **not** fire `dismissed`. |
| `patch` | Update an existing toast in place: `patch(id, { message, type, duration })` — only the keys you pass are merged into the matching entry. Returns `true` if the id existed, `false` otherwise (no throw). A `duration` key clears and restarts that toast's auto-dismiss timer (`0` makes it sticky; a positive value arms/re-arms it); omitting `duration` leaves a running timer untouched. |
| `promise` | Sugar over `show`/`patch` for an async operation — see [Promise / loading toasts](#promise--loading-toasts) above. |

### Slots

| Slot | Params | Description |
| --- | --- | --- |
| `toast` | `toast, dismiss` | Custom per-toast rendering. The scope gives you the `toast` record (`{ id, message, type, duration }`) and the `dismiss` function so your chrome can close itself. Without it, each toast renders the (optional loading spinner +) message text plus a close button. |

### Events

`Toaster` has ONE event — its first: `dismissed`.

| Event | Payload | Description |
| --- | --- | --- |
| `dismissed` | `{ toast, reason }` | Fired exactly once per toast, at dismissal *initiation* (before the exit animation runs). `toast` is the full queue entry; `reason` is `'timeout'` (auto-dismiss), `'swipe'` (pointer swipe past threshold), `'close'` (the built-in close button), or `'api'` (the `dismiss(id)` verb). `clear()` removes every toast immediately and does **not** fire `dismissed`. |

There is still no `model: true` prop and no Angular `ControlValueAccessor` — correct for a host that is not a form control; the imperative handle + this one event are the entire write/notify surface.

## Swipe-to-dismiss

Pointer swipe-to-dismiss is **on by default** (opt out with `disableSwipe`). Direction is auto-derived from `position`: `*-right` swipes right, `*-left` swipes left, `top-center` swipes up, `bottom-center` swipes down. Drag past 45% of the toast's own width/height, or release with velocity over ~0.11px/ms, and it dismisses with reason `'swipe'`; a shorter drag springs back. A drag that starts on the close button (or any button/link inside the `#toast` slot) never triggers a swipe, so custom interactive chrome stays clickable.

## Stacked mode

Set `stacked` to opt into a sonner-style collapsed stack: when the pointer is not over the region and it does not have keyboard focus, toasts collapse into a single-cell overlay with depth-driven `translate`/`scale`, fading to invisible at depth 3+ (newest always on top). Hovering the region — or moving keyboard focus into it (`:focus-within`, e.g. tabbing to a close button) — expands it back to the plain flex-column stack; leaving re-collapses. `stacked: false` (the default) always renders the plain flex column.

## Enter/exit animations & `@dismissed`

Every toast plays a CSS enter animation on mount (slide in from the corner's edge + fade) and an exit animation while it is being dismissed. Every dismissal — timer expiry, the close button, the `dismiss()` verb, or a swipe — routes through one funnel that fires `@dismissed { toast, reason }` **once**, then plays the exit animation; the entry is removed once the animation's `animationend` fires (or a ~350ms failsafe, whichever is first — so overriding `--rozie-toast-exit-duration` past roughly that window gets cut short by the failsafe). `@media (prefers-reduced-motion: reduce)` collapses the transforms to a near-instant fade without changing this lifecycle — `animationend` still fires, so removal timing is unaffected.

## The `'loading'` toast type

`show`/`promise` accept a `'loading'` toast type in addition to `'info'`/`'success'`/`'error'`/`'warning'`. It renders a small decorative `aria-hidden` CSS spinner before the message (no extra markup needed) and announces `polite`, like `'info'`/`'success'`. See [Promise / loading toasts](#promise--loading-toasts) above for the common case of driving it from an async operation.

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

The full token vocabulary — the region layout (`z`, `gap`, `region-padding`, `max-width`, `font`), the per-toast box model (`content-gap`, `min-width`, `toast-max-width`, `padding`, `color`, `bg`, `radius`, `shadow`), the per-type accents (`success-bg`, `error-bg`, `warning-bg`, `info-bg`), the message + close button (`font-size`, `close-size`, `close-opacity`), the enter/exit lifecycle (`enter-duration`, `exit-duration`), stacked mode (`stack-offset`, `stack-scale-step`), and the loading spinner (`spinner-size`, `spinner-color`) — has documented defaults in `themes/base.css`. Only cosmetic values flow through tokens; the structural rules (the fixed-corner region, the flex stack, the per-toast box model, the collapsed grid overlay) compile per-leaf and are not consumer-overridable.

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
- Each toast is a `role="status"` with `aria-live` chosen by its `type`: `'error'` and `'warning'` toasts announce `assertive` (interrupt), while everything else — including `'loading'` — announces `polite` (wait for a gap).
- The loading spinner is purely decorative (`aria-hidden`); the message text carries the meaning. `patch()` mutates the *same* `role="status"` element in place, so a loading → success/error transition (including via `promise()`) is announced naturally by screen readers — no element is added or removed.
- The close button is a real `<button type="button">` with `aria-label="Dismiss"`, so it is keyboard- and screen-reader-operable. Focusing it (`:focus-within`) also expands a `stacked` region, so a keyboard user can always reach every toast.
- Swipe is never the only way to dismiss a toast — the close button and the imperative verbs work identically whether `disableSwipe` is set or not.
- `@media (prefers-reduced-motion: reduce)` collapses the enter/exit/collapse transforms to near-instant fades; the dismissal lifecycle (including the `@dismissed` event and removal timing) is unaffected.
- The region is `position: fixed` with `pointer-events: none`, and only the individual toasts re-enable pointer events — so an empty stack never intercepts clicks on the page beneath it.

## SSR

Every timer call is `typeof window`-guarded, so the component renders on the server without scheduling a `setTimeout`. Timers start when a toast is shown in the browser, and `$onUnmount` clears them all on teardown.
