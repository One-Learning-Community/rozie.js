# @rozie-ui/popover-lit

Idiomatic **lit** `Popover` — a headless floating primitive for tooltips and popovers, wrapping [`@floating-ui/dom`](https://floating-ui.com) for collision-aware positioning (offset / flip / shift / arrow) with live `autoUpdate` tracking. You bring the anchor (the `anchor` slot) and the floating content (the default slot); Popover owns placement, the open/close gesture (`trigger`: click / hover / focus), dismissal (Escape + click-outside), the WAI-ARIA wiring (tooltip vs dialog), and a two-way `open` model — compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/popover-lit @floating-ui/dom
```

Peer dependencies: `lit + @lit-labs/preact-signals + @preact/signals-core + @floating-ui/dom`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/popover-lit';
import '@floating-ui/dom'; // peer engine

// <rozie-popover> is a custom element. Bind `open`/`placement`/`trigger`/`offset`/
// `arrow` as properties; listen for `change` for the new open boolean, or
// `open-change` to drive the two-way model. Project the anchor into the `anchor`
// slot and the content into the default slot.
const el = document.querySelector('rozie-popover');
el.trigger = 'click';
el.placement = 'bottom';
el.offset = 8;
el.arrow = true;
el.addEventListener('open-change', (e) => {
  el.open = e.detail;
});
el.addEventListener('change', (e) => {
  console.log('open:', e.detail);
});
```

## Theming

Every visual value is a `--rozie-popover-*` CSS custom property (background, border, radius, shadow, padding, z-index, max-width, arrow size) — override any of them at any ancestor scope to match your design system.

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `open` | `Boolean` | `false` | ✓ |  | Whether the floating content is open. The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Popover writes the new state back whenever the trigger or a dismissal toggles it. Left unbound it falls back to an uncontrolled default. |
| `placement` | `String` | `"bottom"` |  |  | Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content may flip to the opposite side when it would overflow the viewport. Reconciled at runtime. |
| `trigger` | `String` | `"click"` |  |  | How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur. Drives both the gesture handlers and the ARIA role (`'hover'`/`'focus'` → tooltip, `'click'` → popover dialog). |
| `offset` | `Number` | `8` |  |  | Distance in pixels between the anchor and the floating content (the Floating UI `offset` middleware). Reconciled at runtime. |
| `disableFlip` | `Boolean` | `false` |  |  | Disable the Floating UI `flip` middleware. By default the content flips to the opposite side of the anchor when it would overflow the viewport; set this to keep it pinned to `placement` regardless. |
| `disableShift` | `Boolean` | `false` |  |  | Disable the Floating UI `shift` middleware. By default the content shifts along its axis to stay within the viewport; set this to keep it strictly aligned to the anchor. |
| `arrow` | `Boolean` | `false` |  |  | Opt in to a positioned arrow element. When set, Popover renders an arrow `<div>` and runs the Floating UI `arrow` middleware against it so it points at the anchor. Style it via the `--rozie-popover-*` arrow CSS custom properties. |
| `disabled` | `Boolean` | `false` |  |  | Disable the control entirely: the trigger no longer opens the content and any open content is suppressed. |
| `strategy` | `String` | `"absolute"` |  |  | Floating UI positioning strategy — 'absolute' (default) or 'fixed'. Use 'fixed' to escape a scrollable/overflow-clipping ancestor (e.g. a sticky table header). Reconciled at runtime. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the open state changes — a click/hover/focus trigger gesture, an Escape or click-outside dismissal, or a programmatic `show`/`hide`/`toggle`. Payload is the new `open` boolean. The two-way `open` model is updated alongside it. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `show` | Open the floating content (no-op when `disabled`). Emits `change` and updates the `open` model. |
| `hide` | Close the floating content. Emits `change` and updates the `open` model. |
| `toggle` | Flip the open state (no-op when `disabled`). Emits `change` and updates the `open` model. |
| `reposition` | Recompute the floating position immediately (the Floating UI `computePosition` pass). Useful after content size changes that `autoUpdate` does not observe. |

```ts
// The custom element IS the handle — exposed methods are public element methods.
const el = document.querySelector('rozie-popover');
el.show();
el.hide();
el.toggle();
el.reposition();
```

## Slots

| Slot | Params |
| --- | --- |
| anchor | open, toggle, show, hide |
| (default) |  |
