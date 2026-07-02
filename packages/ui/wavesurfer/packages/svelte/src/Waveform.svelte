<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount, untrack } from 'svelte';

interface Props {
  /**
   * The audio URL the waveform loads. Bound at construction and reconciled at runtime — changing it calls the engine `load(url)`.
   * @example
   * <Waveform :src="audioUrl" r-model:currentTime="time" />
   */
  src?: (string) | null;
  /**
   * The waveform height in pixels. Reconciled at runtime via `setOptions`.
   */
  height?: number;
  /**
   * The color of the unplayed portion of the waveform. Reconciled at runtime via `setOptions`.
   */
  waveColor?: string;
  /**
   * The color of the played (progress) portion of the waveform. Reconciled at runtime via `setOptions`.
   */
  progressColor?: string;
  /**
   * The color of the playback cursor. Reconciled at runtime via `setOptions`.
   */
  cursorColor?: string;
  /**
   * The width of the playback cursor in pixels. Reconciled at runtime via `setOptions`.
   */
  cursorWidth?: number;
  /**
   * Draw the waveform as bars of this pixel width. `null` (default) renders a continuous waveform. Reconciled at runtime via `setOptions`.
   */
  barWidth?: (unknown) | null;
  /**
   * The pixel gap between bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
   */
  barGap?: (unknown) | null;
  /**
   * The corner radius of bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
   */
  barRadius?: (unknown) | null;
  /**
   * The minimum pixels-per-second zoom level. Reconciled at runtime via `zoom`.
   */
  minPxPerSec?: number;
  /**
   * Playback volume (`0`–`1`). Reconciled at runtime via `setVolume`.
   */
  volume?: number;
  /**
   * Playback speed multiplier. Reconciled at runtime via `setPlaybackRate`.
   */
  playbackRate?: number;
  /**
   * Begin playback as soon as the audio is ready. Construction-only.
   */
  autoplay?: boolean;
  /**
   * Normalize the waveform by its largest peak (wavesurfer's `normalize` option). Reconciled at runtime via `setOptions`.
   */
  normalizeAmplitude?: boolean;
  /**
   * Hide the horizontal scrollbar when the waveform is zoomed wider than its container. Construction-only.
   */
  hideScrollbar?: boolean;
  /**
   * Disable click/seek interaction with the waveform (the engine defaults to interactive). Construction-only.
   */
  disableInteraction?: boolean;
  /**
   * Disable drag-to-seek across the waveform (the engine defaults to drag-seekable). Construction-only.
   */
  disableDragToSeek?: boolean;
  /**
   * Render a time-ruler beneath the waveform (the wavesurfer Timeline plugin). Construction-only in v1 — toggling after mount is a no-op.
   */
  timeline?: boolean;
  /**
   * Show a hover cursor with a time label as the pointer moves over the waveform (the wavesurfer Hover plugin). Construction-only in v1 — toggling after mount is a no-op.
   */
  hover?: boolean;
  /**
   * The line color of the Hover plugin cursor (only applies when `hover` is enabled). Construction-only in v1.
   */
  hoverColor?: (string) | null;
  /**
   * Raw wavesurfer `WaveSurferOptions` passthrough — spread into `WaveSurfer.create()` before the curated keys (explicit props win). Use it for any v7 option not surfaced as a first-class prop (`peaks`, `duration`, `sampleRate`, `mediaControls`, `splitChannels`, …).
   */
  options?: any;
  /**
   * The current playback position in seconds. The lone two-way `model: true` prop: playback writes the live position back on every `timeupdate` (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write seeks the engine via `setTime`.
   */
  currentTime?: unknown;
  onready?: (...args: unknown[]) => void;
  onplaying?: (...args: unknown[]) => void;
  onpaused?: (...args: unknown[]) => void;
  onfinished?: (...args: unknown[]) => void;
  ontimeupdate?: (...args: unknown[]) => void;
  onseeking?: (...args: unknown[]) => void;
  oninteraction?: (...args: unknown[]) => void;
  onloading?: (...args: unknown[]) => void;
  onerror?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultOptions = (() => ({}))();

let {
  src = null,
  height = 128,
  waveColor = '#8a2be2',
  progressColor = '#5a189a',
  cursorColor = '#333333',
  cursorWidth = 1,
  barWidth = null,
  barGap = null,
  barRadius = null,
  minPxPerSec = 1,
  volume = 1,
  playbackRate = 1,
  autoplay = false,
  normalizeAmplitude = false,
  hideScrollbar = false,
  disableInteraction = false,
  disableDragToSeek = false,
  timeline = false,
  hover = false,
  hoverColor = null,
  options = __defaultOptions,
  currentTime = $bindable(undefined),
  onready,
  onplaying,
  onpaused,
  onfinished,
  ontimeupdate,
  onseeking,
  oninteraction,
  onloading,
  onerror,
  ...__rozieAttrs
}: Props = $props();

let container = $state<HTMLElement | undefined>(undefined);

// Default import is `WaveSurfer` (≠ the component name `Waveform`, so no import⇄
// component collision — Cropper had to alias; we don't). Plugin factories are
// separate v7 entry points.
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/plugins/timeline';
import HoverPlugin from 'wavesurfer.js/plugins/hover';

// null-let so the bundled-leaf typeNeutralize pass annotates it `any`: the engine's
// strict WaveSurferOptions/return types don't match the loosely-typed .rozie props,
// and (per the engine-wrapper recipe) `ws` must be TOP-LEVEL — the Solid emitter
// splits $onMount into onMount(...) + onCleanup(...), so a mount-local `let` would
// be out of scope in teardown (TS2304).
// null-let so the bundled-leaf typeNeutralize pass annotates it `any`: the engine's
// strict WaveSurferOptions/return types don't match the loosely-typed .rozie props,
// and (per the engine-wrapper recipe) `ws` must be TOP-LEVEL — the Solid emitter
// splits $onMount into onMount(...) + onCleanup(...), so a mount-local `let` would
// be out of scope in teardown (TS2304).
let ws: any = null;

// Build the engine. The whole config object is untyped (ws is `any`) so the
// constructor's options + event-callback params are unchecked against wavesurfer's
// strict types (the Cropper buildCropper idiom).
// Build the engine. The whole config object is untyped (ws is `any`) so the
// constructor's options + event-callback params are unchecked against wavesurfer's
// strict types (the Cropper buildCropper idiom).
const buildWaveSurfer = () => {
  let plugins = [];
  plugins = [];
  if (timeline) plugins.push(TimelinePlugin.create());
  if (hover) plugins.push(HoverPlugin.create({
    lineColor: hoverColor ?? undefined
  }));
  let cfg: any = null;
  cfg = {
    ...$state.snapshot(options),
    container: container,
    url: src ?? undefined,
    height: height,
    waveColor: waveColor,
    progressColor: progressColor,
    cursorColor: cursorColor,
    cursorWidth: cursorWidth,
    barWidth: barWidth ?? undefined,
    barGap: barGap ?? undefined,
    barRadius: barRadius ?? undefined,
    minPxPerSec: minPxPerSec,
    autoplay: autoplay,
    normalize: normalizeAmplitude,
    hideScrollbar: hideScrollbar,
    interact: !disableInteraction,
    dragToSeek: !disableDragToSeek,
    plugins: plugins
  };
  ws = WaveSurfer.create(cfg);

  // ── engine events → emits + the two-way currentTime writeback ──────────────
  ws.on('ready', (duration: any) => onready?.(duration));
  ws.on('play', () => onplaying?.());
  ws.on('pause', () => onpaused?.());
  ws.on('finish', () => onfinished?.());
  ws.on('timeupdate', (t: any) => {
    // Echo the live position into the two-way model, then emit. The reverse
    // $watch below is value-equality-guarded, so this write does not loop.
    currentTime = t;
    ontimeupdate?.(t);
  });
  ws.on('seeking', (t: any) => onseeking?.(t));
  ws.on('interaction', (t: any) => oninteraction?.(t));
  ws.on('loading', (percent: any) => onloading?.(percent));
  ws.on('error', (err: any) => onerror?.(err));
};
// ─── imperative handle (Phase 21 $expose) ────────────────────────────────────
// Collision-clear across all six targets: canonical media verbs play/pause/
// playPause kept (the emits were renamed playing/paused/finished to dodge ROZ121);
// no setCurrentTime (React model auto-setter, ROZ524 — use setTime); no Lit
// reserved lifecycle name (update/render/firstUpdated/updated/willUpdate/requestUpdate).
export function play() {
  if (ws) ws.play();
}
export function pause() {
  if (ws) ws.pause();
}
export function playPause() {
  if (ws) ws.playPause();
}
export function stop() {
  if (ws) ws.stop();
}
export function seekTo(progress: any) {
  if (ws) ws.seekTo(progress);
}
export function setTime(seconds: any) {
  if (ws) ws.setTime(seconds);
}
export function setVolume(v: any) {
  if (ws) ws.setVolume(v);
}
export function setPlaybackRate(rate: any) {
  if (ws) ws.setPlaybackRate(rate);
}
export function setZoom(pxPerSec: any) {
  if (ws) ws.zoom(pxPerSec);
}
export function load(url: any) {
  if (ws) ws.load(url);
}
export function isPlaying() {
  return ws ? ws.isPlaying() : false;
}
export function getDuration() {
  return ws ? ws.getDuration() : 0;
}
export function getCurrentTime() {
  return ws ? ws.getCurrentTime() : 0;
}
export function getWaveSurfer() {
  return ws;
}

onMount(() => {
  // $refs read ONLY here (ROZ123). The container is the engine's attach target.
  buildWaveSurfer();
  return () => {
    if (ws) ws.destroy();
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => src)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => {
  if (ws && typeof v === 'string' && v) ws.load(v);
})(__watchVal); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { const __watchVal = (() => height)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } ((v: any) => {
  if (ws) ws.setOptions({
    height: v
  });
})(__watchVal); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { const __watchVal = (() => waveColor)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } ((v: any) => {
  if (ws) ws.setOptions({
    waveColor: v
  });
})(__watchVal); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { const __watchVal = (() => progressColor)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } ((v: any) => {
  if (ws) ws.setOptions({
    progressColor: v
  });
})(__watchVal); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { const __watchVal = (() => cursorColor)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } ((v: any) => {
  if (ws) ws.setOptions({
    cursorColor: v
  });
})(__watchVal); }); });
let __rozieWatchInitial_5 = true;
$effect(() => { const __watchVal = (() => cursorWidth)(); untrack(() => { if (__rozieWatchInitial_5) { __rozieWatchInitial_5 = false; return; } ((v: any) => {
  if (ws) ws.setOptions({
    cursorWidth: v
  });
})(__watchVal); }); });
let __rozieWatchInitial_6 = true;
$effect(() => { const __watchVal = (() => barWidth)(); untrack(() => { if (__rozieWatchInitial_6) { __rozieWatchInitial_6 = false; return; } ((v: any) => {
  if (ws) ws.setOptions({
    barWidth: v ?? undefined
  });
})(__watchVal); }); });
let __rozieWatchInitial_7 = true;
$effect(() => { const __watchVal = (() => barGap)(); untrack(() => { if (__rozieWatchInitial_7) { __rozieWatchInitial_7 = false; return; } ((v: any) => {
  if (ws) ws.setOptions({
    barGap: v ?? undefined
  });
})(__watchVal); }); });
let __rozieWatchInitial_8 = true;
$effect(() => { const __watchVal = (() => barRadius)(); untrack(() => { if (__rozieWatchInitial_8) { __rozieWatchInitial_8 = false; return; } ((v: any) => {
  if (ws) ws.setOptions({
    barRadius: v ?? undefined
  });
})(__watchVal); }); });
let __rozieWatchInitial_9 = true;
$effect(() => { const __watchVal = (() => normalizeAmplitude)(); untrack(() => { if (__rozieWatchInitial_9) { __rozieWatchInitial_9 = false; return; } ((v: any) => {
  if (ws) ws.setOptions({
    normalize: v
  });
})(__watchVal); }); });
let __rozieWatchInitial_10 = true;
$effect(() => { const __watchVal = (() => volume)(); untrack(() => { if (__rozieWatchInitial_10) { __rozieWatchInitial_10 = false; return; } ((v: any) => {
  if (ws && typeof v === 'number') ws.setVolume(v);
})(__watchVal); }); });
let __rozieWatchInitial_11 = true;
$effect(() => { const __watchVal = (() => playbackRate)(); untrack(() => { if (__rozieWatchInitial_11) { __rozieWatchInitial_11 = false; return; } ((v: any) => {
  if (ws && typeof v === 'number') ws.setPlaybackRate(v);
})(__watchVal); }); });
let __rozieWatchInitial_12 = true;
$effect(() => { const __watchVal = (() => minPxPerSec)(); untrack(() => { if (__rozieWatchInitial_12) { __rozieWatchInitial_12 = false; return; } ((v: any) => {
  if (ws && typeof v === 'number' && v > 0) ws.zoom(v);
})(__watchVal); }); });
let __rozieWatchInitial_13 = true;
$effect(() => { const __watchVal = (() => currentTime)(); untrack(() => { if (__rozieWatchInitial_13) { __rozieWatchInitial_13 = false; return; } ((v: any) => {
  // Round-trip guard: skip if the incoming value already matches the engine
  // position (the timeupdate → $model → $watch echo), else seek.
  if (!ws || typeof v !== 'number') return;
  if (Math.abs(v - ws.getCurrentTime()) < 0.05) return;
  ws.setTime(v);
})(__watchVal); }); });
</script>

<div bind:this={container} {...__rozieAttrs} class={["rozie-waveform", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-0b6fbb3a></div>

<style>
:global {
  .rozie-waveform[data-rozie-s-0b6fbb3a] {
    width: 100%;
  }
}
</style>
