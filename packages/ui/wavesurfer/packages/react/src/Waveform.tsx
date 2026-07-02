import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './Waveform.css';
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
  onReady?: (...args: any[]) => void;
  onPlaying?: (...args: any[]) => void;
  onPaused?: (...args: any[]) => void;
  onFinished?: (...args: any[]) => void;
  onTimeupdate?: (...args: any[]) => void;
  onSeeking?: (...args: any[]) => void;
  onInteraction?: (...args: any[]) => void;
  onLoading?: (...args: any[]) => void;
  onError?: (...args: any[]) => void;
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

const Waveform = forwardRef<WaveformHandle, WaveformProps>(function Waveform(_props: WaveformProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<WaveformProps, 'src' | 'height' | 'waveColor' | 'progressColor' | 'cursorColor' | 'cursorWidth' | 'barWidth' | 'barGap' | 'barRadius' | 'minPxPerSec' | 'volume' | 'playbackRate' | 'autoplay' | 'normalizeAmplitude' | 'hideScrollbar' | 'disableInteraction' | 'disableDragToSeek' | 'timeline' | 'hover' | 'hoverColor' | 'options'> & { src: (string) | null; height: number; waveColor: string; progressColor: string; cursorColor: string; cursorWidth: number; barWidth: (unknown) | null; barGap: (unknown) | null; barRadius: (unknown) | null; minPxPerSec: number; volume: number; playbackRate: number; autoplay: boolean; normalizeAmplitude: boolean; hideScrollbar: boolean; disableInteraction: boolean; disableDragToSeek: boolean; timeline: boolean; hover: boolean; hoverColor: (string) | null; options: Record<string, any> } = {
    ..._props,
    src: _props.src ?? null,
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
    options: _props.options ?? __defaultOptions,
  };
  const attrs: Record<string, unknown> = (() => {
    const { src, height, waveColor, progressColor, cursorColor, cursorWidth, barWidth, barGap, barRadius, minPxPerSec, volume, playbackRate, autoplay, normalizeAmplitude, hideScrollbar, disableInteraction, disableDragToSeek, timeline, hover, hoverColor, options, currentTime, defaultValue, onCurrentTimeChange, defaultCurrentTime, ...rest } = _props as WaveformProps & Record<string, unknown>;
    void src; void height; void waveColor; void progressColor; void cursorColor; void cursorWidth; void barWidth; void barGap; void barRadius; void minPxPerSec; void volume; void playbackRate; void autoplay; void normalizeAmplitude; void hideScrollbar; void disableInteraction; void disableDragToSeek; void timeline; void hover; void hoverColor; void options; void currentTime; void defaultValue; void onCurrentTimeChange; void defaultCurrentTime;
    return rest;
  })();
  const ws = useRef<any>(null);
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

  const { onError: _rozieProp_onError, onFinished: _rozieProp_onFinished, onInteraction: _rozieProp_onInteraction, onLoading: _rozieProp_onLoading, onPaused: _rozieProp_onPaused, onPlaying: _rozieProp_onPlaying, onReady: _rozieProp_onReady, onSeeking: _rozieProp_onSeeking, onTimeupdate: _rozieProp_onTimeupdate } = props;
    const buildWaveSurfer = useCallback(() => {
    let plugins = [];
    plugins = [];
    if (props.timeline) plugins.push(TimelinePlugin.create());
    if (props.hover) plugins.push(HoverPlugin.create({
      lineColor: props.hoverColor ?? undefined
    }));
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
    ws.current = WaveSurfer.create(cfg);

    // ── engine events → emits + the two-way currentTime writeback ──────────────
    ws.current.on('ready', (duration: any) => _rozieProp_onReady && _rozieProp_onReady(duration));
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
  }, [_rozieProp_onError, _rozieProp_onFinished, _rozieProp_onInteraction, _rozieProp_onLoading, _rozieProp_onPaused, _rozieProp_onPlaying, _rozieProp_onReady, _rozieProp_onSeeking, _rozieProp_onTimeupdate, props.autoplay, props.barGap, props.barRadius, props.barWidth, props.cursorColor, props.cursorWidth, props.disableDragToSeek, props.disableInteraction, props.height, props.hideScrollbar, props.hover, props.hoverColor, props.minPxPerSec, props.normalizeAmplitude, props.options, props.progressColor, props.src, props.timeline, props.waveColor, setCurrentTime]);
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

  const _rozieExposeRef = useRef({ play, pause, playPause, stop, seekTo, setTime, setVolume, setPlaybackRate, setZoom, load, isPlaying, getDuration, getCurrentTime, getWaveSurfer });
  _rozieExposeRef.current = { play, pause, playPause, stop, seekTo, setTime, setVolume, setPlaybackRate, setZoom, load, isPlaying, getDuration, getCurrentTime, getWaveSurfer };
  useImperativeHandle(ref, () => ({ play: (...args: Parameters<typeof play>): ReturnType<typeof play> => _rozieExposeRef.current.play(...args), pause: (...args: Parameters<typeof pause>): ReturnType<typeof pause> => _rozieExposeRef.current.pause(...args), playPause: (...args: Parameters<typeof playPause>): ReturnType<typeof playPause> => _rozieExposeRef.current.playPause(...args), stop: (...args: Parameters<typeof stop>): ReturnType<typeof stop> => _rozieExposeRef.current.stop(...args), seekTo: (...args: Parameters<typeof seekTo>): ReturnType<typeof seekTo> => _rozieExposeRef.current.seekTo(...args), setTime: (...args: Parameters<typeof setTime>): ReturnType<typeof setTime> => _rozieExposeRef.current.setTime(...args), setVolume: (...args: Parameters<typeof setVolume>): ReturnType<typeof setVolume> => _rozieExposeRef.current.setVolume(...args), setPlaybackRate: (...args: Parameters<typeof setPlaybackRate>): ReturnType<typeof setPlaybackRate> => _rozieExposeRef.current.setPlaybackRate(...args), setZoom: (...args: Parameters<typeof setZoom>): ReturnType<typeof setZoom> => _rozieExposeRef.current.setZoom(...args), load: (...args: Parameters<typeof load>): ReturnType<typeof load> => _rozieExposeRef.current.load(...args), isPlaying: (...args: Parameters<typeof isPlaying>): ReturnType<typeof isPlaying> => _rozieExposeRef.current.isPlaying(...args), getDuration: (...args: Parameters<typeof getDuration>): ReturnType<typeof getDuration> => _rozieExposeRef.current.getDuration(...args), getCurrentTime: (...args: Parameters<typeof getCurrentTime>): ReturnType<typeof getCurrentTime> => _rozieExposeRef.current.getCurrentTime(...args), getWaveSurfer: (...args: Parameters<typeof getWaveSurfer>): ReturnType<typeof getWaveSurfer> => _rozieExposeRef.current.getWaveSurfer(...args) }), []);

  return (
    <>
    <div ref={container} {...attrs} className={clsx("rozie-waveform", (attrs.className as string | undefined))} data-rozie-s-0b6fbb3a="" />
    </>
  );
});
export default Waveform;
