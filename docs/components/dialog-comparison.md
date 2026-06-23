# Headless modal dialog comparison

How `@rozie-ui/dialog` compares to the existing modal / dialog libraries across the six frameworks. Like the slider, listbox, and OTP families, the dialog has **no shared vanilla-JS engine** — but unlike those, the "engine" it leans on is the **browser platform itself**: the native `<dialog>` element + `showModal()`. The modal landscape is overwhelmingly **per-framework** (Radix on React, Headless UI on React/Vue, vue-final-modal on Vue, Angular CDK on Angular, …), and almost all of them re-implement in JavaScript what the platform now gives for free — a top-layer surface, a scrim, a focus trap, and Esc handling. Rozie authors the author-side API **once** on top of the native element and ships it to all six frameworks as the *same* idiomatic `<Dialog>`.

> Research snapshot: 2026-06-22. The modal/dialog landscape moves quickly; treat the library names, framework coverage, and feature columns as of that date.

## The libraries at a glance

| Option | Framework(s) | Top-layer (no portal) | Native focus trap | Scrim source | Two-way `open` | One source → 6 fw |
| --- | --- | :---: | :---: | --- | :---: | :---: |
| **Radix Dialog** (`@radix-ui/react-dialog`) | React | ❌ portal to `<body>` | ⚠️ JS focus-scope | styled `<div>` overlay | ⚠️ open + onOpenChange | ❌ |
| **Headless UI Dialog** | React, Vue | ❌ portal | ⚠️ JS focus-trap | styled `<div>` overlay | ⚠️ open + onClose | ❌ (2 fw) |
| **Native `<dialog>`** | any (raw DOM) | ✅ top layer | ✅ native | native `::backdrop` | ❌ imperative only | ❌ |
| **vue-final-modal** | Vue | ❌ teleport | ⚠️ JS | styled overlay | ✅ `v-model` | ❌ |
| **Angular CDK Dialog** (`@angular/cdk/dialog`) | Angular | ❌ CDK overlay (cdk-overlay-container) | ⚠️ CDK focus-trap | CDK backdrop `<div>` | ⚠️ service/ref | ❌ |
| **Rozie** | `@rozie-ui/dialog-*` | ✅ native `showModal()` top layer | ✅ native | native `::backdrop` | ✅ `r-model:open` | ✅ |

These libraries are **good** — on its home framework each is a reasonable pick, and Rozie does not claim to out-feature Radix's composable parts or the CDK's overlay-positioning toolkit. The wedge is **consistency, coverage, and the native-`<dialog>` foundation**: there is no modal component that spans all six frameworks with the *same* API, and almost none of the incumbents use the platform's top layer — they portal/teleport into `<body>` and re-build the focus trap and scrim in JavaScript. Rozie gives all six the *same* idiomatic `<Dialog>` from one definition, sitting on the native element.

## Top layer vs. portal: the design choice

The deepest decision in a modal component is **how it escapes its ancestors' `z-index`, `overflow: hidden`, and `transform` contexts**. Two camps:

- **Portal / teleport into `<body>`** (Radix, Headless UI, vue-final-modal, Angular CDK): the dialog DOM is *relocated* to a container at the end of `<body>` so no ancestor can clip or stack it. It works, but it means the component owns a portal implementation, a scrim element, a JS focus-trap, scroll-lock, and the focus-restore dance — and the relocated node lives outside its logical place in the tree (a known footgun for event bubbling, context providers, and form ownership).
- **The native top layer** (native `<dialog>`, **Rozie**): `showModal()` promotes the element to the browser's **top layer**, painted above *all* page content regardless of `z-index` / `overflow` / `transform`, with **no DOM relocation**. The element stays exactly where you authored it. The scrim is the real `::backdrop` pseudo-element, the focus trap and Esc handling are the UA's, and focus restoration to the previously-focused element is automatic.

Rozie picks the native-top-layer camp deliberately. The highest-value, hardest-to-get-right surface — top-layer stacking, the focus trap, focus restoration, Esc — is the browser's, identical on all six targets, while Rozie owns the author-side API: the two-way `open`, the open↔native reconcile, the backdrop/escape close policy, and optional scroll-lock.

## Fully controlled, one close funnel

Most modal components expose a tangle of close paths — an `onOpenChange`, an overlay `onClick`, an Esc handler, an X button — each of which the consumer wires separately. `@rozie-ui/dialog` keeps **one**: `open` is the sole `model: true` prop, and every dismiss (backdrop click, Escape, programmatic `hide()`) funnels through a single site that writes `open = false` and emits `close` with a `reason`. That is what lets the same source stay fully controlled — and two-way bound — on all six frameworks: the binding is always in sync with what's on screen, and the `reason` tells you *why* it closed without extra handlers.

## Where Rozie wins today

- **One definition, six idiomatic packages** — including **Lit / web components**, which have *no* mainstream modal component at all, and **Solid**, which is mostly hand-rolled. Both are categories the incumbents barely serve.
- **The same component surface everywhere.** Where the ecosystem offers a different library per framework — five APIs, five scrims, five focus-trap implementations — `@rozie-ui/dialog` is one `<Dialog>` with the same `open` model, the same `close` event with its `reason`, and the same `show` / `hide` handle on all six.
- **The platform does the hard part.** Top-layer rendering with **no portal**, a native `::backdrop`, a real focus trap, Esc-to-dismiss, and focus restoration come from `<dialog>` + `showModal()` — not re-implemented in JavaScript, so there is far less to go wrong (and nothing to ship).
- **A real two-way `open` on all six** — `r-model:open` reads *and* writes, with no `onOpenChange → setState` glue.
- **Zero-config styling that re-skins to any design system.** Every cosmetic value is a `--rozie-dialog-*` CSS custom property with a built-in fallback, plus ready-made token bridges for shadcn/ui, Material 3, and Bootstrap 5.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **Composable, unstyled parts.** Radix exposes `Dialog.Trigger` / `Dialog.Title` / `Dialog.Description` / `Dialog.Close` as separate primitives with wired ARIA. `@rozie-ui/dialog` is a single element with one default slot; you supply the heading and buttons yourself (and point `ariaLabelledby` at your title).
- **Non-modal / positioned overlays.** The CDK overlay toolkit positions popovers, tooltips, and dropdowns with flexible anchoring strategies. Rozie's dialog is specifically the **modal** case (`showModal()` + top layer); it is not a general overlay-positioning engine.
- **Imperative "open a dialog from a service".** Angular CDK's `Dialog.open(Component)` and similar APIs spawn dialogs imperatively with injected data and a result promise. Rozie's dialog is declarative-first (`r-model:open` + slot content); the `show()` / `hide()` handle covers imperative open/close but not "render an arbitrary component and await its result".
- **Stacked / nested modals & scroll-lock edge cases.** The native top layer stacks multiple open dialogs correctly, but Rozie's scroll-lock is a simple `<html>` `overflow: hidden` — it does not yet compensate for scrollbar-gutter shift or coordinate across several simultaneously-open dialogs the way some mature libraries do.
- **`@rozie-ui/dialog` is `0.1.0`.** The surface (6 props / 1 event with a `reason` / 2-verb handle / native top layer) is stable and gate-verified across all six targets, but it is younger and less battle-tested than the established per-framework libraries. It also inherits the native `<dialog>` browser-support floor (a polyfill is needed for pre-2022 engines).

## Try it

The [`@rozie-ui/dialog` showcase + API reference](/components/dialog) documents the `@rozie-ui/dialog-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/dialog-react`, etc.). There is **no engine to import and no required CSS** — the native-`<dialog>` behaviour and a fully-tokenised skin ship inside the component, with optional one-line theme bridges for shadcn/ui, Material 3, and Bootstrap 5. The [live demo](/components/dialog-demo) runs the real Vue package in the page.

## Cross-references

- [Dialog — showcase & API](/components/dialog) — the full `@rozie-ui/dialog` surface, quick start, theming, and accessibility reference.
- [Dialog — live demo](/components/dialog-demo) — the real Vue package running in the page (backdrop / escape / programmatic close with a `@close` reason readout), plus the one `.rozie` source and all six generated outputs.
- [`Dialog.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/dialog/src/Dialog.rozie)
- [Otp — headless one-time-code input](/components/otp-comparison) — a sibling no-engine pure-Rozie family built on native `<input>` cells.
