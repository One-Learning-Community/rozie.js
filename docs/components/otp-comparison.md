---
surface_hash: 4a5c43776a0f
---

# Headless one-time-code input comparison

How `@rozie-ui/otp` compares to the existing OTP / PIN-input libraries across the six frameworks. Like the slider and listbox, the OTP input has no shared vanilla-JS engine. Unlike a slider, though, the OTP landscape is overwhelmingly per-framework: every ecosystem grew its own segmented-code component (`react-otp-input`, `input-otp`, `vue3-otp-input`, `ng-otp-input`, Corvu's OTP Field, …) with its own props, its own paste behaviour, and its own accessibility story. The one genuinely cross-framework option, Zag.js's `pin-input` machine, ships *separate per-framework bindings* you wire yourself. Rozie ships the same `<Otp>`, built on N native `<input>` cells, with the same props, events, two-way `value`, and handle, to all six frameworks.

> Research snapshot: 2026-08-10. The OTP-input landscape is fragmented and fast-moving; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

| Framework | Representative option(s) | Cell model | Paste-distribute | Two-way value | Same API, 6 fw |
| --- | --- | --- | :---: | :---: | :---: |
| **React** | `input-otp` (shadcn), `react-otp-input`, Base UI OTP Field | one hidden input *or* N native cells | ✅ | ⚠️ value + onChange | ❌ |
| **Vue** | `vue3-otp-input`, `vue-input-otp`, PrimeVue `InputOtp`, Element Plus | N native cells *or* hidden input | ✅ | ✅ `v-model` | ❌ |
| **Svelte** | Bits UI `PinInput` / shadcn-svelte, several `*-otp` packages | one hidden input *or* N native cells | ✅ | ⚠️ bind | ❌ |
| **Solid** | Corvu OTP Field, shadcn-solid (built on Corvu) | one hidden input over slots | ✅ | ⚠️ value + onChange | ❌ |
| **Angular** | `ng-otp-input`, `ngx-otp-input`, PrimeNG `p-inputOtp` | N native cells *or* one real input | ✅ | ⚠️ CVA | ❌ |
| **Lit / web components** | *(none mainstream)* | — | — | — | ❌ |
| **Zag.js `pin-input`** | framework-agnostic state machine (React/Vue/Solid/Svelte bindings) | N native cells | ✅ | ⚠️ per-binding | ⚠️ 4 fw, no Angular/Lit |
| **Rozie** | `@rozie-ui/otp-*` | ✅ N native cells | ✅ | ✅ `r-model:value` (Angular CVA) | ✅ |

On its home framework each of these is a solid pick. The case for Rozie is consistency, coverage, and the native-cell foundation: there is no OTP component that spans every framework with the same API. Even the popular hidden-input model (`input-otp`) is reproduced framework-by-framework through *separate* ports (`vue-input-otp`, shadcn-svelte's Bits UI port, Corvu on Solid): separate authors, separate APIs. The one agnostic option, Zag.js's `pin-input`, covers four frameworks but ships per-framework binding code you assemble into a component yourself, and reaches neither Angular nor Lit. Lit / web components have nothing mainstream at all. Rozie gives them all the same `<Otp>`.

## Native cells vs. fake cells: the design choice

The deepest decision in an OTP component is what a cell actually is. Two camps:

- **One hidden input + styled fake cells** (`input-otp`/shadcn, Corvu, Bits UI): a single (often invisible, overlaid) `<input>` holds the value; the visible "cells" are `<div>`s mirroring its characters. Maximum styling control — an animated caret sweeping across cells, arbitrary cell grouping with separators, password-manager badge handling — at the cost of re-implementing caret position, selection, and per-cell focus in JavaScript. This model now has a respected port in most ecosystems, but each is a *different* library.
- **N native `<input maxlength="1">` cells** (`react-otp-input`, `vue3-otp-input`, `ng-otp-input`, Zag.js, **Rozie**): each cell is a real input. Focus, the caret, the keyboard, the clipboard, and `autocomplete="one-time-code"` come from the platform; the work is the choreography between cells (advance on type, retreat on backspace, distribute on paste).

Rozie picks the native-cells camp deliberately. The highest-value surface (mobile keyboards, SMS autofill, platform focus and selection) is the browser's, while Rozie owns the author-side API, the sanitize/distribute logic, and the focus choreography. That choreography runs through one container ref, never per-cell refs, which is what gives it a clean cross-target story including Lit's shadow root.

## Fully controlled, no local state

Most OTP components keep an internal array of per-cell characters (or a draft buffer behind the hidden input) and reconcile it against the bound value, which means a value↔cells echo guard and the usual "controlled vs uncontrolled" footguns. `@rozie-ui/otp` keeps none: the assembled code string *is* `value` (the sole `model: true` prop), and each cell's displayed character is derived from it (`value[i]`). Entry is sequential, so `value` is always a contiguous string; there is no draft buffer to drift. That is what lets the component stay fully controlled and two-way bound, and it is why the Angular output is a clean `ControlValueAccessor` (an OTP is a form control).

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-assembly-required.

| Capability | React (`input-otp`) | Vue (`vue3-otp-input`) | Svelte (Bits/shadcn) | Solid (Corvu) | Angular (`ng-otp-input`) | Lit (none) | Zag.js | **`@rozie-ui/otp`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Native `<input>` cells | ❌ hidden input | ✅ | ❌ hidden input | ❌ hidden input | ✅ | ❌ | ✅ | ✅ |
| Paste-to-distribute | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| `autocomplete="one-time-code"` autofill | ✅ | ⚠️ | ✅ | ✅ | ✅ | — | ✅ (`otp`) | ✅ |
| Masking / password cells | ✅ pattern | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | ✅ | ✅ `mask` |
| Two-way value binding | ⚠️ value+onChange | ✅ `v-model` | ⚠️ bind | ⚠️ value+onChange | ⚠️ CVA | — | ⚠️ per-binding | ✅ `r-model:value` (Angular CVA) |
| Imperative handle | ⚠️ ref-on-input | ⚠️ `clearInput`/`fillInput` | ⚠️ varies | ⚠️ context | ⚠️ varies | hand-roll | ⚠️ `api` | ✅ uniform `focus`/`clear` |
| Zero-config styling, re-skinnable | ⚠️ unstyled, wire it | ⚠️ class props | ⚠️ | ⚠️ unstyled | ⚠️ class hooks | — | ⚠️ unstyled | ✅ CSS-var tokens + shadcn/Material/Bootstrap bridges |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ 4 fw, per-binding | ✅ |

## Where Rozie wins today

- **First-class packages everywhere** — including **Lit / web components**, which have *no* mainstream OTP component at all, and the same idiomatic surface on the four frameworks Zag.js reaches *plus* the two it doesn't (Angular, Lit).
- **The same component surface everywhere.** Where the ecosystem offers a different library per framework, `@rozie-ui/otp` is one `<Otp>` with the same props, the same `change` / `complete` events, the same two-way `value`, and the same `focus` / `clear` handle. One component to learn, document, and migrate across your stack.
- **Platform autofill + a11y for free.** `autocomplete="one-time-code"` on the first cell, `inputmode` per `type`, ordinal `aria-label`s, and `role="group"` ship in the box: the SMS-autofill path most hand-rolled inputs forget.
- **A real two-way `value`.** `r-model:value` reads *and* writes the code with no `onChange → setState` glue, and because `value` is the sole `model: true` prop the Angular output is a `ControlValueAccessor`, so `[formControl]` / `[(ngModel)]` bind directly. (Most React/Solid/Svelte options are value+callback; only Vue's `v-model` is comparable.)
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-otp-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5, where most incumbents ship unstyled and leave the skin to you.

## What Rozie defers {#what-rozie-defers}

- **The hidden-input model's styling ceiling.** The `input-otp` / Corvu / Bits UI approach (one invisible input + fully custom cells) enables effects native cells can't easily do: a single animated caret sweeping across cells, arbitrary cell grouping with separators, and the password-manager badge handling `input-otp` is known for. Rozie's native-cells foundation trades that ceiling for free platform focus/selection and SMS autofill.
- **Middle-gap / non-contiguous states.** Rozie models the standard OTP UX, a contiguous left-to-right code, which is what keeps it fully controlled with no draft state. A deliberately sparse code (cell 1 and cell 4 filled, 2–3 empty), which no real verification flow produces, is intentionally not modeled.
- **Per-cell custom rendering.** Libraries that own their cell DOM can inject arbitrary per-cell content (icons, separators, grouped layouts) via render props or slots. `@rozie-ui/otp` renders native `<input>` cells and styles them via tokens; it does not expose a per-cell render slot today.
- **It's a single component, not a form/primitive kit.** Base UI, PrimeVue/PrimeNG, and the shadcn ports ship OTP alongside whole families of inputs, dialogs, and form controls. Rozie ships OTP (alongside its other `@rozie-ui` components), not a unified primitive suite.
- **`@rozie-ui/otp` is pre-1.0** and younger and less battle-tested than the established per-framework libraries. The full surface is documented in the [showcase & API](/components/otp).

## Try it

The [`@rozie-ui/otp` showcase + API reference](/components/otp) documents the `@rozie-ui/otp-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/otp-react`, etc.). There is no engine to import and no required CSS: the native-cell behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/otp-demo) runs the real Vue package in the page.

## Cross-references

- [Otp — showcase & API](/components/otp) — the full `@rozie-ui/otp` surface, quick start, theming, keyboard, and accessibility reference.
- [Otp — live demo](/components/otp-demo) — the real Vue package running in the page (numeric + masked + a `@complete` readout), plus the Rozie source and the six generated outputs.
- [`Otp.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/otp/src/Otp.rozie)
- [Slider — headless slider / range](/components/slider-comparison) — a sibling no-engine pure-Rozie family built on a native `<input type="range">`.
