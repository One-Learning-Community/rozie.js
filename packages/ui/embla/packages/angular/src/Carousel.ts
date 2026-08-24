import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.

interface SlideCtx {
  $implicit: { slide: any; index: any };
  slide: any;
  index: any;
}

interface DefaultCtx {}

interface ThumbCtx {
  $implicit: { slide: any; index: any };
  slide: any;
  index: any;
}

@Component({
  selector: 'rozie-carousel',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-embla" [ngClass]="{ 'rozie-embla--vertical': axis() === 'y' }" #rozieSpread_0 #rozieListenersTarget_1>
      
      <div class="rozie-embla__stage">
        @if (arrows()) {
    <button type="button" class="rozie-embla__arrow rozie-embla__arrow--prev" [disabled]="!canPrev()" aria-label="Previous slide" (click)="scrollPrev()">‹</button>
    }<div class="rozie-embla__viewport" #viewportEl>
          <div class="rozie-embla__container">
            
            @for (slide of slides(); track keyFor(slide, i); let i = $index) {
    <div class="rozie-embla__slide">
              @if ((slideTpl ?? __rozieFillMap()['slide'] ?? templates()?.['slide'])) {
    <ng-container *ngTemplateOutlet="(slideTpl ?? __rozieFillMap()['slide'] ?? templates()?.['slide']); context: { $implicit: { slide: slide, index: i }, slide: slide, index: i }" />
    } @else {
    {{ rozieDisplay(slide) }}
    }
            </div>
    }
            
            <ng-container *ngTemplateOutlet="(defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot'])" />
          </div>
        </div>
        @if (arrows()) {
    <button type="button" class="rozie-embla__arrow rozie-embla__arrow--next" [disabled]="!canNext()" aria-label="Next slide" (click)="scrollNext()">›</button>
    }</div>

      
      @if (dots()) {
    <div class="rozie-embla__dots">
        @for (di of snaps(); track di) {
    <button type="button" class="rozie-embla__dot" [ngClass]="{ 'is-selected': di === selected() }" [attr.aria-label]="rozieAttr('Go to slide ' + (di + 1))" (click)="scrollToIndex(di)"></button>
    }
      </div>
    }@if (thumbnails()) {
    <div class="rozie-embla__thumbs">
        <div class="rozie-embla__thumbs-viewport" #thumbsViewportEl>
          <div class="rozie-embla__thumbs-container">
            @for (item of slides(); track keyFor(item, i); let i = $index) {
    <div class="rozie-embla__thumb" [ngClass]="{ 'is-selected': i === selected() }" (click)="selectThumb(i)">
              @if ((thumbTpl ?? __rozieFillMap()['thumb'] ?? templates()?.['thumb'])) {
    <ng-container *ngTemplateOutlet="(thumbTpl ?? __rozieFillMap()['thumb'] ?? templates()?.['thumb']); context: { $implicit: { slide: item, index: i }, slide: item, index: i }" />
    } @else {
    {{ rozieDisplay(item) }}
    }
            </div>
    }
          </div>
        </div>
      </div>
    }</div>

  `,
  styles: [`
    :host(rozie-carousel) { display: contents; }
    .rozie-embla { position: relative; }
    .rozie-embla__stage { position: relative; }
    .rozie-embla__viewport { overflow: hidden; }
    .rozie-embla__container { display: flex; }
    .rozie-embla__slide { flex: 0 0 100%; min-width: 0; }
    .rozie-embla--vertical .rozie-embla__container { flex-direction: column; height: 100%; }
    .rozie-embla--vertical .rozie-embla__slide { flex: 0 0 100%; min-height: 0; }
    .rozie-embla__arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--rozie-embla-arrow-size, 2.25rem);
      height: var(--rozie-embla-arrow-size, 2.25rem);
      padding: 0;
      border: none;
      border-radius: var(--rozie-embla-arrow-radius, 50%);
      background: var(--rozie-embla-arrow-bg, rgb(255 255 255 / 0.9));
      color: var(--rozie-embla-arrow-fg, var(--rozie-embla-accent, #1a1a1a));
      font-size: var(--rozie-embla-arrow-font-size, 1.5rem);
      line-height: 1;
      cursor: pointer;
      box-shadow: var(--rozie-embla-arrow-shadow, 0 1px 4px rgb(0 0 0 / 0.25));
      transition: opacity 0.15s ease, background 0.15s ease;
    }
    .rozie-embla__arrow:hover { background: var(--rozie-embla-arrow-hover-bg, #fff); }
    .rozie-embla__arrow:disabled { opacity: var(--rozie-embla-arrow-disabled-opacity, 0.35); cursor: default; }
    .rozie-embla__arrow--prev { left: var(--rozie-embla-arrow-inset, 0.5rem); }
    .rozie-embla__arrow--next { right: var(--rozie-embla-arrow-inset, 0.5rem); }
    .rozie-embla__dots {
      display: flex;
      justify-content: center;
      gap: var(--rozie-embla-dots-gap, 0.4rem);
      padding: var(--rozie-embla-dots-padding, 0.625rem 0);
    }
    .rozie-embla__dot {
      width: var(--rozie-embla-dot-size, 0.5rem);
      height: var(--rozie-embla-dot-size, 0.5rem);
      padding: 0;
      border: none;
      border-radius: 50%;
      background: var(--rozie-embla-dot-bg, rgb(0 0 0 / 0.25));
      cursor: pointer;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .rozie-embla__dot:hover { background: var(--rozie-embla-dot-hover-bg, rgba(0, 0, 0, 0.45)); }
    .rozie-embla__dot.is-selected {
      background: var(--rozie-embla-dot-selected-bg, var(--rozie-embla-accent, #1a1a1a));
      transform: scale(var(--rozie-embla-dot-selected-scale, 1.25));
    }
    .rozie-embla__thumbs { margin-top: var(--rozie-embla-thumbs-gap, 0.5rem); }
    .rozie-embla__thumbs-viewport { overflow: hidden; }
    .rozie-embla__thumbs-container { display: flex; gap: var(--rozie-embla-thumb-gap, 0.5rem); }
    .rozie-embla__thumb {
      flex: 0 0 auto;
      cursor: pointer;
      opacity: var(--rozie-embla-thumb-opacity, 0.5);
      border: var(--rozie-embla-thumb-border-width, 2px) solid var(--rozie-embla-thumb-border-color, transparent);
      border-radius: var(--rozie-embla-thumb-radius, 4px);
      overflow: hidden;
      transition: opacity 0.15s ease, border-color 0.15s ease;
    }
    .rozie-embla__thumb:hover { opacity: var(--rozie-embla-thumb-hover-opacity, 0.8); }
    .rozie-embla__thumb.is-selected {
      opacity: var(--rozie-embla-thumb-selected-opacity, 1);
      border-color: var(--rozie-embla-thumb-selected-border-color, var(--rozie-embla-accent, #1a1a1a));
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Carousel),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Carousel {
  /**
   * Slide data for config-array mode (mode a): Rozie renders one `.rozie-embla__slide` per item, optionally via the scoped `slide` slot for custom markup. Optional — leave it unset and use the default slot (mode b) to drop slide DOM directly.
   * @example
   * <rozie-carousel [slides]="['A', 'B', 'C']" [(selectedIndex)]="idx" />
   */
  slides = input<any[]>((() => [])());
  /**
   * Wrap from the last snap back to the first (the Embla `loop` option). Runtime-updatable — toggling it re-inits the engine.
   */
  loop = input<boolean>(false);
  /**
   * Snap alignment of slides within the viewport — one of `'start'`, `'center'`, or `'end'`. Runtime-updatable.
   */
  align = input<string>('center');
  /**
   * Scroll axis — `'x'` for a horizontal carousel or `'y'` for a vertical one. Runtime-updatable.
   */
  axis = input<string>('x');
  /**
   * Number of slides advanced per snap (the Embla `slidesToScroll` option). Runtime-updatable.
   */
  slidesToScroll = input<number>(1);
  /**
   * Enable momentum/free-scroll dragging with no hard snapping (the Embla `dragFree` option). Runtime-updatable.
   */
  dragFree = input<boolean>(false);
  /**
   * Enable pointer drag (mapped to the Embla `watchDrag` option — a Vue-clarity rename). Set `false` to disable dragging and leave only programmatic/arrow navigation. Runtime-updatable.
   */
  draggable = input<boolean>(true);
  /**
   * Edge-snap containment (the Embla `containScroll` option) — `''` (off), `'trimSnaps'`, or `'keepSnaps'`. Runtime-updatable.
   */
  containScroll = input<string>('trimSnaps');
  /**
   * Initial snap index the carousel starts at (the Embla `startIndex` option). Init-only — to move after mount use the `scrollToIndex()` handle verb or the `selectedIndex` model.
   */
  startIndex = input<number>(0);
  /**
   * Allow a fast flick to skip intermediate snaps (the Embla `skipSnaps` option). Runtime-updatable.
   */
  skipSnaps = input<boolean>(false);
  /**
   * Scroll transition duration in Embla's relative unit (the `duration` option) — lower is snappier. Runtime-updatable.
   */
  duration = input<number>(25);
  /**
   * Text/scroll direction — `'ltr'` or `'rtl'` (the Embla `direction` option). Runtime-updatable.
   */
  direction = input<string>('ltr');
  /**
   * Mount the `embla-carousel-autoplay` plugin to auto-advance the carousel. Toggling it at runtime rebuilds the plugin set.
   */
  autoplay = input<boolean>(false);
  /**
   * Delay in milliseconds between auto-advances when `autoplay` is on. Runtime-updatable.
   */
  autoplayDelay = input<number>(4000);
  /**
   * Show built-in dot pagination — one dot per scroll snap, the active snap highlighted, and clicking a dot scrolls to it. Opt-in, off by default.
   */
  dots = input<boolean>(false);
  /**
   * Show built-in prev/next arrow buttons overlaid on the viewport. The arrows disable at the ends unless `loop` is set. Opt-in, off by default.
   */
  arrows = input<boolean>(false);
  /**
   * Show a synced thumbnail strip below the carousel — its own Embla instance with one thumb per slide (config-array mode). Fill the `thumb` scoped slot for custom thumb content (falls back to the slide value). Clicking a thumb scrolls the main carousel; the main selection highlights and scrolls the active thumb. Opt-in, off by default.
   */
  thumbnails = input<boolean>(false);
  /**
   * Escape hatch — extra Embla plugins (Fade, Class Names, Wheel Gestures, …) appended verbatim after the built-in Autoplay plugin.
   */
  plugins = input<any[]>((() => [])());
  /**
   * Escape hatch — a raw `EmblaOptionsType` object spread last over the curated option props, so a consumer can override anything Embla supports.
   */
  options = input<Record<string, any>>((() => ({}))());
  /**
   * The current scroll-snap index (two-way `r-model`). Dragging or scrolling writes the new index back (echo-guarded so a programmatic `scrollTo` does not ping-pong); a consumer write scrolls the carousel. Distinct from the `select` emit — a model prop must not share a name with an emit.
   * @example
   * <rozie-carousel [slides]="items" [(selectedIndex)]="idx" />
   */
  selectedIndex = model<number>(0);
  snaps = signal<any[]>([]);
  selected = signal(0);
  canPrev = signal(false);
  canNext = signal(false);
  viewportEl = viewChild<ElementRef<HTMLDivElement>>('viewportEl');
  thumbsViewportEl = viewChild<ElementRef<HTMLDivElement>>('thumbsViewportEl');
  select = output<unknown>();
  settle = output<void>();
  reInit = output<void>();
  pointerDown = output<void>({ alias: 'pointer-down' });
  @ContentChild('slide', { read: TemplateRef }) slideTpl?: TemplateRef<SlideCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('thumb', { read: TemplateRef }) thumbTpl?: TemplateRef<ThumbCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  __rozieFills = contentChildren(RozieSlot, { descendants: true });
  __rozieFillMap = computed(() => {
    const map = Object.create(null) as Record<string, TemplateRef<unknown>>;
    for (const f of this.__rozieFills()) {
      const k = f.rozieSlot();
      if (k == null) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      map[k === '' ? 'defaultSlot' : k] = f.templateRef;
    }
    return map;
  });
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;
  private __rozieWatchInitial_5 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.selectedIndex())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((i: any) => {
      if (this.embla && typeof i === 'number' && i !== this.embla.selectedScrollSnap()) this.embla.scrollTo(i);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => [this.loop(), this.align(), this.axis(), this.slidesToScroll(), this.dragFree(), this.draggable(), this.containScroll(), this.skipSnaps(), this.duration(), this.direction()].join('|'))(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => this.embla?.reInit(this.reinitOptions()))(); }); });
    effect(() => { const __watchVal = (() => `${this.autoplay()}|${this.autoplayDelay()}`)(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => this.embla?.reInit(this.reinitOptions(), this.emblaPluginsFromProps()))(); }); });
    effect(() => { const __watchVal = (() => this.slides().length)(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } (() => {
      this.embla?.reInit(this.reinitOptions());
      this.emblaThumbs?.reInit(this.thumbsOptionsFromProps());
      this.syncNav();
    })(); }); });
    effect(() => { const __watchVal = (() => [].length)(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } (() => {
      this.embla?.reInit(this.reinitOptions());
      this.syncNav();
    })(); }); });
    effect(() => { const __watchVal = (() => this.thumbnails())(); untracked(() => { if (this.__rozieWatchInitial_5) { this.__rozieWatchInitial_5 = false; return; } ((on: any) => {
      if (!on) {
        if (this.emblaThumbs) {
          this.emblaThumbs.destroy();
          this.emblaThumbs = null;
        }
        return;
      }
      if (this.emblaThumbs) return;
      // The r-if'd thumbs viewport mounts in the SAME tick this watch fires, and a
      // pre-flush watcher (Vue's default) runs BEFORE that render — $refs.thumbs-
      // ViewportEl is still null when the callback runs, so a synchronous build
      // silently no-ops and a runtime thumbnails toggle never gets an engine.
      // Double-schedule an idempotent pass through queueMicrotask AND rAF (the
      // DatePicker scheduleFocus idiom, DatePicker.rozie:656-673) so whichever
      // lands first after the flush wins; targets that already flushed
      // synchronously take the immediate fast path in `build()` below and never
      // wait on the deferred passes.
      const build = () => {
        if (!this.embla) return; // unmounted — the $onMount cleanup nulled it
        if (!this.thumbnails()) return; // toggled back off before this pass ran
        if (this.emblaThumbs) return; // idempotent across the double-schedule
        if (!this.thumbsViewportEl()?.nativeElement) return;
        this.emblaThumbs = EmblaCarousel(this.thumbsViewportEl()!.nativeElement, this.thumbsOptionsFromProps());
        this.syncNav();
      };
      build();
      if (typeof queueMicrotask !== 'undefined') queueMicrotask(build);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(build);
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    this.embla = EmblaCarousel(this.viewportEl()!.nativeElement, this.initialOptions(), this.emblaPluginsFromProps());

    // Build the thumbnail strip's own Embla instance when enabled. $refs.thumbsViewportEl
    // exists exactly when the `thumbnails` r-if has rendered (read here in $onMount, the
    // only $refs-safe site). Stays null otherwise (zero overhead).
    // Build the thumbnail strip's own Embla instance when enabled. $refs.thumbsViewportEl
    // exists exactly when the `thumbnails` r-if has rendered (read here in $onMount, the
    // only $refs-safe site). Stays null otherwise (zero overhead).
    if (this.thumbnails() && this.thumbsViewportEl()?.nativeElement) {
      this.emblaThumbs = EmblaCarousel(this.thumbsViewportEl()!.nativeElement, this.thumbsOptionsFromProps());
    }

    // engine → consumer: on every snap change write the two-way model AND fire the
    // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`). syncNav
    // refreshes the built-in dots/arrows + thumb sync.
    // engine → consumer: on every snap change write the two-way model AND fire the
    // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`). syncNav
    // refreshes the built-in dots/arrows + thumb sync.
    this.embla.on('select', () => {
      const i = this.embla.selectedScrollSnap();
      this.selectedIndex.set(i), this.__rozieCvaOnChange(i);
      this.select.emit(i);
      this.syncNav();
    });
    this.embla.on('settle', () => this.settle.emit());
    this.embla.on('reInit', () => {
      this.reInit.emit();
      this.syncNav();
    });
    this.embla.on('pointerDown', () => this.pointerDown.emit());
    // Embla caches SLIDE sizes at init. If a slide's CSS (or a root width applied via
    // attribute fallthrough) settles a frame after $onMount, the snap COUNT measured
    // at init is stale — and a slide-size change (vs a viewport resize or slide
    // add/remove) fires neither `resize` nor `reInit`, so Embla never re-measures on
    // its own. Re-measure once after the first layout flush via reInit (its `reInit`
    // handler resyncs the dot count); `resize` keeps the viewport-resize case covered.
    // Embla caches SLIDE sizes at init. If a slide's CSS (or a root width applied via
    // attribute fallthrough) settles a frame after $onMount, the snap COUNT measured
    // at init is stale — and a slide-size change (vs a viewport resize or slide
    // add/remove) fires neither `resize` nor `reInit`, so Embla never re-measures on
    // its own. Re-measure once after the first layout flush via reInit (its `reInit`
    // handler resyncs the dot count); `resize` keeps the viewport-resize case covered.
    this.embla.on('resize', () => this.syncNav());

    // seed the nav state immediately (covers the already-laid-out case)…
    // seed the nav state immediately (covers the already-laid-out case)…
    this.syncNav();
    // …then re-measure after layout fully settles (a consumer's slide CSS / a root
    // width via attribute fallthrough can land a couple of frames after $onMount;
    // Embla caches slide sizes at init and a slide-size change alone fires no
    // re-measure). Two rAFs out, then a macrotask, each reInit → its handler resyncs
    // the dot count. Idempotent: a reInit on already-correct sizes is a no-op diff.
    // …then re-measure after layout fully settles (a consumer's slide CSS / a root
    // width via attribute fallthrough can land a couple of frames after $onMount;
    // Embla caches slide sizes at init and a slide-size change alone fires no
    // re-measure). Two rAFs out, then a macrotask, each reInit → its handler resyncs
    // the dot count. Idempotent: a reInit on already-correct sizes is a no-op diff.
    if (typeof requestAnimationFrame === 'function') {
      const remeasure = () => {
        if (this.embla) this.embla.reInit(this.reinitOptions(), this.emblaPluginsFromProps());
      };
      this.remeasureRafOuter = requestAnimationFrame(() => {
        this.remeasureRafInner = requestAnimationFrame(remeasure);
      });
      this.remeasureTimer = setTimeout(remeasure, 0);
    }

    // D7: cancel every scheduled handle AND null both engines on unmount. Nulling
    // both (not just calling destroy()) makes all 14 exposed verbs + getInstance()
    // fall through their existing `if (embla)` / ternary guards after unmount, so
    // the handle-manifest's "Null / 0 / Empty before mount" contract becomes
    // symmetric — null before mount AND after unmount — instead of calling into a
    // destroyed engine.
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.remeasureRafOuter) cancelAnimationFrame(this.remeasureRafOuter);
      if (this.remeasureRafInner) cancelAnimationFrame(this.remeasureRafInner);
      if (this.remeasureTimer) clearTimeout(this.remeasureTimer);
      this.remeasureRafOuter = null;
      this.remeasureRafInner = null;
      this.remeasureTimer = null;
      if (this.embla) {
        this.embla.destroy();
        this.embla = null;
      }
      if (this.emblaThumbs) {
        this.emblaThumbs.destroy();
        this.emblaThumbs = null;
      }
    });
  }

  embla: any = null;
  emblaThumbs: any = null;
  remeasureRafOuter: any = null;
  remeasureRafInner: any = null;
  remeasureTimer: any = null;
  keyFor = (slide: any, i: any) => {
    if (slide !== null && typeof slide === 'object') return slide.id ?? slide.key ?? i;
    return slide ?? i;
  };
  initialOptions = () => {
    let opts: any = null;
    opts = {
      // quick 260807-cor (D4) — CONDITIONAL: the selector string on the FALSE
      // branch, an explicit element list only on the TRUE branch. This is
      // deliberately NOT an unconditional array — Embla's own `storeElements()`
      // re-resolves a STRING selector fresh via `container.querySelectorAll()`
      // on EVERY `reInit()` call, including its OWN internally-triggered ones
      // (the native `watchSlides: true` MutationObserver calls `reInit()` with
      // NO arguments, which reuses whatever `slides` value was last explicitly
      // set — a materialized ARRAY would freeze at that point, silently
      // breaking watchSlides' self-healing for ANY post-mount slide-count
      // change on ALL SIX targets, not just Lit; verified live via the VR
      // union matrix, not just reasoned about). Keeping the selector string as
      // the DEFAULT branch preserves 100% of the pre-D4 native-self-healing
      // behavior — for config-array mode on every target, AND for declarative
      // mode on the five hostless targets, AND for Lit's config-array mode
      // (all of those cases have real shadow/light-DOM descendants the
      // selector correctly re-finds every time, exactly as before this task).
      // `$slotted.default.length` is a compile-time-constant `0` on the five
      // hostless targets (Task 1 lowers `$slotted.default` to `[]`), so this
      // ternary is UNCONDITIONALLY the selector-string branch there — a cheap,
      // always-false runtime check, byte-behavior-identical to the pre-D4
      // `slides: '.rozie-embla__slide'` line. Only on Lit, and only when
      // there IS declarative (light-DOM) content assigned to the default slot,
      // does it switch to the explicit list — the phantom-slot problem
      // (`container.children` fallback catching the trailing empty <slot>) is
      // avoided the same way it always was: the selector filters to
      // `.rozie-embla__slide` elements only. `...$props.options` still
      // overrides `slides` last if a consumer needs to.
      slides: [].length > 0 ? [...this.viewportEl()!.nativeElement.querySelectorAll('.rozie-embla__slide'), ...[]] : '.rozie-embla__slide',
      loop: this.loop(),
      align: this.align(),
      axis: this.axis(),
      slidesToScroll: this.slidesToScroll(),
      dragFree: this.dragFree(),
      watchDrag: this.draggable(),
      containScroll: this.containScroll(),
      startIndex: this.startIndex(),
      skipSnaps: this.skipSnaps(),
      duration: this.duration(),
      direction: this.direction(),
      ...this.options()
    };
    return opts;
  };
  reinitOptions = () => {
    let opts: any = null;
    opts = this.initialOptions();
    delete opts.startIndex;
    return opts;
  };
  emblaPluginsFromProps = () => {
    const builtins = this.autoplay() ? [Autoplay({
      delay: this.autoplayDelay()
    })] : [];
    return [...builtins, ...this.plugins()];
  };
  thumbsOptionsFromProps = () => {
    let opts: any = null;
    opts = {
      containScroll: 'keepSnaps',
      dragFree: true,
      axis: this.axis()
    };
    return opts;
  };
  syncNav = () => {
    if (!this.embla) return;
    const i = this.embla.selectedScrollSnap();
    this.snaps.set(this.embla.scrollSnapList().map((_: any, n: any) => n));
    this.selected.set(i);
    this.canPrev.set(this.embla.canScrollPrev());
    this.canNext.set(this.embla.canScrollNext());
    if (this.emblaThumbs) this.emblaThumbs.scrollTo(i);
  };
  selectThumb = (i: any) => {
    this.scrollToIndex(i);
  };
  scrollNext = (jump?: any) => {
    if (this.embla) this.embla.scrollNext(jump);
  };
  scrollPrev = (jump?: any) => {
    if (this.embla) this.embla.scrollPrev(jump);
  };
  scrollToIndex = (index: any, jump?: any) => {
    if (this.embla) this.embla.scrollTo(index, jump);
  };
  reInitCarousel = (opts: any) => {
    if (this.embla) this.embla.reInit(opts ?? this.reinitOptions(), this.emblaPluginsFromProps());
  };
  canScrollNext = () => {
    return this.embla ? this.embla.canScrollNext() : false;
  };
  canScrollPrev = () => {
    return this.embla ? this.embla.canScrollPrev() : false;
  };
  getSelectedIndex = () => {
    return this.embla ? this.embla.selectedScrollSnap() : 0;
  };
  scrollSnapList = () => {
    return this.embla ? this.embla.scrollSnapList() : [];
  };
  scrollProgress = () => {
    return this.embla ? this.embla.scrollProgress() : 0;
  };
  slidesInView = () => {
    return this.embla ? this.embla.slidesInView() : [];
  };
  slidesNotInView = () => {
    return this.embla ? this.embla.slidesNotInView() : [];
  };
  previousScrollSnap = () => {
    return this.embla ? this.embla.previousScrollSnap() : 0;
  };
  getPlugins = () => {
    return this.embla ? this.embla.plugins() : null;
  };
  getInstance = () => {
    return this.embla;
  };

  private __rozieCvaOnChange: (v: number) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: number | null): void {
    this.selectedIndex.set(v ?? 0);
  }
  registerOnChange(fn: (v: number) => void): void {
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

  static ngTemplateContextGuard(
    _dir: Carousel,
    _ctx: unknown,
  ): _ctx is SlideCtx | DefaultCtx | ThumbCtx {
    return true;
  }

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));

  private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));

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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Carousel;
