import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
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

@customElement('rozie-waveform')
export default class Waveform extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-waveform[data-rozie-s-0b6fbb3a] {
  width: 100%;
}
`;

  /**
   * The audio URL the waveform loads. Bound at construction and reconciled at runtime — changing it calls the engine `load(url)`.
   * @example
   * <Waveform :src="audioUrl" r-model:currentTime="time" />
   */
  @property({ type: String, reflect: true }) src: string | null = null;
  /**
   * Pre-computed waveform peaks (an array of channel sample arrays, or a single `number[]`). Renders the waveform without downloading or decoding audio — pair with `duration`. Construction-only.
   */
  @property({ type: Object }) peaks: unknown = undefined;
  /**
   * The audio duration in seconds. Required alongside `peaks` when rendering without a decodable `src` (the timeline/ruler and region positions are derived from it). Construction-only.
   */
  @property({ type: Number, reflect: true }) duration: number | null = null;
  /**
   * The waveform height in pixels. Reconciled at runtime via `setOptions`.
   */
  @property({ type: Number, reflect: true }) height: number = 128;
  /**
   * The color of the unplayed portion of the waveform. Reconciled at runtime via `setOptions`.
   */
  @property({ type: String, reflect: true }) waveColor: string = '#8a2be2';
  /**
   * The color of the played (progress) portion of the waveform. Reconciled at runtime via `setOptions`.
   */
  @property({ type: String, reflect: true }) progressColor: string = '#5a189a';
  /**
   * The color of the playback cursor. Reconciled at runtime via `setOptions`.
   */
  @property({ type: String, reflect: true }) cursorColor: string = '#333333';
  /**
   * The width of the playback cursor in pixels. Reconciled at runtime via `setOptions`.
   */
  @property({ type: Number, reflect: true }) cursorWidth: number = 1;
  /**
   * Draw the waveform as bars of this pixel width. `null` (default) renders a continuous waveform. Reconciled at runtime via `setOptions`.
   */
  @property({ type: Object }) barWidth: unknown = null;
  /**
   * The pixel gap between bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
   */
  @property({ type: Object }) barGap: unknown = null;
  /**
   * The corner radius of bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
   */
  @property({ type: Object }) barRadius: unknown = null;
  /**
   * The minimum pixels-per-second zoom level. Reconciled at runtime via `zoom`.
   */
  @property({ type: Number, reflect: true }) minPxPerSec: number = 1;
  /**
   * Playback volume (`0`–`1`). Reconciled at runtime via `setVolume`.
   */
  @property({ type: Number, reflect: true }) volume: number = 1;
  /**
   * Playback speed multiplier. Reconciled at runtime via `setPlaybackRate`.
   */
  @property({ type: Number, reflect: true }) playbackRate: number = 1;
  /**
   * Begin playback as soon as the audio is ready. Construction-only.
   */
  @property({ type: Boolean, reflect: true }) autoplay: boolean = false;
  /**
   * Normalize the waveform by its largest peak (wavesurfer's `normalize` option). Reconciled at runtime via `setOptions`.
   */
  @property({ type: Boolean, reflect: true }) normalizeAmplitude: boolean = false;
  /**
   * Hide the horizontal scrollbar when the waveform is zoomed wider than its container. Construction-only.
   */
  @property({ type: Boolean, reflect: true }) hideScrollbar: boolean = false;
  /**
   * Disable click/seek interaction with the waveform (the engine defaults to interactive). Construction-only.
   */
  @property({ type: Boolean, reflect: true }) disableInteraction: boolean = false;
  /**
   * Disable drag-to-seek across the waveform (the engine defaults to drag-seekable). Construction-only.
   */
  @property({ type: Boolean, reflect: true }) disableDragToSeek: boolean = false;
  /**
   * Render a time-ruler beneath the waveform (the wavesurfer Timeline plugin). Construction-only in v1 — toggling after mount is a no-op.
   */
  @property({ type: Boolean, reflect: true }) timeline: boolean = false;
  /**
   * Show a hover cursor with a time label as the pointer moves over the waveform (the wavesurfer Hover plugin). Construction-only in v1 — toggling after mount is a no-op.
   */
  @property({ type: Boolean, reflect: true }) hover: boolean = false;
  /**
   * The line color of the Hover plugin cursor (only applies when `hover` is enabled). Construction-only in v1.
   */
  @property({ type: String, reflect: true }) hoverColor: string | null = null;
  /**
   * The interactive regions as an array of `{ id?, start, end?, content?, color?, drag?, resize? }`. Providing an array (even empty) registers the Regions plugin at construction. Two-way (`model: true`): user create / drag / resize / remove writes the updated array back (round-trip-guarded); a consumer write reconciles the live regions (add / update / remove by `id`).
   */
  @property({ type: Object, attribute: 'regions' }) _regions_attr: unknown = undefined;
  private _regionsControllable = createLitControllableProperty<unknown>({ host: this, eventName: 'regions-change', defaultValue: undefined, initialControlledValue: undefined });
  /**
   * Allow drawing new regions by dragging over empty waveform space (Regions plugin `enableDragSelection`). Requires `regions` to be an array. Construction-only in v1.
   */
  @property({ type: Boolean, reflect: true }) dragToCreateRegions: boolean = false;
  /**
   * Default fill color for drag-created regions (only applies when `dragToCreateRegions` is on). Construction-only in v1.
   */
  @property({ type: String, reflect: true }) regionColor: string | null = null;
  /**
   * Raw wavesurfer `WaveSurferOptions` passthrough — spread into `WaveSurfer.create()` before the curated keys (explicit props win). Use it for any v7 option not surfaced as a first-class prop (`sampleRate`, `mediaControls`, `splitChannels`, `barHeight`, …).
   */
  @property({ type: Object }) options: any = {};
  /**
   * The current playback position in seconds. The lone two-way `model: true` prop: playback writes the live position back on every `timeupdate` (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write seeks the engine via `setTime`.
   */
  @property({ type: Object, attribute: 'current-time' }) _currentTime_attr: unknown = undefined;
  private _currentTimeControllable = createLitControllableProperty<unknown>({ host: this, eventName: 'current-time-change', defaultValue: undefined, initialControlledValue: undefined });
  @query('[data-rozie-ref="container"]') private _refContainer!: HTMLElement;
private __rozieWatchInitial_13 = true;
private __rozieWatchInitial_14 = true;
private __rozieFirstUpdateDone = false;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this._disconnectCleanups.push((() => {
      if (this.ws) this.ws.destroy();
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.currentTime)(); untracked(() => { if (this.__rozieWatchInitial_13) { this.__rozieWatchInitial_13 = false; return; } ((v: any) => {
      // Round-trip guard: skip if the incoming value already matches the engine
      // position (the timeupdate → $model → $watch echo), else seek.
      if (!this.ws || typeof v !== 'number') return;
      if (Math.abs(v - this.ws.getCurrentTime()) < 0.05) return;
      this.ws.setTime(v);
    })(__watchVal); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.regions)(); untracked(() => { if (this.__rozieWatchInitial_14) { this.__rozieWatchInitial_14 = false; return; } ((list: any) => {
      // Controlled reconcile of the live regions to match the incoming list.
      // Gated on `regionsReady` (duration known) and value-equality-guarded inside
      // reconcileRegions so a writeback echo doesn't loop.
      if (!this.regionsReady) return;
      this.reconcileRegions(list);
    })(__watchVal); }); }));

    // $refs read ONLY here (ROZ123). The container is the engine's attach target.
    this.buildWaveSurfer();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('src'))) { const __watchVal = (() => this.src)(); ((v: any) => {
      if (this.ws && typeof v === 'string' && v) this.ws.load(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('height'))) { const __watchVal = (() => this.height)(); ((v: any) => {
      if (this.ws) this.ws.setOptions({
        height: v
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('waveColor'))) { const __watchVal = (() => this.waveColor)(); ((v: any) => {
      if (this.ws) this.ws.setOptions({
        waveColor: v
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('progressColor'))) { const __watchVal = (() => this.progressColor)(); ((v: any) => {
      if (this.ws) this.ws.setOptions({
        progressColor: v
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('cursorColor'))) { const __watchVal = (() => this.cursorColor)(); ((v: any) => {
      if (this.ws) this.ws.setOptions({
        cursorColor: v
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('cursorWidth'))) { const __watchVal = (() => this.cursorWidth)(); ((v: any) => {
      if (this.ws) this.ws.setOptions({
        cursorWidth: v
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('barWidth'))) { const __watchVal = (() => this.barWidth)(); ((v: any) => {
      if (this.ws) this.ws.setOptions({
        barWidth: v ?? undefined
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('barGap'))) { const __watchVal = (() => this.barGap)(); ((v: any) => {
      if (this.ws) this.ws.setOptions({
        barGap: v ?? undefined
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('barRadius'))) { const __watchVal = (() => this.barRadius)(); ((v: any) => {
      if (this.ws) this.ws.setOptions({
        barRadius: v ?? undefined
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('normalizeAmplitude'))) { const __watchVal = (() => this.normalizeAmplitude)(); ((v: any) => {
      if (this.ws) this.ws.setOptions({
        normalize: v
      });
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('volume'))) { const __watchVal = (() => this.volume)(); ((v: any) => {
      if (this.ws && typeof v === 'number') this.ws.setVolume(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('playbackRate'))) { const __watchVal = (() => this.playbackRate)(); ((v: any) => {
      if (this.ws && typeof v === 'number') this.ws.setPlaybackRate(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('minPxPerSec'))) { const __watchVal = (() => this.minPxPerSec)(); ((v: any) => {
      if (this.ws && typeof v === 'number' && v > 0) this.ws.zoom(v);
    })(__watchVal); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'regions') this._regionsControllable.notifyAttributeChange(value as unknown as unknown);
    if (name === 'current-time') this._currentTimeControllable.notifyAttributeChange(value as unknown as unknown);
  }

  render() {
    return html`
<div class="rozie-waveform" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="container" data-rozie-s-0b6fbb3a></div>
`;
  }

  ws: any = null;

  regionsPlugin: any = null;

  regionsReady = false;

  reconciling = false;

  serializeRegion = (r: any) => ({
  id: r.id,
  start: r.start,
  end: r.end,
  color: r.color,
  content: r.content && r.content.textContent ? r.content.textContent : undefined,
  drag: r.drag,
  resize: r.resize
});

  sameRegions = (list: any, engineRegions: any) => {
  if (!Array.isArray(list) || list.length !== engineRegions.length) return false;
  const key = (r: any) => `${r.id}:${Math.round((r.start ?? 0) * 1000)}:${Math.round((r.end ?? 0) * 1000)}`;
  const a = list.map(key).sort();
  const b = engineRegions.map(key).sort();
  return a.every((k: any, i: any) => k === b[i]);
};

  writeBackRegions = () => {
  if (!this.regionsPlugin || this.reconciling) return;
  this._regionsControllable.write(this.regionsPlugin.getRegions().map(this.serializeRegion));
};

  reconcileRegions = (list: any) => {
  if (!this.regionsPlugin || !Array.isArray(list)) return;
  const current = this.regionsPlugin.getRegions();
  if (this.sameRegions(list, current)) return;
  this.reconciling = true;
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
      const created = this.regionsPlugin.addRegion({
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
  this.reconciling = false;
  if (addedWithoutId) this.writeBackRegions();
};

  buildWaveSurfer = () => {
  let plugins = [];
  plugins = [];
  if (this.timeline) plugins.push(TimelinePlugin.create());
  if (this.hover) plugins.push(HoverPlugin.create({
    lineColor: this.hoverColor ?? undefined
  }));
  // Regions plugin is registered when `regions` is an array (even empty).
  this.regionsPlugin = null;
  if (Array.isArray(this.regions)) {
    this.regionsPlugin = RegionsPlugin.create();
    plugins.push(this.regionsPlugin);
  }
  let cfg: any = null;
  cfg = {
    ...this.options,
    container: this._refContainer,
    url: this.src ?? undefined,
    height: this.height,
    waveColor: this.waveColor,
    progressColor: this.progressColor,
    cursorColor: this.cursorColor,
    cursorWidth: this.cursorWidth,
    barWidth: this.barWidth ?? undefined,
    barGap: this.barGap ?? undefined,
    barRadius: this.barRadius ?? undefined,
    minPxPerSec: this.minPxPerSec,
    autoplay: this.autoplay,
    normalize: this.normalizeAmplitude,
    hideScrollbar: this.hideScrollbar,
    interact: !this.disableInteraction,
    dragToSeek: !this.disableDragToSeek,
    plugins: plugins
  };
  // peaks/duration override the `options` bag ONLY when actually provided —
  // assigning `undefined` unconditionally would clobber a caller's options.peaks.
  if (this.peaks != null) cfg.peaks = this.peaks;
  if (this.duration != null) cfg.duration = this.duration;
  this.ws = WaveSurfer.create(cfg);

  // ── engine events → emits + the two-way currentTime writeback ──────────────
  this.ws.on('ready', (duration: any) => {
    // Regions can only be placed once the duration is known — do the initial
    // reconcile + drag-selection wiring here, then open the gate for prop-driven
    // reconciles. ($watch is lazy, so it never fires at mount; this is the only
    // place initial regions get added.)
    if (this.regionsPlugin) {
      this.regionsReady = true;
      if (this.dragToCreateRegions) {
        this.regionsPlugin.enableDragSelection({
          color: this.regionColor ?? undefined
        });
      }
      this.reconcileRegions(this.regions);
    }
    this.dispatchEvent(new CustomEvent("ready", {
      detail: duration,
      bubbles: true,
      composed: true
    }));
  });
  this.ws.on('play', () => this.dispatchEvent(new CustomEvent("playing", {
    detail: undefined,
    bubbles: true,
    composed: true
  })));
  this.ws.on('pause', () => this.dispatchEvent(new CustomEvent("paused", {
    detail: undefined,
    bubbles: true,
    composed: true
  })));
  this.ws.on('finish', () => this.dispatchEvent(new CustomEvent("finished", {
    detail: undefined,
    bubbles: true,
    composed: true
  })));
  this.ws.on('timeupdate', (t: any) => {
    // Echo the live position into the two-way model, then emit. The reverse
    // $watch below is value-equality-guarded, so this write does not loop.
    this._currentTimeControllable.write(t);
    this.dispatchEvent(new CustomEvent("timeupdate", {
      detail: t,
      bubbles: true,
      composed: true
    }));
  });
  this.ws.on('seeking', (t: any) => this.dispatchEvent(new CustomEvent("seeking", {
    detail: t,
    bubbles: true,
    composed: true
  })));
  this.ws.on('interaction', (t: any) => this.dispatchEvent(new CustomEvent("interaction", {
    detail: t,
    bubbles: true,
    composed: true
  })));
  this.ws.on('loading', (percent: any) => this.dispatchEvent(new CustomEvent("loading", {
    detail: percent,
    bubbles: true,
    composed: true
  })));
  this.ws.on('error', (err: any) => this.dispatchEvent(new CustomEvent("error", {
    detail: err,
    bubbles: true,
    composed: true
  })));

  // ── regions plugin events → emits + two-way `regions` writeback ────────────
  // Each is a no-op during a controlled reconcile (the `reconciling` guard) so a
  // programmatic add/update/remove does not echo back or double-emit; only genuine
  // user gestures (drag-create, drag/resize, delete) drive the model + emits.
  if (this.regionsPlugin) {
    this.regionsPlugin.on('region-created', (region: any) => {
      if (this.reconciling) return;
      this.dispatchEvent(new CustomEvent("regionCreated", {
        detail: this.serializeRegion(region),
        bubbles: true,
        composed: true
      }));
      this.writeBackRegions();
    });
    this.regionsPlugin.on('region-updated', (region: any) => {
      if (this.reconciling) return;
      this.dispatchEvent(new CustomEvent("regionUpdated", {
        detail: this.serializeRegion(region),
        bubbles: true,
        composed: true
      }));
      this.writeBackRegions();
    });
    this.regionsPlugin.on('region-removed', (region: any) => {
      if (this.reconciling) return;
      this.dispatchEvent(new CustomEvent("regionRemoved", {
        detail: this.serializeRegion(region),
        bubbles: true,
        composed: true
      }));
      this.writeBackRegions();
    });
    this.regionsPlugin.on('region-clicked', (region: any) => {
      this.dispatchEvent(new CustomEvent("regionClicked", {
        detail: this.serializeRegion(region),
        bubbles: true,
        composed: true
      }));
    });
    // Playback entered/left a region — pure notifications (no writeback), so they
    // fire regardless of the reconcile guard. The events for active-segment
    // highlighting, transcript/karaoke sync, and loop-a-region.
    this.regionsPlugin.on('region-in', (region: any) => {
      this.dispatchEvent(new CustomEvent("regionIn", {
        detail: this.serializeRegion(region),
        bubbles: true,
        composed: true
      }));
    });
    this.regionsPlugin.on('region-out', (region: any) => {
      this.dispatchEvent(new CustomEvent("regionOut", {
        detail: this.serializeRegion(region),
        bubbles: true,
        composed: true
      }));
    });
  }
};

  play() {
    if (this.ws) this.ws.play();
  }

  pause() {
    if (this.ws) this.ws.pause();
  }

  playPause() {
    if (this.ws) this.ws.playPause();
  }

  stop() {
    if (this.ws) this.ws.stop();
  }

  seekTo(progress: any) {
    if (this.ws) this.ws.seekTo(progress);
  }

  setTime(seconds: any) {
    if (this.ws) this.ws.setTime(seconds);
  }

  setVolume(v: any) {
    if (this.ws) this.ws.setVolume(v);
  }

  setPlaybackRate(rate: any) {
    if (this.ws) this.ws.setPlaybackRate(rate);
  }

  setZoom(pxPerSec: any) {
    if (this.ws) this.ws.zoom(pxPerSec);
  }

  load(url: any) {
    if (this.ws) this.ws.load(url);
  }

  isPlaying() {
    return this.ws ? this.ws.isPlaying() : false;
  }

  getDuration() {
    return this.ws ? this.ws.getDuration() : 0;
  }

  getCurrentTime() {
    return this.ws ? this.ws.getCurrentTime() : 0;
  }

  getWaveSurfer() {
    return this.ws;
  }

  addRegion(opts: any) {
    return this.regionsPlugin ? this.regionsPlugin.addRegion(opts) : null;
  }

  clearRegions() {
    if (this.regionsPlugin) this.regionsPlugin.clearRegions();
  }

  getRegions() {
    return this.regionsPlugin ? this.regionsPlugin.getRegions() : [];
  }

  get regions(): unknown { return this._regionsControllable.read(); }
  set regions(v: unknown) { this._regionsControllable.notifyPropertyWrite(v); }
  get currentTime(): unknown { return this._currentTimeControllable.read(); }
  set currentTime(v: unknown) { this._currentTimeControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['src', 'peaks', 'duration', 'height', 'wave-color', 'wavecolor', 'progress-color', 'progresscolor', 'cursor-color', 'cursorcolor', 'cursor-width', 'cursorwidth', 'bar-width', 'barwidth', 'bar-gap', 'bargap', 'bar-radius', 'barradius', 'min-px-per-sec', 'minpxpersec', 'volume', 'playback-rate', 'playbackrate', 'autoplay', 'normalize-amplitude', 'normalizeamplitude', 'hide-scrollbar', 'hidescrollbar', 'disable-interaction', 'disableinteraction', 'disable-drag-to-seek', 'disabledragtoseek', 'timeline', 'hover', 'hover-color', 'hovercolor', 'regions', 'drag-to-create-regions', 'dragtocreateregions', 'region-color', 'regioncolor', 'options', 'current-time', 'currenttime']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
