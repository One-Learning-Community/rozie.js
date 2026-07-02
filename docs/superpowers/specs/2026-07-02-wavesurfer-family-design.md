# `@rozie-ui/wavesurfer` — marquee audio-waveform family — design

**Date:** 2026-07-02
**Status:** Approved (design) — building autonomously
**Topic:** Add a new `@rozie-ui` component family wrapping **wavesurfer.js v7** — one
`.rozie` source → six idiomatic per-framework leaves (React / Vue / Svelte / Angular /
Solid / Lit) on the compiled `dist` + `./source` standard. Component `Waveform`, slug
`wavesurfer`.

---

## 1. Why this family

The project thesis (see `.planning/ROADMAP.md` + memory `project_post_v1_killer_component_ports`)
is to **port vanilla-JS engine wrappers that are painful to wrap ×6**, not to reimplement
framework-native widgets. wavesurfer.js is a textbook fit:

- It is *the* de-facto vanilla audio-waveform engine (canvas + Web Audio), with a
  plugin architecture (regions, timeline, minimap, spectrogram, hover, envelope, record).
- Per-framework wrappers are **lopsided**: React has `@wavesurfer/react`; the other five
  ecosystems have thin, stale, or absent wrappers. ONE Rozie source ships six idiomatic
  packages — Angular/Svelte/Solid/Lit consumers get a category-leading waveform for free.
- It stresses a **rendering surface the six emitters have never been pushed on**: 2D canvas
  + Web Audio lifecycle, and a plugin layer registered at engine init.

**Engine major:** pin `wavesurfer.js@^7` (current 7.12.8). v7 is the ESM rewrite; each
plugin is a separate entry (`wavesurfer.js/plugins/*`) exposing a `.create(opts)` factory
passed into `WaveSurfer.create({ plugins: [...] })`. Per memory
`feedback_peer_dep_node_engines_dont_gate_compiled_component`, the major is chosen by API,
not Node floor.

## 2. Scope — v1 = Core + Timeline + Hover

Core waveform + full playback, plus the **two stateless plugins** (timeline ruler, hover
cursor). These plugins are pure config — no interactive writeback — so they prove the
plugin-wiring path across all six targets without the region-CRUD state rabbit hole.

**Explicitly deferred (fast-follow phases):**
- **Regions** (interactive draggable regions: region model, CRUD `$expose` verbs,
  `region-*` emits) — the iconic feature and the real state stress-test.
- **Live plugin toggling** — in v1, `timeline`/`hover` are read at engine init only;
  toggling post-mount is a documented no-op. Live toggling = engine re-create, deferred.
- **`#controls` scoped slot** — v1 ships no slots; consumers build transport controls from
  the exposed handle + events. A scoped slot exposing `{ isPlaying, currentTime, duration }`
  is a clean fast-follow.
- Spectrogram / minimap / envelope / record plugins.

## 3. Surface (IR contract — this is the compile-check `EXPECT` block)

**Component name `Waveform`** (descriptive, per the `Carousel`/`Chart`/`FlowCanvas`
convention — not the engine name), **slug `wavesurfer`**, Lit tag `rozie-waveform`.

### Props (booleans default `false`; on-by-default engine flags expressed as `disableX` per `feedback_boolean_props_default_false`)

| Prop | Type | Default | Runtime-reconcilable? | Notes |
|---|---|---|---|---|
| `src` | String | `null` | Yes → `ws.load(url)` | audio URL (engine `url`) |
| `height` | Number | `128` | Yes → `setOptions` | waveform px height |
| `waveColor` | String | `'#8a2be2'`* | Yes → `setOptions` | |
| `progressColor` | String | `'#5a189a'`* | Yes → `setOptions` | |
| `cursorColor` | String | `'#333'` | Yes → `setOptions` | |
| `cursorWidth` | Number | `1` | Yes → `setOptions` | |
| `barWidth` | Number | `null` | Yes → `setOptions` | `null` → continuous wave |
| `barGap` | Number | `null` | Yes → `setOptions` | |
| `barRadius` | Number | `null` | Yes → `setOptions` | |
| `minPxPerSec` | Number | `1` | Yes → `ws.zoom(v)` | zoom baseline |
| `volume` | Number | `1` | Yes → `ws.setVolume(v)` | |
| `playbackRate` | Number | `1` | Yes → `ws.setPlaybackRate(v)` | |
| `autoplay` | Boolean | `false` | init-only | |
| `normalize` | Boolean | `false` | Yes → `setOptions` | |
| `hideScrollbar` | Boolean | `false` | init-only | |
| `disableInteraction` | Boolean | `false` | init-only | engine `interact = !disableInteraction` |
| `disableDragToSeek` | Boolean | `false` | init-only | engine `dragToSeek = !disableDragToSeek` |
| `timeline` | Boolean | `false` | init-only (v1) | opt-in TimelinePlugin |
| `hover` | Boolean | `false` | init-only (v1) | opt-in HoverPlugin |
| `hoverColor` | String | `null` | init-only (v1) | HoverPlugin color |
| `options` | Object | `() => ({})` | init-only | raw wavesurfer `WaveSurferOptions` passthrough (spread first; explicit props win) |

\* purple palette so the default demo is visually distinctive; tweak during authoring if a
more neutral default reads better.

### Two-way model (single `model: true`)

- **`currentTime`** (Number, untyped → emits `unknown`, `default: undefined` like cropper's
  `data`) — writeback fires on the engine `timeupdate` event; incoming consumer writes call
  `ws.setTime(v)` behind a **re-entrancy guard** (`seekingInternally` flag + rounded-second
  equality, mirroring cropper's `sameData` round-trip guard) so playback and binding do not
  oscillate. React auto-generates a `setCurrentTime` setter → **do not expose a `setCurrentTime`
  verb** (ROZ524, the cropper-`setData` / maplibre-`setCenter` class).

### Emits

`ready` (duration), `play`, `pause`, `finish`, `timeupdate` (currentTime), `seeking` (time),
`interaction` (time), `loading` (percent), `error` (err).

### `$expose` verbs (collision-clear across all six targets)

`play`, `pause`, `playPause`, `stop`, `seekTo(progress)`, `setTime(seconds)`,
`setVolume(v)`, `setPlaybackRate(rate)`, `setZoom(pxPerSec)`, `load(url)`, `isPlaying`,
`getDuration`, `getCurrentTime`, `getWaveSurfer`.

Collision audit: `play`/`pause`/`load`/`stop` are **not** `HTMLElement` methods (they are
`HTMLMediaElement` methods, but the Lit host is a plain custom element, so no override) →
no Lit-host clash. None match a Lit reserved lifecycle name
(`update`/`render`/`firstUpdated`/`updated`/`willUpdate`/`requestUpdate`). No bare event⇄verb
collision (ROZ121) — every emit name (`play`, `pause`, …) that is also a verb refers to the
**same** imperative action, but wavesurfer's methods and events do collide by name the way
cropper's `crop`/`zoom` did; **verify at the surface gate** and rename to `playPause`-style
if the gate flags it. (Expectation: `play`/`pause` verbs are fine because they are exposed
handle methods, not template `@play`/`@pause` bindings — but the gate is authoritative.)

## 4. Engine lifecycle & reactivity

Mirrors the cropper engine-wrapper pattern exactly:

- **Top-level null-lets:** `let ws = null` (the WaveSurfer instance) and `let seekingInternally
  = false` (the model re-entrancy guard). Declared at top level — **not** inside `$onMount` —
  because the Solid emitter splits `$onMount` into `onMount(...)` + `onCleanup(...)`, so the
  handle must be reachable from teardown (per `ADDING-A-FAMILY.md` "cross-phase state" gotcha).
- **`$onMount`:** read `$refs.container` (the **only** ROZ123-safe place), build the engine via
  a `buildWaveSurfer()` helper:
  ```
  ws = WaveSurfer.create({
    ...$snapshot($props.options),   // passthrough first — explicit keys win
    container: $refs.container,
    url: $props.src,
    height, waveColor, progressColor, cursorColor, cursorWidth,
    barWidth, barGap, barRadius, minPxPerSec, autoplay, normalize,
    hideScrollbar,
    interact: !$props.disableInteraction,
    dragToSeek: !$props.disableDragToSeek,
    plugins: [ /* TimelinePlugin.create() if timeline; HoverPlugin.create({hoverColor}) if hover */ ],
  })
  ```
  Wire `ws.on('ready', ...)` → `$emit('ready', ws.getDuration())`; `ws.on('timeupdate', t)`
  → guard-write `$model.currentTime = t` + `$emit('timeupdate', t)`; `play`/`pause`/`finish`/
  `seeking`/`interaction`/`loading`/`error` → `$emit`. Return a cleanup that calls
  `ws.destroy()` (tears down AudioContext + canvas ×6).
- **`$watch` reconcilers** (one per runtime-reconcilable prop): `src`→`ws.load(v)`; the
  appearance props (`height`/colors/bars/`normalize`/`cursorWidth`) batched through
  `ws.setOptions({...})`; `volume`→`ws.setVolume`; `playbackRate`→`ws.setPlaybackRate`;
  `minPxPerSec`→`ws.zoom`; `currentTime` (incoming) → guarded `ws.setTime(v)` (skip if
  `Math.round` equals current + set `seekingInternally` around the call).

**Re-entrancy guard detail:** `timeupdate` handler sets `seekingInternally = true` before
`$model.currentTime = t` and clears it after (microtask), and the `currentTime` `$watch`
early-returns when `seekingInternally` is true or when `Math.round(v) === Math.round(ws.getCurrentTime())`.
Assert this in a **behavior test**, not just a snapshot (memory `feedback_snapshot_tests_cement_bugs`).

## 5. Parity risks to watch (prior-family scar tissue)

1. **`currentTime` feedback loop** — the guard flag is load-bearing; behavior-test it.
2. **Lit shadow DOM** — wavesurfer renders a canvas (and its own internal shadow wrapper for
   style isolation) into our container. cropper/maplibre carried *WebGL*-in-shadow VR
   deferrals; wavesurfer is 2D-canvas + Web Audio, expected fine, but **flag as a VR watch
   item** — do not assume (memory `project_vr_outstanding_rozie_ui_issues`: "every cosmetic
   deferral was a real bug"). If engine CSS ever needs to reach sibling DOM, add
   `adopt-document-styles` (cropper precedent) — expected unnecessary here since v7 needs no
   external CSS.
3. **AudioContext lifecycle across HMR/unmount ×6** — verify `ws.destroy()` actually runs
   (Solid `onCleanup` scope; the top-level `let ws` covers this). Playwright smoke, not just
   VR (memory `feedback_vite_build_vs_dev_node_isms`).
4. **`$refs.container` types to generic `HTMLElement`** — fine here (we only pass it to the
   engine; we touch no element-specific members), so no codegen type-aid needed (contrast the
   cropper `<img>`→`HTMLImageElement` aid).
5. **Autoplay + jsdom/CI** — VR/smoke must not depend on actual audio decode; use a tiny
   fixed data-URI or a deterministic peaks array so renders are stable and offline
   (memory `feedback_vr_linux_baselines`, `project_vr_fullcalendar_wallclock_flake`). No
   wall-clock, no network in VR cells.

## 6. Deliverables & gates (purely additive family)

No `packages/core` / `packages/targets` edits → the heavy emitter-change gates (dist-parity
rebless, target-snapshot rebless) do **not** apply. Following `ADDING-A-FAMILY.md`:

- `packages/ui/wavesurfer/src/Waveform.rozie` — the source (author-owned).
- `scripts/compile-wavesurfer-check.mjs` — surface + collision gate (**run FIRST**), `EXPECT`
  block = §3. This is where ROZ121/ROZ524/Lit-lifecycle collisions surface.
- Six leaves under `packages/ui/wavesurfer/packages/{react,solid,lit,vue,svelte,angular}/`
  on the dist+source standard; engine peer `wavesurfer.js@^7`; **no `themes/`** (engine
  wrapper); **no `<style>` css-copy** unless a host-sizing `<style>` is added (a minimal
  scoped container `<style>` is acceptable — width 100%, block display).
- `scripts/{codegen,readme,event-manifest,handle-manifest}.mjs` (copy captcha/cropper,
  retarget). `readme.mjs` `USAGE`/`HANDLE_USAGE` must be **family-specific** (docs usage build
  throws on a missing `USAGE` export).
- Docs: `docs/components/wavesurfer.md` (showcase + IR-exact `### Props` table — validated by
  codegen), `wavesurfer-comparison.md`, `wavesurfer-demo.md` (`<ClientOnly>` importing
  `@rozie-ui/wavesurfer-vue` — add to `docs/package.json`), `wavesurfer-api.md` (`rozie-props
  Waveform` fence — add `'wavesurfer'` to `docs/.vitepress/props-codegen.ts` resolver list),
  auto `wavesurfer-usage.md`. Four registration points: `docs/.vitepress/config.ts` nav,
  `docs/components/index.md`, `docs/index.md`.
- Prop prose single-source: authored in the `.rozie` `<props>` `docs.description`; `readme.mjs`
  imports `renderPropDescription` from `@rozie/core`.
- VR: ~6 deterministic cells (waveform, bars, timeline, hover, zoomed, playing-state) using a
  fixed offline audio source; register in the VR matrix; behavior spec for playback + the
  model round-trip guard. Playground entry.

### Gate order (the real catches, per the recipe)

1. `node scripts/compile-wavesurfer-check.mjs` (surface ×6 zero-error + IR surface).
2. `turbo run typecheck --force --continue` (memory `feedback_typecheck_via_turbo` — `-r`
   skips `^build`). tsdown leaves need explicit `tsc --noEmit`.
3. Build ×6 (`ng-packagr`/`vue-tsc`/`svelte2tsx`/`tsdown` — leaf-level collisions surface here).
4. `turbo run test --force --continue` (cold — surface + behavior).
5. Docs build (`--max-old-space-size=6144` per memory `project_docs_build_oom`).
6. Playwright smoke + VR (Linux baselines only — memory `feedback_vr_linux_baselines`,
   `feedback_vr_macos_text_node_kerning`; regen via pinned Docker).

**No auto-push** (memory `feedback_no_autopush`) — commit atomically on `main`, stop.

## 7. Open questions (resolved by defaults, revisit if a gate objects)

- Component name `Waveform` vs `WaveSurfer` — chose `Waveform` (convention). Revisit only if
  it collides with the engine import (it won't — engine imports as `WaveSurfer`).
- `currentTime` as sole model vs adding `isPlaying`/`volume` models — chose single-model
  discipline; playback controlled via handle verbs + `play`/`pause` emits.
- No slots in v1 — controls via handle; scoped `#controls` slot is the first fast-follow.
