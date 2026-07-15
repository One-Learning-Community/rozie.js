# @rozie-ui/toast-solid

Idiomatic **solid** `Toaster` — a headless, accessible toast / notification host (a live-region queue with per-toast auto-dismiss timers, hover-to-pause, six corner positions, and a per-toast close button) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. It is **not** a global singleton + context system: the host owns the queue + timers as internal state and exposes an imperative `show` / `dismiss` / `clear` handle you drive via `ref` — "call from anywhere" is your app's wiring concern (stash the ref). Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/toast-solid
```

Peer dependencies: `solid-js`. Install them alongside this package.

## Usage

```tsx
import { Toaster, type ToasterHandle } from '@rozie-ui/toast-solid';

export function Demo() {
  let toaster: ToasterHandle | undefined;
  // The ref callback receives the HANDLE object (not the DOM node).
  return (
    <>
      <button onClick={() => toaster?.show({ message: 'Saved!', type: 'success' })}>Save</button>
      <button onClick={() => toaster?.show({ message: 'Something failed', type: 'error' })}>Fail</button>

      {/* Mount the host once (typically near the app root). */}
      <Toaster ref={(h) => (toaster = h)} position="bottom-right" duration={4000} />
    </>
  );
}
```

## Theming

Every visual value is a `--rozie-toast-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```tsx
import '@rozie-ui/toast-solid/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `position` | `String` | `"bottom-right"` |  |  |
| `duration` | `Number` | `4000` |  |  |
| `max` | `Number` | `0` |  |  |
| `disablePauseOnHover` | `Boolean` | `false` |  |  |
| `ariaLabel` | `String` | `null` |  |  |
| `disableSwipe` | `Boolean` | `false` |  |  |
| `stacked` | `Boolean` | `false` |  |  |

## Events

| Event | Description |
| --- | --- |
| `dismissed` | Fired exactly once per toast, at dismissal initiation (before the exit animation runs). Payload is ONE object `{ toast, reason }` — `toast` is the full queue entry, `reason` is `'timeout'` (auto-dismiss), `'swipe'` (pointer swipe past threshold), `'close'` (the built-in close button), or `'api'` (the `dismiss(id)` verb). `clear()` removes every toast immediately and does NOT fire `dismissed` (documented bulk behavior). |

## Imperative handle

The component has no events — its primary API is an imperative handle (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call the methods directly. None of the verbs overrides an inherited host-element member, so the Lit custom element emits no ROZ137 warning:

| Method | Description |
| --- | --- |
| `show` | Enqueue a toast. Accepts `{ message, type, duration, id }` (all optional — `message` defaults to `''`, `type` to `'info'`, `duration` to the `duration` prop). Returns the toast `id`. A non-sticky toast (duration > 0) auto-dismisses; `duration: 0` makes it sticky. |
| `dismiss` | Remove a single toast by the `id` returned from `show` (routes through the exit lifecycle with reason `'api'` — fires `dismissed`, plays the exit animation, then removes it). |
| `clear` | Remove every visible toast at once immediately (no exit animation) and clear all pending auto-dismiss timers. Does NOT fire `dismissed`. |
| `patch` | Update an existing toast in place. Accepts `(id, { message, type, duration })` — only the keys you pass are merged into the matching entry. Returns `true` if the id existed, `false` otherwise (no throw). Including a `duration` key clears and restarts that toast's auto-dismiss timer (`0` makes it sticky; a positive value arms/re-arms it); omitting `duration` leaves a running timer untouched. |
| `promise` | Sugar over `show`/`patch` for an async operation: `promise(p, { loading, success, error })` immediately shows a `{ type: 'loading', duration: 0 }` toast and returns its `id` SYNCHRONOUSLY. On resolve it patches the SAME toast to `{ type: 'success', message: resolve(success, value) }` (the auto-dismiss timer starts AT SETTLE); on reject, likewise with `error`. `success`/`error` accept a string or a `(value) => string` function. Never resurrects a toast dismissed while `p` was still pending, and never returns a derived promise — your own `.then`/`.catch` on `p` still fire. |

```tsx
import { Toaster, type ToasterHandle } from '@rozie-ui/toast-solid';

let toaster: ToasterHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Toaster ref={(h) => (toaster = h)} />;
toaster?.show({ message: 'Saved', type: 'success' });
toaster?.clear();
```

## Slots

| Slot | Params |
| --- | --- |
| toast | toast, dismiss |
