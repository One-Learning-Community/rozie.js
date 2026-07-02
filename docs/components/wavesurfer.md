# Waveform — the cross-framework audio waveform player

[wavesurfer.js](https://wavesurfer.xyz) is the de-facto vanilla-JS audio-waveform engine (2D canvas + Web Audio). But its framework wrappers are **lopsided**: React has the official [`@wavesurfer/react`](https://www.npmjs.com/package/@wavesurfer/react); Angular, Svelte, Solid and Lit have thin, stale, or absent wrappers. That gap (React served, the rest stranded) is exactly what Rozie's write-once-ship-six thesis exists to close.

One `Waveform.rozie` source compiles to six idiomatic packages — so Angular, Svelte, Solid and Lit consumers get a category-leading waveform player for free, with the same props, events, two-way playback position, and imperative handle as the React one.

## The `@rozie-ui/wavesurfer` packages

| Package | Framework | Ships |
| --- | --- | --- |
| `@rozie-ui/wavesurfer-react` | React 18+ | compiled `.tsx` + types |
| `@rozie-ui/wavesurfer-vue` | Vue 3.4+ | `.vue` SFC source + compiled drop-in |
| `@rozie-ui/wavesurfer-svelte` | Svelte 5+ | `.svelte` source |
| `@rozie-ui/wavesurfer-angular` | Angular 19+ | standalone component |
| `@rozie-ui/wavesurfer-solid` | Solid 1.8+ | compiled `.tsx` + types |
| `@rozie-ui/wavesurfer-lit` | Lit 3+ | compiled custom element + types |

All six wrap **wavesurfer.js v7** (`wavesurfer.js@^7`), declared as a peer dependency. wavesurfer renders a canvas — **no external CSS import is required** (unlike engines whose UI is styled DOM).

::: tip v1 scope — Core + Timeline + Hover
This family ships the core waveform + full playback plus the two **stateless** plugins (the [Timeline](https://wavesurfer.xyz/docs/classes/plugins_timeline.TimelinePlugin) ruler and [Hover](https://wavesurfer.xyz/docs/classes/plugins_hover.HoverPlugin) cursor), opt-in via the `timeline` / `hover` props. Interactive **Regions** — draggable, resizable selections — are the natural next phase.
:::

## Quick start

The playback position is **two-way bound** through a single `currentTime` model prop (seconds). Playback writes the live position back on every `timeupdate` (round-trip-guarded so a programmatic seek doesn't ping-pong); a consumer write seeks the engine. The audio comes through `src`; playback lifecycle fires as native framework events.

### React

```tsx
import { useState } from 'react';
import { Waveform } from '@rozie-ui/wavesurfer-react';

export function Demo() {
  const [time, setTime] = useState(0);
  return (
    <Waveform
      src="/audio.mp3"
      currentTime={time}
      onCurrentTimeChange={setTime}
      timeline
      hover
      onReady={(d) => console.log('duration', d)}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Waveform from '@rozie-ui/wavesurfer-vue';

const time = ref(0);
</script>

<template>
  <Waveform
    src="/audio.mp3"
    v-model:currentTime="time"
    :timeline="true"
    :hover="true"
    @ready="(d) => console.log('duration', d)"
  />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import Waveform from '@rozie-ui/wavesurfer-svelte';

  let time = $state(0);
</script>

<Waveform
  src="/audio.mp3"
  bind:currentTime={time}
  timeline
  hover
  onready={(d) => console.log('duration', d)}
/>
```

### Angular

```ts
import { Component } from '@angular/core';
import { Waveform } from '@rozie-ui/wavesurfer-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Waveform],
  template: `
    <Waveform
      src="/audio.mp3"
      [(currentTime)]="time"
      [timeline]="true"
      [hover]="true"
      (ready)="onReady($event)"
    />
  `,
})
export class DemoComponent {
  time = 0;
  onReady(d: any) { console.log('duration', d); }
}
```

### Solid

```tsx
import { createSignal } from 'solid-js';
import { Waveform } from '@rozie-ui/wavesurfer-solid';

export function Demo() {
  const [time, setTime] = createSignal(0);
  return (
    <Waveform
      src="/audio.mp3"
      currentTime={time()}
      onCurrentTimeChange={setTime}
      timeline
      hover
      onReady={(d) => console.log('duration', d)}
    />
  );
}
```

### Lit

```ts
import '@rozie-ui/wavesurfer-lit';

// <rozie-waveform> is a custom element. Bind `src`/`currentTime` as properties
// and listen for `currentTime-change` (the two-way channel) + `ready`.
const el = document.querySelector('rozie-waveform');
el.src = '/audio.mp3';
el.timeline = true;
el.addEventListener('currentTime-change', (e) => { el.currentTime = e.detail; });
el.addEventListener('ready', (e) => console.log('duration', e.detail));
```

## Reference

### Props

`currentTime` is the lone **two-way** model prop (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onCurrentTimeChange`). The appearance and playback props reconcile into the live engine on change (`src` via `load`, colors/bars via `setOptions`, `volume` / `playbackRate` / `minPxPerSec` via their setters). A handful are **set at construction** — `autoplay`, `hideScrollbar`, `disableInteraction`, `disableDragToSeek`, and the two plugin toggles (`timeline` / `hover` / `hoverColor`); anything not surfaced here can be passed through the `options` bag (`peaks`, `duration`, `sampleRate`, `mediaControls`, …).

| Name | Type | Default | Two-way (model) | Runtime-updatable? | Description |
| --- | --- | --- | :---: | :---: | --- |
| `src` | `String` | `null` | | ✓ | The audio URL the waveform loads. Changing it calls `load(url)`. |
| `height` | `Number` | `128` | | ✓ | The waveform height in pixels. Reconciled via `setOptions`. |
| `waveColor` | `String` | `"#8a2be2"` | | ✓ | Color of the unplayed portion of the waveform. Reconciled via `setOptions`. |
| `progressColor` | `String` | `"#5a189a"` | | ✓ | Color of the played (progress) portion. Reconciled via `setOptions`. |
| `cursorColor` | `String` | `"#333333"` | | ✓ | Color of the playback cursor. Reconciled via `setOptions`. |
| `cursorWidth` | `Number` | `1` | | ✓ | Width of the playback cursor in pixels. Reconciled via `setOptions`. |
| `barWidth` | `unknown` | `null` | | ✓ | Draw the waveform as bars of this pixel width. `null` = continuous. Reconciled via `setOptions`. |
| `barGap` | `unknown` | `null` | | ✓ | Pixel gap between bars (when `barWidth` is set). Reconciled via `setOptions`. |
| `barRadius` | `unknown` | `null` | | ✓ | Corner radius of bars (when `barWidth` is set). Reconciled via `setOptions`. |
| `minPxPerSec` | `Number` | `1` | | ✓ | Minimum pixels-per-second zoom level. Reconciled via `zoom`. |
| `volume` | `Number` | `1` | | ✓ | Playback volume (`0`–`1`). Reconciled via `setVolume`. |
| `playbackRate` | `Number` | `1` | | ✓ | Playback speed multiplier. Reconciled via `setPlaybackRate`. |
| `autoplay` | `Boolean` | `false` | | | Begin playback as soon as the audio is ready. **Construction-only.** |
| `normalizeAmplitude` | `Boolean` | `false` | | ✓ | Normalize the waveform by its largest peak (wavesurfer's `normalize` option). Reconciled via `setOptions`. Named `normalizeAmplitude` to avoid the inherited `Node.normalize()` DOM-method collision on the Lit custom element. |
| `hideScrollbar` | `Boolean` | `false` | | | Hide the horizontal scrollbar when zoomed wider than the container. **Construction-only.** |
| `disableInteraction` | `Boolean` | `false` | | | Disable click/seek interaction (the engine defaults to interactive). **Construction-only.** |
| `disableDragToSeek` | `Boolean` | `false` | | | Disable drag-to-seek across the waveform. **Construction-only.** |
| `timeline` | `Boolean` | `false` | | | Render a time-ruler beneath the waveform (Timeline plugin). **Construction-only** in v1. |
| `hover` | `Boolean` | `false` | | | Show a hover cursor + time label (Hover plugin). **Construction-only** in v1. |
| `hoverColor` | `String` | `null` | | | Line color of the Hover cursor (only when `hover` is on). **Construction-only** in v1. |
| `options` | `Object` | `{}` | | | Raw [wavesurfer `WaveSurferOptions`](https://wavesurfer.xyz/docs/types/wavesurfer.WaveSurferOptions) passthrough — spread into `WaveSurfer.create()` **before** the curated keys (explicit props win). Use for `peaks`, `duration`, `sampleRate`, `mediaControls`, `splitChannels`, … |
| `currentTime` | `unknown` | `undefined` | ✓ | ✓ | The current playback position in seconds. Two-way: playback writes it back on every `timeupdate` (round-trip-guarded); a consumer write seeks via `setTime`. |

### Events

| Event | Payload | Fires when |
| --- | --- | --- |
| `ready` | `duration` | The audio is decoded and the waveform is ready. |
| `playing` | — | Playback starts (the engine `play` event). |
| `paused` | — | Playback pauses (the engine `pause` event). |
| `finished` | — | Playback reaches the end (the engine `finish` event). |
| `timeupdate` | `currentTime` | The playback position advances. Also drives the two-way `currentTime` model. |
| `seeking` | `currentTime` | The user seeks the waveform. |
| `interaction` | `newTime` | The user clicks/interacts with the waveform. |
| `loading` | `percent` | Audio download progresses (`0`–`100`). |
| `error` | `error` | The audio fails to load or decode. |

> The engine's own `play` / `pause` / `finish` events are surfaced as `playing` / `paused` / `finished` so they don't collide with the `play()` / `pause()` imperative verbs (Rozie forbids an `$expose` verb sharing a name with an emit).

### Imperative handle

Grab a handle via your framework's native ref mechanism (`useRef` / template ref / `bind:this` / `@ViewChild` / `ref` callback / the custom element itself) and call:

| Method | Description |
| --- | --- |
| `play()` | Start playback. |
| `pause()` | Pause playback. |
| `playPause()` | Toggle play/pause. |
| `stop()` | Stop and return the cursor to the start. |
| `seekTo(progress)` | Seek to a relative position (`0`–`1`). |
| `setTime(seconds)` | Seek to an absolute position in seconds. |
| `setVolume(v)` | Set volume (`0`–`1`). |
| `setPlaybackRate(rate)` | Set the playback speed multiplier. |
| `setZoom(pxPerSec)` | Set the zoom level in pixels-per-second. |
| `load(url)` | Load a new audio source URL. |
| `isPlaying()` | Whether audio is currently playing. |
| `getDuration()` | Total duration in seconds. |
| `getCurrentTime()` | Current playback position in seconds. |
| `getWaveSurfer()` | The underlying wavesurfer instance (the engine escape hatch). |

## Gotchas

### `normalizeAmplitude`, not `normalize`

wavesurfer's option is `normalize`, but a reactive property named `normalize` would shadow the inherited `Node.prototype.normalize()` DOM method on the Lit custom element (a hard type error). The prop is therefore named **`normalizeAmplitude`** across all six frameworks and mapped to the engine's `normalize` option internally.

### Plugins are construction-time (v1)

`timeline` / `hover` are read once when the engine is created. Toggling them after mount is a no-op in v1 — pass the desired value at first render. (Live toggling would re-create the engine; it's a planned follow-up.)

### Offline / deterministic rendering

To render a waveform without decoding audio (CI, tests, SSR-adjacent), pass a pre-computed peaks array and a duration through `options`:

```ts
<Waveform :options="{ peaks: [/* -1..1 samples */], duration: 8 }" src="/audio.mp3" />
```
