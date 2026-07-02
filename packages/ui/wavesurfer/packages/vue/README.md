# @rozie-ui/wavesurfer-vue

Idiomatic **vue** `Waveform` — a cross-framework audio waveform player compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [wavesurfer.js](https://wavesurfer.xyz) (v7). The playback position is two-way bound via `currentTime` (seconds). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/wavesurfer-vue
```

Peer dependencies: the `wavesurfer.js` engine (`^7`) + `vue`. Install them alongside this package. wavesurfer renders a canvas — no external CSS import is required.

## Usage

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

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `src` | `String` | `null` |  |  |
| `height` | `Number` | `128` |  |  |
| `waveColor` | `String` | `"#8a2be2"` |  |  |
| `progressColor` | `String` | `"#5a189a"` |  |  |
| `cursorColor` | `String` | `"#333333"` |  |  |
| `cursorWidth` | `Number` | `1` |  |  |
| `barWidth` | `unknown` | `null` |  |  |
| `barGap` | `unknown` | `null` |  |  |
| `barRadius` | `unknown` | `null` |  |  |
| `minPxPerSec` | `Number` | `1` |  |  |
| `volume` | `Number` | `1` |  |  |
| `playbackRate` | `Number` | `1` |  |  |
| `autoplay` | `Boolean` | `false` |  |  |
| `normalizeAmplitude` | `Boolean` | `false` |  |  |
| `hideScrollbar` | `Boolean` | `false` |  |  |
| `disableInteraction` | `Boolean` | `false` |  |  |
| `disableDragToSeek` | `Boolean` | `false` |  |  |
| `timeline` | `Boolean` | `false` |  |  |
| `hover` | `Boolean` | `false` |  |  |
| `hoverColor` | `String` | `null` |  |  |
| `options` | `Object` | `{}` |  |  |
| `currentTime` | `unknown` | `undefined` | ✓ |  |

## Events

| Event | Description |
| --- | --- |
| `ready` | |
| `playing` | |
| `paused` | |
| `finished` | |
| `timeupdate` | |
| `seeking` | |
| `interaction` | |
| `loading` | |
| `error` | |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```vue
<script setup>
import { ref } from 'vue';
const wave = ref();      // template ref
</script>

<template>
  <Waveform ref="wave" ... />
  <button @click="wave.playPause()">Play / Pause</button>
</template>
```

| Method | Description |
| --- | --- |
| `play` | Start playback. |
| `pause` | Pause playback. |
| `playPause` | Toggle between play and pause. |
| `stop` | Stop playback and return the cursor to the start. |
| `seekTo` | Seek to a relative position — `seekTo(progress)` where `progress` is `0`–`1`. |
| `setTime` | Seek to an absolute position in seconds — `setTime(seconds)`. |
| `setVolume` | Set the playback volume — `setVolume(v)` where `v` is `0`–`1`. |
| `setPlaybackRate` | Set the playback speed multiplier — `setPlaybackRate(rate)`. |
| `setZoom` | Set the zoom level in pixels-per-second — `setZoom(pxPerSec)`. |
| `load` | Load a new audio source URL — `load(url)`. |
| `isPlaying` | Return whether audio is currently playing (`boolean`). |
| `getDuration` | Return the total duration in seconds (`0` before the audio is ready). |
| `getCurrentTime` | Return the current playback position in seconds. |
| `getWaveSurfer` | Return the underlying wavesurfer instance for direct API access (the engine escape hatch). Null before mount. |
