# @rozie-ui/otp-lit

Idiomatic **lit** `Otp` — a headless, fully-accessible (WAI-ARIA) one-time-code / PIN input (segmented native cells, paste-to-distribute, full keyboard navigation, `autocomplete="one-time-code"` SMS autofill, and optional masking) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction engine IS the browser's native `<input>` cells; every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/otp-lit
```

Peer dependencies: `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/otp-lit';

// <rozie-otp> is a custom element. Bind `value`/`length`/`type` as properties,
// listen for `value-change` to receive the new code as the two-way value, and
// `complete` when every cell is filled.
const el = document.querySelector('rozie-otp');
el.length = 6;
el.type = 'numeric';
el.value = '';
el.addEventListener('value-change', (e) => {
  el.value = e.detail;
});
el.addEventListener('complete', (e) => {
  console.log('code complete:', e.detail.value);
});
```

## Theming

Every visual value is a `--rozie-otp-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/otp-lit/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `value` | `String` | `''` | ✓ |  |
| `length` | `Number` | `6` |  |  |
| `type` | `String` | `"numeric"` |  |  |
| `mask` | `Boolean` | `false` |  |  |
| `autoFocus` | `Boolean` | `false` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `placeholder` | `String` | `''` |  |  |
| `ariaLabel` | `String` | `null` |  |  |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired on every edit (type, paste, backspace, or a programmatic `clear`). Payload `{ value }` — the new contiguous code string (0..`length` chars). |
| `complete` | Fired when the last cell is filled, i.e. the code reaches `length` characters. Payload `{ value }` — the complete code string. Use it to auto-submit a verification flow. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the first empty cell) — on the Lit custom element this is an accepted ROZ137 warn-only override, the public `focus()` handle is intended:

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the first empty cell (clamped to the last cell when the code is full). NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended. |
| `clear` | Reset the code to the empty string (emits `change` with `{ value: "" }`) and move focus to the first cell. |

```ts
// The custom element IS the handle — exposed methods are public element
// methods. `focus()` here DELIBERATELY overrides the inherited
// HTMLElement.focus (it focuses the first empty cell).
const el = document.querySelector('rozie-otp');
el.focus();
el.clear();
```

## Slots

| Slot | Params |
| --- | --- |
