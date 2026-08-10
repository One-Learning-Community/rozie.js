---
surface_hash: 17f8b8d41384
---

# Cropper libraries comparison

How `@rozie-ui/cropper` compares to the existing per-framework [Cropper.js](https://github.com/fengyuanchen/cropperjs) wrappers. Cropper.js is the de-facto vanilla-JS image-cropping engine, and it is framework-agnostic: every wrapper exists only to glue reactive state to the imperative `Cropper` instance, surface its options as props, and forward the event set. The result is a lopsided ecosystem: a deep but no-longer-shipping React wrapper; an older Vue one; and for Angular / Svelte / Solid / Lit, a stale or negligible-adoption wrapper, an *unrelated* cropping engine, or nothing at all. Rozie ships the same `<Cropper>`, with the same props, events, two-way crop box, and imperative handle, to all six frameworks as pre-compiled per-framework packages.

> Research snapshot: 2026-08-10. Versions and the wrapper landscape move; treat them as of that date. Where a framework's popular "image cropper" is a **different engine** (not Cropper.js), that's called out; it means there is no idiomatic *Cropper.js* option there.

## The wrappers at a glance

| Framework | Cropper.js wrapper | Engine | Depth | Notes |
| --- | --- | --- | :---: | --- |
| **React** | `react-cropper` | Cropper.js v1 | **deep** | Mature and widely used (~412k wk); last published 2023-04. |
| **Vue** | `vue-cropperjs` | Cropper.js v1 | **moderate** | Official-org thin wrapper; last published 2021-02, sparse Vue 3 momentum. |
| **Angular** | `angular-cropperjs` *(stale)* | Cropper.js v1 | **thin** | Last published 2023-06 (~8.7k wk). The popular pick, `ngx-image-cropper` (~328k wk), is a **different engine**, not Cropper.js. |
| **Svelte** | *(no mainstream option)* | — | — | `svelte-easy-crop` wraps a **different engine** (react-easy-crop's); the one Cropper.js wrapper (`@cloudparker/easy-cropperjs-svelte`) has negligible adoption (~59 wk). |
| **Solid** | *(none)* | — | — | No dedicated Cropper.js (or comparable) wrapper. |
| **Lit** | *(none)* | — | — | No web-component wrapper for Cropper.js v1. |
| **Rozie** | `@rozie-ui/cropper-*` | Cropper.js v1 | **deep** | Same API on all six: props, events, two-way binding, handle. |

On React, `react-cropper` is a mature library and the obvious single-framework pick, though it has not shipped since 2023-04. The case for Rozie is everywhere else. Vue's `vue-cropperjs` is a thin, low-momentum wrapper. Angular and Svelte developers reach for a *different* cropping engine (`ngx-image-cropper`, `svelte-easy-crop`) because no maintained, mainstream Cropper.js wrapper exists there (`angular-cropperjs` last shipped 2023-06). Solid and Lit have nothing. Rozie gives all five underserved targets a first-class, consistent Cropper.js component, the same one it ships for React.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / different-engine / consumer-glue-required.

| Capability | `react-cropper` | `vue-cropperjs` | Angular (stale wrapper) | Svelte (niche wrapper) | Solid (none) | Lit (none) | **`@rozie-ui/cropper`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Cropper.js v1 engine | ✅ | ✅ | ⚠️ stale | ⚠️ niche | ❌ | ❌ | ✅ |
| Mount cropper from `src` | ✅ | ✅ | hand-roll | hand-roll | hand-roll | hand-roll | ✅ |
| Full option surface as props | ✅ | ⚠️ partial | — | — | — | — | ✅ 21 props |
| **Two-way crop box** | ⚠️ via `crop` callback | ⚠️ via event | — | — | — | — | ✅ `data` model (round-trip-guarded) |
| Full event set | ✅ | ⚠️ partial | — | — | — | — | ✅ 6 events |
| Imperative handle (rotate / zoom / export…) | ✅ via ref `.cropper` | ⚠️ via `$refs` methods | — | — | — | hand-roll | ✅ uniform 27-verb `$expose` |
| `getCroppedCanvas` / export | ✅ | ✅ | — | — | — | — | ✅ + `getCroppedDataURL` convenience |
| Angular `ControlValueAccessor` | n/a | n/a | ❌ | n/a | n/a | n/a | ✅ (`data` model → `[(ngModel)]`) |
| TypeScript | ✅ | ⚠️ | — | — | — | — | ✅ |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **First-class packages for all six frameworks** — including the four with **no maintained, mainstream Cropper.js option** (Angular's `angular-cropperjs` last shipped 2023-06; Svelte's only Cropper.js wrapper has negligible adoption; Solid and Lit have nothing). An Angular or Svelte dev today adopts a *different* cropping engine with its own API and look, or a stale wrapper; a Solid or Lit dev hand-rolls everything around the raw engine. Rozie hands all four a first-class Cropper.js component.
- **A real two-way crop box on all six.** The `data` model (`{ x, y, width, height, rotate, scaleX, scaleY }`) reads *and* drives the crop box, echoed on every `crop` event and applied via `setData` with a round-trip guard. `react-cropper` and `vue-cropperjs` surface the box via a one-way callback or event; you wire the write-back yourself.
- **A uniform 27-verb imperative handle** (`getCroppedCanvas` / `getCroppedDataURL` / `rotateBy` / `zoomBy` / `scaleX` / `setAspectRatio` / …) grabbed with each framework's native ref. It is identical on every target, versus however a given wrapper happens to expose the instance (a `.cropper` ref property, `$refs` methods, …).
- **Angular gets a `ControlValueAccessor` for free.** Because `data` is the lone model prop, `[(ngModel)]="box"` and reactive `formControl` bindings work out of the box. No Cropper.js wrapper offers this today.
- **`getCropper()` is always one hop from the raw engine**, so the full Cropper.js v1 API is reachable on any target when the curated surface doesn't cover something.

## What Rozie defers {#what-rozie-defers}

- **React depth on React.** `react-cropper` is a mature, multi-year library with a large user base, battle-tested edge-case handling, and React-idiomatic ergonomics refined over many releases. On React specifically it exposes more accumulated polish than Rozie's curated prop set. Rozie's value is the same idiomatic component on all six frameworks, with the five underserved targets getting a Cropper.js component they otherwise lack. For anything outside the curated surface, `getCropper()` hands you the raw engine on every target.

- **Runtime-reconciling every option.** Cropper.js v1 ships runtime setters only for the aspect ratio, drag mode, crop box, enable/disable, and source. Those five props reconcile live, and the rest are applied at construction (the *Runtime-updatable?* column in the [API table](/components/cropper#props)). Wrappers that rebuild the whole instance on any option change (as `react-cropper` does for some props) can appear to reconcile more; Rozie deliberately keeps the construction-time set construction-time rather than churning a full destroy/rebuild. Anything not surfaced passes through the `options` object at construction.

- **`@rozie-ui/cropper` is pre-1.0** and younger than `react-cropper`. The full surface is documented in the [showcase & API](/components/cropper).

- **Cropper.js v1, not v2.** These packages wrap the mature v1. Cropper.js v2 (the Web-Components rewrite) is a separate, newer API; teams that want v2's web-component model are better served by it directly (it is already cross-framework via custom elements). See [Why v1, not v2](/components/cropper#why-v1-not-v2).

## Try it

The [`@rozie-ui/cropper` showcase + API reference](/components/cropper) documents the `@rozie-ui/cropper-*` packages: one pre-compiled, per-framework install (`npm i @rozie-ui/cropper-react cropperjs`, etc.), plus the `import 'cropperjs/dist/cropper.css'` the engine DOM needs. The showcase walks the two-way `data` binding, the event surface, the imperative handle, and the crop/rotate/flip/export recipes.

## Cross-references

- [Cropper — showcase & API](/components/cropper) — the full `@rozie-ui/cropper` surface, quick starts, and recipes.
- [`Cropper.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/cropper/src/Cropper.rozie)
- [MapLibre libraries comparison](/components/maplibre-comparison) — the sibling engine-wrapper port.
