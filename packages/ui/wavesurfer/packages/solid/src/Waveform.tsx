import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
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

__rozieInjectStyle('Waveform-0b6fbb3a', `.rozie-waveform[data-rozie-s-0b6fbb3a] {
  width: 100%;
}`);

interface WaveformProps {
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
  options?: Record<string, any>;
  /**
   * The current playback position in seconds. The lone two-way `model: true` prop: playback writes the live position back on every `timeupdate` (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write seeks the engine via `setTime`.
   */
  currentTime?: unknown;
  defaultCurrentTime?: unknown;
  onCurrentTimeChange?: (currentTime: unknown) => void;
  onReady?: (...args: unknown[]) => void;
  onPlaying?: (...args: unknown[]) => void;
  onPaused?: (...args: unknown[]) => void;
  onFinished?: (...args: unknown[]) => void;
  onTimeupdate?: (...args: unknown[]) => void;
  onSeeking?: (...args: unknown[]) => void;
  onInteraction?: (...args: unknown[]) => void;
  onLoading?: (...args: unknown[]) => void;
  onError?: (...args: unknown[]) => void;
  ref?: (h: WaveformHandle) => void;
}

export interface WaveformHandle {
  play: (...args: any[]) => any;
  pause: (...args: any[]) => any;
  playPause: (...args: any[]) => any;
  stop: (...args: any[]) => any;
  seekTo: (...args: any[]) => any;
  setTime: (...args: any[]) => any;
  setVolume: (...args: any[]) => any;
  setPlaybackRate: (...args: any[]) => any;
  setZoom: (...args: any[]) => any;
  load: (...args: any[]) => any;
  isPlaying: (...args: any[]) => any;
  getDuration: (...args: any[]) => any;
  getCurrentTime: (...args: any[]) => any;
  getWaveSurfer: (...args: any[]) => any;
}

export default function Waveform(_props: WaveformProps): JSX.Element {
  const _merged = mergeProps({ src: null, height: 128, waveColor: '#8a2be2', progressColor: '#5a189a', cursorColor: '#333333', cursorWidth: 1, barWidth: null, barGap: null, barRadius: null, minPxPerSec: 1, volume: 1, playbackRate: 1, autoplay: false, normalizeAmplitude: false, hideScrollbar: false, disableInteraction: false, disableDragToSeek: false, timeline: false, hover: false, hoverColor: null, options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['src', 'height', 'waveColor', 'progressColor', 'cursorColor', 'cursorWidth', 'barWidth', 'barGap', 'barRadius', 'minPxPerSec', 'volume', 'playbackRate', 'autoplay', 'normalizeAmplitude', 'hideScrollbar', 'disableInteraction', 'disableDragToSeek', 'timeline', 'hover', 'hoverColor', 'options', 'currentTime', 'ref']);
  onMount(() => { local.ref?.({ play, pause, playPause, stop, seekTo, setTime, setVolume, setPlaybackRate, setZoom, load, isPlaying, getDuration, getCurrentTime, getWaveSurfer }); });

  const [currentTime, setCurrentTime] = createControllableSignal<unknown>(_props as unknown as Record<string, unknown>, 'currentTime', undefined);
  onMount(() => {
    const _cleanup = (() => {
    // $refs read ONLY here (ROZ123). The container is the engine's attach target.
    buildWaveSurfer();
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (ws) ws.destroy();
  });
  });
  createEffect(on(() => (() => local.src)(), (v) => untrack(() => ((v: any) => {
    if (ws && typeof v === 'string' && v) ws.load(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.height)(), (v) => untrack(() => ((v: any) => {
    if (ws) ws.setOptions({
      height: v
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.waveColor)(), (v) => untrack(() => ((v: any) => {
    if (ws) ws.setOptions({
      waveColor: v
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.progressColor)(), (v) => untrack(() => ((v: any) => {
    if (ws) ws.setOptions({
      progressColor: v
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.cursorColor)(), (v) => untrack(() => ((v: any) => {
    if (ws) ws.setOptions({
      cursorColor: v
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.cursorWidth)(), (v) => untrack(() => ((v: any) => {
    if (ws) ws.setOptions({
      cursorWidth: v
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.barWidth)(), (v) => untrack(() => ((v: any) => {
    if (ws) ws.setOptions({
      barWidth: v ?? undefined
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.barGap)(), (v) => untrack(() => ((v: any) => {
    if (ws) ws.setOptions({
      barGap: v ?? undefined
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.barRadius)(), (v) => untrack(() => ((v: any) => {
    if (ws) ws.setOptions({
      barRadius: v ?? undefined
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.normalizeAmplitude)(), (v) => untrack(() => ((v: any) => {
    if (ws) ws.setOptions({
      normalize: v
    });
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.volume)(), (v) => untrack(() => ((v: any) => {
    if (ws && typeof v === 'number') ws.setVolume(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.playbackRate)(), (v) => untrack(() => ((v: any) => {
    if (ws && typeof v === 'number') ws.setPlaybackRate(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.minPxPerSec)(), (v) => untrack(() => ((v: any) => {
    if (ws && typeof v === 'number' && v > 0) ws.zoom(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => currentTime())(), (v) => untrack(() => ((v: any) => {
    // Round-trip guard: skip if the incoming value already matches the engine
    // position (the timeupdate → $model → $watch echo), else seek.
    if (!ws || typeof v !== 'number') return;
    if (Math.abs(v - ws.getCurrentTime()) < 0.05) return;
    ws.setTime(v);
  })(v)), { defer: true }));
  let containerRef: HTMLElement | null = null;

  // null-let so the bundled-leaf typeNeutralize pass annotates it `any`: the engine's
  // strict WaveSurferOptions/return types don't match the loosely-typed .rozie props,
  // and (per the engine-wrapper recipe) `ws` must be TOP-LEVEL — the Solid emitter
  // splits $onMount into onMount(...) + onCleanup(...), so a mount-local `let` would
  // be out of scope in teardown (TS2304).
  let ws: any = null;

  // Build the engine. The whole config object is untyped (ws is `any`) so the
  // constructor's options + event-callback params are unchecked against wavesurfer's
  // strict types (the Cropper buildCropper idiom).
  function buildWaveSurfer() {
    let plugins = [];
    plugins = [];
    if (local.timeline) plugins.push(TimelinePlugin.create());
    if (local.hover) plugins.push(HoverPlugin.create({
      lineColor: local.hoverColor ?? undefined
    }));
    let cfg: any = null;
    cfg = {
      ...local.options,
      container: containerRef,
      url: local.src ?? undefined,
      height: local.height,
      waveColor: local.waveColor,
      progressColor: local.progressColor,
      cursorColor: local.cursorColor,
      cursorWidth: local.cursorWidth,
      barWidth: local.barWidth ?? undefined,
      barGap: local.barGap ?? undefined,
      barRadius: local.barRadius ?? undefined,
      minPxPerSec: local.minPxPerSec,
      autoplay: local.autoplay,
      normalize: local.normalizeAmplitude,
      hideScrollbar: local.hideScrollbar,
      interact: !local.disableInteraction,
      dragToSeek: !local.disableDragToSeek,
      plugins: plugins
    };
    ws = WaveSurfer.create(cfg);

    // ── engine events → emits + the two-way currentTime writeback ──────────────
    ws.on('ready', (duration: any) => _props.onReady?.(duration));
    ws.on('play', () => _props.onPlaying?.());
    ws.on('pause', () => _props.onPaused?.());
    ws.on('finish', () => _props.onFinished?.());
    ws.on('timeupdate', (t: any) => {
      // Echo the live position into the two-way model, then emit. The reverse
      // $watch below is value-equality-guarded, so this write does not loop.
      setCurrentTime(t);
      _props.onTimeupdate?.(t);
    });
    ws.on('seeking', (t: any) => _props.onSeeking?.(t));
    ws.on('interaction', (t: any) => _props.onInteraction?.(t));
    ws.on('loading', (percent: any) => _props.onLoading?.(percent));
    ws.on('error', (err: any) => _props.onError?.(err));
  }
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

  return (
    <>
    <div ref={(el) => { containerRef = el as HTMLElement; }} {...attrs} class={"rozie-waveform" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-0b6fbb3a="" />
    </>
  );
}
