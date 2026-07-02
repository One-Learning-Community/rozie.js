import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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

@Component({
  selector: 'rozie-waveform',
  standalone: true,
  template: `

    <div class="rozie-waveform" #container #rozieSpread_0 #rozieListenersTarget_1></div>

  `,
  styles: [`
    .rozie-waveform {
      width: 100%;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Waveform),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Waveform {
  /**
   * The audio URL the waveform loads. Bound at construction and reconciled at runtime — changing it calls the engine `load(url)`.
   * @example
   * <Waveform :src="audioUrl" r-model:currentTime="time" />
   */
  src = input<(string) | null>(null);
  /**
   * The waveform height in pixels. Reconciled at runtime via `setOptions`.
   */
  height = input<number>(128);
  /**
   * The color of the unplayed portion of the waveform. Reconciled at runtime via `setOptions`.
   */
  waveColor = input<string>('#8a2be2');
  /**
   * The color of the played (progress) portion of the waveform. Reconciled at runtime via `setOptions`.
   */
  progressColor = input<string>('#5a189a');
  /**
   * The color of the playback cursor. Reconciled at runtime via `setOptions`.
   */
  cursorColor = input<string>('#333333');
  /**
   * The width of the playback cursor in pixels. Reconciled at runtime via `setOptions`.
   */
  cursorWidth = input<number>(1);
  /**
   * Draw the waveform as bars of this pixel width. `null` (default) renders a continuous waveform. Reconciled at runtime via `setOptions`.
   */
  barWidth = input<(unknown) | null>(null);
  /**
   * The pixel gap between bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
   */
  barGap = input<(unknown) | null>(null);
  /**
   * The corner radius of bars (when `barWidth` is set). Reconciled at runtime via `setOptions`.
   */
  barRadius = input<(unknown) | null>(null);
  /**
   * The minimum pixels-per-second zoom level. Reconciled at runtime via `zoom`.
   */
  minPxPerSec = input<number>(1);
  /**
   * Playback volume (`0`–`1`). Reconciled at runtime via `setVolume`.
   */
  volume = input<number>(1);
  /**
   * Playback speed multiplier. Reconciled at runtime via `setPlaybackRate`.
   */
  playbackRate = input<number>(1);
  /**
   * Begin playback as soon as the audio is ready. Construction-only.
   */
  autoplay = input<boolean>(false);
  /**
   * Normalize the waveform by its largest peak (wavesurfer's `normalize` option). Reconciled at runtime via `setOptions`.
   */
  normalizeAmplitude = input<boolean>(false);
  /**
   * Hide the horizontal scrollbar when the waveform is zoomed wider than its container. Construction-only.
   */
  hideScrollbar = input<boolean>(false);
  /**
   * Disable click/seek interaction with the waveform (the engine defaults to interactive). Construction-only.
   */
  disableInteraction = input<boolean>(false);
  /**
   * Disable drag-to-seek across the waveform (the engine defaults to drag-seekable). Construction-only.
   */
  disableDragToSeek = input<boolean>(false);
  /**
   * Render a time-ruler beneath the waveform (the wavesurfer Timeline plugin). Construction-only in v1 — toggling after mount is a no-op.
   */
  timeline = input<boolean>(false);
  /**
   * Show a hover cursor with a time label as the pointer moves over the waveform (the wavesurfer Hover plugin). Construction-only in v1 — toggling after mount is a no-op.
   */
  hover = input<boolean>(false);
  /**
   * The line color of the Hover plugin cursor (only applies when `hover` is enabled). Construction-only in v1.
   */
  hoverColor = input<(string) | null>(null);
  /**
   * Raw wavesurfer `WaveSurferOptions` passthrough — spread into `WaveSurfer.create()` before the curated keys (explicit props win). Use it for any v7 option not surfaced as a first-class prop (`peaks`, `duration`, `sampleRate`, `mediaControls`, `splitChannels`, …).
   */
  options = input<Record<string, any>>((() => ({}))());
  /**
   * The current playback position in seconds. The lone two-way `model: true` prop: playback writes the live position back on every `timeupdate` (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write seeks the engine via `setTime`.
   */
  currentTime = model<unknown>(undefined);
  container = viewChild<ElementRef<HTMLDivElement>>('container');
  ready = output<unknown>();
  playing = output<void>();
  paused = output<void>();
  finished = output<void>();
  timeupdate = output<unknown>();
  seeking = output<unknown>();
  interaction = output<unknown>();
  loading = output<unknown>();
  error = output<unknown>();
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;
  private __rozieWatchInitial_6 = true;
  private __rozieWatchInitial_7 = true;
  private __rozieWatchInitial_8 = true;
  private __rozieWatchInitial_9 = true;
  private __rozieWatchInitial_10 = true;
  private __rozieWatchInitial_11 = true;
  private __rozieWatchInitial_12 = true;
  private __rozieWatchInitial_13 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.src())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (this.ws && typeof v === 'string' && v) this.ws.load(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.height())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => {
      if (this.ws) this.ws.setOptions({
        height: v
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.waveColor())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } ((v: any) => {
      if (this.ws) this.ws.setOptions({
        waveColor: v
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.progressColor())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => {
      if (this.ws) this.ws.setOptions({
        progressColor: v
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.cursorColor())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => {
      if (this.ws) this.ws.setOptions({
        cursorColor: v
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.cursorWidth())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((v: any) => {
      if (this.ws) this.ws.setOptions({
        cursorWidth: v
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.barWidth())(); untracked(() => { if (this.__rozieWatchInitial_6) { this.__rozieWatchInitial_6 = false; return; } ((v: any) => {
      if (this.ws) this.ws.setOptions({
        barWidth: v ?? undefined
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.barGap())(); untracked(() => { if (this.__rozieWatchInitial_7) { this.__rozieWatchInitial_7 = false; return; } ((v: any) => {
      if (this.ws) this.ws.setOptions({
        barGap: v ?? undefined
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.barRadius())(); untracked(() => { if (this.__rozieWatchInitial_8) { this.__rozieWatchInitial_8 = false; return; } ((v: any) => {
      if (this.ws) this.ws.setOptions({
        barRadius: v ?? undefined
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.normalizeAmplitude())(); untracked(() => { if (this.__rozieWatchInitial_9) { this.__rozieWatchInitial_9 = false; return; } ((v: any) => {
      if (this.ws) this.ws.setOptions({
        normalize: v
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.volume())(); untracked(() => { if (this.__rozieWatchInitial_10) { this.__rozieWatchInitial_10 = false; return; } ((v: any) => {
      if (this.ws && typeof v === 'number') this.ws.setVolume(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.playbackRate())(); untracked(() => { if (this.__rozieWatchInitial_11) { this.__rozieWatchInitial_11 = false; return; } ((v: any) => {
      if (this.ws && typeof v === 'number') this.ws.setPlaybackRate(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.minPxPerSec())(); untracked(() => { if (this.__rozieWatchInitial_12) { this.__rozieWatchInitial_12 = false; return; } ((v: any) => {
      if (this.ws && typeof v === 'number' && v > 0) this.ws.zoom(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.currentTime())(); untracked(() => { if (this.__rozieWatchInitial_13) { this.__rozieWatchInitial_13 = false; return; } ((v: any) => {
      // Round-trip guard: skip if the incoming value already matches the engine
      // position (the timeupdate → $model → $watch echo), else seek.
      if (!this.ws || typeof v !== 'number') return;
      if (Math.abs(v - this.ws.getCurrentTime()) < 0.05) return;
      this.ws.setTime(v);
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    // $refs read ONLY here (ROZ123). The container is the engine's attach target.
    this.buildWaveSurfer();
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.ws) this.ws.destroy();
    });
  }

  ws: any = null;
  buildWaveSurfer = () => {
    let plugins = [];
    plugins = [];
    if (this.timeline()) plugins.push(TimelinePlugin.create());
    if (this.hover()) plugins.push(HoverPlugin.create({
      lineColor: this.hoverColor() ?? undefined
    }));
    let cfg: any = null;
    cfg = {
      ...this.options(),
      container: this.container()?.nativeElement,
      url: this.src() ?? undefined,
      height: this.height(),
      waveColor: this.waveColor(),
      progressColor: this.progressColor(),
      cursorColor: this.cursorColor(),
      cursorWidth: this.cursorWidth(),
      barWidth: this.barWidth() ?? undefined,
      barGap: this.barGap() ?? undefined,
      barRadius: this.barRadius() ?? undefined,
      minPxPerSec: this.minPxPerSec(),
      autoplay: this.autoplay(),
      normalize: this.normalizeAmplitude(),
      hideScrollbar: this.hideScrollbar(),
      interact: !this.disableInteraction(),
      dragToSeek: !this.disableDragToSeek(),
      plugins: plugins
    };
    this.ws = WaveSurfer.create(cfg);

    // ── engine events → emits + the two-way currentTime writeback ──────────────
    this.ws.on('ready', (duration: any) => this.ready.emit(duration));
    this.ws.on('play', () => this.playing.emit());
    this.ws.on('pause', () => this.paused.emit());
    this.ws.on('finish', () => this.finished.emit());
    this.ws.on('timeupdate', (t: any) => {
      // Echo the live position into the two-way model, then emit. The reverse
      // $watch below is value-equality-guarded, so this write does not loop.
      this.currentTime.set(t), this.__rozieCvaOnChange(t);
      this.timeupdate.emit(t);
    });
    this.ws.on('seeking', (t: any) => this.seeking.emit(t));
    this.ws.on('interaction', (t: any) => this.interaction.emit(t));
    this.ws.on('loading', (percent: any) => this.loading.emit(percent));
    this.ws.on('error', (err: any) => this.error.emit(err));
  };
  play = () => {
    if (this.ws) this.ws.play();
  };
  pause = () => {
    if (this.ws) this.ws.pause();
  };
  playPause = () => {
    if (this.ws) this.ws.playPause();
  };
  stop = () => {
    if (this.ws) this.ws.stop();
  };
  seekTo = (progress: any) => {
    if (this.ws) this.ws.seekTo(progress);
  };
  setTime = (seconds: any) => {
    if (this.ws) this.ws.setTime(seconds);
  };
  setVolume = (v: any) => {
    if (this.ws) this.ws.setVolume(v);
  };
  setPlaybackRate = (rate: any) => {
    if (this.ws) this.ws.setPlaybackRate(rate);
  };
  setZoom = (pxPerSec: any) => {
    if (this.ws) this.ws.zoom(pxPerSec);
  };
  load = (url: any) => {
    if (this.ws) this.ws.load(url);
  };
  isPlaying = () => {
    return this.ws ? this.ws.isPlaying() : false;
  };
  getDuration = () => {
    return this.ws ? this.ws.getDuration() : 0;
  };
  getCurrentTime = () => {
    return this.ws ? this.ws.getCurrentTime() : 0;
  };
  getWaveSurfer = () => {
    return this.ws;
  };

  private __rozieCvaOnChange: (v: unknown) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: unknown | null): void {
    this.currentTime.set(v ?? undefined);
  }
  registerOnChange(fn: (v: unknown) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
    const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
    const parseClassTokens = (value: unknown): string[] => {
      if (typeof value !== 'string') return [];
      const out: string[] = [];
      for (const tok of value.split(/\s+/)) {
        if (tok.length > 0) out.push(tok);
      }
      return out;
    };
    const parseStyleDecls = (value: unknown): Array<[string, string]> => {
      if (typeof value !== 'string') return [];
      const out: Array<[string, string]> = [];
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const prop = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (prop.length > 0) out.push([prop, val]);
      }
      return out;
    };
    const applyClassMerge = (el: HTMLElement, value: unknown) => {
      const next = parseClassTokens(value);
      const prev = prevClassTokensByElement.get(el) ?? [];
      const nextSet = new Set(next);
      for (const tok of prev) {
        if (!nextSet.has(tok)) el.classList.remove(tok);
      }
      for (const tok of next) el.classList.add(tok);
      prevClassTokensByElement.set(el, next);
    };
    const applyStyleMerge = (el: HTMLElement, value: unknown) => {
      const next = parseStyleDecls(value);
      const prev = prevStylePropsByElement.get(el) ?? [];
      const nextProps = next.map(([p]) => p);
      const nextSet = new Set(nextProps);
      for (const prop of prev) {
        if (!nextSet.has(prop)) el.style.removeProperty(prop);
      }
      for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
      prevStylePropsByElement.set(el, nextProps);
    };
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (k === 'class' || k === 'style') continue;
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
        applyClassMerge(el, '');
      }
      if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
        applyStyleMerge(el, '');
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (k === 'class') {
          applyClassMerge(el, v);
        } else if (k === 'style') {
          applyStyleMerge(el, v);
        } else if (v === null || v === false) {
          renderer.removeAttribute(el, k);
        } else {
          renderer.setAttribute(el, k, String(v));
        }
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_1.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_1) {
      this.__rozieListenersDestroyRegistered_1 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_1) off();
        this.__rozieListenersDisposers_1 = [];
      });
    }
  });
}

export default Waveform;
