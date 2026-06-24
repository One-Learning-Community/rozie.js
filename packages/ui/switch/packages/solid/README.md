# @rozie-ui/switch-solid

Idiomatic **solid** `Switch` — a headless, fully-accessible (WAI-ARIA `role="switch"`) on/off toggle: a boolean two-way `modelValue`, toggle on click AND Space/Enter, `aria-checked`/`aria-disabled`/`aria-readonly` wiring, and an optional scoped slot for a fully custom thumb/track — compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction engine IS the browser's native focusable element; every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/switch-solid
```

Peer dependencies: `solid-js`. Install them alongside this package.

## Usage

```tsx
import { createSignal } from 'solid-js';
import { Switch } from '@rozie-ui/switch-solid';

export function Demo() {
  const [on, setOn] = createSignal(false);
  return (
    <Switch
      modelValue={on()}
      onModelValueChange={setOn}
      ariaLabel="Wi-Fi"
      onChange={(e) => console.log('switch:', e.checked)}
    />
  );
}
```

## Theming

Every visual value is a `--rozie-switch-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```tsx
import '@rozie-ui/switch-solid/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `modelValue` | `Boolean` | `false` | ✓ |  | The on/off state of the switch (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a switch **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). `true` is the checked/on state; reflected as `aria-checked`. |
| `disabled` | `Boolean` | `false` |  |  | Disable the control entirely — it becomes non-focusable (`tabindex` is dropped), non-toggleable (click and keyboard are ignored), and `aria-disabled` is set. Also sets the Angular `ControlValueAccessor` disabled state. |
| `readonly` | `Boolean` | `false` |  |  | Make the switch read-only — its state is shown and the control stays focusable, but the user cannot toggle it (click and keyboard are ignored). Reflected as `aria-readonly`. |
| `ariaLabel` | `String` | `null` |  |  | Accessible name applied to the `role="switch"` control (`aria-label`). Provide this (or an external `<label>`) so the switch is announced. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the switch is toggled — by a click, by Space/Enter, or by the programmatic `toggle()` handle. Payload `{ checked }` — the new boolean state. (No-op while `disabled` or `readonly`.) |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the control) — on the Lit custom element this is an accepted ROZ137 warn-only override, the public `focus()` handle is intended:

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the switch control. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended. |
| `toggle` | Flip the on/off state (same funnel as a click / Space / Enter) and emit `change`. A no-op while `disabled` or `readonly`. |

```tsx
import { Switch, type SwitchHandle } from '@rozie-ui/switch-solid';

let handle: SwitchHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Switch ref={(h) => (handle = h)} modelValue={on()} />;
handle?.toggle();
```

## Slots

| Slot | Params |
| --- | --- |
| (default) | checked, toggle |
