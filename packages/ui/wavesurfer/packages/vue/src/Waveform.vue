<template>

<div class="rozie-waveform" ref="containerRef" v-bind="$attrs"></div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * The audio URL the waveform loads. Bound at construction and reconciled at runtime — changing it calls the engine `load(url)`.
     * @example
     * <Waveform :src="audioUrl" r-model:currentTime="time" />
     */
    src?: string | null;
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
    barWidth?: Record<string, any> | null;
    /**
     * The pixel gap between bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
     */
    barGap?: Record<string, any> | null;
    /**
     * The corner radius of bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
     */
    barRadius?: Record<string, any> | null;
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
    hoverColor?: string | null;
    /**
     * Raw wavesurfer `WaveSurferOptions` passthrough — spread into `WaveSurfer.create()` before the curated keys (explicit props win). Use it for any v7 option not surfaced as a first-class prop (`peaks`, `duration`, `sampleRate`, `mediaControls`, `splitChannels`, …).
     */
    options?: Record<string, any>;
  }>(),
  { src: null, height: 128, waveColor: '#8a2be2', progressColor: '#5a189a', cursorColor: '#333333', cursorWidth: 1, barWidth: null, barGap: null, barRadius: null, minPxPerSec: 1, volume: 1, playbackRate: 1, autoplay: false, normalizeAmplitude: false, hideScrollbar: false, disableInteraction: false, disableDragToSeek: false, timeline: false, hover: false, hoverColor: null, options: () => ({}) }
);

/**
 * The current playback position in seconds. The lone two-way `model: true` prop: playback writes the live position back on every `timeupdate` (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write seeks the engine via `setTime`.
 */
const currentTime = defineModel<unknown>('currentTime', { default: undefined });

const emit = defineEmits<{
  ready: [...args: any[]];
  playing: [...args: any[]];
  paused: [...args: any[]];
  finished: [...args: any[]];
  timeupdate: [...args: any[]];
  seeking: [...args: any[]];
  interaction: [...args: any[]];
  loading: [...args: any[]];
  error: [...args: any[]];
}>();

const containerRef = ref<HTMLElement>();

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
  if (props.timeline) plugins.push(TimelinePlugin.create());
  if (props.hover) plugins.push(HoverPlugin.create({
    lineColor: props.hoverColor ?? undefined
  }));
  let cfg: any = null;
  cfg = {
    ...props.options,
    container: containerRef.value,
    url: props.src ?? undefined,
    height: props.height,
    waveColor: props.waveColor,
    progressColor: props.progressColor,
    cursorColor: props.cursorColor,
    cursorWidth: props.cursorWidth,
    barWidth: props.barWidth ?? undefined,
    barGap: props.barGap ?? undefined,
    barRadius: props.barRadius ?? undefined,
    minPxPerSec: props.minPxPerSec,
    autoplay: props.autoplay,
    normalize: props.normalizeAmplitude,
    hideScrollbar: props.hideScrollbar,
    interact: !props.disableInteraction,
    dragToSeek: !props.disableDragToSeek,
    plugins: plugins
  };
  ws = WaveSurfer.create(cfg);

  // ── engine events → emits + the two-way currentTime writeback ──────────────
  ws.on('ready', (duration: any) => emit('ready', duration));
  ws.on('play', () => emit('playing'));
  ws.on('pause', () => emit('paused'));
  ws.on('finish', () => emit('finished'));
  ws.on('timeupdate', (t: any) => {
    // Echo the live position into the two-way model, then emit. The reverse
    // $watch below is value-equality-guarded, so this write does not loop.
    currentTime.value = t;
    emit('timeupdate', t);
  });
  ws.on('seeking', (t: any) => emit('seeking', t));
  ws.on('interaction', (t: any) => emit('interaction', t));
  ws.on('loading', (percent: any) => emit('loading', percent));
  ws.on('error', (err: any) => emit('error', err));
};
// ─── imperative handle (Phase 21 $expose) ────────────────────────────────────
// Collision-clear across all six targets: canonical media verbs play/pause/
// playPause kept (the emits were renamed playing/paused/finished to dodge ROZ121);
// no setCurrentTime (React model auto-setter, ROZ524 — use setTime); no Lit
// reserved lifecycle name (update/render/firstUpdated/updated/willUpdate/requestUpdate).
function play() {
  if (ws) ws.play();
}
function pause() {
  if (ws) ws.pause();
}
function playPause() {
  if (ws) ws.playPause();
}
function stop() {
  if (ws) ws.stop();
}
function seekTo(progress: any) {
  if (ws) ws.seekTo(progress);
}
function setTime(seconds: any) {
  if (ws) ws.setTime(seconds);
}
function setVolume(v: any) {
  if (ws) ws.setVolume(v);
}
function setPlaybackRate(rate: any) {
  if (ws) ws.setPlaybackRate(rate);
}
function setZoom(pxPerSec: any) {
  if (ws) ws.zoom(pxPerSec);
}
function load(url: any) {
  if (ws) ws.load(url);
}
function isPlaying() {
  return ws ? ws.isPlaying() : false;
}
function getDuration() {
  return ws ? ws.getDuration() : 0;
}
function getCurrentTime() {
  return ws ? ws.getCurrentTime() : 0;
}
function getWaveSurfer() {
  return ws;
}

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // $refs read ONLY here (ROZ123). The container is the engine's attach target.
  buildWaveSurfer();
  _cleanup_0 = () => {
    if (ws) ws.destroy();
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => props.src, (v: any) => {
  if (ws && typeof v === 'string' && v) ws.load(v);
});
watch(() => props.height, (v: any) => {
  if (ws) ws.setOptions({
    height: v
  });
});
watch(() => props.waveColor, (v: any) => {
  if (ws) ws.setOptions({
    waveColor: v
  });
});
watch(() => props.progressColor, (v: any) => {
  if (ws) ws.setOptions({
    progressColor: v
  });
});
watch(() => props.cursorColor, (v: any) => {
  if (ws) ws.setOptions({
    cursorColor: v
  });
});
watch(() => props.cursorWidth, (v: any) => {
  if (ws) ws.setOptions({
    cursorWidth: v
  });
});
watch(() => props.barWidth, (v: any) => {
  if (ws) ws.setOptions({
    barWidth: v ?? undefined
  });
});
watch(() => props.barGap, (v: any) => {
  if (ws) ws.setOptions({
    barGap: v ?? undefined
  });
});
watch(() => props.barRadius, (v: any) => {
  if (ws) ws.setOptions({
    barRadius: v ?? undefined
  });
});
watch(() => props.normalizeAmplitude, (v: any) => {
  if (ws) ws.setOptions({
    normalize: v
  });
});
watch(() => props.volume, (v: any) => {
  if (ws && typeof v === 'number') ws.setVolume(v);
});
watch(() => props.playbackRate, (v: any) => {
  if (ws && typeof v === 'number') ws.setPlaybackRate(v);
});
watch(() => props.minPxPerSec, (v: any) => {
  if (ws && typeof v === 'number' && v > 0) ws.zoom(v);
});
watch(() => currentTime.value, (v: any) => {
  // Round-trip guard: skip if the incoming value already matches the engine
  // position (the timeupdate → $model → $watch echo), else seek.
  if (!ws || typeof v !== 'number') return;
  if (Math.abs(v - ws.getCurrentTime()) < 0.05) return;
  ws.setTime(v);
});

defineExpose({ play, pause, playPause, stop, seekTo, setTime, setVolume, setPlaybackRate, setZoom, load, isPlaying, getDuration, getCurrentTime, getWaveSurfer });
</script>

<style scoped>
.rozie-waveform {
  width: 100%;
}
</style>
