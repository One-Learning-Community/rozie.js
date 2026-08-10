---
surface_hash: af3d40aabb57
---

# Headless split-pane comparison

How `@rozie-ui/resizable` compares to the existing split-pane / resizable-panel libraries across the six frameworks. Like the slider and otp, the resizable splitter has no shared vanilla-JS engine, and like them, the split-pane landscape is overwhelmingly per-framework: every ecosystem grew its own splitter (`react-resizable-panels` for React, `splitpanes` for Vue, `paneforge` for Svelte, `angular-split` for Angular, `@corvu/resizable` for Solid) with its own API, its own persistence story, and its own, often partial, accessibility coverage. The one option that *is* framework-agnostic, [Split.js](https://www.npmjs.com/package/split.js), is a styled DOM engine you wrap per framework yourself, and its last release was more than four years ago. Rozie builds the behaviour on native Pointer Events and the keyboard and delivers the same idiomatic `<Resizable>` on all six frameworks, with the same props, two-way `size`, and handle, installed as a pre-compiled per-framework package with no Rozie toolchain required.

> Research snapshot: 2026-08-10. The split-pane landscape moves; treat the library names, versions, and feature columns as of that date. Versions cited are from npm/GitHub at that time.

## The libraries at a glance

| Library | Framework(s) | Headless | a11y (separator role + keyboard) | Maintained | N-panel / persistence | Notes |
| --- | --- | :---: | :---: | :---: | :---: | --- |
| [`react-resizable-panels`](https://github.com/bvaughn/react-resizable-panels) (bvaughn) | React | ✅ unstyled | ✅ `role="separator"` + keyboard resize | ✅ v4.12 (active) | ✅ N-panel **+** `autoSaveId` localStorage + collapse | The dominant React option. Deep: arbitrary panel trees, conditional panels, imperative API. The model shadcn/ui's Resizable wraps. |
| [`allotment`](https://github.com/johnwalley/allotment) | React | ✅ | ⚠️ separator role; keyboard partial | ✅ v1.20 | ✅ N-panel; snap/collapse; no built-in persist | Derived from VS Code's split-view. Pixel-oriented, N-pane. |
| [`re-resizable`](https://npmtrends.com/re-resizable) | React | ✅ | ❌ resize handles, no separator a11y | ✅ (high downloads) | per-element resize, not a panel group | Resizes a single box by its edges/corners — a different primitive than a split pane. |
| [`react-split-pane`](https://github.com/tomkp/react-split-pane) (tomkp) | React | ✅ | ⚠️ | ⚠️ revived (v3.x) | 2-pane, nestable | The classic; was long-stale, recently saw renewed releases. Pointer-based dividers. |
| [`splitpanes`](https://github.com/antoniandre/splitpanes) (antoniandre) | Vue 3 (+2 legacy) | ⚠️ class hooks | ✅ as of v4.1 (focusable splitters, `keyboard-step`, ARIA) | ✅ v4.1 | ✅ N-panel; persistence is DIY | The de-facto Vue splitter. Keyboard a11y added in the 4.1 line. |
| [`vue-resizable`](https://www.npmjs.com/package/vue-resizable) | Vue | ⚠️ | ❌ | ⚠️ | per-element resize | Edge/corner box resizing, not a panel-group splitter. |
| [`paneforge`](https://github.com/svecosystem/paneforge) | Svelte 5 | ✅ | ✅ separator + keyboard support | ✅ v1.0 (Svelte 5 runes) | ✅ N-panel + nested + localStorage/cookie persist | The svecosystem splitter; a near-port of the react-resizable-panels model. What shadcn-svelte's Resizable wraps. |
| [`svelte-splitpanes`](https://www.npmjs.com/package/svelte-splitpanes) | Svelte | ⚠️ | ⚠️ | ⚠️ community | N-panel | A community port of the `splitpanes` API to Svelte. |
| [`angular-split`](https://github.com/angular-split/angular-split) | Angular | ⚠️ styled-ish | ⚠️ keyboard resize + `aria-value*`, but `role="slider"` gutters (not the APG separator) | ✅ v20 (Angular 19+) | ✅ N-panel; gutter resize | The main Angular splitter. Keyboard resize (arrows + PageUp/PageDown on tab-able gutters) shipped in 2022. |
| [`@corvu/resizable`](https://corvu.dev/docs/primitives/resizable/) | Solid | ✅ unstyled | ✅ Window-Splitter pattern; arrow + shift-expand | ✅ v0.2 | ✅ N-panel | Solid's accessible primitive; closely follows the WAI-ARIA pattern. |
| [`solid-resizable-panels`](https://github.com/elite174/solid-resizable-panels) | Solid | ✅ | ⚠️ | ⚠️ community | N-panel | A second Solid option, modeled on react-resizable-panels. |
| [Split.js](https://www.npmjs.com/package/split.js) / [Split-Grid](https://www.npmjs.com/package/split-grid) | vanilla (agnostic) | ⚠️ ships CSS | ❌ no separator/keyboard a11y | ❌ Split.js v1.6.5 (4y), Split-Grid v1.0.11 (5y, inactive) | N-panel | The only framework-agnostic engines — but stale, no a11y, and you write the per-framework wrapper. No maintained **web-component** splitter exists. |
| **`@rozie-ui/resizable`** | **React · Vue · Svelte · Angular · Solid · Lit** | ✅ tokenised, re-skinnable | ✅ `role="separator"` + Arrow/Home/End + live `aria-value*` | ✅ new (pre-1.0) | ❌ 2-panel only; persist via `r-model` | Same API, six idiomatic packages. |

On its home framework each of these is a solid pick. The case for Rozie is consistency, coverage, and an accessibility floor that is the same everywhere: no split-pane component spans all six frameworks with the same API. Even the popular React model (`react-resizable-panels`) is reproduced framework-by-framework through separate ports (`paneforge`, `solid-resizable-panels`), and Lit / web components have no maintained splitter at all. `@rozie-ui/resizable` gives all six the same idiomatic `<Resizable>`, with the WAI-ARIA window-splitter keyboard pattern wired in on every target; several incumbents (the vanilla engines, `re-resizable`) still lack keyboard resize entirely, and `angular-split` implements it on `role="slider"` gutters rather than the separator pattern.

## Scope: two panels, one number

The incumbents above are, in most cases, more featureful. `react-resizable-panels`, `paneforge`, `allotment`, `splitpanes`, and `angular-split` all model an arbitrary N-panel tree with nested groups, percentage arrays, collapse/expand and snap-to-edge affordances, and (in the React/Svelte case) a built-in persistence layer (`autoSaveId` → localStorage / cookies). Those are real capabilities Rozie does not ship today.

`@rozie-ui/resizable` deliberately scopes v1 to two panels and one number. The first panel's percent *is* `size` (the sole `model: true` prop); the second takes the remainder via CSS (`flex: 1 1 0`). There is no panel array, no measured-pixel state, and no echo guard, which is what keeps it fully controlled and two-way bound on all six frameworks, and is why the Angular output is a clean `ControlValueAccessor` (a splitter position is a form-controllable value). Nested splitters compose (a `Resizable` inside a panel), but a single N-panel group is not modeled. The trade is explicit: cross-framework parity, a uniform keyboard/ARIA floor, and zero draft state, in exchange for feature depth. See [What Rozie defers](#what-rozie-defers).

## Native pointer capture, no document listeners

The drag uses Pointer Events with `setPointerCapture` on the handle, so `pointermove` / `pointerup` keep firing on the handle through the entire gesture (even when the cursor races past it), with no document-level `mousemove` listeners to attach and tear down, and no lost-pointer dead zones. Each move converts the pointer coordinate into a first-panel percent off the container rect and clamps it to `[min, max]`; the panels are positioned purely by one CSS custom property (`--rozie-resizable-size`). The result is identical on all six targets, including inside Lit's shadow root (`getBoundingClientRect` reaches the container there too).

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-assembly-required.

| Capability | React (`react-resizable-panels`) | Vue (`splitpanes`) | Svelte (`paneforge`) | Solid (`@corvu/resizable`) | Angular (`angular-split`) | Lit (none) | **`@rozie-ui/resizable`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Pointer-capture drag | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Keyboard resize (Arrow/Home/End) | ✅ | ✅ (4.1) | ✅ | ✅ | ⚠️ arrows + Page keys | — | ✅ |
| `role="separator"` + live `aria-value*` | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| Min / max clamp | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Horizontal + vertical | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Two-way value binding | ⚠️ callback | ⚠️ events | ⚠️ callback | ⚠️ store/signal | ⚠️ outputs | — | ✅ `r-model:size` (Angular CVA) |
| Imperative handle | ✅ ref API | ⚠️ | ✅ | ✅ context | ⚠️ | hand-roll | ✅ `applySize` / `reset` |
| Custom handle slot | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ `handle` slot |
| Zero-config + re-skinnable | ⚠️ unstyled | ⚠️ class hooks | ⚠️ unstyled | ⚠️ unstyled | ⚠️ | — | ✅ CSS-var tokens + shadcn/Material/Bootstrap bridges |
| **N panels (>2)** | ✅ | ✅ | ✅ | ✅ | ✅ | — | ❌ deferred |
| **Built-in layout persistence** | ✅ `autoSaveId` | ⚠️ DIY | ✅ localStorage/cookie | ⚠️ | ⚠️ | — | ⚠️ via `r-model` (you persist) |
| **Collapse / snap-to-edge** | ✅ | ⚠️ | ✅ | ✅ | ✅ | — | ❌ deferred |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **First-class packages for all six frameworks**, including Lit / web components, which have no maintained split-pane component at all. Where the ecosystem offers a different library per framework, `@rozie-ui/resizable` is one `<Resizable>` to learn, document, and migrate: the same props, the same `resize` event, the same two-way `size`, and the same `applySize` / `reset` handle on all six.
- **A real two-way `size` on all six.** `r-model:size` reads and writes the split with no `onChange → setState` glue, and because `size` is the sole `model: true` prop the Angular output is a `ControlValueAccessor`, so `[formControl]` / `[(ngModel)]` bind directly. The per-framework incumbents each expose a different binding shape (React callbacks, Vue events, Svelte stores, Solid signals, Angular outputs).
- **A uniform keyboard + ARIA floor.** Arrow / Home / End resizing on a `role="separator"` with live `aria-value*` ships on every target. That matters because the floor is uneven in the incumbents: the vanilla engines (Split.js / Split-Grid) ship no keyboard a11y at all, `re-resizable` exposes no separator semantics, `angular-split` resizes from the keyboard but marks its gutters `role="slider"` rather than the APG separator pattern, and `splitpanes` only gained keyboard support in its 4.1 line. Rozie's accessibility doesn't depend on which framework you picked.
- **Zero-config styling that re-skins to any design system.** Every rendered value is a `--rozie-resizable-*` CSS custom property, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5, where most incumbents ship unstyled and leave the skin to you.

## When a competitor is the better pick

- **You're React-only and need N-panel layouts, persisted across reloads, with collapse/expand.** Use [`react-resizable-panels`](https://github.com/bvaughn/react-resizable-panels). It is the mature, dominant option, treats accessibility and persistence as first-class, and is what shadcn/ui's Resizable is built on. Rozie's 2-panel scope simply doesn't cover that shape.
- **You're a VS-Code-style IDE layout in React.** [`allotment`](https://github.com/johnwalley/allotment) is derived from VS Code's own split-view and is purpose-built for that.
- **You're Svelte-only and want the react-resizable-panels feature set natively.** [`paneforge`](https://github.com/svecosystem/paneforge) (Svelte 5 runes, nested groups, persistence) is the idiomatic choice.
- **You just need to resize one box by its edges**, not split a pane: that's [`re-resizable`](https://npmtrends.com/re-resizable), a different primitive entirely.

`@rozie-ui/resizable` is the right pick when you're building (or maintaining) a component library or design system that must ship the same accessible two-panel splitter across more than one of React, Vue, Svelte, Angular, Solid, and Lit, and you don't want to adopt, learn, and re-test a different library, with a different API and uneven a11y, per framework.

## What Rozie defers {#what-rozie-defers}

- **N-panel layouts.** `react-resizable-panels`, `splitpanes`, `paneforge`, `allotment`, and `angular-split` model an arbitrary tree of panels with a percentage array and nested groups. `@rozie-ui/resizable` v1 is deliberately two panels and one `size` number, which is what keeps it fully controlled with no draft state. Nested splitters can be composed (a `Resizable` inside a panel) but a single N-panel group is not modeled.
- **Built-in layout persistence.** The React (`autoSaveId` → localStorage) and Svelte (`paneforge`, localStorage/cookies) incumbents ship a persistence layer. Rozie exposes the position as a two-way `size`, so persisting it is a one-liner on the consumer side, but there is no built-in storage adapter.
- **Collapse / snap-to-edge affordances.** Collapsible panels, snap points, and double-click-to-reset are incumbent features (`react-resizable-panels`, `paneforge`, `allotment`, `angular-split`) that Rozie does not model today.
- **`@rozie-ui/resizable` is pre-1.0.** The surface is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established per-framework libraries. The full prop, event, handle, and slot tables live in the [API reference](/components/resizable-api).

## Try it

The [`@rozie-ui/resizable` showcase](/components/resizable) documents the `@rozie-ui/resizable-*` packages — one pre-compiled, per-framework install. There is no engine to import and no required CSS: the native-pointer behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/resizable-demo) runs the real Vue package in the page.

## Cross-references

- [Resizable — showcase](/components/resizable) — the full `@rozie-ui/resizable` surface, quick start, theming, keyboard, and accessibility reference.
- [Resizable — API reference](/components/resizable-api) — every prop, the two-way `size` model, the `resize` event, the `applySize` / `reset` handle, and the three slots.
- [Resizable — live demo](/components/resizable-demo) — the real Vue package running in the page, plus the one `.rozie` source and all six generated outputs.
- [All components](/components/) — the rest of the `@rozie-ui` family.
- [Slider — headless slider / range](/components/slider-comparison) — a sibling no-engine pure-Rozie family built on a native `<input type="range">`.
- [`Resizable.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/resizable/src/Resizable.rozie)
