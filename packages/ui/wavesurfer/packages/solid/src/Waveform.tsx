import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
// Default import is `WaveSurfer` (≠ the component name `Waveform`, so no import⇄
// component collision — Cropper had to alias; we don't). Plugin factories are
// separate v7 entry points.
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/plugins/timeline';
import HoverPlugin from 'wavesurfer.js/plugins/hover';
import RegionsPlugin from 'wavesurfer.js/plugins/regions';

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
   * Pre-computed waveform peaks (an array of channel sample arrays, or a single `number[]`). Renders the waveform without downloading or decoding audio — pair with `duration`. Construction-only.
   */
  peaks?: unknown;
  /**
   * The audio duration in seconds. Required alongside `peaks` when rendering without a decodable `src` (the timeline/ruler and region positions are derived from it). Construction-only.
   */
  duration?: (number) | null;
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
   * Render a time-ruler beneath the waveform (the wavesurfer Timeline plugin). Live-toggleable — registers/unregisters on the running engine, no remount.
   */
  timeline?: boolean;
  /**
   * Show a hover cursor with a time label as the pointer moves over the waveform (the wavesurfer Hover plugin). Live-toggleable — registers/unregisters on the running engine, no remount.
   */
  hover?: boolean;
  /**
   * The line color of the Hover plugin cursor (only applies when `hover` is enabled). Read/applied when the Hover plugin is (re-)created — not live on an already-registered instance.
   */
  hoverColor?: (string) | null;
  /**
   * The interactive regions as an array of `{ id?, start, end?, content?, color?, drag?, resize? }`. Providing an array (even empty) registers the Regions plugin — at construction if it's already an array, or lazily the first time `regions` transitions from `null`/`undefined` to an array. Two-way (`model: true`): user create / drag / resize / remove writes the updated array back (round-trip-guarded); a consumer write reconciles the live regions (add / update / remove by `id`).
   */
  regions?: unknown;
  defaultRegions?: unknown;
  onRegionsChange?: (regions: unknown) => void;
  /**
   * Allow drawing new regions by dragging over empty waveform space (Regions plugin `enableDragSelection`). Requires `regions` to be an array. Read/applied when the Regions plugin is (re-)created — not live on an already-registered instance.
   */
  dragToCreateRegions?: boolean;
  /**
   * Default fill color for drag-created regions (only applies when `dragToCreateRegions` is on). Read/applied when the Regions plugin is (re-)created — not live on an already-registered instance.
   */
  regionColor?: (string) | null;
  /**
   * Raw wavesurfer `WaveSurferOptions` passthrough — spread into `WaveSurfer.create()` before the curated keys (explicit props win). Use it for any v7 option not surfaced as a first-class prop (`sampleRate`, `mediaControls`, `splitChannels`, `barHeight`, …).
   */
  options?: Record<string, any>;
  /**
   * The current playback position in seconds. The lone two-way `model: true` prop: playback writes the live position back on every `timeupdate` (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write seeks the engine via `setTime`.
   */
  currentTime?: unknown;
  defaultCurrentTime?: unknown;
  onCurrentTimeChange?: (currentTime: unknown) => void;
  onRegionCreated?: (...args: unknown[]) => void;
  onRegionUpdated?: (...args: unknown[]) => void;
  onRegionRemoved?: (...args: unknown[]) => void;
  onRegionClicked?: (...args: unknown[]) => void;
  onRegionIn?: (...args: unknown[]) => void;
  onRegionOut?: (...args: unknown[]) => void;
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
  addRegion: (...args: any[]) => any;
  clearRegions: (...args: any[]) => any;
  getRegions: (...args: any[]) => any;
}

export default function Waveform(_props: WaveformProps): JSX.Element {
  const _merged = mergeProps({ src: null, peaks: undefined, duration: null, height: 128, waveColor: '#8a2be2', progressColor: '#5a189a', cursorColor: '#333333', cursorWidth: 1, barWidth: null, barGap: null, barRadius: null, minPxPerSec: 1, volume: 1, playbackRate: 1, autoplay: false, normalizeAmplitude: false, hideScrollbar: false, disableInteraction: false, disableDragToSeek: false, timeline: false, hover: false, hoverColor: null, dragToCreateRegions: false, regionColor: null, options: (() => ({}))() as Record<string, any> }, _props);
  const [local, attrs] = splitProps(_merged, ['src', 'peaks', 'duration', 'height', 'waveColor', 'progressColor', 'cursorColor', 'cursorWidth', 'barWidth', 'barGap', 'barRadius', 'minPxPerSec', 'volume', 'playbackRate', 'autoplay', 'normalizeAmplitude', 'hideScrollbar', 'disableInteraction', 'disableDragToSeek', 'timeline', 'hover', 'hoverColor', 'regions', 'dragToCreateRegions', 'regionColor', 'options', 'currentTime', 'ref']);
  onMount(() => { local.ref?.({ play, pause, playPause, stop, seekTo, setTime, setVolume, setPlaybackRate, setZoom, load, isPlaying, getDuration, getCurrentTime, getWaveSurfer, addRegion, clearRegions, getRegions }); });

  const [regions, setRegions] = createControllableSignal<unknown>(_props as unknown as Record<string, unknown>, 'regions', undefined);
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
  createEffect(on(() => (() => local.timeline)(), (v) => untrack(() => ((v: any) => {
    if (!ws) return;
    if (v && !timelinePlugin) {
      timelinePlugin = TimelinePlugin.create();
      ws.registerPlugin(timelinePlugin);
    } else if (!v && timelinePlugin) {
      ws.unregisterPlugin(timelinePlugin);
      timelinePlugin = null;
    }
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.hover)(), (v) => untrack(() => ((v: any) => {
    if (!ws) return;
    if (v && !hoverPlugin) {
      hoverPlugin = HoverPlugin.create({
        lineColor: local.hoverColor ?? undefined
      });
      ws.registerPlugin(hoverPlugin);
    } else if (!v && hoverPlugin) {
      ws.unregisterPlugin(hoverPlugin);
      hoverPlugin = null;
    }
  })(v)), { defer: true }));
  createEffect(on(() => (() => regions())(), (v) => untrack(() => ((list: any) => {
    // Lazy registration: `regions` transitioned to an array after mount and the
    // plugin doesn't exist yet — register it now. If the engine has already
    // decoded audio (wsReady), open the reconcile gate immediately; otherwise
    // `ready`'s own catch-up (above) opens it once duration is known.
    if (Array.isArray(list) && !regionsPlugin && ws) {
      ensureRegionsPlugin();
      if (wsReady) regionsReady = true;
    }
    // Controlled reconcile of the live regions to match the incoming list.
    // Gated on `regionsReady` (duration known) and value-equality-guarded inside
    // reconcileRegions so a writeback echo doesn't loop.
    if (!regionsReady) return;
    reconcileRegions(list);
  })(v)), { defer: true }));
  let containerRef: HTMLElement | null = null;

  // null-let so the bundled-leaf typeNeutralize pass annotates it `any`: the engine's
  // strict WaveSurferOptions/return types don't match the loosely-typed .rozie props,
  // and (per the engine-wrapper recipe) `ws` must be TOP-LEVEL — the Solid emitter
  // splits $onMount into onMount(...) + onCleanup(...), so a mount-local `let` would
  // be out of scope in teardown (TS2304).
  let ws: any = null;
  // Regions plugin instance + its two guards (all top-level for the Solid teardown
  // scope, same reason as `ws`). `regionsReady` gates the reconcile until the audio
  // is decoded (addRegion needs a known duration). `reconciling` is the re-entrancy
  // guard: while a controlled reconcile mutates the engine, the region-event
  // handlers must NOT emit or write back (that would fight the incoming update) —
  // only genuine USER edits (outside reconcile) drive the model + emits.
  let regionsPlugin: any = null;
  let regionsReady = false;
  let reconciling = false;
  // timelinePlugin / hoverPlugin (live plugin-presence toggling) — top-level so
  // the $watch(timeline)/$watch(hover) blocks below can register/unregister them
  // on the running engine. wsReady tracks "the engine has decoded audio and
  // fired `ready`", independent of whether a regions plugin exists — it gates
  // the rare async-window lazy-registration case in the `ready` handler below.
  let timelinePlugin: any = null;
  let hoverPlugin: any = null;
  let wsReady = false;

  // Serialize an engine Region to the plain descriptor shape the two-way `regions`
  // model carries. Pure (no sigils) — safe at top level.
  function serializeRegion(r: any) {
    return {
      id: r.id,
      start: r.start,
      end: r.end,
      color: r.color,
      content: r.content && r.content.textContent ? r.content.textContent : undefined,
      drag: r.drag,
      resize: r.resize
    };
  }

  // Value-equality guard (by id + rounded start/end) that stops the
  // user-edit → writeback → $model.regions → $watch → reconcile loop from
  // oscillating (the Cropper `sameData` idiom, generalized to a list).
  function sameRegions(list: any, engineRegions: any) {
    if (!Array.isArray(list) || list.length !== engineRegions.length) return false;
    const key = (r: any) => `${r.id}:${Math.round((r.start ?? 0) * 1000)}:${Math.round((r.end ?? 0) * 1000)}`;
    const a = list.map(key).sort();
    const b = engineRegions.map(key).sort();
    return a.every((k: any, i: any) => k === b[i]);
  }

  // Push the live engine regions back into the two-way `regions` model (serialized).
  // No-op while `reconciling` — a controlled update must not echo back onto itself.
  function writeBackRegions() {
    if (!regionsPlugin || reconciling) return;
    setRegions(regionsPlugin.getRegions().map(serializeRegion));
  }

  // Reconcile the live engine regions to match a consumer-provided descriptor list:
  // update-by-id, add the new, remove the missing. Guarded by `reconciling` so the
  // add/remove/setOptions calls don't trigger writeBackRegions mid-flight. If any
  // region was added WITHOUT a consumer id, echo the engine state (now carrying the
  // assigned ids) back once so the two-way binding gains them.
  function reconcileRegions(list: any) {
    if (!regionsPlugin || !Array.isArray(list)) return;
    const current = regionsPlugin.getRegions();
    if (sameRegions(list, current)) return;
    reconciling = true;
    let addedWithoutId = false;
    // Build the id→region map with a no-arg `new Map()` (infers Map<any, any>) — a
    // `new Map(current.map(...))` over the `any`-typed engine list infers
    // Map<unknown, unknown>, so `.setOptions` would fail the strict leaf typecheck.
    const byId = new Map();
    for (const r of current as any) byId.set(r.id, r);
    const keep = new Set();
    for (const desc of list as any) {
      if (!desc || typeof desc.start !== 'number') continue;
      if (desc.id != null && byId.has(desc.id)) {
        byId.get(desc.id).setOptions({
          start: desc.start,
          end: desc.end,
          color: desc.color,
          drag: desc.drag,
          resize: desc.resize,
          content: desc.content
        });
        keep.add(desc.id);
      } else {
        const created = regionsPlugin.addRegion({
          id: desc.id,
          start: desc.start,
          end: desc.end,
          color: desc.color,
          content: desc.content,
          drag: desc.drag,
          resize: desc.resize
        });
        keep.add(created.id);
        if (desc.id == null) addedWithoutId = true;
      }
    }
    for (const r of current as any) {
      if (!keep.has(r.id)) r.remove();
    }
    reconciling = false;
    if (addedWithoutId) writeBackRegions();
  }

  // Attach the 6 region-event listeners to a live RegionsPlugin instance — shared
  // by the construction-time path (buildWaveSurfer) and the lazy path
  // (ensureRegionsPlugin) so both register identical behavior through one code
  // path. Each writeback/emit is a no-op during a controlled reconcile (the
  // `reconciling` guard) so a programmatic add/update/remove does not echo back
  // or double-emit; only genuine user gestures (drag-create, drag/resize,
  // delete) drive the model + emits.
  function wireRegionsPluginEvents(plugin: any) {
    plugin.on('region-created', (region: any) => {
      if (reconciling) return;
      _props.onRegionCreated?.(serializeRegion(region));
      writeBackRegions();
    });
    plugin.on('region-updated', (region: any) => {
      if (reconciling) return;
      _props.onRegionUpdated?.(serializeRegion(region));
      writeBackRegions();
    });
    plugin.on('region-removed', (region: any) => {
      if (reconciling) return;
      _props.onRegionRemoved?.(serializeRegion(region));
      writeBackRegions();
    });
    plugin.on('region-clicked', (region: any) => {
      _props.onRegionClicked?.(serializeRegion(region));
    });
    // Playback entered/left a region — pure notifications (no writeback), so they
    // fire regardless of the reconcile guard. The events for active-segment
    // highlighting, transcript/karaoke sync, and loop-a-region.
    plugin.on('region-in', (region: any) => {
      _props.onRegionIn?.(serializeRegion(region));
    });
    plugin.on('region-out', (region: any) => {
      _props.onRegionOut?.(serializeRegion(region));
    });
  }

  // Lazily register the Regions plugin on the LIVE engine (idempotent — a no-op
  // if it already exists or the engine isn't built yet). Shared by the `ready`
  // handler's async-window catch-up and the $watch(regions) transition-to-array
  // path, so `regions` flipping from null/undefined to an array after mount
  // registers the plugin without a remount.
  function ensureRegionsPlugin() {
    if (regionsPlugin || !ws) return regionsPlugin;
    regionsPlugin = RegionsPlugin.create();
    ws.registerPlugin(regionsPlugin);
    wireRegionsPluginEvents(regionsPlugin);
    if (local.dragToCreateRegions) {
      regionsPlugin.enableDragSelection({
        color: local.regionColor ?? undefined
      });
    }
    return regionsPlugin;
  }

  // Build the engine. The whole config object is untyped (ws is `any`) so the
  // constructor's options + event-callback params are unchecked against wavesurfer's
  // strict types (the Cropper buildCropper idiom).
  function buildWaveSurfer() {
    let plugins = [];
    plugins = [];
    if (local.timeline) {
      timelinePlugin = TimelinePlugin.create();
      plugins.push(timelinePlugin);
    }
    if (local.hover) {
      hoverPlugin = HoverPlugin.create({
        lineColor: local.hoverColor ?? undefined
      });
      plugins.push(hoverPlugin);
    }
    // Regions plugin is registered when `regions` is an array (even empty).
    regionsPlugin = null;
    if (Array.isArray(regions())) {
      regionsPlugin = RegionsPlugin.create();
      plugins.push(regionsPlugin);
    }
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
    // peaks/duration override the `options` bag ONLY when actually provided —
    // assigning `undefined` unconditionally would clobber a caller's options.peaks.
    if (local.peaks != null) cfg.peaks = local.peaks;
    if (local.duration != null) cfg.duration = local.duration;
    ws = WaveSurfer.create(cfg);

    // ── engine events → emits + the two-way currentTime writeback ──────────────
    ws.on('ready', (duration: any) => {
      wsReady = true;
      // Rare async-window catch-up: `regions` became an array between mount and
      // `ready` firing, before `wsReady` was true, so the $watch(regions) lazy
      // path below couldn't gate on it yet. ensureRegionsPlugin is idempotent.
      if (Array.isArray(regions())) ensureRegionsPlugin();
      // Regions can only be placed once the duration is known — do the initial
      // reconcile + drag-selection wiring here, then open the gate for prop-driven
      // reconciles. ($watch is lazy, so it never fires at mount; this is the only
      // place initial regions get added.)
      if (regionsPlugin) {
        regionsReady = true;
        if (local.dragToCreateRegions) {
          regionsPlugin.enableDragSelection({
            color: local.regionColor ?? undefined
          });
        }
        reconcileRegions(regions());
      }
      _props.onReady?.(duration);
    });
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

    // ── regions plugin events ───────────────────────────────────────────────────
    // Shared with the lazy ensureRegionsPlugin() path so construction-time and
    // lazy registration wire identical listener behavior through one function.
    if (regionsPlugin) wireRegionsPluginEvents(regionsPlugin);
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
  // Regions imperative surface (active only when the `regions` array registered the
  // plugin). `addRegion` returns the created engine Region; NO `setRegions` verb
  // (the React `regions`-model auto-setter, ROZ524 — drive the list via the two-way
  // binding instead).
  function addRegion(opts: any) {
    return regionsPlugin ? regionsPlugin.addRegion(opts) : null;
  }
  function clearRegions() {
    if (regionsPlugin) regionsPlugin.clearRegions();
  }
  function getRegions() {
    return regionsPlugin ? regionsPlugin.getRegions() : [];
  }

  return (
    <>
    <div ref={(el) => { containerRef = el as HTMLElement; }} {...attrs} class={"rozie-waveform" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-0b6fbb3a="" />
    </>
  );
}
