# Headless one-time-code input comparison

How `@rozie-ui/otp` compares to the existing OTP / PIN-input libraries across the six frameworks. Like the slider and listbox, the OTP input has **no shared vanilla-JS engine** — but unlike a slider, the OTP landscape is overwhelmingly **per-framework**: every ecosystem grew its own segmented-code component (`react-otp-input`, `input-otp`, `vue3-otp-input`, `ng-otp-input`, …) with its own props, its own paste behaviour, and its own accessibility story. Rozie authors the behaviour **once** on top of N native `<input>` cells and ships it to all six frameworks as the *same* idiomatic `<Otp>`.

> Research snapshot: 2026-06-22. The OTP-input landscape is fragmented and fast-moving; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

| Framework | Representative option(s) | Native `<input>` cells | Paste-distribute | Masking | Two-way value | One source → 6 fw |
| --- | --- | :---: | :---: | :---: | :---: | :---: |
| **React** | `react-otp-input`, `input-otp` (shadcn) | ✅ / ⚠️ (input-otp uses a hidden input + fake cells) | ✅ | ⚠️ (input-otp via render) | ⚠️ value+onChange | ❌ |
| **Vue** | `vue3-otp-input`, Element Plus, PrimeVue `InputOtp` | ✅ | ✅ | ⚠️ | ✅ `v-model` | ❌ |
| **Svelte** | `svelte-otp`, hand-rolled | ✅ | ⚠️ | ⚠️ | ⚠️ bind | ❌ |
| **Solid** | *(few; mostly hand-rolled)* | ✅ | ⚠️ | ⚠️ | ⚠️ signal | ❌ |
| **Angular** | `ng-otp-input`, PrimeNG `p-inputOtp` | ✅ | ✅ | ⚠️ | ⚠️ CVA (varies) | ❌ |
| **Lit / web components** | *(none mainstream)* | — | — | — | — | ❌ |
| **Rozie** | `@rozie-ui/otp-*` | ✅ N native cells | ✅ | ✅ `mask` | ✅ `r-model:value` (Angular CVA) | ✅ |

These libraries are **good** — on its home framework each is a reasonable pick, and Rozie does not claim to out-feature `input-otp` on React or PrimeVue on Vue. The wedge is **consistency, coverage, and the native-cell foundation**: there is no OTP component that spans all six frameworks with the *same* API; each ecosystem reimplements paste-distribution, backspace choreography, masking, and `autocomplete="one-time-code"` autofill from scratch (and Lit / web components have nothing mainstream at all). Rozie gives all six the *same* idiomatic `<Otp>` from one definition.

## Native cells vs. fake cells: the design choice

The deepest decision in an OTP component is **what a cell actually is**. Two camps:

- **One hidden input + styled fake cells** (`input-otp`/shadcn): a single off-screen `<input>` holds the value; the visible "cells" are `<div>`s mirroring its characters. Maximum styling control (animated caret, slot grouping) at the cost of re-implementing caret position, selection, and per-cell focus in JavaScript.
- **N native `<input maxlength="1">` cells** (`react-otp-input`, `vue3-otp-input`, `ng-otp-input`, **Rozie**): each cell is a real input. Focus, the caret, the keyboard, the clipboard, and `autocomplete="one-time-code"` come from the platform; the work is the choreography between cells (advance on type, retreat on backspace, distribute on paste).

Rozie picks the native-cells camp deliberately. The highest-value surface — mobile keyboards, SMS autofill, platform focus and selection — is the browser's, identical on all six targets, while Rozie owns the author-side API, the sanitize/distribute logic, and the focus choreography (through **one container ref**, never per-cell refs, which is what gives it a clean cross-target story including Lit's shadow root).

## Fully controlled, no local state

Most OTP components keep an internal array of per-cell characters and reconcile it against the bound value — which means a value↔cells echo guard and the usual "controlled vs uncontrolled" footguns. `@rozie-ui/otp` keeps **none**: the assembled code string *is* `value` (the sole `model: true` prop), and each cell's displayed character is derived from it (`value[i]`). Entry is sequential, so `value` is always a contiguous string; there is no draft buffer to drift. That is what lets the same source stay fully controlled — and two-way bound — on all six frameworks, and it is why the Angular output is a clean `ControlValueAccessor` (an OTP **is** a form control).

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Lit / web components**, which have *no* mainstream OTP component at all, and **Solid**, which is mostly hand-rolled. Both are categories the incumbents barely serve.
- **The same component surface everywhere.** Where the ecosystem offers a different library per framework — five APIs, five paste behaviours, five accessibility stories — `@rozie-ui/otp` is one `<Otp>` with the same props, the same `change` / `complete` events, the same two-way `value`, and the same `focus` / `clear` handle on all six.
- **Platform autofill + a11y for free.** `autocomplete="one-time-code"` on the first cell, `inputmode` per `type`, ordinal `aria-label`s, and `role="group"` ship in the box — the SMS-autofill path most hand-rolled inputs forget.
- **A real two-way `value` on all six** — `r-model:value` reads *and* writes the code with no `onChange → setState` glue, and the Angular output is a `ControlValueAccessor`, so `[formControl]` / `[(ngModel)]` bind directly.
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-otp-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **`input-otp`'s animated single-input model.** The shadcn `input-otp` approach (one hidden input + fully custom cells) enables effects native cells can't easily do — a single animated caret sweeping across cells, arbitrary cell grouping with separators. Rozie's native-cells foundation trades that ceiling for free platform focus/selection and SMS autofill.
- **Middle-gap / non-contiguous states.** Rozie models the standard OTP UX — a contiguous left-to-right code — which is what keeps it fully controlled with no draft state. A deliberately sparse code (cell 1 and cell 4 filled, 2–3 empty), which no real verification flow produces, is intentionally not modeled.
- **Per-cell custom rendering.** Libraries that own their cell DOM can inject arbitrary per-cell content (icons, separators, grouped layouts) via render props. `@rozie-ui/otp` renders native `<input>` cells and styles them via tokens; it does not expose a per-cell render slot today.
- **`@rozie-ui/otp` is `0.1.0`.** The surface (8 props / 2 events / 2-verb handle / masking / paste-distribute) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established per-framework libraries.

## Try it

The [`@rozie-ui/otp` showcase + API reference](/components/otp) documents the `@rozie-ui/otp-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/otp-react`, etc.). There is **no engine to import and no required CSS** — the native-cell behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/otp-demo) runs the real Vue package in the page.

## Cross-references

- [Otp — showcase & API](/components/otp) — the full `@rozie-ui/otp` surface, quick start, theming, keyboard, and accessibility reference.
- [Otp — live demo](/components/otp-demo) — the real Vue package running in the page (numeric + masked + a `@complete` readout), plus the one `.rozie` source and all six generated outputs.
- [`Otp.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/otp/src/Otp.rozie)
- [Slider — headless slider / range](/components/slider-comparison) — a sibling no-engine pure-Rozie family built on a native `<input type="range">`.
