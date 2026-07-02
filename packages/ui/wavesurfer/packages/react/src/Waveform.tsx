import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './Waveform.css';
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
   * The interactive regions as an array of `{ id?, start, end?, content?, color?, drag?, resize? }`. Providing an array (even empty) registers the Regions plugin at construction. Two-way (`model: true`): user create / drag / resize / remove writes the updated array back (round-trip-guarded); a consumer write reconciles the live regions (add / update / remove by `id`).
   */
  regions?: unknown;
  defaultRegions?: unknown;
  onRegionsChange?: (regions: unknown) => void;
  /**
   * Allow drawing new regions by dragging over empty waveform space (Regions plugin `enableDragSelection`). Requires `regions` to be an array. Construction-only in v1.
   */
  dragToCreateRegions?: boolean;
  /**
   * Default fill color for drag-created regions (only applies when `dragToCreateRegions` is on). Construction-only in v1.
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
  onReady?: (...args: any[]) => void;
  onPlaying?: (...args: any[]) => void;
  onPaused?: (...args: any[]) => void;
  onFinished?: (...args: any[]) => void;
  onTimeupdate?: (...args: any[]) => void;
  onSeeking?: (...args: any[]) => void;
  onInteraction?: (...args: any[]) => void;
  onLoading?: (...args: any[]) => void;
  onError?: (...args: any[]) => void;
  onRegionCreated?: (...args: any[]) => void;
  onRegionUpdated?: (...args: any[]) => void;
  onRegionRemoved?: (...args: any[]) => void;
  onRegionClicked?: (...args: any[]) => void;
  onRegionIn?: (...args: any[]) => void;
  onRegionOut?: (...args: any[]) => void;
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

const Waveform = forwardRef<WaveformHandle, WaveformProps>(function Waveform(_props: WaveformProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<WaveformProps, 'src' | 'peaks' | 'duration' | 'height' | 'waveColor' | 'progressColor' | 'cursorColor' | 'cursorWidth' | 'barWidth' | 'barGap' | 'barRadius' | 'minPxPerSec' | 'volume' | 'playbackRate' | 'autoplay' | 'normalizeAmplitude' | 'hideScrollbar' | 'disableInteraction' | 'disableDragToSeek' | 'timeline' | 'hover' | 'hoverColor' | 'dragToCreateRegions' | 'regionColor' | 'options'> & { src: (string) | null; peaks: unknown; duration: (number) | null; height: number; waveColor: string; progressColor: string; cursorColor: string; cursorWidth: number; barWidth: (unknown) | null; barGap: (unknown) | null; barRadius: (unknown) | null; minPxPerSec: number; volume: number; playbackRate: number; autoplay: boolean; normalizeAmplitude: boolean; hideScrollbar: boolean; disableInteraction: boolean; disableDragToSeek: boolean; timeline: boolean; hover: boolean; hoverColor: (string) | null; dragToCreateRegions: boolean; regionColor: (string) | null; options: Record<string, any> } = {
    ..._props,
    src: _props.src ?? null,
    peaks: _props.peaks ?? undefined,
    duration: _props.duration ?? null,
    height: _props.height ?? 128,
    waveColor: _props.waveColor ?? '#8a2be2',
    progressColor: _props.progressColor ?? '#5a189a',
    cursorColor: _props.cursorColor ?? '#333333',
    cursorWidth: _props.cursorWidth ?? 1,
    barWidth: _props.barWidth ?? null,
    barGap: _props.barGap ?? null,
    barRadius: _props.barRadius ?? null,
    minPxPerSec: _props.minPxPerSec ?? 1,
    volume: _props.volume ?? 1,
    playbackRate: _props.playbackRate ?? 1,
    autoplay: _props.autoplay ?? false,
    normalizeAmplitude: _props.normalizeAmplitude ?? false,
    hideScrollbar: _props.hideScrollbar ?? false,
    disableInteraction: _props.disableInteraction ?? false,
    disableDragToSeek: _props.disableDragToSeek ?? false,
    timeline: _props.timeline ?? false,
    hover: _props.hover ?? false,
    hoverColor: _props.hoverColor ?? null,
    dragToCreateRegions: _props.dragToCreateRegions ?? false,
    regionColor: _props.regionColor ?? null,
    options: _props.options ?? __defaultOptions,
  };
  const attrs: Record<string, unknown> = (() => {
    const { src, peaks, duration, height, waveColor, progressColor, cursorColor, cursorWidth, barWidth, barGap, barRadius, minPxPerSec, volume, playbackRate, autoplay, normalizeAmplitude, hideScrollbar, disableInteraction, disableDragToSeek, timeline, hover, hoverColor, regions, dragToCreateRegions, regionColor, options, currentTime, defaultValue, onRegionsChange, defaultRegions, onCurrentTimeChange, defaultCurrentTime, ...rest } = _props as WaveformProps & Record<string, unknown>;
    void src; void peaks; void duration; void height; void waveColor; void progressColor; void cursorColor; void cursorWidth; void barWidth; void barGap; void barRadius; void minPxPerSec; void volume; void playbackRate; void autoplay; void normalizeAmplitude; void hideScrollbar; void disableInteraction; void disableDragToSeek; void timeline; void hover; void hoverColor; void regions; void dragToCreateRegions; void regionColor; void options; void currentTime; void defaultValue; void onRegionsChange; void defaultRegions; void onCurrentTimeChange; void defaultCurrentTime;
    return rest;
  })();
  const regionsPlugin = useRef<any>(null);
  const ws = useRef<any>(null);
  const regionsReady = useRef(false);
  const reconciling = useRef(false);
  const [regions, setRegions] = useControllableState({
    value: props.regions,
    defaultValue: props.defaultRegions ?? undefined,
    onValueChange: props.onRegionsChange,
  });
  const [currentTime, setCurrentTime] = useControllableState({
    value: props.currentTime,
    defaultValue: props.defaultCurrentTime ?? undefined,
    onValueChange: props.onCurrentTimeChange,
  });
  const container = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);
  const _watch5First = useRef(true);
  const _watch6First = useRef(true);
  const _watch7First = useRef(true);
  const _watch8First = useRef(true);
  const _watch9First = useRef(true);
  const _watch10First = useRef(true);
  const _watch11First = useRef(true);
  const _watch12First = useRef(true);
  const _watch13First = useRef(true);
  const _watch14First = useRef(true);

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
  function sameRegions(list: any, engineRegions: any) {
    if (!Array.isArray(list) || list.length !== engineRegions.length) return false;
    const key = (r: any) => `${r.id}:${Math.round((r.start ?? 0) * 1000)}:${Math.round((r.end ?? 0) * 1000)}`;
    const a = list.map(key).sort();
    const b = engineRegions.map(key).sort();
    return a.every((k: any, i: any) => k === b[i]);
  }
  function writeBackRegions() {
    if (!regionsPlugin.current || reconciling.current) return;
    setRegions(regionsPlugin.current.getRegions().map(serializeRegion));
  }
  function reconcileRegions(list: any) {
    if (!regionsPlugin.current || !Array.isArray(list)) return;
    const current = regionsPlugin.current.getRegions();
    if (sameRegions(list, current)) return;
    reconciling.current = true;
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
        const created = regionsPlugin.current.addRegion({
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
    reconciling.current = false;
    if (addedWithoutId) writeBackRegions();
  }
  const { onError: _rozieProp_onError, onFinished: _rozieProp_onFinished, onInteraction: _rozieProp_onInteraction, onLoading: _rozieProp_onLoading, onPaused: _rozieProp_onPaused, onPlaying: _rozieProp_onPlaying, onReady: _rozieProp_onReady, onRegionClicked: _rozieProp_onRegionClicked, onRegionCreated: _rozieProp_onRegionCreated, onRegionIn: _rozieProp_onRegionIn, onRegionOut: _rozieProp_onRegionOut, onRegionRemoved: _rozieProp_onRegionRemoved, onRegionUpdated: _rozieProp_onRegionUpdated, onSeeking: _rozieProp_onSeeking, onTimeupdate: _rozieProp_onTimeupdate } = props;
    const buildWaveSurfer = useCallback(() => {
    let plugins = [];
    plugins = [];
    if (props.timeline) plugins.push(TimelinePlugin.create());
    if (props.hover) plugins.push(HoverPlugin.create({
      lineColor: props.hoverColor ?? undefined
    }));
    // Regions plugin is registered when `regions` is an array (even empty).
    regionsPlugin.current = null;
    if (Array.isArray(regions)) {
      regionsPlugin.current = RegionsPlugin.create();
      plugins.push(regionsPlugin.current);
    }
    let cfg: any = null;
    cfg = {
      ...props.options,
      container: container.current,
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
    // peaks/duration override the `options` bag ONLY when actually provided —
    // assigning `undefined` unconditionally would clobber a caller's options.peaks.
    if (props.peaks != null) cfg.peaks = props.peaks;
    if (props.duration != null) cfg.duration = props.duration;
    ws.current = WaveSurfer.create(cfg);

    // ── engine events → emits + the two-way currentTime writeback ──────────────
    ws.current.on('ready', (duration: any) => {
      // Regions can only be placed once the duration is known — do the initial
      // reconcile + drag-selection wiring here, then open the gate for prop-driven
      // reconciles. ($watch is lazy, so it never fires at mount; this is the only
      // place initial regions get added.)
      if (regionsPlugin.current) {
        regionsReady.current = true;
        if (props.dragToCreateRegions) {
          regionsPlugin.current.enableDragSelection({
            color: props.regionColor ?? undefined
          });
        }
        reconcileRegions(regions);
      }
      _rozieProp_onReady && _rozieProp_onReady(duration);
    });
    ws.current.on('play', () => _rozieProp_onPlaying && _rozieProp_onPlaying());
    ws.current.on('pause', () => _rozieProp_onPaused && _rozieProp_onPaused());
    ws.current.on('finish', () => _rozieProp_onFinished && _rozieProp_onFinished());
    ws.current.on('timeupdate', (t: any) => {
      // Echo the live position into the two-way model, then emit. The reverse
      // $watch below is value-equality-guarded, so this write does not loop.
      setCurrentTime(t);
      _rozieProp_onTimeupdate && _rozieProp_onTimeupdate(t);
    });
    ws.current.on('seeking', (t: any) => _rozieProp_onSeeking && _rozieProp_onSeeking(t));
    ws.current.on('interaction', (t: any) => _rozieProp_onInteraction && _rozieProp_onInteraction(t));
    ws.current.on('loading', (percent: any) => _rozieProp_onLoading && _rozieProp_onLoading(percent));
    ws.current.on('error', (err: any) => _rozieProp_onError && _rozieProp_onError(err));

    // ── regions plugin events → emits + two-way `regions` writeback ────────────
    // Each is a no-op during a controlled reconcile (the `reconciling` guard) so a
    // programmatic add/update/remove does not echo back or double-emit; only genuine
    // user gestures (drag-create, drag/resize, delete) drive the model + emits.
    if (regionsPlugin.current) {
      regionsPlugin.current.on('region-created', (region: any) => {
        if (reconciling.current) return;
        _rozieProp_onRegionCreated && _rozieProp_onRegionCreated(serializeRegion(region));
        writeBackRegions();
      });
      regionsPlugin.current.on('region-updated', (region: any) => {
        if (reconciling.current) return;
        _rozieProp_onRegionUpdated && _rozieProp_onRegionUpdated(serializeRegion(region));
        writeBackRegions();
      });
      regionsPlugin.current.on('region-removed', (region: any) => {
        if (reconciling.current) return;
        _rozieProp_onRegionRemoved && _rozieProp_onRegionRemoved(serializeRegion(region));
        writeBackRegions();
      });
      regionsPlugin.current.on('region-clicked', (region: any) => {
        _rozieProp_onRegionClicked && _rozieProp_onRegionClicked(serializeRegion(region));
      });
      // Playback entered/left a region — pure notifications (no writeback), so they
      // fire regardless of the reconcile guard. The events for active-segment
      // highlighting, transcript/karaoke sync, and loop-a-region.
      regionsPlugin.current.on('region-in', (region: any) => {
        _rozieProp_onRegionIn && _rozieProp_onRegionIn(serializeRegion(region));
      });
      regionsPlugin.current.on('region-out', (region: any) => {
        _rozieProp_onRegionOut && _rozieProp_onRegionOut(serializeRegion(region));
      });
    }
  }, [_rozieProp_onError, _rozieProp_onFinished, _rozieProp_onInteraction, _rozieProp_onLoading, _rozieProp_onPaused, _rozieProp_onPlaying, _rozieProp_onReady, _rozieProp_onRegionClicked, _rozieProp_onRegionCreated, _rozieProp_onRegionIn, _rozieProp_onRegionOut, _rozieProp_onRegionRemoved, _rozieProp_onRegionUpdated, _rozieProp_onSeeking, _rozieProp_onTimeupdate, props.autoplay, props.barGap, props.barRadius, props.barWidth, props.cursorColor, props.cursorWidth, props.disableDragToSeek, props.disableInteraction, props.dragToCreateRegions, props.duration, props.height, props.hideScrollbar, props.hover, props.hoverColor, props.minPxPerSec, props.normalizeAmplitude, props.options, props.peaks, props.progressColor, props.regionColor, props.src, props.timeline, props.waveColor, reconcileRegions, regions, serializeRegion, setCurrentTime, writeBackRegions]);
  // ─── imperative handle (Phase 21 $expose) ────────────────────────────────────
  // Collision-clear across all six targets: canonical media verbs play/pause/
  // playPause kept (the emits were renamed playing/paused/finished to dodge ROZ121);
  // no setCurrentTime (React model auto-setter, ROZ524 — use setTime); no Lit
  // reserved lifecycle name (update/render/firstUpdated/updated/willUpdate/requestUpdate).
  function play() {
    if (ws.current) ws.current.play();
  }
  function pause() {
    if (ws.current) ws.current.pause();
  }
  function playPause() {
    if (ws.current) ws.current.playPause();
  }
  function stop() {
    if (ws.current) ws.current.stop();
  }
  function seekTo(progress: any) {
    if (ws.current) ws.current.seekTo(progress);
  }
  function setTime(seconds: any) {
    if (ws.current) ws.current.setTime(seconds);
  }
  function setVolume(v: any) {
    if (ws.current) ws.current.setVolume(v);
  }
  function setPlaybackRate(rate: any) {
    if (ws.current) ws.current.setPlaybackRate(rate);
  }
  function setZoom(pxPerSec: any) {
    if (ws.current) ws.current.zoom(pxPerSec);
  }
  function load(url: any) {
    if (ws.current) ws.current.load(url);
  }
  function isPlaying() {
    return ws.current ? ws.current.isPlaying() : false;
  }
  function getDuration() {
    return ws.current ? ws.current.getDuration() : 0;
  }
  function getCurrentTime() {
    return ws.current ? ws.current.getCurrentTime() : 0;
  }
  function getWaveSurfer() {
    return ws.current;
  }
  // Regions imperative surface (active only when the `regions` array registered the
  // plugin). `addRegion` returns the created engine Region; NO `setRegions` verb
  // (the React `regions`-model auto-setter, ROZ524 — drive the list via the two-way
  // binding instead).
  // Regions imperative surface (active only when the `regions` array registered the
  // plugin). `addRegion` returns the created engine Region; NO `setRegions` verb
  // (the React `regions`-model auto-setter, ROZ524 — drive the list via the two-way
  // binding instead).
  function addRegion(opts: any) {
    return regionsPlugin.current ? regionsPlugin.current.addRegion(opts) : null;
  }
  function clearRegions() {
    if (regionsPlugin.current) regionsPlugin.current.clearRegions();
  }
  function getRegions() {
    return regionsPlugin.current ? regionsPlugin.current.getRegions() : [];
  }

  useEffect(() => {
    // $refs read ONLY here (ROZ123). The container is the engine's attach target.
    buildWaveSurfer();
    return () => {
      if (ws.current) ws.current.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = props.src;
    if (ws.current && typeof v === 'string' && v) ws.current.load(v);
  }, [props.src]);
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    const v = props.height;
    if (ws.current) ws.current.setOptions({
      height: v
    });
  }, [props.height]);
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    const v = props.waveColor;
    if (ws.current) ws.current.setOptions({
      waveColor: v
    });
  }, [props.waveColor]);
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = props.progressColor;
    if (ws.current) ws.current.setOptions({
      progressColor: v
    });
  }, [props.progressColor]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const v = props.cursorColor;
    if (ws.current) ws.current.setOptions({
      cursorColor: v
    });
  }, [props.cursorColor]);
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    const v = props.cursorWidth;
    if (ws.current) ws.current.setOptions({
      cursorWidth: v
    });
  }, [props.cursorWidth]);
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    const v = props.barWidth;
    if (ws.current) ws.current.setOptions({
      barWidth: v ?? undefined
    });
  }, [props.barWidth]);
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    const v = props.barGap;
    if (ws.current) ws.current.setOptions({
      barGap: v ?? undefined
    });
  }, [props.barGap]);
  useEffect(() => {
    if (_watch8First.current) { _watch8First.current = false; return; }
    const v = props.barRadius;
    if (ws.current) ws.current.setOptions({
      barRadius: v ?? undefined
    });
  }, [props.barRadius]);
  useEffect(() => {
    if (_watch9First.current) { _watch9First.current = false; return; }
    const v = props.normalizeAmplitude;
    if (ws.current) ws.current.setOptions({
      normalize: v
    });
  }, [props.normalizeAmplitude]);
  useEffect(() => {
    if (_watch10First.current) { _watch10First.current = false; return; }
    const v = props.volume;
    if (ws.current && typeof v === 'number') ws.current.setVolume(v);
  }, [props.volume]);
  useEffect(() => {
    if (_watch11First.current) { _watch11First.current = false; return; }
    const v = props.playbackRate;
    if (ws.current && typeof v === 'number') ws.current.setPlaybackRate(v);
  }, [props.playbackRate]);
  useEffect(() => {
    if (_watch12First.current) { _watch12First.current = false; return; }
    const v = props.minPxPerSec;
    if (ws.current && typeof v === 'number' && v > 0) ws.current.zoom(v);
  }, [props.minPxPerSec]);
  useEffect(() => {
    if (_watch13First.current) { _watch13First.current = false; return; }
    const v = currentTime;
    // Round-trip guard: skip if the incoming value already matches the engine
    // position (the timeupdate → $model → $watch echo), else seek.
    if (!ws.current || typeof v !== 'number') return;
    if (Math.abs(v - ws.current.getCurrentTime()) < 0.05) return;
    ws.current.setTime(v);
  }, [currentTime]);
  useEffect(() => {
    if (_watch14First.current) { _watch14First.current = false; return; }
    const list = regions;
    // Controlled reconcile of the live regions to match the incoming list.
    // Gated on `regionsReady` (duration known) and value-equality-guarded inside
    // reconcileRegions so a writeback echo doesn't loop.
    if (!regionsReady.current) return;
    reconcileRegions(list);
  }, [regions]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ play, pause, playPause, stop, seekTo, setTime, setVolume, setPlaybackRate, setZoom, load, isPlaying, getDuration, getCurrentTime, getWaveSurfer, addRegion, clearRegions, getRegions });
  _rozieExposeRef.current = { play, pause, playPause, stop, seekTo, setTime, setVolume, setPlaybackRate, setZoom, load, isPlaying, getDuration, getCurrentTime, getWaveSurfer, addRegion, clearRegions, getRegions };
  useImperativeHandle(ref, () => ({ play: (...args: Parameters<typeof play>): ReturnType<typeof play> => _rozieExposeRef.current.play(...args), pause: (...args: Parameters<typeof pause>): ReturnType<typeof pause> => _rozieExposeRef.current.pause(...args), playPause: (...args: Parameters<typeof playPause>): ReturnType<typeof playPause> => _rozieExposeRef.current.playPause(...args), stop: (...args: Parameters<typeof stop>): ReturnType<typeof stop> => _rozieExposeRef.current.stop(...args), seekTo: (...args: Parameters<typeof seekTo>): ReturnType<typeof seekTo> => _rozieExposeRef.current.seekTo(...args), setTime: (...args: Parameters<typeof setTime>): ReturnType<typeof setTime> => _rozieExposeRef.current.setTime(...args), setVolume: (...args: Parameters<typeof setVolume>): ReturnType<typeof setVolume> => _rozieExposeRef.current.setVolume(...args), setPlaybackRate: (...args: Parameters<typeof setPlaybackRate>): ReturnType<typeof setPlaybackRate> => _rozieExposeRef.current.setPlaybackRate(...args), setZoom: (...args: Parameters<typeof setZoom>): ReturnType<typeof setZoom> => _rozieExposeRef.current.setZoom(...args), load: (...args: Parameters<typeof load>): ReturnType<typeof load> => _rozieExposeRef.current.load(...args), isPlaying: (...args: Parameters<typeof isPlaying>): ReturnType<typeof isPlaying> => _rozieExposeRef.current.isPlaying(...args), getDuration: (...args: Parameters<typeof getDuration>): ReturnType<typeof getDuration> => _rozieExposeRef.current.getDuration(...args), getCurrentTime: (...args: Parameters<typeof getCurrentTime>): ReturnType<typeof getCurrentTime> => _rozieExposeRef.current.getCurrentTime(...args), getWaveSurfer: (...args: Parameters<typeof getWaveSurfer>): ReturnType<typeof getWaveSurfer> => _rozieExposeRef.current.getWaveSurfer(...args), addRegion: (...args: Parameters<typeof addRegion>): ReturnType<typeof addRegion> => _rozieExposeRef.current.addRegion(...args), clearRegions: (...args: Parameters<typeof clearRegions>): ReturnType<typeof clearRegions> => _rozieExposeRef.current.clearRegions(...args), getRegions: (...args: Parameters<typeof getRegions>): ReturnType<typeof getRegions> => _rozieExposeRef.current.getRegions(...args) }), []);

  return (
    <>
    <div ref={container} {...attrs} className={clsx("rozie-waveform", (attrs.className as string | undefined))} data-rozie-s-0b6fbb3a="" />
    </>
  );
});
export default Waveform;
