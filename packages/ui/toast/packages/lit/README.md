# @rozie-ui/toast-lit

Idiomatic **lit** `Toaster` — a headless, accessible toast / notification host (a live-region queue with per-toast auto-dismiss timers, hover-to-pause, six corner positions, and a per-toast close button) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. It is **not** a global singleton + context system: the host owns the queue + timers as internal state and exposes an imperative `show` / `dismiss` / `clear` handle you drive via `ref` — "call from anywhere" is your app's wiring concern (stash the ref). Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/toast-lit
```

Peer dependencies: `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/toast-lit';

// <rozie-toaster> is a custom element. Bind `position`/`duration` as properties,
// then call the imperative `show` / `dismiss` / `clear` methods on the element.
const el = document.querySelector('rozie-toaster');
el.position = 'bottom-right';
el.duration = 4000;
const id = el.show({ message: 'Saved!', type: 'success' });
// el.dismiss(id);
// el.clear();
```

## Theming

Every visual value is a `--rozie-toast-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/toast-lit/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `position` | `String` | `"bottom-right"` |  |  |
| `duration` | `Number` | `4000` |  |  |
| `max` | `Number` | `0` |  |  |
| `disablePauseOnHover` | `Boolean` | `false` |  |  |
| `ariaLabel` | `String` | `null` |  |  |

## Events

| Event | Description |
| --- | --- |
| `dismissed` | Fired exactly once per toast, at dismissal initiation (before the exit animation runs). Payload is ONE object `{ toast, reason }` — `toast` is the full queue entry, `reason` is `'timeout'` (auto-dismiss), `'swipe'` (pointer swipe past threshold), `'close'` (the built-in close button), or `'api'` (the `dismiss(id)` verb). `clear()` removes every toast immediately and does NOT fire `dismissed` (documented bulk behavior). |

## Imperative handle

The component has no events — its primary API is an imperative handle (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call the methods directly. None of the verbs overrides an inherited host-element member, so the Lit custom element emits no ROZ137 warning:

| Method | Description |
| --- | --- |
| `show` | Enqueue a toast. Accepts `{ message, type, duration, id }` (all optional — `message` defaults to `''`, `type` to `'info'`, `duration` to the `duration` prop). Returns the toast `id`. A non-sticky toast (duration > 0) auto-dismisses; `duration: 0` makes it sticky. |
| `dismiss` | Remove a single toast by the `id` returned from `show` (clears its auto-dismiss timer). |
| `clear` | Remove every visible toast at once and clear all pending auto-dismiss timers. |

```ts
// The custom element IS the handle — the exposed methods are public element
// methods (none overrides an inherited HTMLElement member, so there is no
// ROZ137 warning).
const el = document.querySelector('rozie-toaster');
const id = el.show({ message: 'Saved', type: 'success' });
el.dismiss(id);
el.clear();
```

## Slots

| Slot | Params |
| --- | --- |
| toast | toast, dismiss |
