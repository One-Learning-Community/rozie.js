---
surface_hash: 17f8b8d41384
---

# Cropper libraries comparison

How `@rozie-ui/cropper` compares to the existing per-framework [Cropper.js](https://github.com/fengyuanchen/cropperjs) wrappers. Cropper.js is the de-facto vanilla-JS image-cropping engine, and it is framework-agnostic: every wrapper exists only to glue reactive state to the imperative `Cropper` instance, surface its options as props, and forward the event set. The result is a **lopsided ecosystem**: a deep, maintained React wrapper; an older Vue one; and for Angular / Svelte / Solid / Lit, either an *unrelated* cropping engine or nothing at all. Rozie ships one source to all six.

> Research snapshot: 2026-06-07. Versions and the wrapper landscape move; treat them as of that date. Where a framework's popular "image cropper" is a **different engine** (not Cropper.js), that's called out — it means there is no idiomatic *Cropper.js* option there.

## The wrappers at a glance

| Framework | Cropper.js wrapper | Engine | Depth | Notes |
| --- | --- | --- | :---: | --- |
| **React** | `react-cropper` | Cropper.js v1 | **deep** | Mature, maintained, the obvious React pick. |
| **Vue** | `vue-cropperjs` | Cropper.js v1 | **moderate** | Official-org thin wrapper; Vue-2-era lineage, sparse Vue 3 momentum. |
| **Angular** | *(none for Cropper.js)* | — | — | `ngx-image-cropper` is popular but a **different engine**, not Cropper.js. |
| **Svelte** | *(none for Cropper.js)* | — | — | `svelte-easy-crop` exists but wraps a **different engine** (react-easy-crop's). |
| **Solid** | *(none)* | — | — | No dedicated Cropper.js (or comparable) wrapper. |
| **Lit** | *(none)* | — | — | No web-component wrapper for Cropper.js v1. |
| **Rozie** | `@rozie-ui/cropper-*` | Cropper.js v1 | **deep** | One source → all six, same props / events / two-way / handle. |

`react-cropper` is an **excellent, mature library** — for a single-React app it's the obvious pick, and Rozie does not claim to out-feature it on React. The wedge is everywhere else: Vue's `vue-cropperjs` is a thin, low-momentum wrapper; **Angular and Svelte developers reach for a *different* cropping engine** (`ngx-image-cropper`, `svelte-easy-crop`) because no idiomatic Cropper.js wrapper exists; and **Solid and Lit have nothing**. Rozie gives all five underserved targets a first-class, *consistent* Cropper.js component — the same one it produces for React — from a single definition.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / different-engine / consumer-glue-required.

| Capability | `react-cropper` | `vue-cropperjs` | Angular (none) | Svelte (none) | Solid (none) | Lit (none) | **`@rozie-ui/cropper`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Cropper.js v1 engine | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Mount cropper from `src` | ✅ | ✅ | hand-roll | hand-roll | hand-roll | hand-roll | ✅ |
| Full option surface as props | ✅ | ⚠️ partial | — | — | — | — | ✅ 21 props |
| **Two-way crop box** | ⚠️ via `crop` callback | ⚠️ via event | — | — | — | — | ✅ `data` model (round-trip-guarded) |
| Full event set | ✅ | ⚠️ partial | — | — | — | — | ✅ 6 events |
| Imperative handle (rotate / zoom / export…) | ✅ via ref `.cropper` | ⚠️ via `$refs` methods | — | — | — | hand-roll | ✅ uniform 27-verb `$expose` |
| `getCroppedCanvas` / export | ✅ | ✅ | — | — | — | — | ✅ + `getCroppedDataURL` convenience |
| Angular `ControlValueAccessor` | n/a | n/a | ❌ | n/a | n/a | n/a | ✅ (`data` model → `[(ngModel)]`) |
| TypeScript | ✅ | ⚠️ | — | — | — | — | ✅ |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including the four frameworks with **no Cropper.js option at all** (Angular, Svelte, Solid, Lit). An Angular or Svelte dev today must adopt a *different* cropping engine (`ngx-image-cropper`, `svelte-easy-crop`) with its own API and look; a Solid or Lit dev hand-rolls everything around the raw engine. Rozie hands all four a first-class Cropper.js component.
- **A real two-way crop box on all six** — the `data` model (`{ x, y, width, height, rotate, scaleX, scaleY }`) reads *and* drives the crop box, echoed on every `crop` event and applied via `setData` with a round-trip guard. `react-cropper` and `vue-cropperjs` surface the box via a one-way callback / event; you wire the write-back yourself.
- **A uniform 27-verb imperative handle** (`getCroppedCanvas` / `getCroppedDataURL` / `rotateBy` / `zoomBy` / `scaleX` / `setAspectRatio` / …) grabbed with each framework's native ref — identical on every target, versus "however this wrapper happens to expose the instance" (a `.cropper` ref property, `$refs` methods, …).
- **Angular gets a `ControlValueAccessor` for free** — because `data` is the lone model prop, `[(ngModel)]="box"` and reactive `formControl` bindings work out of the box. No Cropper.js wrapper offers this today (there isn't one).
- **`getCropper()` is always one hop from the raw engine**, so the full Cropper.js v1 API is reachable on any target when the curated surface doesn't cover something.

## What Rozie defers {#what-rozie-defers}

This page concedes where the incumbents are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **React depth on React.** `react-cropper` is a mature, multi-year library with a large user base, battle-tested edge-case handling, and React-idiomatic ergonomics refined over many releases. On React specifically it exposes more accumulated polish than Rozie's curated prop set. Rozie's value is **not** "more than react-cropper on React" — it's the **same idiomatic component on all six frameworks from one source**, with the five underserved targets getting a Cropper.js component they otherwise lack. For anything outside the curated surface, `getCropper()` hands you the raw engine on every target.

- **Runtime-reconciling every option.** Cropper.js v1 ships runtime setters only for the aspect ratio, drag mode, crop box, enable/disable, and source — so those five props reconcile live, and the rest are applied at construction (the *Runtime-updatable?* column in the [API table](/components/cropper#props)). Wrappers that rebuild the whole instance on any option change (as `react-cropper` does for some props) can appear to "reconcile" more; Rozie deliberately keeps the construction-time set construction-time rather than churning a full destroy/rebuild. Anything not surfaced reconciles through the `options` passthrough at construction.

- **`@rozie-ui/cropper` is `0.1.0`.** The surface (21 props / 6 events / 27-verb handle / two-way `data` model) is stable and gate-verified, but it is younger than `react-cropper`.

- **Cropper.js v1, not v2.** These packages wrap the mature v1. Cropper.js v2 (the Web-Components rewrite) is a separate, newer API; teams that want v2's web-component model are better served by it directly (it is already cross-framework via custom elements). See [Why v1, not v2](/components/cropper#why-v1-not-v2).

## Try it

The [`@rozie-ui/cropper` showcase + API reference](/components/cropper) documents the `@rozie-ui/cropper-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/cropper-react cropperjs`, etc.), plus the `import 'cropperjs/dist/cropper.css'` the engine DOM needs. The showcase walks the two-way `data` binding, the 6-event surface, the 27-verb imperative handle, and the crop/rotate/flip/export recipes.

## Cross-references

- [Cropper — showcase & API](/components/cropper) — the full `@rozie-ui/cropper` surface, quick starts, and recipes.
- [`Cropper.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/cropper/src/Cropper.rozie)
- [MapLibre libraries comparison](/components/maplibre-comparison) — the sibling engine-wrapper port.
