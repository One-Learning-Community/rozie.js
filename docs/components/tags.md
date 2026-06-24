# Tags — the cross-framework headless token / tags input

`Tags` is Rozie's **headless, fully-accessible** tags / token input — a `@rozie-ui` family with **no third-party engine** behind it. Every behaviour (type-to-add with configurable delimiter keys, paste-to-bulk-add, Backspace-deletes-previous, dedup, per-token validation, a `max` cap, removable chips with labelled remove controls, a live token count, and the focus choreography) is authored once in `Tags.rozie` and compiled to idiomatic React, Vue, Svelte, Angular, Solid, and Lit.

Under the hood the "engine" is the **platform itself**: one native `<input>` for typing plus a row of removable chips. The browser keyboard, the clipboard (paste), and focus all come from the platform for free. The committed tokens **are** `modelValue` (the sole `model: true` prop), so the value is fully two-way bound; the only local state is the in-progress `draft` text in the input — a genuine UI buffer distinct from the committed list. Rozie owns the author-side API: the two-way `r-model:modelValue`, the commit / dedup / validate / cap logic, paste distribution, the Backspace behaviour, the focus choreography (via one container ref, never per-chip refs), and the token-themed skin.

And because **every visual value is a CSS custom property**, it re-skins to any design system — with ready-made bridges for shadcn/ui, Material 3, and Bootstrap 5.

## The `@rozie-ui/tags` packages

`Tags` ships as six pre-compiled, per-framework packages generated from a single `Tags.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/tags-react` | `npm i @rozie-ui/tags-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tags/packages/react/README.md) |
| `@rozie-ui/tags-vue` | `npm i @rozie-ui/tags-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tags/packages/vue/README.md) |
| `@rozie-ui/tags-svelte` | `npm i @rozie-ui/tags-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tags/packages/svelte/README.md) |
| `@rozie-ui/tags-angular` | `npm i @rozie-ui/tags-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tags/packages/angular/README.md) |
| `@rozie-ui/tags-solid` | `npm i @rozie-ui/tags-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tags/packages/solid/README.md) |
| `@rozie-ui/tags-lit` | `npm i @rozie-ui/tags-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tags/packages/lit/README.md) |

Each package carries only its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common + @angular/forms`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). The per-leaf READMEs and the [API reference](/components/tags-api) props table are generated from the same IR parse of `Tags.rozie`, so they cannot drift from the compiled output.

## Quick start

Two-way bind `modelValue` (a `string[]`) and type — press Enter or comma to commit a token. Paste a comma-separated list to bulk-add; Backspace in an empty input removes the last token:

```rozie
<components>
{
  Tags: './Tags.rozie',
}
</components>

<data>
{
  skills: ['rozie', 'vue'],
}
</data>

<template>
  <Tags
    r-model:modelValue="$data.skills"
    placeholder="Add a skill…"
    ariaLabel="Skills"
    :max="8"
    @add="onAdd"
  />
</template>
```

`r-model:modelValue` is Rozie's [two-way bind](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere): the consumer hands `Tags` an array, `Tags` writes a fresh array back on every add/remove, and the framework reconciler picks it up — no `onChange → setState` wiring. Because `modelValue` is the component's sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor` — a `Tags` **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).

## Custom chip rendering

Every chip is rendered through a scoped `#tag` slot whose params are `{ tag, index, remove }`. The default fallback renders the built-in chip (a label + a labelled remove button); override the slot to render anything — a pill, an avatar, a status dot — and call `remove()` from your own control:

```rozie
<template>
  <Tags r-model:modelValue="$data.skills" ariaLabel="Skills">
    <template #tag="{ tag, remove }">
      <span class="my-pill">{{ tag }} <button type="button" @click="remove">×</button></span>
    </template>
  </Tags>
</template>
```

On React the slot surfaces as a render-prop `children` callback — the one documented cross-framework slot divergence.

## API

The full prop / event / handle / slot surface lives on the dedicated **[API reference](/components/tags-api)** page. In brief:

- **Props** — `modelValue` (the two-way tokens array), `delimiters` (commit keys, default `[',', 'Enter']`), `allowDuplicates` (default `false`), `max` (cap, default `null`), `disabled` / `readonly` (both default `false`), `validate` (per-token validator/normalizer), `placeholder`, and `ariaLabel`. Boolean props default `false` (negative opt-out).
- **Events** — `add` (`{ value, tokens }`), `remove` (`{ value, index, tokens }`), `change` (`{ value }` — the full array, on every mutation).
- **Imperative handle** — `clear()` and `focusInput()`.
- **Slot** — the scoped `tag` slot (`{ tag, index, remove }`).

## Behaviour

| Interaction | Result |
| --- | --- |
| type a character | mirrors into the inline `draft` buffer (not yet committed). |
| a delimiter key (`Enter` / `,` by default) | commits the draft as a token (after trim → `validate` → dedup → `max`), clears the draft, and fires `add` + `change`. |
| paste | the pasted text is split on the non-`Enter` delimiter characters and each piece is bulk-added (same validate/dedup/cap rules); fires `add` per accepted token. |
| `Backspace` in an **empty** input | removes the previous (last) token and fires `remove` + `change`. |
| a chip's remove control (click) | removes that token and fires `remove` + `change`. |
| reaching `max` | the input is disabled; further adds (type-commit, paste, programmatic) are rejected. |

A candidate that is empty, a duplicate (when `allowDuplicates` is `false`), rejected by `validate`, or over `max` is **silently dropped** — no event fires.

## Theming

Every value the component renders is a `--rozie-tags-*` CSS custom property with a built-in fallback, so it works with **zero configuration** yet is completely re-skinnable. Override tokens at any ancestor scope:

```css
.rozie-tags {
  --rozie-tags-accent: #16a34a;
  --rozie-tags-chip-bg: #dcfce7;
  --rozie-tags-radius: 0.75rem;
  --rozie-tags-gap: 0.5rem;
}
```

The full token vocabulary — the control box (`gap`, `padding`, `bg`, `color`, `border-width`, `border-color`, `radius`, `min-width`), the accent + focus ring (`accent`, `focus-ring-width`, `focus-ring-color`), the chip (`chip-gap`, `chip-padding`, `chip-font-size`, `chip-color`, `chip-bg`, `chip-radius`), the chip remove button (`remove-size`, `remove-color`, `remove-opacity`, `remove-hover-bg`), the inline input (`input-min`, `input-padding`, `placeholder-color`), and the disabled state (`disabled-opacity`, `disabled-bg`) — has documented defaults in `themes/base.css`. Only cosmetic values flow through tokens; the structural rules compile per-leaf and are not consumer-overridable.

### Design-system bridges

Each package ships token presets that map the tags tokens onto a known design system's published CSS variables — so the input automatically follows that system's light/dark theme and accent:

```ts
import '@rozie-ui/tags-react/themes/shadcn.css';    // shadcn/ui (Radix) — reads --primary/--secondary/--border/--ring…
import '@rozie-ui/tags-react/themes/material.css';  // Material 3 — reads --md-sys-color-*
import '@rozie-ui/tags-react/themes/bootstrap.css'; // Bootstrap 5 — reads --bs-*
import '@rozie-ui/tags-react/themes/base.css';      // the documented default token set
```

The full token vocabulary is in [`themes/base.css`](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tags/src/themes/base.css).

## Accessibility

- The container is a `role="group"` with the `ariaLabel` you supply as its `aria-label`; the inline text input carries the same label so assistive tech announces what is being entered.
- Each chip's remove control is a real `<button>` with an `aria-label` of `"Remove <token>"`, so it is reachable and announced individually.
- A visually-hidden `aria-live="polite"` region announces the current token count (`"3 tags"`) as the list changes.
- `disabled` disables the input and every remove button; `readonly` hides the input and remove buttons so the tokens read as a display of committed values.
- Focus choreography reads a **single container ref** and walks `root.querySelector('input')` — which reaches the input inside Lit's shadow root too — and runs only in post-mount handlers, so it is identical on all six targets.

## See also

- [Tags — API reference](/components/tags-api) — the full prop / event / handle / slot surface.
- [Headless tags input comparison](/components/tags-comparison) — how `@rozie-ui/tags` stacks up against the per-framework token-input libraries.
- [Tags — live demo](/components/tags-demo) — the real Vue package running in the page.
- [`Tags.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tags/src/Tags.rozie)
