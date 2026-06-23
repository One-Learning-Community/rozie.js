# Headless combobox / autocomplete comparison

How `@rozie-ui/combobox` compares to the existing combobox / autocomplete libraries across the six frameworks. Like the slider and otp, the combobox has **no shared vanilla-JS engine** — but unlike a slider, the combobox/autocomplete landscape is overwhelmingly **per-framework**: every ecosystem grew its own typeahead (`@headlessui/react` Combobox, Radix + cmdk, `downshift`, `vue-select`, the Angular CDK/Material autocomplete, …) with its own props, its own filtering model, and its own accessibility story. Rozie authors the WAI-ARIA combobox pattern **once** on native DOM and ships it to all six frameworks as the *same* idiomatic `<Combobox>`.

> Research snapshot: 2026-06-22. The combobox landscape is fragmented and fast-moving; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

| Framework | Representative option(s) | WAI-ARIA combobox | Built-in filtering | Async mode | Two-way value | Custom option render | One source → 6 fw |
| --- | --- | :---: | :---: | :---: | :---: | :---: | :---: |
| **React** | Headless UI `Combobox`, Radix + `cmdk`, `downshift` | ✅ | ⚠️ (downshift BYO; cmdk built-in) | ✅ | ⚠️ value+onChange | ✅ (render prop) | ❌ |
| **Vue** | `vue-select`, PrimeVue `AutoComplete`, Headless UI Vue | ✅ | ✅ | ✅ | ✅ `v-model` | ✅ (slot) | ❌ |
| **Svelte** | `svelte-select`, hand-rolled | ✅ / ⚠️ | ✅ | ✅ | ⚠️ bind | ✅ (slot) | ❌ |
| **Solid** | `@kobalte/core` Combobox, hand-rolled | ✅ | ⚠️ | ⚠️ | ⚠️ signal | ✅ | ❌ |
| **Angular** | CDK `Autocomplete`, Material `mat-autocomplete` | ✅ | ⚠️ (BYO filter pipe) | ✅ | ⚠️ CVA | ✅ (template) | ❌ |
| **Lit / web components** | *(none mainstream)* | — | — | — | — | — | ❌ |
| **Rozie** | `@rozie-ui/combobox-*` | ✅ | ✅ (+ `disableFilter`) | ✅ (`search` event) | ✅ `r-model:value` (Angular CVA) | ✅ `#option` slot | ✅ |

These libraries are **good** — on its home framework each is a reasonable pick, and Rozie does not claim to out-feature Headless UI on React or PrimeVue on Vue. The wedge is **consistency, coverage, and a built-in WAI-ARIA implementation**: there is no combobox that spans all six frameworks with the *same* API; each ecosystem reimplements the input + popup listbox, `aria-activedescendant` navigation, the filtering model, and dismissal from scratch (and Lit / web components have nothing mainstream at all). Rozie gives all six the *same* idiomatic `<Combobox>` from one definition.

## The WAI-ARIA combobox pattern, implemented once

The deepest work in a combobox is the **ARIA + keyboard model**: a `role="combobox"` input, a `role="listbox"` popup, the active option tracked via `aria-activedescendant` (so the highlight moves without real DOM focus leaving the input), `aria-expanded` / `aria-controls` wiring, and the `ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter`/`Escape` keyboard map with disabled-option skipping. Most ecosystems get *some* of this right in *some* libraries — and re-derive it per framework. Rozie authors it once and compiles it to all six, so the accessibility floor is identical everywhere, including the Lit custom element where there is no incumbent at all.

Dismissal is the robust headless pattern: options select on `@mousedown.prevent` (selection happens *before* the input blurs, and focus stays on the input), and the input's `@blur` closes the popup — so there is **no document click-outside listener** and therefore no cross-Lit-shadow retargeting problem that a global listener would introduce.

## Filtering: batteries included, async escape hatch

`@rozie-ui/combobox` filters the `options` you pass by `label` out of the box — zero wiring, unlike `downshift` (which is intentionally filter-agnostic) or the Angular CDK autocomplete (which expects you to pipe the list yourself). When you need server-side data, `disableFilter` + the `search` event turn it into a controlled async typeahead: the component renders whatever `options` you hold and emits the query on each keystroke. One component covers both the "static list" and "remote search" cases that often need two different incumbents.

## Single model, real two-way value

`value` is the combobox's sole `model: true` prop — the selected option's value, read *and* written through `r-model:value` with no `onChange → setState` glue. The input *text* is internal state, deliberately **not** a second model: two models would forfeit the clean `ControlValueAccessor` the Angular output generates (a combobox **is** a form control). That is what lets the same source stay fully two-way bound on all six frameworks and bind directly to `[formControl]` / `[(ngModel)]` on Angular.

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Lit / web components**, which have *no* mainstream combobox at all, and **Solid**, which is thinly served. Both are categories the incumbents barely reach.
- **The same component surface everywhere.** Where the ecosystem offers a different library per framework — many APIs, many filtering models, many accessibility stories — `@rozie-ui/combobox` is one `<Combobox>` with the same props, the same `change` / `search` events, the same two-way `value`, the same `#option` scoped slot, and the same `focus` / `clear` handle on all six.
- **WAI-ARIA + keyboard for free.** `role="combobox"`/`role="listbox"`, `aria-activedescendant`, `aria-expanded`/`aria-controls`, and the full arrow/Home/End/Enter/Escape model ship in the box.
- **A real two-way `value` on all six** — `r-model:value` reads *and* writes with no glue, and the Angular output is a `ControlValueAccessor`.
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-combobox-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **Floating-positioned popup.** The popup is positioned directly below the input (`position: absolute`); there is **no floating-ui-style auto-flip/shift** to keep it on-screen near a viewport edge. Libraries that wrap `@floating-ui` (Headless UI, Kobalte, Radix) flip and shift automatically. This is a deliberate no-engine v1 limitation.
- **Multi-select / tags.** `@rozie-ui/combobox` is single-select (one `value` model). Tag/token multi-select inputs (`vue-select` multiple, react-select) are not modeled today.
- **Option groups & virtualization.** A flat option list, rendered in full. Grouped headings and windowed rendering of very large lists (the `@rozie-ui/data-table` virtualization story) are not built into the combobox yet.
- **Free-text / create-on-the-fly.** The value is always one of the supplied options; there is no "allow arbitrary text as the value" / creatable mode.
- **`@rozie-ui/combobox` is `0.1.0`.** The surface (7 props / 2 events / 2-verb handle / `#option` slot / client + async filtering) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established per-framework libraries.

## Try it

The [`@rozie-ui/combobox` showcase + API reference](/components/combobox) documents the `@rozie-ui/combobox-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/combobox-react`, etc.). There is **no engine to import and no required CSS** — the WAI-ARIA behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/combobox-demo) runs the real Vue package in the page.

## Cross-references

- [Combobox — showcase & API](/components/combobox) — the full `@rozie-ui/combobox` surface, quick start, filtering, theming, keyboard, and accessibility reference.
- [Combobox — live demo](/components/combobox-demo) — the real Vue package running in the page (filterable picker + custom `#option` slot + a selected-value readout), plus the one `.rozie` source and all six generated outputs.
- [`Combobox.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/combobox/src/Combobox.rozie)
- [Otp — headless one-time-code input](/components/otp-comparison) — a sibling no-engine pure-Rozie family built on native `<input>` cells.
