# @rozie-ui/wavesurfer-angular

Idiomatic **angular** `Waveform` — a cross-framework audio waveform player compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [wavesurfer.js](https://wavesurfer.xyz) (v7). The playback position is two-way bound via `currentTime` (seconds). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/wavesurfer-angular
```

Peer dependencies: the `wavesurfer.js` engine (`^7`) + `@angular/core + @angular/common`. Install them alongside this package. wavesurfer renders a canvas — no external CSS import is required.

## Usage

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

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `src` | `String` | `null` |  |  |
| `peaks` | `unknown` | `undefined` |  |  |
| `duration` | `Number` | `null` |  |  |
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
| `regions` | `unknown` | `undefined` | ✓ |  |
| `dragToCreateRegions` | `Boolean` | `false` |  |  |
| `regionColor` | `String` | `null` |  |  |
| `options` | `Object` | `{}` |  |  |
| `currentTime` | `unknown` | `undefined` | ✓ |  |

## Events

| Event | Description |
| --- | --- |
| `regionCreated` | |
| `regionUpdated` | |
| `regionRemoved` | |
| `regionClicked` | |
| `regionIn` | |
| `regionOut` | |
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

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Waveform) wave!: Waveform;  // or the viewChild() signal
  toggle() { this.wave.playPause(); }
  duration() { return this.wave.getDuration(); }
}
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
| `addRegion` | Add a region imperatively — `addRegion({ start, end?, id?, content?, color?, drag?, resize? })`. Returns the created engine Region. Requires the `regions` array to have registered the plugin. Null when regions are disabled. |
| `clearRegions` | Remove all regions. |
| `getRegions` | Return the live engine Region objects (empty array when regions are disabled). |
