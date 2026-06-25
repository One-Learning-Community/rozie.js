# Headless split-pane comparison

How `@rozie-ui/resizable` compares to the existing split-pane / resizable-panel libraries across the six frameworks. Like the slider and otp, the resizable splitter has **no shared vanilla-JS engine** — and like them, the split-pane landscape is overwhelmingly **per-framework**: every ecosystem grew its own (`react-resizable-panels`, `splitpanes` for Vue, Angular CDK's drag plus community split libraries, …) with its own API, its own persistence story, and its own accessibility coverage. Rozie authors the behaviour **once** on top of native Pointer Events and ships it to all six frameworks as the *same* idiomatic `<Resizable>`.

> Research snapshot: 2026-06-24. The split-pane landscape is fragmented; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

| Framework | Representative option(s) | Pointer capture | Keyboard (a11y) | Two-way value | One source → 6 fw |
| --- | --- | :---: | :---: | :---: | :---: |
| **React** | `react-resizable-panels`, `react-split-pane`, `allotment` | ✅ | ⚠️ varies | ⚠️ callback | ❌ |
| **Vue** | `splitpanes`, `vue-resizable` | ✅ | ⚠️ | ⚠️ events | ❌ |
| **Svelte** | community `svelte-splitpanes` ports | ⚠️ | ⚠️ | ⚠️ bind | ❌ |
| **Solid** | `solid-resizable-panels`, Corvu primitives | ✅ | ⚠️ | ⚠️ callback | ❌ |
| **Angular** | Angular CDK drag + community split libs | ⚠️ | ⚠️ | ⚠️ | ❌ |
| **Lit / web components** | *(none mainstream)* | — | — | — | ❌ |
| **Rozie** | `@rozie-ui/resizable-*` | ✅ | ✅ Arrow/Home/End | ✅ `r-model:size` (Angular CVA) | ✅ |

These libraries are **good** — on its home framework each is a reasonable pick, and Rozie does not claim to out-feature `react-resizable-panels` on React or `splitpanes` on Vue. The wedge is **consistency, coverage, and the native-pointer foundation**: there is no split-pane component that spans all six frameworks with the *same* API. Even the popular React model (`react-resizable-panels`) is reproduced framework-by-framework through *separate* ports. Lit / web components have nothing mainstream at all. Rozie gives all six the *same* idiomatic `<Resizable>` from one definition.

## Two panels, one number: the design choice

Most split-pane libraries support **N panels** with a nested group/panel tree, percentage arrays, and a persistence layer (localStorage of the layout). That power has a cost: a panel-group state machine, a measured-geometry reconcile, and per-framework controlled-vs-uncontrolled footguns.

`@rozie-ui/resizable` deliberately scopes v1 to **two panels and one number**. The first panel's percent *is* `size` (the sole `model: true` prop); the second takes the remainder via CSS. There is no panel array, no measured-pixel state, and no echo guard — which is what keeps it fully controlled and two-way bound on all six frameworks, and is why the Angular output is a clean `ControlValueAccessor` (a splitter position **is** a form-controllable value). N-panel layouts are the headline deferral below.

## Native pointer capture, no document listeners

The drag uses Pointer Events with `setPointerCapture` on the handle, so `pointermove` / `pointerup` keep firing on the handle through the entire gesture — even when the cursor races past it — with no document-level `mousemove` listeners to attach and tear down, and no lost-pointer dead zones. Each move converts the pointer coordinate into a first-panel percent off the container rect and clamps it to `[min, max]`; the panels are positioned purely by one CSS custom property. The result is identical on all six targets, including inside Lit's shadow root.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-assembly-required.

| Capability | React (`react-resizable-panels`) | Vue (`splitpanes`) | Svelte (community) | Solid (`solid-resizable-panels`) | Angular (CDK + community) | Lit (none) | **`@rozie-ui/resizable`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Pointer-capture drag | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | — | ✅ |
| Keyboard resize (Arrow/Home/End) | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | ✅ |
| `role="separator"` + aria-value* | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | ✅ |
| Min / max clamp | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | — | ✅ |
| Horizontal + vertical | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| Two-way value binding | ⚠️ callback | ⚠️ events | ⚠️ bind | ⚠️ callback | ⚠️ | — | ✅ `r-model:size` (Angular CVA) |
| Imperative handle | ⚠️ ref API | ⚠️ | ⚠️ | ⚠️ | ⚠️ | hand-roll | ✅ `applySize` / `reset` |
| Custom handle slot | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ `handle` slot |
| Zero-config styling, re-skinnable | ⚠️ unstyled | ⚠️ class hooks | ⚠️ | ⚠️ unstyled | ⚠️ | — | ✅ CSS-var tokens + shadcn/Material/Bootstrap bridges |
| N panels (>2) | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ❌ deferred |
| Layout persistence | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | — | ⚠️ via `r-model` (you persist) |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Lit / web components**, which have *no* mainstream split-pane component at all. Where the ecosystem offers a different library per framework, `@rozie-ui/resizable` is one `<Resizable>` with the same props, the same `resize` event, the same two-way `size`, and the same `applySize` / `reset` handle on all six.
- **First-class keyboard + ARIA.** Arrow / Home / End resizing on a `role="separator"` with live `aria-value*` ships in the box — the accessibility most drag-only handles skip.
- **A real two-way `size` on all six** — `r-model:size` reads *and* writes the split with no `onChange → setState` glue, and because `size` is the sole `model: true` prop the Angular output is a `ControlValueAccessor`, so `[formControl]` / `[(ngModel)]` bind directly.
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-resizable-*` CSS custom property, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5 — where most incumbents ship unstyled.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **N-panel layouts.** `react-resizable-panels`, `splitpanes`, and `allotment` model an arbitrary tree of panels with a percentage array and nested groups. `@rozie-ui/resizable` v1 is deliberately two panels and one `size` number — which is what keeps it fully controlled with no draft state. Nested splitters can be composed (a `Resizable` inside a panel) but a single N-panel group is not modeled.
- **Built-in layout persistence.** The React/Vue incumbents ship an `autoSaveId` / localStorage persistence layer. Rozie exposes the position as a two-way `size`, so persisting it is a one-liner on the consumer side — but there is no built-in storage adapter.
- **Collapse / snap-to-edge affordances.** Double-click-to-collapse, collapsed panels, and snap points are incumbent features Rozie does not model today.
- **`@rozie-ui/resizable` is `0.1.0`.** The surface (5 props / 1 event / 2-verb handle / 3 slots) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established per-framework libraries.

## Try it

The [`@rozie-ui/resizable` showcase + API reference](/components/resizable) documents the `@rozie-ui/resizable-*` packages — one pre-compiled, per-framework install. There is **no engine to import and no required CSS** — the native-pointer behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/resizable-demo) runs the real Vue package in the page.

## Cross-references

- [Resizable — showcase & API](/components/resizable) — the full `@rozie-ui/resizable` surface, quick start, theming, keyboard, and accessibility reference.
- [Resizable — live demo](/components/resizable-demo) — the real Vue package running in the page, plus the one `.rozie` source and all six generated outputs.
- [`Resizable.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/resizable/src/Resizable.rozie)
- [Slider — headless slider / range](/components/slider-comparison) — a sibling no-engine pure-Rozie family built on a native `<input type="range">`.
