# Waveform — the cross-framework audio waveform player

[wavesurfer.js](https://wavesurfer.xyz) is the de-facto vanilla-JS audio-waveform engine (2D canvas + Web Audio). But its framework wrappers are **lopsided**: React has the official [`@wavesurfer/react`](https://www.npmjs.com/package/@wavesurfer/react); Angular, Svelte, Solid and Lit have thin, stale, or absent wrappers. That gap (React served, the rest stranded) is exactly what Rozie's write-once-ship-six thesis exists to close.

One `Waveform.rozie` source compiles to six idiomatic packages — so Angular, Svelte, Solid and Lit consumers get a category-leading waveform player for free, with the same props, events, two-way playback position, two-way interactive regions, and imperative handle as the React one.

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

::: tip Scope — Core + Timeline + Hover + Regions
This family ships the core waveform + full playback, the two **stateless** plugins (the [Timeline](https://wavesurfer.xyz/docs/classes/plugins_timeline.TimelinePlugin) ruler and [Hover](https://wavesurfer.xyz/docs/classes/plugins_hover.HoverPlugin) cursor), and the interactive [**Regions**](https://wavesurfer.xyz/docs/classes/plugins_regions.RegionsPlugin) plugin — draggable, resizable selections with a two-way `regions` binding. Register a plugin by opting in (`timeline` / `hover`) or by passing a `regions` array.
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

## Regions

Regions are draggable, resizable selections over the waveform. Pass a `regions` array (even empty) to register the plugin; bind it two-way to keep your state in sync as the user creates, drags, resizes, and removes them. Turn on `dragToCreateRegions` to let users draw new regions on empty space.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Waveform from '@rozie-ui/wavesurfer-vue';

const regions = ref([
  { id: 'intro', start: 0, end: 2, color: 'rgba(138,43,226,0.2)' },
  { id: 'chorus', start: 4, end: 6, color: 'rgba(90,24,154,0.25)' },
]);
</script>

<template>
  <Waveform
    src="/audio.mp3"
    v-model:regions="regions"
    :drag-to-create-regions="true"
    region-color="rgba(138,43,226,0.2)"
    @region-created="(r) => console.log('created', r.id)"
    @region-updated="(r) => console.log('moved', r.id, r.start, r.end)"
    @region-removed="(r) => console.log('removed', r.id)"
  />
</template>
```

Or manage regions imperatively through the handle — `addRegion(...)`, `clearRegions()`, `getRegions()` — and listen for the `regionCreated` / `regionUpdated` / `regionClicked` / `regionRemoved` events.

### Following playback through regions

`regionIn` / `regionOut` fire as playback crosses a region's boundaries — the events behind active-segment highlighting, transcript/karaoke sync, and loop-a-region. Together with `getWaveSurfer()` (the engine escape hatch) they make a region loop trivial:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Waveform from '@rozie-ui/wavesurfer-vue';

const wave = ref();
const regions = ref([{ id: 'loop', start: 2, end: 4, color: 'rgba(45,212,191,0.25)' }]);
const activeId = ref<string | null>(null);
const loop = ref(true);

// Track the active segment on enter; seek back to its start on exit → seamless loop.
const onIn = (r: { id: string }) => (activeId.value = r.id);
const onOut = (r: { id: string; start: number }) => {
  activeId.value = null;
  if (loop.value && r.id === 'loop') wave.value?.setTime(r.start);
};
</script>

<template>
  <Waveform
    ref="wave"
    src="/audio.mp3"
    v-model:regions="regions"
    @region-in="onIn"
    @region-out="onOut"
  />
  <p>Now playing: {{ activeId ?? '—' }}</p>
</template>
```

## Reference

### Props

There are two **two-way** model props — `currentTime` and `regions` (bind either with `r-model` / `v-model` / `bind:` / `[(…)]` / `onCurrentTimeChange` / `onRegionsChange`). The appearance and playback props reconcile into the live engine on change (`src` via `load`, colors/bars via `setOptions`, `volume` / `playbackRate` / `minPxPerSec` via their setters). Plugin *presence* is also live — `timeline` and `hover` register/unregister on the running engine, and the Regions plugin registers as soon as `regions` becomes an array (at construction or lazily after mount) — see [Plugin presence is live](#plugin-presence-is-live). A handful are still **set at construction (or at plugin-creation time)** — `autoplay`, `hideScrollbar`, `disableInteraction`, `disableDragToSeek`, and `hoverColor` / `dragToCreateRegions` / `regionColor` (read only when their plugin is (re-)created); anything not surfaced here can be passed through the `options` bag (`peaks`, `duration`, `sampleRate`, `mediaControls`, …).

| Name | Type | Default | Two-way (model) | Runtime-updatable? | Description |
| --- | --- | --- | :---: | :---: | --- |
| `src` | `String` | `null` | | ✓ | The audio URL the waveform loads. Changing it calls `load(url)`. |
| `peaks` | `unknown` | `undefined` | | | Pre-computed waveform peaks (array of channel sample arrays, or a single `number[]`) — render without downloading/decoding audio; pair with `duration`. **Construction-only.** |
| `duration` | `Number` | `null` | | | Audio duration in seconds — required alongside `peaks` when there's no decodable `src`. **Construction-only.** |
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
| `timeline` | `Boolean` | `false` | | ✓ | Render a time-ruler beneath the waveform (Timeline plugin). Live-toggleable — registers/unregisters on the running engine, no remount. |
| `hover` | `Boolean` | `false` | | ✓ | Show a hover cursor + time label (Hover plugin). Live-toggleable — registers/unregisters on the running engine, no remount. |
| `hoverColor` | `String` | `null` | | | Line color of the Hover cursor (only when `hover` is on). Read/applied when the Hover plugin is (re-)created — not live on an already-registered instance. |
| `regions` | `unknown` | `undefined` | ✓ | ✓ | Interactive regions — an array of `{ id?, start, end?, content?, color?, drag?, resize? }`. Providing an array (even `[]`) registers the Regions plugin — at construction if it's already an array, or lazily the first time `regions` transitions from `null`/`undefined` to an array. Two-way: user create/drag/resize/remove writes the array back (round-trip-guarded); a consumer write reconciles the live regions by `id`. |
| `dragToCreateRegions` | `Boolean` | `false` | | | Allow drawing new regions by dragging empty waveform space. Requires `regions` to be an array. Read/applied when the Regions plugin is (re-)created — not live on an already-registered instance. |
| `regionColor` | `String` | `null` | | | Default fill color for drag-created regions (only when `dragToCreateRegions` is on). Read/applied when the Regions plugin is (re-)created — not live on an already-registered instance. |
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
| `regionCreated` | `region` | A region is created (by drag or `addRegion`). |
| `regionUpdated` | `region` | A region finishes being dragged or resized. |
| `regionClicked` | `region` | A region is clicked. |
| `regionRemoved` | `region` | A region is removed. |
| `regionIn` | `region` | Playback enters a region (for active-segment highlighting / transcript sync). |
| `regionOut` | `region` | Playback leaves a region. |

> Region-event payloads are the serialized descriptor `{ id, start, end, color, content, drag, resize }`. Programmatic region changes made through a controlled `regions` update do **not** re-emit these — only genuine user gestures do.

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
| `addRegion(opts)` | Add a region — `{ start, end?, id?, content?, color?, drag?, resize? }`. Returns the created region. |
| `clearRegions()` | Remove all regions. |
| `getRegions()` | The live engine region objects. |

## Gotchas

### `normalizeAmplitude`, not `normalize`

wavesurfer's option is `normalize`, but a reactive property named `normalize` would shadow the inherited `Node.prototype.normalize()` DOM method on the Lit custom element (a hard type error). The prop is therefore named **`normalizeAmplitude`** across all six frameworks and mapped to the engine's `normalize` option internally.

### Plugin presence is live

`timeline` / `hover` / the Regions plugin all toggle presence **live**, via wavesurfer.js's `registerPlugin` / `unregisterPlugin` on the running engine — no remount. Flip `timeline`/`hover` on or off any time; the corresponding plugin instance is created/registered or unregistered/torn down in place. The Regions plugin registers as soon as `regions` becomes an array — at construction if it's already an array, or lazily (still no remount) the first time it transitions from `null`/`undefined` to an array later. There is **no live *un*register path for `regions`** — once the Regions plugin is registered, setting `regions` back to `null` does not tear it down. `hoverColor` / `dragToCreateRegions` / `regionColor` are read only when their plugin is (re-)created, not live on an already-registered instance.

### Give controlled regions stable ids

When you drive `regions` as a controlled list, include a stable `id` on each descriptor so reconciliation can match update-vs-add. Regions you add without an id get one assigned by the engine, and — because the binding is two-way — that id is written back into your bound array. If you hold an id-less array and never consume the writeback, a changing array reference can re-add the same region.

### Offline / deterministic rendering

To render a waveform without decoding audio (CI, tests, SSR-adjacent), pass a pre-computed peaks array and a duration — no `src` needed:

```ts
<Waveform :peaks="[/* -1..1 samples */]" :duration="8" />
```
