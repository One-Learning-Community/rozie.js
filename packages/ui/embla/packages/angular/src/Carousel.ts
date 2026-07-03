import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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

function __rozieDisplay(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      // Circular structure or a non-serialisable value (BigInt nested in an
      // object). Degrade to a non-throwing form so the wrap never crashes the
      // render — that is the entire point of "safe" interpolation (SPEC-1).
      return String(v);
    }
  }
  return String(v);
}

function __rozieAttr(v: unknown): string | null {
  return v == null ? null : __rozieDisplay(v);
}

@Component({
  selector: 'rozie-carousel',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `

    <div class="rozie-embla" [ngClass]="{ 'rozie-embla--vertical': axis() === 'y' }" #rozieSpread_0 #rozieListenersTarget_1>
      
      <div class="rozie-embla__stage">
        @if (arrows()) {
    <button type="button" class="rozie-embla__arrow rozie-embla__arrow--prev" [disabled]="!canPrev()" aria-label="Previous slide" (click)="navPrev()">‹</button>
    }<div class="rozie-embla__viewport" #viewportEl>
          <div class="rozie-embla__container">
            
            @for (item of slides(); track keyFor(item, i); let i = $index) {
    <div class="rozie-embla__slide">
              @if ((slideTpl ?? templates()?.['slide'])) {
    <ng-container *ngTemplateOutlet="(slideTpl ?? templates()?.['slide']); context: { $implicit: { slide: item, index: i }, slide: item, index: i }" />
    } @else {
    {{ rozieDisplay(item) }}
    }
            </div>
    }
            
            <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
          </div>
        </div>
        @if (arrows()) {
    <button type="button" class="rozie-embla__arrow rozie-embla__arrow--next" [disabled]="!canNext()" aria-label="Next slide" (click)="navNext()">›</button>
    }</div>

      
      @if (dots()) {
    <div class="rozie-embla__dots">
        @for (di of snaps(); track di) {
    <button type="button" class="rozie-embla__dot" [ngClass]="{ 'is-selected': di === selected() }" [attr.aria-label]="rozieAttr('Go to slide ' + (di + 1))" (click)="navTo(di)"></button>
    }
      </div>
    }@if (thumbnails()) {
    <div class="rozie-embla__thumbs">
        <div class="rozie-embla__thumbs-viewport" #thumbsViewportEl>
          <div class="rozie-embla__thumbs-container">
            @for (item of slides(); track keyFor(item, i); let i = $index) {
    <div class="rozie-embla__thumb" [ngClass]="{ 'is-selected': i === selected() }" (click)="selectThumb(i)">
              @if ((thumbTpl ?? templates()?.['thumb'])) {
    <ng-container *ngTemplateOutlet="(thumbTpl ?? templates()?.['thumb']); context: { $implicit: { slide: item, index: i }, slide: item, index: i }" />
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
   * <Carousel :slides="['A', 'B', 'C']" r-model:selectedIndex="idx" />
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
   * Initial snap index the carousel starts at (the Embla `startIndex` option). Runtime-updatable.
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
   * <Carousel :slides="items" r-model:selectedIndex="idx" />
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
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.selectedIndex())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((i: any) => {
      if (this.embla && typeof i === 'number' && i !== this.embla.selectedScrollSnap()) this.embla.scrollTo(i);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => [this.loop(), this.align(), this.axis(), this.slidesToScroll(), this.dragFree(), this.draggable(), this.containScroll(), this.skipSnaps(), this.duration(), this.direction()].join('|'))(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => this.embla?.reInit(this.emblaOptionsFromProps()))(); }); });
    effect(() => { const __watchVal = (() => `${this.autoplay()}|${this.autoplayDelay()}`)(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => this.embla?.reInit(this.emblaOptionsFromProps(), this.emblaPluginsFromProps()))(); }); });
    effect(() => { const __watchVal = (() => this.slides().length)(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } (() => {
      this.embla?.reInit(this.emblaOptionsFromProps());
      this.emblaThumbs?.reInit(this.thumbsOptionsFromProps());
      this.syncNav();
    })(); }); });
    effect(() => { const __watchVal = (() => this.thumbnails())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((on: any) => {
      if (on && !this.emblaThumbs && this.thumbsViewportEl()?.nativeElement) {
        this.emblaThumbs = EmblaCarousel(this.thumbsViewportEl()!.nativeElement, this.thumbsOptionsFromProps());
        this.syncNav();
      } else if (!on && this.emblaThumbs) {
        this.emblaThumbs.destroy();
        this.emblaThumbs = null;
      }
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    this.embla = EmblaCarousel(this.viewportEl()!.nativeElement, this.emblaOptionsFromProps(), this.emblaPluginsFromProps());

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
        if (this.embla) this.embla.reInit(this.emblaOptionsFromProps(), this.emblaPluginsFromProps());
      };
      requestAnimationFrame(() => requestAnimationFrame(remeasure));
      setTimeout(remeasure, 0);
    }
    this.__rozieDestroyRef.onDestroy(() => {
      this.embla?.destroy();
      this.emblaThumbs?.destroy();
    });
  }

  embla: any = null;
  emblaThumbs: any = null;
  keyFor = (slide: any, i: any) => {
    if (slide !== null && typeof slide === 'object') return slide.id ?? slide.key ?? i;
    return slide ?? i;
  };
  emblaOptionsFromProps = () => {
    let opts: any = null;
    opts = {
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
  navPrev = () => {
    if (this.embla) this.embla.scrollPrev();
  };
  navNext = () => {
    if (this.embla) this.embla.scrollNext();
  };
  navTo = (i: any) => {
    if (this.embla) this.embla.scrollTo(i);
  };
  selectThumb = (i: any) => {
    if (this.emblaThumbs && !this.emblaThumbs.clickAllowed()) return;
    this.navTo(i);
  };
  scrollNext = (jump: any) => {
    if (this.embla) this.embla.scrollNext(jump);
  };
  scrollPrev = (jump: any) => {
    if (this.embla) this.embla.scrollPrev(jump);
  };
  scrollToIndex = (index: any, jump: any) => {
    if (this.embla) this.embla.scrollTo(index, jump);
  };
  reInitCarousel = (opts: any) => {
    if (this.embla) this.embla.reInit(opts ?? this.emblaOptionsFromProps(), this.emblaPluginsFromProps());
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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default Carousel;
