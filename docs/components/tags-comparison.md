# Headless tags input comparison

How `@rozie-ui/tags` compares to the existing tags / token / chips-input libraries across the six frameworks. Like the OTP, slider, and listbox families, the tags input has **no shared vanilla-JS engine** — and like OTP, the landscape is overwhelmingly **per-framework**: every ecosystem grew its own token input (`react-tag-input`, `@yaireo/tagify` wrappers, `vue3-tags-input`, PrimeVue `Chips` / `AutoComplete`, `ngx-chips`, Angular Material `MatChipGrid`, …) with its own props, its own paste behaviour, and its own accessibility story. Rozie authors the behaviour **once** on top of one native `<input>` + a row of chips and ships it to all six frameworks as the *same* idiomatic `<Tags>`.

> Research snapshot: 2026-06-24. The tags-input landscape is fragmented and fast-moving; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

| Framework | Representative option(s) | Paste-to-bulk-add | Two-way value | Per-token validation | One source → 6 fw |
| --- | --- | :---: | :---: | :---: | :---: |
| **React** | `react-tag-input`, `react-tagsinput`, `@yaireo/tagify` (React wrapper), Mantine `TagsInput` | ✅ | ⚠️ value + onChange | ⚠️ varies | ❌ |
| **Vue** | `vue3-tags-input`, `@sipec/vue3-tags-input`, PrimeVue `Chips`/`AutoComplete`, Element Plus `Tag` + input | ✅ | ✅ `v-model` | ⚠️ | ❌ |
| **Svelte** | `svelte-tags-input`, a handful of community chips inputs | ⚠️ | ⚠️ bind | ⚠️ | ❌ |
| **Solid** | *(no mainstream dedicated option; hand-rolled)* | — | — | — | ❌ |
| **Angular** | `ngx-chips`, Angular Material `MatChipGrid` + input, PrimeNG `Chips` | ✅ | ⚠️ CVA | ⚠️ | ❌ |
| **Lit / web components** | *(none mainstream)* | — | — | — | ❌ |
| **Tagify** | framework-agnostic vanilla engine (wrappers for React/Vue/Angular/jQuery) | ✅ | ⚠️ per-wrapper | ✅ | ⚠️ 3 fw via wrappers, no Svelte/Solid/Lit |
| **Rozie** | `@rozie-ui/tags-*` | ✅ | ✅ `r-model:modelValue` (Angular CVA) | ✅ `validate` | ✅ |

These libraries are **good** — on its home framework each is a reasonable pick, and Rozie does not claim to out-feature Tagify on React or Mantine's `TagsInput`. The wedge is **consistency, coverage, and the no-engine native foundation**: there is no tags component that spans all six frameworks with the *same* API. Even the agnostic option, Tagify, is a vanilla engine you wrap per framework (and it reaches neither Svelte, Solid, nor Lit). Solid and Lit have no mainstream dedicated tags input at all. Rozie gives all six the *same* idiomatic `<Tags>` from one definition, with zero engine to ship.

## No engine, native input + chips: the design choice

The deepest decision in a tags component is **what holds the text and what holds the tokens**. Two camps:

- **A vanilla engine owns the DOM** (Tagify): a single library mounts into a container and renders the input + tags itself, mutating the DOM directly. Maximum features (drag-reorder, dropdown suggestions, inline edit) at the cost of a non-trivial engine dependency and a wrapper per framework that reconciles the engine's imperative state against the framework's.
- **A native `<input>` + framework-rendered chips** (most per-framework libraries, **Rozie**): the typing surface is a real `<input>`; the chips are framework-rendered elements. Focus, the caret, the keyboard, and the clipboard come from the platform; the work is the choreography (commit on delimiter, bulk-add on paste, retreat on Backspace) and the dedup/validate/cap policy.

Rozie picks the no-engine native camp deliberately. The highest-value surface — the keyboard, paste, focus, mobile input — is the browser's, identical on all six targets, while Rozie owns the author-side API, the commit/dedup/validate logic, and the focus choreography (through **one container ref**, never per-chip refs, which is what gives it a clean cross-target story including Lit's shadow root). There is no engine to import and no required CSS.

## Fully controlled tokens, one local draft

Most tags components keep an internal array of tokens *and* reconcile it against the bound value — a controlled/uncontrolled split with the usual footguns. `@rozie-ui/tags` keeps the committed tokens **as** `modelValue` (the sole `model: true` prop) and writes a fresh array back on every mutation; the **only** local state is the in-progress `draft` text in the input — a genuine UI buffer that is never the committed value. That is what lets the same source stay fully controlled — and two-way bound — on all six frameworks, and it is why the Angular output is a clean `ControlValueAccessor` (a tags input **is** a form control).

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-assembly-required.

| Capability | React (`react-tag-input`) | Vue (`vue3-tags-input`) | Svelte (`svelte-tags-input`) | Solid (none) | Angular (`ngx-chips`) | Lit (none) | Tagify | **`@rozie-ui/tags`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Native `<input>` typing surface | ✅ | ✅ | ✅ | — | ✅ | — | ⚠️ engine input | ✅ |
| Configurable delimiter keys | ✅ | ✅ | ⚠️ | — | ✅ | — | ✅ | ✅ `delimiters` |
| Paste-to-bulk-add | ✅ | ✅ | ⚠️ | — | ✅ | — | ✅ | ✅ |
| Backspace deletes previous | ✅ | ✅ | ⚠️ | — | ✅ | — | ✅ | ✅ |
| Dedup | ✅ | ⚠️ | ⚠️ | — | ✅ | — | ✅ | ✅ `allowDuplicates` |
| Per-token validation / normalize | ⚠️ | ⚠️ | ⚠️ | — | ⚠️ | — | ✅ | ✅ `validate` |
| Max cap | ⚠️ | ✅ | ⚠️ | — | ✅ | — | ✅ | ✅ `max` |
| Two-way value binding | ⚠️ value+onChange | ✅ `v-model` | ⚠️ bind | — | ⚠️ CVA | — | ⚠️ per-wrapper | ✅ `r-model:modelValue` (Angular CVA) |
| Custom chip rendering | ⚠️ render prop | ✅ slot | ⚠️ | — | ✅ template | — | ⚠️ template fn | ✅ scoped `#tag` slot |
| Zero-config styling, re-skinnable | ⚠️ | ⚠️ | ⚠️ | — | ⚠️ | — | ⚠️ | ✅ CSS-var tokens + shadcn/Material/Bootstrap bridges |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ 3 fw via wrappers | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Solid and Lit**, which have *no* mainstream tags input at all, and the same idiomatic surface on the frameworks Tagify's wrappers reach *plus* the ones they don't. These are categories the incumbents simply don't serve.
- **The same component surface everywhere.** Where the ecosystem offers a different library per framework — many APIs, many paste behaviours, many accessibility stories — `@rozie-ui/tags` is one `<Tags>` with the same props, the same `add` / `remove` / `change` events, the same two-way `modelValue`, and the same `clear` / `focus` handle on all six.
- **First-class validation + dedup + cap.** `validate` (a normalize-or-reject function), `allowDuplicates`, and `max` are core props — not a feature you bolt on with an `onChange` interceptor.
- **A real two-way value on all six** — `r-model:modelValue` reads *and* writes the tokens with no `onChange → setState` glue, and because it is the sole `model: true` prop the Angular output is a `ControlValueAccessor`, so `[formControl]` / `[(ngModel)]` bind directly.
- **Zero-config styling that re-skins to any design system, and no engine to ship.** Every rendered value is a `--rozie-tags-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5 — and there is no third-party engine dependency at all.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **Autocomplete / suggestions dropdown.** Tagify, PrimeVue `AutoComplete`, and Mantine pair the token input with a typeahead suggestion list. `@rozie-ui/tags` is a pure token input today; pair it with the [`Combobox`](/components/combobox) or [`Listbox`](/components/listbox) family for suggestions.
- **Inline token editing + drag-reorder.** Tagify lets you double-click a chip to edit it and drag to reorder. Rozie models add/remove, not in-place edit or reorder.
- **Rich token objects.** Several libraries support `{ id, label, … }` token objects with per-token color/avatar. `@rozie-ui/tags` is a `string[]` model; render richness via the `#tag` slot, but the committed value is strings.
- **It's a single component, not a form/primitive kit.** PrimeVue/PrimeNG, Angular Material, and Mantine ship chips alongside whole families of inputs and form controls. Rozie ships `Tags` (alongside its other `@rozie-ui` components), not a unified primitive suite.
- **`@rozie-ui/tags` is `0.1.0`.** The surface (9 props / 3 events / 2-verb handle / scoped slot / paste-bulk-add / validate / dedup / cap) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established per-framework libraries.

## Try it

The [`@rozie-ui/tags` showcase + API reference](/components/tags) documents the `@rozie-ui/tags-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/tags-react`, etc.). There is **no engine to import and no required CSS** — the native-input behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/tags-demo) runs the real Vue package in the page.

## Cross-references

- [Tags — showcase](/components/tags) — the full `@rozie-ui/tags` overview, quick start, theming, and accessibility reference.
- [Tags — API reference](/components/tags-api) — every prop, event, handle verb, and the scoped slot.
- [Tags — live demo](/components/tags-demo) — the real Vue package running in the page, plus the one `.rozie` source and all six generated outputs.
- [`Tags.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/tags/src/Tags.rozie)
- [Otp — headless one-time-code input](/components/otp-comparison) — a sibling no-engine pure-Rozie input family built on native cells.
