# Headless modal dialog comparison

How `@rozie-ui/dialog` compares to the existing modal / dialog libraries across the six frameworks. Like the slider, listbox, and OTP families, the dialog has **no shared vanilla-JS engine** — but unlike those, the "engine" it leans on is the **browser platform itself**: the native `<dialog>` element + `showModal()`. The modal landscape is overwhelmingly **per-framework** (Radix / Base UI / Ariakit on React, Headless UI on React + Vue, vue-final-modal on Vue, Angular CDK / Material on Angular, Reka UI on Vue, …), and almost all of them re-implement in JavaScript what the platform now gives for free — a top-layer surface, a scrim, a focus trap, and Esc handling. Rozie authors the author-side API **once** on top of the native element and ships it to all six frameworks as the *same* idiomatic `<Dialog>`.

> Research snapshot: 2026-06-23. The modal/dialog landscape moves quickly; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

Cell legend: **✅** = yes / out of the box · **❌** = no / not present · **⚠️** = partial or framework-specific. "Escapes ancestors via" is *how* the dialog defeats an ancestor's `z-index` / `overflow: hidden` / `transform`.

| Option | Framework(s) | Escapes ancestors via | Focus trap | Scrim source | Two-way `open` | One source → 6 fw |
| --- | --- | --- | :---: | --- | :---: | :---: |
| **Radix Dialog** (`@radix-ui/react-dialog`) | React | portal → `<body>` | ⚠️ JS (FocusScope) | styled `<div>` | ⚠️ `open` + `onOpenChange` | ❌ |
| **Base UI Dialog** (`@base-ui-components/react`) | React | portal → `<body>` | ⚠️ JS | styled `<div>` | ⚠️ `open` + `onOpenChange` | ❌ |
| **shadcn/ui Dialog** | React (Vue via shadcn-vue) | portal (wraps Radix / Reka UI) | ⚠️ JS | styled `<div>` | ⚠️ `open` + `onOpenChange` | ❌ |
| **Ariakit Dialog** | React | portal → `<body>` | ⚠️ `inert` on the rest (no trap) | styled `<div>` | ⚠️ `open` + `setOpen` | ❌ |
| **Headless UI Dialog** | React, Vue | portal | ⚠️ JS focus-trap | styled `<div>` | ⚠️ `open` + `onClose` (`v-model` on Vue) | ❌ (2 fw) |
| **vue-final-modal** (v4) | Vue | `<Teleport>` → body | ⚠️ JS | styled overlay | ✅ `v-model` | ❌ |
| **Angular CDK / Material Dialog** | Angular | CDK overlay container | ⚠️ CDK focus-trap | CDK backdrop `<div>` | ⚠️ service `open()` → `DialogRef` | ❌ |
| **Native `<dialog>`** | any (raw DOM) | ✅ native top layer | ✅ native | native `::backdrop` | ❌ imperative only | ❌ |
| **`@rozie-ui/dialog`** | all six | ✅ native top layer | ✅ native | native `::backdrop` | ✅ `r-model:open` | ✅ |

These libraries are **good** — on its home framework each is a reasonable pick, and Rozie does not claim to out-feature Radix's composable parts, Base UI's primitive suite, or the CDK's overlay-positioning toolkit. The wedge is **consistency, coverage, and the native-`<dialog>` foundation**: there is no modal component that spans all six frameworks with the *same* API (Radix is React-only; its model has a separate Vue port in **Reka UI**, formerly Radix Vue, and a React successor in **Base UI** from ex-Radix engineers — separate packages with separate APIs), and almost none of the incumbents use the platform's top layer — they portal/teleport into `<body>` and re-build the focus trap and scrim in JavaScript. Rozie gives all six the *same* idiomatic `<Dialog>` from one definition, sitting on the native element.

## Top layer vs. portal: the design choice

The deepest decision in a modal component is **how it escapes its ancestors' `z-index`, `overflow: hidden`, and `transform` contexts**. Two camps:

- **Portal / teleport into `<body>`** (Radix, Base UI, shadcn, Ariakit, Headless UI, vue-final-modal, Angular CDK): the dialog DOM is *relocated* to a container at the end of `<body>` so no ancestor can clip or stack it. It works, but it means the component owns a portal implementation, a scrim element, a JS focus-trap (Ariakit instead marks the rest of the page `inert`), scroll-lock, and the focus-restore dance — and the relocated node lives outside its logical place in the tree (a known footgun for event bubbling, context providers, and form ownership).
- **The native top layer** (native `<dialog>`, **Rozie**): `showModal()` promotes the element to the browser's **top layer**, painted above *all* page content regardless of `z-index` / `overflow` / `transform`, with **no DOM relocation**. The element stays exactly where you authored it. The scrim is the real `::backdrop` pseudo-element, the rest of the page is made `inert` by the UA, the focus trap and Esc handling are the UA's, and focus restoration to the previously-focused element is automatic.

Rozie picks the native-top-layer camp deliberately. The highest-value, hardest-to-get-right surface — top-layer stacking, the focus trap, focus restoration, Esc — is the browser's, identical on all six targets, while Rozie owns the author-side API: the two-way `open`, the open↔native reconcile, the backdrop/escape close policy, and optional scroll-lock.

## Fully controlled, one close funnel

Most modal components expose a tangle of close paths — an `onOpenChange`, an overlay `onClick`, an Esc handler, an X button — each of which the consumer wires separately. `@rozie-ui/dialog` keeps **one**: `open` is the sole `model: true` prop, and every dismiss (backdrop click, Escape, programmatic `hide()`) funnels through a single site that writes `open = false` and emits `close` with a `reason`. That is what lets the same source stay fully controlled — and two-way bound — on all six frameworks: the binding is always in sync with what's on screen, and the `reason` tells you *why* it closed without extra handlers.

## When to use which

- **Radix / Base UI / shadcn / Ariakit (React):** reach for these when you need **composable, individually-stylable parts** (`Dialog.Trigger` / `Title` / `Description` / `Close`) with wired ARIA, or you're already inside that design system. Ariakit is worth a look if you prefer `inert`-based isolation over a JS focus-trap.
- **Headless UI / vue-final-modal:** a mature, battle-tested modal when you're committed to a **single** framework — React + Tailwind (Headless UI) or Vue (either). vue-final-modal also ships a `useModal()` programmatic/dynamic API.
- **Angular CDK / Material Dialog:** the pick on Angular when you want to **open dialogs imperatively from a service** (`dialog.open(Component)` → a `DialogRef` with an awaited result and injected data), or you need the CDK's overlay toolkit for **non-modal, positioned** popovers/tooltips/menus.
- **Raw native `<dialog>`:** no framework, zero dependencies, and you're happy to hand-wire the open-state, backdrop-click, and close-reason logic yourself.
- **`@rozie-ui/dialog`:** you ship across **two or more** of the six frameworks (or to Lit / Solid, which the incumbents barely serve) and want the *same* idiomatic `<Dialog>`, a real two-way `open`, and the platform's top-layer / focus-trap / focus-restore behaviour — without maintaining a wrapper per framework.

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Lit / web components**, which have *no* mainstream modal component at all, and **Solid**, which is mostly hand-rolled. Both are categories the incumbents barely serve.
- **The same component surface everywhere.** Where the ecosystem offers a different library per framework — many APIs, many scrims, many focus-trap implementations — `@rozie-ui/dialog` is one `<Dialog>` with the same `open` model, the same `close` event with its `reason`, and the same `show` / `hide` handle on all six.
- **The platform does the hard part.** Top-layer rendering with **no portal**, a native `::backdrop`, a real focus trap, Esc-to-dismiss, an inert background, and focus restoration come from `<dialog>` + `showModal()` — not re-implemented in JavaScript, so there is far less to go wrong (and nothing to ship).
- **A real two-way `open` on all six** — `r-model:open` reads *and* writes, with no `onOpenChange → setState` glue.
- **Zero-config styling that re-skins to any design system.** Every cosmetic value is a `--rozie-dialog-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **Composable, unstyled parts.** Radix, Base UI, and Ariakit expose `Dialog.Trigger` / `Title` / `Description` / `Close` as separate primitives with wired ARIA. `@rozie-ui/dialog` is a single element with one default slot; you supply the heading and buttons yourself (and point `ariaLabelledby` at your title).
- **Non-modal / positioned overlays.** The CDK overlay toolkit (and Floating-UI-based libraries) position popovers, tooltips, and dropdowns with flexible anchoring strategies. Rozie's dialog is specifically the **modal** case (`showModal()` + top layer); it is not a general overlay-positioning engine, popover, or drawer kit.
- **Imperative "open a dialog from a service".** Angular CDK's `Dialog.open(Component)` (and vue-final-modal's `useModal()`) spawn dialogs imperatively with injected data and a result promise/ref. Rozie's dialog is declarative-first (`r-model:open` + slot content); the `show()` / `hide()` handle covers imperative open/close but not "render an arbitrary component and await its result".
- **Stacked / nested modals & scroll-lock edge cases.** The native top layer stacks multiple open dialogs correctly, but Rozie's scroll-lock is a simple `<html>` `overflow: hidden` — it does not yet compensate for scrollbar-gutter shift or coordinate across several simultaneously-open dialogs the way some mature libraries do.
- **`@rozie-ui/dialog` is `0.1.0`.** The surface (6 props / 1 event with a `reason` / 2-verb handle / native top layer) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established per-framework libraries. It also inherits the native `<dialog>` browser-support floor — Baseline "widely available" since March 2022 (Chrome/Edge, Firefox 98+, Safari 15.4+), so a polyfill is needed only for pre-2022 engines.

## Try it

The [`@rozie-ui/dialog` showcase + API reference](/components/dialog) documents the `@rozie-ui/dialog-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/dialog-react`, etc.). There is **no engine to import and no required CSS** — the native-`<dialog>` behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/dialog-demo) runs the real Vue package in the page.

## Cross-references

- [Dialog — showcase & API](/components/dialog) — the full `@rozie-ui/dialog` surface, quick start, theming, and accessibility reference.
- [Dialog — live demo](/components/dialog-demo) — the real Vue package running in the page (backdrop / escape / programmatic close with a `@close` reason readout), plus the one `.rozie` source and all six generated outputs.
- [`Dialog.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/dialog/src/Dialog.rozie)
- [Otp — headless one-time-code input](/components/otp-comparison) — a sibling no-engine pure-Rozie family built on native `<input>` cells.
