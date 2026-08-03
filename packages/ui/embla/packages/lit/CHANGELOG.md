# @rozie-ui/embla-lit

## 0.1.4

### Patch Changes

- Regenerated against `@rozie/core@0.3.1`. The `.length` derived `$watch` now compares with `Object.is` instead of strict `!==` (IN-02) — a NaN-valued derived getter (not reachable through this component's own `slides.length` shape today, but a real emitter parity fix) no longer re-fires the reInit/thumb-sync callback on every cycle the base `slides` property's setter ran; this matches React's existing `Object.is` dep-array comparison. The `startIndex` prop's JSDoc now correctly says "Init-only" instead of the stale "Runtime-updatable" (WR-01). No observable runtime behavior change for this component's actual usage (its watched value is never NaN); no API surface change.

## 0.1.3

### Patch Changes

- Regenerated against `@rozie/core@0.3.0`. The selected index now survives `reInit`: `startIndex` is stripped from every reInit payload after the raw `options` spread, so a runtime option flip (e.g. toggling `loop`) no longer teleports the carousel back to `startIndex`. **Deliberate behavior change to a published verb:** no-arg `reInitCarousel()` now preserves position instead of resetting to `startIndex` — documented in `embla.md`. Scheduled mount work (two `requestAnimationFrame` handles + a macrotask) is now cancelled on teardown, and both engines are nulled after `destroy()`, so all 14 `$expose` verbs fall through their guards after unmount. A runtime `thumbnails` toggle now actually builds the thumb engine (deferred/idempotent double-schedule).
- The derived-getter `$watch` on `.length` now fires on value change instead of base-property identity — it previously gated on `changedProperties.has('slides')`, which could miss a length change that didn't also change array identity.
- `r-for` loop keys are no longer leaked as literal DOM attributes on the emitted slide elements.
- Docs truth pass: the runtime-updatable contract (17 of 20 props; `startIndex`/`plugins`/`options` marked construction-only, with reasons), the five previously-missing handle verbs (`scrollProgress`/`slidesInView`/`slidesNotInView`/`previousScrollSnap`/`getPlugins`), and a filled Events table. The docs' Slots section carries a still-open Lit-specific caveat: filling the `slide` scoped slot via native `slot="slide"` light-DOM children does not distribute per-iteration (the browser assigns all matching children to the first same-named `<slot>` in tree order) — use the documented property-function API (`el.slide = ({ slide, index }) => html\`…\`;`) instead. Tracked as an open architecture gap, not fixed in this release.
- No API surface change.
- Updated dependencies
  - @rozie/runtime-lit@0.2.2

## 0.1.2

### Patch Changes

- First published release. `0.1.2` is the FIRST all-targets `@rozie-ui/embla` release line — all six leaves (react / vue / solid / lit / svelte / angular) aligned at the same version. The earlier `0.1.0`/`0.1.1` on-disk numbers were never published; they are changesets ripples from `@rozie/runtime-*` bumps, not release history.

  `embla-carousel ^8.6` and `embla-carousel-autoplay ^8.6` are `peerDependencies` — the consumer installs them; nothing is bundled. There is no engine CSS to import: the carousel skeleton ships scoped and tokenised inside the component.

  The `@rozie/runtime-lit` dependency now resolves to `0.2.2` (array-form `:style` merge).

  Two built-in navigation fixes are now VR-locked in this release: Embla's `slides` option is pinned to `.rozie-embla__slide` (Lit's trailing declarative-mode `<slot/>` used to be counted as a phantom slide, collapsing `scrollSnapList()` to one snap), and `selectThumb` no longer calls the Embla-8-removed `clickAllowed()`.
- Updated dependencies [c279a7e]
  - @rozie/runtime-lit@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [364f4c5]
  - @rozie/runtime-lit@0.2.0
