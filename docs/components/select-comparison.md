---
surface_hash: 06a203fbf92a
---

# Headless select / combobox comparison

How `@rozie-ui/select` compares to the existing headless select & combobox libraries across the six frameworks. Unlike Rozie's engine-wrapper components (Embla, Flatpickr, Chart.js…), the select has no vanilla-JS engine behind it; there is no shared "select core" the way Embla is a shared carousel core. Instead, every framework ecosystem reimplements the WAI-ARIA [select](https://www.w3.org/WAI/ARIA/apg/patterns/select/) / [combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) pattern from scratch, in its own idiom. The result is the most fragmented landscape of any component Rozie ships: the best options are React-only, the one cross-framework incumbent (Headless UI) covers just React + Vue, Svelte and Solid each have their own separate community libraries, Angular gives you low-level CDK primitives you assemble yourself, and web components have no headless combobox at all. Rozie ships the same headless `<Select>`, with the same props, events, two-way `value`, slots, and handle, to all six frameworks. (Type-to-filter is the sibling [`@rozie-ui/combobox`](/components/combobox) family, built on the same headless list spine.)

> Research snapshot: 2026-08-10. The headless-UI landscape moves quickly; treat the library names, framework coverage, and "combobox?" column as of that date.

## The libraries at a glance

| Framework | Representative headless option(s) | Shape | Select | Combobox | Notes |
| --- | --- | --- | :---: | :---: | --- |
| **React** | Headless UI, Radix UI, Ariakit, React Aria, downshift | render-props / hooks | ✅ | ✅ (most) | Deepest ecosystem by far. React Aria is the accessibility gold standard; Radix has **no combobox** primitive; each library is a *different* API. |
| **Vue** | Headless UI (Vue), Reka UI, Ark UI | components | ✅ | ✅ | Headless UI ships an official Vue port; Reka UI / Ark UI add more. Solid coverage, fewer choices than React. |
| **Svelte** | Melt UI, Bits UI | builders / actions | ✅ | ✅ | A separate community ecosystem with **no Headless UI port**. Healthy, but a different mental model (builders) again. |
| **Solid** | Kobalte, Ark UI (Solid), Corvu | components | ✅ | ✅ | Community libraries; no first-party headless suite. |
| **Angular** | Angular CDK (`@angular/cdk/select`), `@angular/aria` | directives / primitives | ⚠️ primitive | ⚠️ experimental | CDK gives you a low-level **select primitive**; you assemble the popup, filtering, and combobox wiring yourself. The CDK combobox is experimental; Angular 21's new `@angular/aria` adds first-party headless select/combobox directives (developer preview, beyond this project's Angular 19 floor). Material's `mat-select`/`mat-autocomplete` are **styled**, not headless. |
| **Lit / web components** | *(none headless)* | — | ❌ | ❌ | No headless select/combobox primitive. Shoelace (archived March 2026 in favour of Web Awesome) `<sl-select>` / Spectrum are **styled** components, not headless behaviour you can re-skin. You hand-roll the ARIA. |
| **Rozie** | `@rozie-ui/select-*` | a **component** | ✅ | ✅ via `@rozie-ui/combobox` | Same API on all six: props, events, two-way `value`, slots, handle. Select-only by design; type-to-filter is the sibling [`@rozie-ui/combobox`](/components/combobox) family. |

On its home framework each of these is a solid pick. The case for Rozie is consistency and coverage: the cross-framework incumbent (Headless UI) stops at React + Vue; the deepest options (Radix, Ariakit, React Aria, downshift) are React-only; Svelte and Solid are *separate* ecosystems with *separate* APIs; Angular hands you primitives, not an assembled control; and Lit / web components have nothing headless. A team shipping a cross-framework design system today maintains a render-prop component on React, a builder on Svelte, a CDK assembly on Angular, and a hand-rolled web component for Lit: four mental models and two gaps for the *same* ARIA pattern. Rozie gives them all the same `<Select>`.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-assembly-required.

| Capability | React (HUI/Radix/Aria…) | Vue (HUI/Reka) | Svelte (Melt/Bits) | Solid (Kobalte) | Angular (CDK) | Lit (none) | **`@rozie-ui/select`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Headless ARIA select | ✅ | ✅ | ✅ | ✅ | ⚠️ primitive | ❌ | ✅ |
| Combobox (type-to-filter) | ✅ (✗ Radix) | ✅ | ✅ | ✅ | ⚠️ experimental | ❌ | ✅ via [`@rozie-ui/combobox`](/components/combobox) |
| Idiomatic **component** surface | ⚠️ render-props/hooks | ✅ | ⚠️ builders | ✅ | ⚠️ directives | hand-roll | ✅ `<Select>` |
| Single **and** multi select | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ `multiple` |
| Two-way value binding | ⚠️ value+onChange | ✅ `v-model` | ⚠️ bind store | ⚠️ signal | ⚠️ wire CVA | — | ✅ `r-model:value` (Angular CVA) |
| Type-ahead (printable keys) | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| Client filter **+ remote hook** | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | via [`@rozie-ui/combobox`](/components/combobox) |
| Scoped option rendering | ✅ render-prop | ✅ slot | ✅ snippet | ✅ | ⚠️ template | — | ✅ `option` / `selected` / `empty` slots |
| Floating popup (flip / shift / width-match) | ✅ | ⚠️ (Reka ✅; HUI wire it) | ✅ | ✅ | ⚠️ CDK overlay | — | ✅ built in (`placement` / `offset`; composes [`@rozie-ui/popover`](/components/popover)) |
| Windowing for long lists | ✅ (wire a virtualizer) | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | ✅ opt-in `virtual` (virtual-core, ×6) |
| Imperative handle | ⚠️ varies | ⚠️ varies | ⚠️ varies | ⚠️ varies | ⚠️ | hand-roll | ✅ uniform 5-verb `$expose` |
| Zero-config styling, re-skinnable | ⚠️ unstyled, wire it | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | ✅ CSS-var tokens + shadcn/Material/Bootstrap bridges |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **First-class packages everywhere** — including **Lit / web components**, which have *no* headless select to begin with, and **Angular**, which gets a fully-assembled select instead of the CDK's lower-level primitives. Both are categories the incumbents simply don't serve.
- **The same component surface everywhere.** Where the ecosystem offers render-props (React), components (Vue/Solid), builders (Svelte), and directives (Angular), `@rozie-ui/select` is one `<Select>` with the same props, events, two-way `value`, slots, and handle. One component to learn, document, and migrate across your stack.
- **The select-only pattern, done fully.** The control follows the [ARIA APG select-only combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/): DOM focus stays on the control while the highlighted option is tracked virtually via `aria-activedescendant`, with full keyboard navigation and type-ahead in the box. Type-to-filter with an editable input is deliberately a sibling family, [`@rozie-ui/combobox`](/components/combobox), sharing the same headless list spine.
- **A real two-way `value`.** `r-model:value` reads *and* writes the selection with no `onChange → setState` glue. Because `value` is the sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor`, so a `Select` is a form control (`[formControl]` / `[(ngModel)]` bind directly).
- **Single + multi select and type-ahead** out of the box: flip `multiple` and get array values, identical on every target.
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-select-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5. Most headless libraries are unstyled-and-you-wire-every-element; Rozie works on drop-in yet stays fully re-skinnable.

## What Rozie defers {#what-rozie-defers}

- **React Aria's accessibility depth.** [React Aria](https://react-spectrum.adobe.com/react-aria/) is the gold standard: locale-aware type-ahead collation, RTL, exhaustive touch / pointer / virtual-cursor handling, and screen-reader testing across a large browser × AT matrix. `@rozie-ui/select` implements the APG patterns faithfully and is gate-verified, but it does not match the breadth of React Aria's edge-case coverage. On React specifically, React Aria is the right call when that depth is the priority.
- **It's a single component, not a primitive suite.** Headless UI, Radix, Ariakit, Kobalte, and Melt ship whole families: Menu, Dialog, Tabs, Popover, Tooltip, and more. Rozie ships the select (alongside its other `@rozie-ui` components), not a unified headless-primitive system.
- **Deep virtualization edge cases.** React Aria and others integrate full-featured list virtualizers (variable heights, sticky sections, horizontal scroll). `@rozie-ui/select` ships opt-in vertical windowing for long lists via `:virtual` (the same `@tanstack/virtual-core` engine the `@rozie-ui/data-table` family uses, wired in cross-framework), so only the visible slice renders, backed by behavioral specs. It does not yet cover the more exotic virtualization modes.
- **Batteries-included async data.** downshift and React Aria have mature async/remote-data patterns (loading states, debounce, cancellation). Rozie's type-to-filter and remote-data story lives in the sibling [`@rozie-ui/combobox`](/components/combobox) family; the select-only `Select` does not model async loading.
- **`@rozie-ui/select` is pre-1.0** and younger and less battle-tested than the established libraries. The full surface is documented in the [showcase & API](/components/select).

## Try it

The [`@rozie-ui/select` showcase + API reference](/components/select) documents the `@rozie-ui/select-*` packages: designed as one pre-compiled, per-framework install each, but today only `@rozie-ui/select-solid` (`npm i @rozie-ui/select-solid`) is on npm — the other five targets are still in dogfooding. There is no list engine to import and no required CSS: the ARIA behaviour and a fully-tokenised skin ship inside the component (the floating popup comes from the required `@rozie-ui/popover-*` peer, which brings `@floating-ui/dom`), with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/select-demo) runs the Vue leaf's workspace build in the page (not yet the published npm package).

## Cross-references

- [Select — showcase & API](/components/select) — the full `@rozie-ui/select` surface, quick start, theming, keyboard, and accessibility reference.
- [Select — live demo](/components/select-demo) — the Vue leaf's workspace build running in the page, plus the Rozie source and the six generated outputs.
- [`Select.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/select/src/Select.rozie)
- [Combobox libraries comparison](/components/combobox-comparison) — the sibling type-to-filter family.
- [Embla libraries comparison](/components/embla-comparison) — a sibling port, contrasting the *engine-wrapper* story with this *headless-behaviour* one.
