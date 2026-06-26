---
surface_hash: aed903b8bc6f
---

# Headless select / combobox comparison

How `@rozie-ui/listbox` compares to the existing headless select & combobox libraries across the six frameworks. Unlike Rozie's engine-wrapper components (Embla, Flatpickr, Chart.js…), the listbox has **no vanilla-JS engine** behind it — there is no shared "select core" the way Embla is a shared carousel core. Instead, **every framework ecosystem reimplements the WAI-ARIA [listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) / [combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) pattern from scratch**, in its own idiom. The result is the most fragmented landscape of any component Rozie ships: the best options are **React-only**, the one cross-framework incumbent (Headless UI) covers **just React + Vue**, Svelte and Solid each have their own separate community libraries, Angular gives you low-level CDK primitives you assemble yourself, and **web components have no headless combobox at all**. Rozie authors the ARIA behaviour **once** and ships it to all six.

> Research snapshot: 2026-06-16. The headless-UI landscape moves quickly; treat the library names, framework coverage, and "combobox?" column as of that date.

## The libraries at a glance

| Framework | Representative headless option(s) | Shape | Listbox | Combobox | Notes |
| --- | --- | --- | :---: | :---: | --- |
| **React** | Headless UI, Radix UI, Ariakit, React Aria, downshift | render-props / hooks | ✅ | ✅ (most) | Deepest ecosystem by far. React Aria is the accessibility gold standard; Radix has **no combobox** primitive; each library is a *different* API. |
| **Vue** | Headless UI (Vue), Reka UI, Ark UI | components | ✅ | ✅ | Headless UI ships an official Vue port; Reka UI / Ark UI add more. Solid coverage, fewer choices than React. |
| **Svelte** | Melt UI, Bits UI | builders / actions | ✅ | ✅ | A separate community ecosystem — **no Headless UI port**. Healthy, but a different mental model (builders) again. |
| **Solid** | Kobalte, Ark UI (Solid), Corvu | components | ✅ | ✅ | Community libraries; no first-party headless suite. |
| **Angular** | Angular CDK (`@angular/cdk/listbox`) | directives / primitives | ⚠️ primitive | ⚠️ experimental | CDK gives you a low-level **listbox primitive** — you assemble the popup, filtering, and combobox wiring yourself. The CDK combobox is experimental. Material's `mat-select`/`mat-autocomplete` are **styled**, not headless. |
| **Lit / web components** | *(none headless)* | — | ❌ | ❌ | No headless select/combobox primitive. Shoelace `<sl-select>` / Spectrum are **styled** components, not headless behaviour you can re-skin. You hand-roll the ARIA. |
| **Rozie** | `@rozie-ui/listbox-*` | a **component** | ✅ | ✅ | One source → all six, same props / events / two-way `value` / slots / handle. Listbox **and** combobox in one component (a `combobox` boolean flip). |

These libraries are **excellent** — on its home framework each is the obvious pick, and Rozie does not claim to out-feature React Aria on React or Melt UI on Svelte. The wedge is **consistency and coverage**: the cross-framework incumbent (Headless UI) stops at React + Vue; the deepest options (Radix, Ariakit, React Aria, downshift) are React-only; Svelte and Solid are *separate* ecosystems with *separate* APIs; Angular hands you primitives, not an assembled combobox; and **Lit / web components have nothing headless**. A team shipping a cross-framework design system today maintains a render-prop component on React, a builder on Svelte, a CDK assembly on Angular, and a hand-rolled web component for Lit — four mental models and two gaps for the *same* ARIA pattern. Rozie gives all six the *same* idiomatic `<Listbox>` from one definition.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-assembly-required.

| Capability | React (HUI/Radix/Aria…) | Vue (HUI/Reka) | Svelte (Melt/Bits) | Solid (Kobalte) | Angular (CDK) | Lit (none) | **`@rozie-ui/listbox`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Headless ARIA listbox | ✅ | ✅ | ✅ | ✅ | ⚠️ primitive | ❌ | ✅ |
| Combobox (type-to-filter) | ✅ (✗ Radix) | ✅ | ✅ | ✅ | ⚠️ experimental | ❌ | ✅ (`combobox` flag) |
| Idiomatic **component** surface | ⚠️ render-props/hooks | ✅ | ⚠️ builders | ✅ | ⚠️ directives | hand-roll | ✅ `<Listbox>` |
| Single **and** multi select | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ `multiple` |
| Two-way value binding | ⚠️ value+onChange | ✅ `v-model` | ⚠️ bind store | ⚠️ signal | ⚠️ wire CVA | — | ✅ `r-model:value` (Angular CVA) |
| Type-ahead (printable keys) | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| Client filter **+ remote hook** | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ `filterable` + `search` event |
| Scoped option rendering | ✅ render-prop | ✅ slot | ✅ snippet | ✅ | ⚠️ template | — | ✅ `option` / `selected` / `empty` slots |
| Imperative handle | ⚠️ varies | ⚠️ varies | ⚠️ varies | ⚠️ varies | ⚠️ | hand-roll | ✅ uniform 5-verb `$expose` |
| Zero-config styling, re-skinnable | ⚠️ unstyled, wire it | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | ✅ CSS-var tokens + shadcn/Material/Bootstrap bridges |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Lit / web components**, which have *no* headless select/combobox to begin with, and **Angular**, which gets a fully-assembled combobox instead of the CDK's lower-level primitives. Both are categories the incumbents simply don't serve.
- **The same component surface everywhere.** Where the ecosystem offers render-props (React), components (Vue/Solid), builders (Svelte), and directives (Angular) — four mental models — `@rozie-ui/listbox` is one `<Listbox>` with the same props, events, two-way `value`, slots, and handle on all six.
- **Listbox *and* combobox in one component.** `combobox` is a single boolean: off → an ARIA select-only button trigger; on → a `role="combobox"` text input that filters as you type. Several ecosystems split these into separate primitives, and Radix has no combobox at all.
- **A real two-way `value` on all six** — `r-model:value` reads *and* writes the selection with no `onChange → setState` glue. Because `value` is the sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor`, so a `Listbox` **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).
- **Single + multi select, type-ahead, and a remote-filter hook** out of the box — flip `multiple`, get array values; flip `filterable="false"` and listen to `search` to drive server-side filtering — identical on every target.
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-listbox-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5. Most headless libraries are unstyled-and-you-wire-every-element; Rozie works on drop-in yet stays fully re-skinnable.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **React Aria's accessibility depth.** [React Aria](https://react-spectrum.adobe.com/react-aria/) is the gold standard: locale-aware type-ahead collation, RTL, exhaustive touch / pointer / virtual-cursor handling, and screen-reader testing across a large browser × AT matrix. `@rozie-ui/listbox` implements the APG patterns faithfully and is gate-verified across all six targets, but it does not match the breadth of React Aria's edge-case coverage. On React specifically, React Aria is the right call when that depth is the priority.
- **It's a single component, not a primitive suite.** Headless UI, Radix, Ariakit, Kobalte, and Melt ship whole families — Menu, Dialog, Tabs, Popover, Tooltip, and more. Rozie ships listbox/combobox (alongside its other `@rozie-ui` components), not a unified headless-primitive system.
- **Virtualization for very large lists.** React Aria and others integrate list virtualizers for thousands of options. `@rozie-ui/listbox` renders the (filtered) option list directly — for very large datasets, filter server-side via `:filterable="false"` + the `search` event rather than shipping every row to the client.
- **Batteries-included async combobox.** downshift and React Aria have mature async/remote-data patterns (loading states, debounce, cancellation). Rozie gives you the `search` event and `filterable="false"` hook; the loading/debounce/cancellation policy is yours to wire.
- **`@rozie-ui/listbox` is `0.1.0`.** The surface (13 props / 3 events / single + multi / combobox / 5-verb handle / 3 slots) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established libraries.

## Try it

The [`@rozie-ui/listbox` showcase + API reference](/components/listbox) documents the `@rozie-ui/listbox-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/listbox-react`, etc.). There is **no engine to import and no required CSS** — the ARIA behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/listbox-demo) runs the real Vue package in the page.

## Cross-references

- [Listbox — showcase & API](/components/listbox) — the full `@rozie-ui/listbox` surface, quick start, theming, keyboard, and accessibility reference.
- [Listbox — live demo](/components/listbox-demo) — the real Vue package running in the page (select + combobox), plus the one `.rozie` source and all six generated outputs.
- [`Listbox.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/listbox/src/Listbox.rozie)
- [Embla libraries comparison](/components/embla-comparison) — a sibling port, contrasting the *engine-wrapper* story with this *headless-behaviour* one.
