# Slider — the cross-framework headless slider / range

`Slider` is Rozie's **headless, fully-accessible** slider and dual-thumb range — the second `@rozie-ui` component with **no third-party engine** behind it. Every behaviour (drag, keyboard, focus, `role="slider"`, `aria-value*`, step/min/max, disabled, and RTL) is authored once in `Slider.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

Under the hood the "engine" is the browser's own **native `<input type="range">`** (Approach B): drag — mouse *and* touch — keyboard, focus management, the slider ARIA role, and step/min/max bounds all come from the platform for free. Dual-thumb **range** mode is two overlapping transparent native inputs; **vertical** is a `transform: rotate(-90deg)` wrapper (so up = increase, with an explicit `aria-orientation="vertical"`); the colored fill is a positioned `<div>` underlay driven purely by `value / min / max` arithmetic — no measured geometry. Rozie owns the author-side API: the two-way `r-model:value`, the range sort/clamp, the fill-var math, the marks + value-bubble overlays, and a thin PageUp/PageDown step augment.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5, plus the cross-browser thumb/track pseudo-element styling that native range inputs require.

## The `@rozie-ui/slider` packages

`Slider` ships as six pre-compiled, per-framework packages generated from a single `Slider.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/slider-react` | `npm i @rozie-ui/slider-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/slider/packages/react/README.md) |
| `@rozie-ui/slider-vue` | `npm i @rozie-ui/slider-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/slider/packages/vue/README.md) |
| `@rozie-ui/slider-svelte` | `npm i @rozie-ui/slider-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/slider/packages/svelte/README.md) |
| `@rozie-ui/slider-angular` | `npm i @rozie-ui/slider-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/slider/packages/angular/README.md) |
| `@rozie-ui/slider-solid` | `npm i @rozie-ui/slider-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/slider/packages/solid/README.md) |
| `@rozie-ui/slider-lit` | `npm i @rozie-ui/slider-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/slider/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Slider.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Two-way bind `value` and set the `min` / `max` / `step` scale to get a single-thumb slider. Flip on `range` to get a sorted `[lo, hi]` dual-thumb range instead:

```rozie
<components>
{
  Slider: './Slider.rozie',
}
</components>

<data>
{
  volume: 50,
  priceRange: [20, 80],
}
</data>

<template>
  <!-- single thumb -->
  <Slider r-model:value="$data.volume" :min="0" :max="100" :step="1" ariaLabel="Volume" />

  <!-- dual-thumb range -->
  <Slider range r-model:value="$data.priceRange" :min="0" :max="100" ariaLabel="Price range" />
</template>
```

`r-model:value` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Slider` a value, `Slider` writes the new value back on every commit (drag end, keyboard, or programmatic step), and the framework reconciler picks it up — no `onChange → setState` wiring. In single mode `value` is a scalar number; in `range` mode it is a **sorted `[lo, hi]` array** (each thumb is neighbour-clamped, and a fresh array is written on every commit). Because `value` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor` — a `Slider` **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `value` | `unknown` | `null` | yes (via `r-model`) | The current value. `model: true` — a scalar number in single mode, a sorted `[lo, hi]` array in `range` mode. The sole model prop, so Angular emits a `ControlValueAccessor`. |
| `range` | `Boolean` | `false` | yes | Range mode: `value` becomes a sorted `[lo, hi]` array driven by two overlapping thumbs. The exact analog of listbox's `multiple` (scalar↔array). |
| `min` | `Number` | `0` | yes | The lower bound of the scale. Forwarded to the native input as the `min` attribute. |
| `max` | `Number` | `100` | yes | The upper bound of the scale. Forwarded to the native input as the `max` attribute. |
| `step` | `Number` | `1` | yes | The granularity. Forwarded as the native `step` attribute; every write-back is quantized to it. |
| `orientation` | `String` | `"horizontal"` | yes | `'horizontal'` (default) or `'vertical'`. Vertical rotates the wrapper `-90deg` (up = increase) and sets `aria-orientation="vertical"` explicitly. |
| `disabled` | `Boolean` | `false` | yes | Disable the control (also sets the Angular CVA disabled state). |
| `marks` | `Array` | `[]` | yes | Tick marks over the track — a bare `value[]` (positions only) or a `{ value, label }[]` (positioned + labelled). Override rendering via the `mark` scoped slot. |
| `ariaLabel` | `String` | `null` | yes | Accessible name for each native input when there is no visible `<label for>`. |
| `pageStep` | `Number` | `null` | yes | The PageUp/PageDown jump. `null` → `step × 10`. Applied by a thin `@keydown` augment (arrows / Home / End stay native). |
| `formatValue` | `Function` | `null` | yes | `(value) => string` — formats the `value` bubble and `aria-valuetext`. `null` → the raw value. |
| `showValue` | `Boolean` | `false` | yes | Render the value-bubble overlay (one bubble per thumb in range mode). Headless — opt-in, no default-styled bubble. |

### Events

| Event | Description |
| --- | --- |
| `change` | Fired after the value changes (drag, keyboard, or a programmatic `increment`/`decrement`). Payload `{ value }` — a scalar in single mode, a sorted `[lo, hi]` array in range mode. The sole emit, funneled through one wrapper so the React prop-destructure hoists exactly once. |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the slider thumb (the native range input — in range mode, the `lo` thumb). **Deliberately named `focus`**, which overrides the inherited `HTMLElement.focus` on the Lit custom element — the public `focus()` handle is intended. (This *inverts* listbox's choice, which named its verb `focusControl` to avoid the override.) |
| `increment` | Increase a thumb by one `step`, clamped to `[min, max]`. Accepts an optional `thumb` argument (`'lo'` \| `'hi'`, default `'lo'`) in range mode. |
| `decrement` | Decrease a thumb by one `step`, clamped to `[min, max]`. Accepts the same optional `thumb` argument in range mode. |

### Slots

| Slot | Params | Description |
| --- | --- | --- |
| `mark` | `value, label, position` | Custom per-mark rendering. `position` is the mark's percent along the track. |
| `bubble` | `value` | Custom value-bubble rendering (one instance per thumb in range mode). Gated by `showValue`. Named `bubble`, **not** `value`, because a slot sharing the declared `value` prop name is a hard ROZ127 error (Svelte 5 unifies snippets + props into one `$props` namespace). |

## Theming

Every value the component renders is a `--rozie-slider-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-slider {
  --rozie-slider-accent: #16a34a;
  --rozie-slider-track-height: 6px;
  --rozie-slider-thumb-size: 18px;
  --rozie-slider-track-bg: rgba(255, 255, 255, 0.18);
}
```

Two of the tokens are special. `--rozie-slider-fill-start` and `--rozie-slider-fill-end` are **runtime-inline** custom properties the component writes from `value / min / max` (via the `fillStyle` `$computed`) — they drive the colored fill `<div>` and the bubble positions, so they are *not* theme tokens you set yourself. Everything else (accent, track height/radius/bg, thumb size/bg/border/shadow/offset, disabled opacity, the vertical thickness/length, and the mark/bubble cosmetics) is a token with a documented default in `themes/base.css`.

The structural rules — the Approach B overlap, the filled-`<div>` underlay, the rotate-90 vertical wrapper, and the per-vendor pseudo-elements — are behavior-critical and compile per-leaf; they are not consumer-overridable. Only the cosmetic values flow through tokens.

### Design-system bridges

Each package ships token presets that map the slider tokens onto a known design system's published CSS variables — so the slider automatically follows that system's light/dark theme and accent:

```ts
import '@rozie-ui/slider-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --primary/--ring/--muted…
import '@rozie-ui/slider-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/slider-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
import '@rozie-ui/slider-react/themes/base.css';      // the documented default token set
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/slider/src/themes/base.css).

## Keyboard

Focus a thumb (`Tab`), then drive it from the keyboard. Arrows, `Home`, and `End` are handled natively by `<input type="range">`; `PageUp` / `PageDown` are augmented so they honour your `pageStep` (native browsers use their own large step otherwise):

| Key | Action |
| --- | --- |
| `→` / `↑` | Increase the focused thumb by one `step`. (In a vertical slider `↑` increases — the wrapper is rotated `-90deg`.) |
| `←` / `↓` | Decrease the focused thumb by one `step`. |
| `Home` | Jump to `min`. |
| `End` | Jump to `max`. |
| `PageUp` | Increase by `pageStep` (`null` → `step × 10`), quantized + clamped. Augmented so it honours the configured `pageStep`. |
| `PageDown` | Decrease by `pageStep`. Same augment. |
| `Tab` | Move to the next focusable element (in range mode, between the two thumbs). |

In range mode each thumb is its own focusable native input; a thumb is clamped at its neighbour, so the array stays sorted however you drive it.

## Accessibility

- Each thumb is a native `<input type="range">`, so it carries the implicit `role="slider"` plus `aria-valuemin` / `aria-valuemax` / `aria-valuenow` **derived by the browser** from the `min` / `max` / `step` / `value` attributes — these are *not* set as `aria-*` attributes by hand (per MDN's slider-role guidance).
- A **vertical** slider sets `aria-orientation="vertical"` explicitly, because a native range input always reports itself as horizontal even when visually rotated.
- Supply an accessible name via a visible `<label for>` pointing at the input, or the `ariaLabel` prop (reflected onto each native input's `aria-label`). When `formatValue` is set, the formatted string is also surfaced as `aria-valuetext`.
- Styling a native range input requires **vendor pseudo-elements** — `::-webkit-slider-thumb` / `::-webkit-slider-runnable-track` for WebKit/Blink and `::-moz-range-thumb` / `::-moz-range-track` / `::-moz-range-progress` for Firefox. Each is emitted in its **own** rule block (never comma-combined — a single invalid vendor selector drops the whole rule on both browsers), so the thumb and track render consistently across browsers.
- In range mode, `pointer-events` is disabled on the input bodies and re-enabled only on the thumb pseudo-elements, and the focused input is raised (`z-index`), so each thumb stays independently grabbable where the two overlap.
