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

Every "hand-roll" row re-implements the same things: build the engine against a container ref, wire `on()` events to framework outputs, reconcile prop changes to `setOptions`/`setVolume`/`zoom`, guard the two-way position against feedback loops, and tear down on unmount. That's exactly the boilerplate Rozie generates — **once**, from one source, for all six.

## What `@rozie-ui/wavesurfer` gives you

- **Identical surface across all six frameworks** — the same props, the same nine events, the same `currentTime` two-way binding, and the same 14-method imperative handle. Learn it once.
- **Idiomatic per-framework output** — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Not a lowest-common-denominator wrapper — real, native code for each.
- **Two-way playback position** done right — `currentTime` binds both ways with a round-trip guard, so playback updates your state and your seeks drive the engine without oscillation.
- **Stateless plugins wired in** — `timeline` and `hover` are one boolean each, registered at construction across every target.
- **No CSS import** — wavesurfer renders a canvas; there's no stylesheet to remember.

## Trade-offs (be honest)

- **v1 scope is Core + Timeline + Hover.** Interactive Regions (draggable selections), the spectrogram, minimap, envelope, and record plugins are not yet surfaced. If you need Regions today, use the engine directly via `getWaveSurfer()` (the escape hatch) or wait for the follow-up phase.
- **Plugin toggles are construction-time** in v1 — you choose `timeline`/`hover` at first render, not reactively.
- **React already had a good option.** If you're React-only, `@wavesurfer/react` is excellent. Rozie's value is the *other five* frameworks getting parity — and one shared API if you ship across several.

## See also

- [Waveform — showcase & API](/components/wavesurfer) — install, quick starts, and the full reference.
- [Waveform — live demo](/components/wavesurfer-demo) — the real `@rozie-ui/wavesurfer-vue` package running in the browser.
