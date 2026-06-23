# Otp — the cross-framework headless one-time-code input

`Otp` is Rozie's **headless, fully-accessible** one-time-code / PIN input — a `@rozie-ui` family with **no third-party engine** behind it. Every behaviour (per-cell typing, paste-to-distribute, backspace/arrow/Home/End navigation, focus choreography, `role="group"`, ordinal `aria-label`s, masking, and `autocomplete="one-time-code"` SMS autofill) is authored once in `Otp.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

Under the hood the "engine" is the **platform itself**: N native `<input>` cells. Browser focus, the keyboard, the clipboard, and one-time-code SMS autofill all come from the platform for free. The component is **fully controlled with no local state** — the assembled code string *is* `value` (the sole `model: true` prop), and each cell's displayed character is derived from it (`value[i]`). There is no draft buffer and no value↔cells echo guard to maintain; entry is sequential (left → right), so `value` is always a contiguous string. Rozie owns the author-side API: the two-way `r-model:value`, the sanitize/distribute logic, the focus choreography (via one container ref, never per-cell refs), and the token-themed skin.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/otp` packages

`Otp` ships as six pre-compiled, per-framework packages generated from a single `Otp.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/otp-react` | `npm i @rozie-ui/otp-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/otp/packages/react/README.md) |
| `@rozie-ui/otp-vue` | `npm i @rozie-ui/otp-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/otp/packages/vue/README.md) |
| `@rozie-ui/otp-svelte` | `npm i @rozie-ui/otp-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/otp/packages/svelte/README.md) |
| `@rozie-ui/otp-angular` | `npm i @rozie-ui/otp-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/otp/packages/angular/README.md) |
| `@rozie-ui/otp-solid` | `npm i @rozie-ui/otp-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/otp/packages/solid/README.md) |
| `@rozie-ui/otp-lit` | `npm i @rozie-ui/otp-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/otp/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Otp.rozie`, so they cannot drift from the compiled output (`codegen.mjs` asserts the structural columns of this page against `ir.props` on every run).

## Quick start

Two-way bind `value` and set `length` / `type` to get a segmented code input. The assembled code is always a contiguous string; `@complete` fires when the last cell is filled:

```rozie
<components>
{
  Otp: './Otp.rozie',
}
</components>

<data>
{
  code: '',
}
</data>

<template>
  <!-- 6-digit numeric code -->
  <Otp r-model:value="$data.code" :length="6" type="numeric" ariaLabel="Verification code" @complete="onComplete" />

  <!-- masked 4-digit PIN -->
  <Otp r-model:value="$data.code" :length="4" mask ariaLabel="PIN" />
</template>
```

`r-model:value` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Otp` a string, `Otp` writes the new contiguous code back on every edit (type, paste, backspace), and the framework reconciler picks it up — no `onChange → setState` wiring. Because `value` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor` — an `Otp` **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `value` | `String` | `''` | yes (via `r-model`) | The assembled code — the sole `model: true` prop, so Angular emits a `ControlValueAccessor`. Always a contiguous string of `0..length` characters. |
| `length` | `Number` | `6` | yes | Number of cells. |
| `type` | `String` | `"numeric"` | yes | Allowed-character class + mobile keyboard hint: `'numeric'` (digits, `inputmode="numeric"`), `'alphanumeric'` (`[A-Za-z0-9]`, `inputmode="text"`), or `'text'` (any non-space, `inputmode="text"`). |
| `mask` | `Boolean` | `false` | yes | Render cells as masked dots (`type="password"`) — for sensitive codes. |
| `autoFocus` | `Boolean` | `false` | yes | Focus the first empty cell on mount. |
| `disabled` | `Boolean` | `false` | yes | Disable every cell (also sets the Angular CVA disabled state). |
| `placeholder` | `String` | `''` | yes | Per-cell placeholder character (e.g. `'•'` or `'0'`). |
| `ariaLabel` | `String` | `null` | yes | Accessible name for the whole group (`role="group"`). Each cell also gets an ordinal `aria-label` (`"Digit 1 of 6"`). |

### Events

| Event | Description |
| --- | --- |
| `change` | Fired on every edit (type, paste, backspace, or a programmatic `clear`). Payload `{ value }` — the new contiguous code string (`0..length` chars). Funneled through one `writeValue` wrapper so the React prop-destructure hoists exactly once. |
| `complete` | Fired when the last cell is filled (the code reaches `length` characters). Payload `{ value }` — the complete code. Use it to auto-submit a verification flow. |

### Imperative handle

Declared once in the source via `$expose`; obtained through each framework's native ref mechanism.

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the first empty cell (clamped to the last cell when the code is full). **Deliberately named `focus`**, which overrides the inherited `HTMLElement.focus` on the Lit custom element — the public `focus()` handle is intended (an accepted, warn-only ROZ137). This mirrors the slider precedent; listbox took the other branch (`focusControl`). |
| `clear` | Reset the code to the empty string (emits `change` with `{ value: "" }`) and move focus to the first cell. Collision-safe — not a host-element member. |

### Slots

`Otp` declares **no slots** — the cells are native `<input>` elements rendered by the component, and the surface is fully covered by props, events, and the imperative handle.

## Theming

Every value the component renders is a `--rozie-otp-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-otp {
  --rozie-otp-accent: #16a34a;
  --rozie-otp-cell-size: 3rem;
  --rozie-otp-radius: 0.75rem;
  --rozie-otp-gap: 0.75rem;
}
```

The full token vocabulary — cell box model (`cell-size`, `font-size`, `font-weight`, `bg`, `color`, `border-width`, `border-color`, `radius`), the accent, the filled-cell border, the focus ring (`focus-ring-width`, `focus-ring-color`), the placeholder color, the gap, and the disabled state (`disabled-opacity`, `disabled-bg`) — has documented defaults in `themes/base.css`. Only cosmetic values flow through tokens; the structural rules (the inline-flex cell row, the per-cell box model, the focus ring) compile per-leaf and are not consumer-overridable.

### Design-system bridges

Each package ships token presets that map the OTP tokens onto a known design system's published CSS variables — so the input automatically follows that system's light/dark theme and accent:

```ts
import '@rozie-ui/otp-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --primary/--ring/--border/--background…
import '@rozie-ui/otp-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/otp-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
import '@rozie-ui/otp-react/themes/base.css';      // the documented default token set
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/otp/src/themes/base.css).

## Keyboard

Focus a cell (`Tab` or click), then drive the input from the keyboard. Typing a character advances focus; backspace deletes and retreats; arrows / Home / End navigate without editing:

| Key | Action |
| --- | --- |
| a digit / character | Filtered by `type`; written into the cell and focus advances to the next cell. Overwrites a filled cell (the last char typed wins). |
| `Backspace` | Delete the current cell's character; if it is already empty, delete the previous cell's character and move focus back. |
| `←` / `→` | Move focus to the previous / next cell (no edit). |
| `Home` / `End` | Move focus to the first / last cell. |
| paste | The pasted text is filtered by `type` and distributed across the cells from the current position; focus lands after the last filled cell. |

## Accessibility

- The container is a `role="group"` with the `ariaLabel` you supply as its `aria-label`; each cell is a native `<input maxlength="1">` carrying an ordinal `aria-label` (`"Digit 1 of 6"`).
- The first cell sets `autocomplete="one-time-code"`, so mobile browsers offer to autofill a code received over SMS; the remaining cells set `autocomplete="off"`.
- `type="numeric"` sets `inputmode="numeric"` for a numeric soft keyboard; `'alphanumeric'` / `'text'` use `inputmode="text"`. `autocapitalize`, `autocorrect`, and `spellcheck` are disabled on every cell.
- `mask` switches the cells to `type="password"` so a sensitive code renders as dots while keeping the same keyboard and ARIA behaviour.
- Focus choreography reads a **single container ref** and walks `root.querySelectorAll('input')` — which reaches the cells inside Lit's shadow root too — and runs only in post-mount handlers, so it is identical on all six targets.
