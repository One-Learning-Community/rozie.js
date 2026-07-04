---
title: Waveform — comparison
surface_hash: c094ffccb048
---

# wavesurfer libraries — comparison

[wavesurfer.js](https://wavesurfer.xyz) does the real work (canvas rendering + Web Audio). The question is the **wrapper**: how do you drop a waveform into *your* framework with idiomatic props, events, two-way state, and an imperative handle? Today that answer is uneven across ecosystems — which is the gap `@rozie-ui/wavesurfer` closes.

## The landscape

| Framework | Common option | State |
| --- | --- | --- |
| React | [`@wavesurfer/react`](https://www.npmjs.com/package/@wavesurfer/react) | Official, well-maintained hook + component. |
| Vue | community wrappers | Thin/aging; often just a `ref` + manual `WaveSurfer.create`. |
| Svelte | — | No maintained wrapper; hand-roll in `onMount`. |
| Angular | community wrappers | Sparse/stale; hand-roll with `ngAfterViewInit`. |
| Solid | — | None; hand-roll with `onMount`/`onCleanup`. |
| Lit | — | None; hand-roll a custom element around the engine. |

Every "hand-roll" row re-implements the same things: build the engine against a container ref, wire `on()` events to framework outputs, reconcile prop changes to `setOptions`/`setVolume`/`zoom`, guard the two-way position (and, with regions, a two-way *list*) against feedback loops, and tear down on unmount. That's exactly the boilerplate Rozie generates — **once**, from one source, for all six.

## What `@rozie-ui/wavesurfer` gives you

- **Identical surface across all six frameworks** — the same props, the same fifteen events, the same two two-way bindings (`currentTime` + `regions`), and the same 17-method imperative handle. Learn it once.
- **Idiomatic per-framework output** — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Not a lowest-common-denominator wrapper — real, native code for each.
- **Two-way playback position** done right — `currentTime` binds both ways with a round-trip guard, so playback updates your state and your seeks drive the engine without oscillation.
- **Two-way interactive regions** — `regions` is a second two-way binding: users create/drag/resize/remove selections and your array stays in sync (reconciled by id, guarded against feedback loops), with `regionCreated/Updated/Clicked/Removed/In/Out` events for the rest.
- **Stateless plugins wired in** — `timeline` and `hover` are one boolean each, registered at construction across every target.
- **No CSS import** — wavesurfer renders a canvas; there's no stylesheet to remember.

## Trade-offs (be honest)

- **Scope is Core + Timeline + Hover + Regions.** The spectrogram, minimap, envelope, and record plugins are not yet surfaced. If you need one of those today, reach for it through the engine directly via `getWaveSurfer()` (the escape hatch), or wait for a follow-up phase.
- **Plugins are construction-time.** You choose `timeline`/`hover`/`regions` at first render, not reactively — a plugin's *presence* is fixed once the engine is built (the `regions` **contents**, however, are fully reactive). Live plugin toggling would re-create the engine; it's a planned follow-up.
- **React already had a good option.** If you're React-only, `@wavesurfer/react` is excellent. Rozie's value is the *other five* frameworks getting parity — and one shared API if you ship across several.

## See also

- [Waveform — showcase & API](/components/wavesurfer) — install, quick starts, and the full reference.
- [Waveform — live demo](/components/wavesurfer-demo) — the real `@rozie-ui/wavesurfer-vue` package running in the browser.
