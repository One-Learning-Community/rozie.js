# Headless slider / range comparison

How `@rozie-ui/slider` compares to the existing slider libraries across the six frameworks. Like the listbox, the slider has **no shared vanilla-JS engine** — but unlike the listbox, the cross-framework slider landscape splits along a second axis: **headless-behaviour libraries** (React Aria, Radix, Kobalte, Melt, Angular CDK) that reimplement the WAI-ARIA [slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) per ecosystem, versus the **native-input wrappers** (rc-slider, MUI Slider, noUiSlider) that ship a styled, batteries-included widget. Rozie sits deliberately in a third spot: it authors the behaviour **once** on top of the browser's own `<input type="range">` and ships it to all six frameworks as the *same* idiomatic `<Slider>`.

> Research snapshot: 2026-06-16. The headless-UI landscape moves quickly; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

| Framework | Representative option(s) | Shape | Headless | Range | Native input | Notes |
| --- | --- | --- | :---: | :---: | :---: | --- |
| **React** | React Aria, Radix Slider, rc-slider, MUI Slider | hooks / components | ✅ (Aria/Radix) | ✅ | ⚠️ (Aria/Radix re-implement; rc/MUI custom DOM) | Deepest ecosystem. React Aria is the accessibility gold standard; Radix is headless-but-unstyled; rc-slider / MUI are styled widgets with their own custom thumbs (not native `<input>`). |
| **Vue** | Reka UI Slider, Element Plus, Vuetify | components | ✅ (Reka) | ✅ | ❌ | Reka UI ports the Radix model; Element/Vuetify are styled. Fewer headless choices than React. |
| **Svelte** | Melt UI, Bits UI | builders / actions | ✅ | ✅ | ❌ | A separate community ecosystem (builders) — **no Radix/Headless-UI port**; its own mental model again. |
| **Solid** | Kobalte Slider, Ark UI (Solid) | components | ✅ | ✅ | ❌ | Community headless libraries; no first-party suite. |
| **Angular** | Angular CDK (no slider) / Material `mat-slider` | components | ⚠️ | ✅ | ✅ (Material 3 uses native input internally) | **The CDK has no headless slider primitive.** `mat-slider` is a *styled* Material component, not headless behaviour you re-skin. |
| **Lit / web components** | *(none headless)* | — | ❌ | ❌ | — | No headless slider primitive. Shoelace `<sl-range>` is a *styled* single-thumb component (no range), not re-skinnable headless behaviour. You hand-roll the ARIA. |
| **noUiSlider** | framework-agnostic vanilla | imperative lib | ⚠️ | ✅ | ❌ | The closest cross-framework option — but it owns its own DOM/drag engine, ships its own (overridable) CSS, and you write a thin wrapper per framework yourself. Not native `<input>`, not idiomatic-component. |
| **Rozie** | `@rozie-ui/slider-*` | a **component** | ✅ | ✅ | ✅ (native `<input type=range>`) | One source → all six, same props / events / two-way `value` / slots / handle. Single **and** range in one component (a `range` boolean flip), built on the native input. |

These libraries are **excellent** — on its home framework each is the obvious pick, and Rozie does not claim to out-feature React Aria on React or Melt UI on Svelte. The wedge is **consistency, coverage, and the native-input foundation**: there is no headless slider that spans all six frameworks; React Aria / Radix are React-only (Reka/Kobalte/Melt are *separate* ports with *separate* APIs); the Angular CDK has *no* slider; Lit / web components have nothing headless; and noUiSlider — the one agnostic option — is a vanilla engine you wrap per-framework yourself. Rozie gives all six the *same* idiomatic `<Slider>` from one definition.

## Native input vs. headless: the tradeoff

The deepest design choice is **what the thumb actually is**. Two camps:

- **Re-implemented headless** (React Aria, Radix, Kobalte, Melt, noUiSlider): a `<div>`-based thumb with hand-authored pointer/keyboard/ARIA handling. Maximum control over drag physics, multi-thumb layouts, and exotic interactions — at the cost of re-implementing (and re-testing) drag, touch, keyboard, focus, and ARIA in JavaScript, per library.
- **Native `<input type="range">`** (MUI internally, Shoelace, **Rozie**): the browser owns drag (mouse *and* touch), keyboard, focus, `role="slider"`, `aria-value*`, step/min/max, disabled, and RTL. You inherit the platform's accessibility and input handling for free; the tradeoff is that styling requires the cross-browser vendor pseudo-elements (`::-webkit-slider-thumb` / `::-moz-range-thumb`) and dual-thumb range needs the two-overlapping-inputs technique.

Rozie picks the native-input camp deliberately (**Approach B**): the highest-risk surface of any slider — pointer + touch + keyboard + a11y — is delegated to the platform and is identical on all six targets, while Rozie owns the author-side API, the range sort/clamp, the fill math, and the overlays. The cross-browser pseudo-element styling is shipped *inside* the component (and gate-verified on WebKit + Firefox), so consumers never write it.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-assembly-required.

| Capability | React (Aria/Radix) | Vue (Reka) | Svelte (Melt) | Solid (Kobalte) | Angular (Material) | Lit (none) | noUiSlider | **`@rozie-ui/slider`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Headless ARIA slider | ✅ | ✅ | ✅ | ✅ | ⚠️ styled | ❌ | ⚠️ | ✅ |
| Dual-thumb range | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ (`range` flag) |
| Built on native `<input>` | ⚠️ | ❌ | ❌ | ❌ | ✅ internal | ❌ | ❌ | ✅ |
| Idiomatic **component** surface | ⚠️ hooks | ✅ | ⚠️ builders | ✅ | ✅ | hand-roll | ⚠️ wrapper | ✅ `<Slider>` |
| Two-way value binding | ⚠️ value+onChange | ✅ `v-model` | ⚠️ bind store | ⚠️ signal | ⚠️ wire CVA | — | ⚠️ events | ✅ `r-model:value` (Angular CVA) |
| Vertical orientation | ✅ | ✅ | ⚠️ | ✅ | ✅ | — | ✅ | ✅ `orientation` |
| Tick marks | ✅ | ✅ | ⚠️ | ✅ | ✅ | — | ✅ `pips` | ✅ `marks` + `mark` slot |
| Value bubble / tooltip | ✅ | ✅ | ⚠️ | ✅ | ✅ | — | ✅ | ✅ `showValue` + `bubble` slot |
| Imperative handle | ⚠️ varies | ⚠️ varies | ⚠️ varies | ⚠️ varies | ⚠️ | hand-roll | ⚠️ | ✅ uniform `focus`/`increment`/`decrement` |
| Zero-config styling, re-skinnable | ⚠️ unstyled, wire it | ⚠️ | ⚠️ | ⚠️ | styled-only | — | ⚠️ ships CSS | ✅ CSS-var tokens + shadcn/Material/Bootstrap bridges |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ vanilla + per-fw wrapper | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Lit / web components**, which have *no* headless slider to begin with, and **Angular**, whose CDK ships *no* slider primitive at all (only the styled `mat-slider`). Both are categories the incumbents simply don't serve.
- **The same component surface everywhere.** Where the ecosystem offers hooks (React), components (Vue/Solid), builders (Svelte), styled widgets (Angular Material), and a vanilla engine (noUiSlider) — five mental models — `@rozie-ui/slider` is one `<Slider>` with the same props, events, two-way `value`, slots, and handle on all six.
- **Single *and* range in one component.** `range` is a single boolean: off → a scalar single-thumb slider; on → a sorted `[lo, hi]` dual-thumb range. The two thumbs are two overlapping native inputs, each neighbour-clamped, so the array stays sorted however you drive it.
- **Built on the native `<input type="range">`.** Drag (mouse + touch), keyboard, focus, `role="slider"`, `aria-value*`, step/min/max, disabled, and RTL come from the platform — the highest-risk slider surface is the browser's, identical on all six targets — while Rozie owns the API, the range math, the fill, and the overlays.
- **A real two-way `value` on all six** — `r-model:value` reads *and* writes the value with no `onChange → setState` glue. Because `value` is the sole `model: true` prop, the Angular output additionally implements `ControlValueAccessor`, so a `Slider` **is** a form control (`[formControl]` / `[(ngModel)]` bind directly).
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-slider-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5 — *and* the cross-browser thumb/track pseudo-element styling that native range inputs require, shipped inside the component so you never hand-write it.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **React Aria's accessibility depth.** [React Aria](https://react-spectrum.adobe.com/react-aria/) is the gold standard: locale-aware number formatting, exhaustive touch / pointer / virtual-cursor handling, and screen-reader testing across a large browser × AT matrix. `@rozie-ui/slider` leans on the native input's platform a11y and is gate-verified across all six targets, but it does not match the breadth of React Aria's edge-case coverage.
- **Drag physics beyond the native input.** A re-implemented `<div>` thumb (Radix, noUiSlider) can do things native range inputs cannot — pointer-precise dragging anywhere on the track, snap-to-mark drag, more than two thumbs, or non-linear scales. Rozie's native-input foundation trades that ceiling for free, identical platform input handling. More than two thumbs and non-linear scales are out of scope today.
- **It's a single component, not a primitive suite.** React Aria, Radix, Kobalte, and Melt ship whole families — Slider alongside Menu, Dialog, Tabs, and more. Rozie ships slider (alongside its other `@rozie-ui` components), not a unified headless-primitive system.
- **`@rozie-ui/slider` is `0.1.0`.** The surface (12 props / 1 event / single + range / vertical / marks / value bubble / 3-verb handle / 2 slots) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established libraries.

## Try it

The [`@rozie-ui/slider` showcase + API reference](/components/slider) documents the `@rozie-ui/slider-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/slider-react`, etc.). There is **no engine to import and no required CSS** — the native-input behaviour, the cross-browser pseudo-element styling, and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/slider-demo) runs the real Vue package in the page.

## Cross-references

- [Slider — showcase & API](/components/slider) — the full `@rozie-ui/slider` surface, quick start, theming, keyboard, and accessibility reference.
- [Slider — live demo](/components/slider-demo) — the real Vue package running in the page (single + range + vertical), plus the one `.rozie` source and all six generated outputs.
- [`Slider.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/slider/src/Slider.rozie)
- [Listbox — headless select / combobox](/components/listbox-comparison) — the sibling no-engine headless family, contrasting the *behaviour-only* story with this *native-input* one.
