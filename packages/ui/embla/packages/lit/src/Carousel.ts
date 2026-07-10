import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.

interface RozieSlideSlotCtx {
  slide: unknown;
  index: unknown;
}

interface RozieThumbSlotCtx {
  slide: unknown;
  index: unknown;
}

@customElement('rozie-carousel')
export default class Carousel extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-embla[data-rozie-s-4143c216] { position: relative; }
.rozie-embla__stage[data-rozie-s-4143c216] { position: relative; }
.rozie-embla__viewport[data-rozie-s-4143c216] { overflow: hidden; }
.rozie-embla__container[data-rozie-s-4143c216] { display: flex; }
.rozie-embla__slide[data-rozie-s-4143c216] { flex: 0 0 100%; min-width: 0; }
.rozie-embla--vertical[data-rozie-s-4143c216] .rozie-embla__container[data-rozie-s-4143c216] { flex-direction: column; height: 100%; }
.rozie-embla--vertical[data-rozie-s-4143c216] .rozie-embla__slide[data-rozie-s-4143c216] { flex: 0 0 100%; min-height: 0; }
.rozie-embla__arrow[data-rozie-s-4143c216] {
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
.rozie-embla__arrow[data-rozie-s-4143c216]:hover { background: var(--rozie-embla-arrow-hover-bg, #fff); }
.rozie-embla__arrow[data-rozie-s-4143c216]:disabled { opacity: var(--rozie-embla-arrow-disabled-opacity, 0.35); cursor: default; }
.rozie-embla__arrow--prev[data-rozie-s-4143c216] { left: var(--rozie-embla-arrow-inset, 0.5rem); }
.rozie-embla__arrow--next[data-rozie-s-4143c216] { right: var(--rozie-embla-arrow-inset, 0.5rem); }
.rozie-embla__dots[data-rozie-s-4143c216] {
  display: flex;
  justify-content: center;
  gap: var(--rozie-embla-dots-gap, 0.4rem);
  padding: var(--rozie-embla-dots-padding, 0.625rem 0);
}
.rozie-embla__dot[data-rozie-s-4143c216] {
  width: var(--rozie-embla-dot-size, 0.5rem);
  height: var(--rozie-embla-dot-size, 0.5rem);
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--rozie-embla-dot-bg, rgb(0 0 0 / 0.25));
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.rozie-embla__dot[data-rozie-s-4143c216]:hover { background: var(--rozie-embla-dot-hover-bg, rgba(0, 0, 0, 0.45)); }
.rozie-embla__dot.is-selected[data-rozie-s-4143c216] {
  background: var(--rozie-embla-dot-selected-bg, var(--rozie-embla-accent, #1a1a1a));
  transform: scale(var(--rozie-embla-dot-selected-scale, 1.25));
}
.rozie-embla__thumbs[data-rozie-s-4143c216] { margin-top: var(--rozie-embla-thumbs-gap, 0.5rem); }
.rozie-embla__thumbs-viewport[data-rozie-s-4143c216] { overflow: hidden; }
.rozie-embla__thumbs-container[data-rozie-s-4143c216] { display: flex; gap: var(--rozie-embla-thumb-gap, 0.5rem); }
.rozie-embla__thumb[data-rozie-s-4143c216] {
  flex: 0 0 auto;
  cursor: pointer;
  opacity: var(--rozie-embla-thumb-opacity, 0.5);
  border: var(--rozie-embla-thumb-border-width, 2px) solid var(--rozie-embla-thumb-border-color, transparent);
  border-radius: var(--rozie-embla-thumb-radius, 4px);
  overflow: hidden;
  transition: opacity 0.15s ease, border-color 0.15s ease;
}
.rozie-embla__thumb[data-rozie-s-4143c216]:hover { opacity: var(--rozie-embla-thumb-hover-opacity, 0.8); }
.rozie-embla__thumb.is-selected[data-rozie-s-4143c216] {
  opacity: var(--rozie-embla-thumb-selected-opacity, 1);
  border-color: var(--rozie-embla-thumb-selected-border-color, var(--rozie-embla-accent, #1a1a1a));
}
`;

  /**
   * Slide data for config-array mode (mode a): Rozie renders one `.rozie-embla__slide` per item, optionally via the scoped `slide` slot for custom markup. Optional — leave it unset and use the default slot (mode b) to drop slide DOM directly.
   * @example
   * <Carousel :slides="['A', 'B', 'C']" r-model:selectedIndex="idx" />
   */
  @property({ type: Array }) slides: any[] = [];
  /**
   * Wrap from the last snap back to the first (the Embla `loop` option). Runtime-updatable — toggling it re-inits the engine.
   */
  @property({ type: Boolean, reflect: true }) loop: boolean = false;
  /**
   * Snap alignment of slides within the viewport — one of `'start'`, `'center'`, or `'end'`. Runtime-updatable.
   */
  @property({ type: String, reflect: true }) align: string = 'center';
  /**
   * Scroll axis — `'x'` for a horizontal carousel or `'y'` for a vertical one. Runtime-updatable.
   */
  @property({ type: String, reflect: true }) axis: string = 'x';
  /**
   * Number of slides advanced per snap (the Embla `slidesToScroll` option). Runtime-updatable.
   */
  @property({ type: Number, reflect: true }) slidesToScroll: number = 1;
  /**
   * Enable momentum/free-scroll dragging with no hard snapping (the Embla `dragFree` option). Runtime-updatable.
   */
  @property({ type: Boolean, reflect: true }) dragFree: boolean = false;
  /**
   * Enable pointer drag (mapped to the Embla `watchDrag` option — a Vue-clarity rename). Set `false` to disable dragging and leave only programmatic/arrow navigation. Runtime-updatable.
   */
  @property({ type: Boolean, reflect: true }) draggable: boolean = true;
  /**
   * Edge-snap containment (the Embla `containScroll` option) — `''` (off), `'trimSnaps'`, or `'keepSnaps'`. Runtime-updatable.
   */
  @property({ type: String, reflect: true }) containScroll: string = 'trimSnaps';
  /**
   * Initial snap index the carousel starts at (the Embla `startIndex` option). Runtime-updatable.
   */
  @property({ type: Number, reflect: true }) startIndex: number = 0;
  /**
   * Allow a fast flick to skip intermediate snaps (the Embla `skipSnaps` option). Runtime-updatable.
   */
  @property({ type: Boolean, reflect: true }) skipSnaps: boolean = false;
  /**
   * Scroll transition duration in Embla's relative unit (the `duration` option) — lower is snappier. Runtime-updatable.
   */
  @property({ type: Number, reflect: true }) duration: number = 25;
  /**
   * Text/scroll direction — `'ltr'` or `'rtl'` (the Embla `direction` option). Runtime-updatable.
   */
  @property({ type: String, reflect: true }) direction: string = 'ltr';
  /**
   * Mount the `embla-carousel-autoplay` plugin to auto-advance the carousel. Toggling it at runtime rebuilds the plugin set.
   */
  @property({ type: Boolean, reflect: true }) autoplay: boolean = false;
  /**
   * Delay in milliseconds between auto-advances when `autoplay` is on. Runtime-updatable.
   */
  @property({ type: Number, reflect: true }) autoplayDelay: number = 4000;
  /**
   * Show built-in dot pagination — one dot per scroll snap, the active snap highlighted, and clicking a dot scrolls to it. Opt-in, off by default.
   */
  @property({ type: Boolean, reflect: true }) dots: boolean = false;
  /**
   * Show built-in prev/next arrow buttons overlaid on the viewport. The arrows disable at the ends unless `loop` is set. Opt-in, off by default.
   */
  @property({ type: Boolean, reflect: true }) arrows: boolean = false;
  /**
   * Show a synced thumbnail strip below the carousel — its own Embla instance with one thumb per slide (config-array mode). Fill the `thumb` scoped slot for custom thumb content (falls back to the slide value). Clicking a thumb scrolls the main carousel; the main selection highlights and scrolls the active thumb. Opt-in, off by default.
   */
  @property({ type: Boolean, reflect: true }) thumbnails: boolean = false;
  /**
   * Escape hatch — extra Embla plugins (Fade, Class Names, Wheel Gestures, …) appended verbatim after the built-in Autoplay plugin.
   */
  @property({ type: Array }) plugins: any[] = [];
  /**
   * Escape hatch — a raw `EmblaOptionsType` object spread last over the curated option props, so a consumer can override anything Embla supports.
   */
  @property({ type: Object }) options: any = {};
  /**
   * The current scroll-snap index (two-way `r-model`). Dragging or scrolling writes the new index back (echo-guarded so a programmatic `scrollTo` does not ping-pong); a consumer write scrolls the carousel. Distinct from the `select` emit — a model prop must not share a name with an emit.
   * @example
   * <Carousel :slides="items" r-model:selectedIndex="idx" />
   */
  @property({ type: Number, attribute: 'selected-index' }) _selectedIndex_attr: number = 0;
  private _selectedIndexControllable = createLitControllableProperty<number>({ host: this, eventName: 'selected-index-change', defaultValue: 0, initialControlledValue: undefined });
  private _snaps = signal<any[]>([]);
  private _selected = signal(0);
  private _canPrev = signal(false);
  private _canNext = signal(false);
  @query('[data-rozie-ref="viewportEl"]') private _refViewportEl!: HTMLElement;
  @query('[data-rozie-ref="thumbsViewportEl"]') private _refThumbsViewportEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieFirstUpdateDone = false;

  @state() private _hasSlotSlide = false;
  @queryAssignedElements({ slot: 'slide', flatten: true }) private _slotSlideElements!: Element[];
  @property({ attribute: false }) slide?: (scope: { slide: unknown; index: unknown }) => unknown;
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @state() private _hasSlotThumb = false;
  @queryAssignedElements({ slot: 'thumb', flatten: true }) private _slotThumbElements!: Element[];
  @property({ attribute: false }) thumb?: (scope: { slide: unknown; index: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="slide"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSlide = this._slotSlideElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="thumb"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotThumb = this._slotThumbElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotSlide = Array.from(this.children).some((el) => el.getAttribute('slot') === 'slide');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    this._hasSlotThumb = Array.from(this.children).some((el) => el.getAttribute('slot') === 'thumb');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push((() => {
      this.embla?.destroy();
      this.emblaThumbs?.destroy();
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.selectedIndex)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((i: any) => {
      if (this.embla && typeof i === 'number' && i !== this.embla.selectedScrollSnap()) this.embla.scrollTo(i);
    })(__watchVal); }); }));

    this.embla = EmblaCarousel(this._refViewportEl, this.emblaOptionsFromProps(), this.emblaPluginsFromProps());

    // Build the thumbnail strip's own Embla instance when enabled. $refs.thumbsViewportEl
    // exists exactly when the `thumbnails` r-if has rendered (read here in $onMount, the
    // only $refs-safe site). Stays null otherwise (zero overhead).
    // Build the thumbnail strip's own Embla instance when enabled. $refs.thumbsViewportEl
    // exists exactly when the `thumbnails` r-if has rendered (read here in $onMount, the
    // only $refs-safe site). Stays null otherwise (zero overhead).
    if (this.thumbnails && this._refThumbsViewportEl) {
      this.emblaThumbs = EmblaCarousel(this._refThumbsViewportEl, this.thumbsOptionsFromProps());
    }

    // engine → consumer: on every snap change write the two-way model AND fire the
    // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`). syncNav
    // refreshes the built-in dots/arrows + thumb sync.
    // engine → consumer: on every snap change write the two-way model AND fire the
    // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`). syncNav
    // refreshes the built-in dots/arrows + thumb sync.
    this.embla.on('select', () => {
      const i = this.embla.selectedScrollSnap();
      this._selectedIndexControllable.write(i);
      this.dispatchEvent(new CustomEvent("select", {
        detail: i,
        bubbles: true,
        composed: true
      }));
      this.syncNav();
    });
    this.embla.on('settle', () => this.dispatchEvent(new CustomEvent("settle", {
      detail: undefined,
      bubbles: true,
      composed: true
    })));
    this.embla.on('reInit', () => {
      this.dispatchEvent(new CustomEvent("reInit", {
        detail: undefined,
        bubbles: true,
        composed: true
      }));
      this.syncNav();
    });
    this.embla.on('pointerDown', () => this.dispatchEvent(new CustomEvent("pointer-down", {
      detail: undefined,
      bubbles: true,
      composed: true
    })));
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
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('loop') || changedProperties.has('align') || changedProperties.has('axis') || changedProperties.has('slidesToScroll') || changedProperties.has('dragFree') || changedProperties.has('draggable') || changedProperties.has('containScroll') || changedProperties.has('skipSnaps') || changedProperties.has('duration') || changedProperties.has('direction'))) { const __watchVal = (() => [this.loop, this.align, this.axis, this.slidesToScroll, this.dragFree, this.draggable, this.containScroll, this.skipSnaps, this.duration, this.direction].join('|'))(); (() => this.embla?.reInit(this.emblaOptionsFromProps()))(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('autoplay') || changedProperties.has('autoplayDelay'))) { const __watchVal = (() => `${this.autoplay}|${this.autoplayDelay}`)(); (() => this.embla?.reInit(this.emblaOptionsFromProps(), this.emblaPluginsFromProps()))(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('slides'))) { const __watchVal = (() => this.slides.length)(); (() => {
      this.embla?.reInit(this.emblaOptionsFromProps());
      this.emblaThumbs?.reInit(this.thumbsOptionsFromProps());
      this.syncNav();
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('thumbnails'))) { const __watchVal = (() => this.thumbnails)(); ((on: any) => {
      if (on && !this.emblaThumbs && this._refThumbsViewportEl) {
        this.emblaThumbs = EmblaCarousel(this._refThumbsViewportEl, this.thumbsOptionsFromProps());
        this.syncNav();
      } else if (!on && this.emblaThumbs) {
        this.emblaThumbs.destroy();
        this.emblaThumbs = null;
      }
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
    if (name === 'selected-index') this._selectedIndexControllable.notifyAttributeChange(value === null ? 0 : Number(value));
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-embla": true, 'rozie-embla--vertical': this.axis === 'y' }).filter(([, v]) => v).map(([k]) => k).join(' ')}" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-4143c216>
  
  <div class="rozie-embla__stage" data-rozie-s-4143c216>
    ${this.arrows ? html`<button class="rozie-embla__arrow rozie-embla__arrow--prev" type="button" ?disabled=${!this._canPrev.value} aria-label="Previous slide" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.scrollPrev(); }} data-rozie-s-4143c216>‹</button>` : nothing}<div class="rozie-embla__viewport" data-rozie-ref="viewportEl" data-rozie-s-4143c216>
      <div class="rozie-embla__container" data-rozie-s-4143c216>
        
        ${repeat<any>(this.slides, (slide, i) => this.keyFor(slide, i), (slide, i) => html`<div class="rozie-embla__slide" key=${rozieAttr(this.keyFor(slide, i))} data-rozie-s-4143c216>
          ${this.slide !== undefined ? this.slide({slide: slide, index: i}) : html`<slot name="slide" data-rozie-params=${(() => { try { return JSON.stringify({slide: slide, index: i}); } catch { return '{}'; } })()}>${rozieDisplay(slide)}</slot>`}
        </div>`)}
        
        <slot></slot>
      </div>
    </div>
    ${this.arrows ? html`<button class="rozie-embla__arrow rozie-embla__arrow--next" type="button" ?disabled=${!this._canNext.value} aria-label="Next slide" @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.scrollNext(); }} data-rozie-s-4143c216>›</button>` : nothing}</div>

  
  ${this.dots ? html`<div class="rozie-embla__dots" data-rozie-s-4143c216>
    ${repeat<any>(this._snaps.value, (di, _idx) => di, (di, _idx) => html`<button class="${Object.entries({ "rozie-embla__dot": true, 'is-selected': di === this._selected.value }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(di)} type="button" aria-label=${rozieAttr('Go to slide ' + (di + 1))} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.scrollToIndex(di); }} data-rozie-s-4143c216></button>`)}
  </div>` : nothing}${this.thumbnails ? html`<div class="rozie-embla__thumbs" data-rozie-s-4143c216>
    <div class="rozie-embla__thumbs-viewport" data-rozie-ref="thumbsViewportEl" data-rozie-s-4143c216>
      <div class="rozie-embla__thumbs-container" data-rozie-s-4143c216>
        ${repeat<any>(this.slides, (item, i) => this.keyFor(item, i), (item, i) => html`<div class="${Object.entries({ "rozie-embla__thumb": true, 'is-selected': i === this._selected.value }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(this.keyFor(item, i))} @click=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this.selectThumb(i); }} data-rozie-s-4143c216>
          ${this.thumb !== undefined ? this.thumb({slide: item, index: i}) : html`<slot name="thumb" data-rozie-params=${(() => { try { return JSON.stringify({slide: item, index: i}); } catch { return '{}'; } })()}>${rozieDisplay(item)}</slot>`}
        </div>`)}
      </div>
    </div>
  </div>` : nothing}</div>
`;
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
    loop: this.loop,
    align: this.align,
    axis: this.axis,
    slidesToScroll: this.slidesToScroll,
    dragFree: this.dragFree,
    watchDrag: this.draggable,
    containScroll: this.containScroll,
    startIndex: this.startIndex,
    skipSnaps: this.skipSnaps,
    duration: this.duration,
    direction: this.direction,
    ...this.options
  };
  return opts;
};

  emblaPluginsFromProps = () => {
  const builtins = this.autoplay ? [Autoplay({
    delay: this.autoplayDelay
  })] : [];
  return [...builtins, ...this.plugins];
};

  thumbsOptionsFromProps = () => {
  let opts: any = null;
  opts = {
    containScroll: 'keepSnaps',
    dragFree: true,
    axis: this.axis
  };
  return opts;
};

  syncNav = () => {
  if (!this.embla) return;
  const i = this.embla.selectedScrollSnap();
  this._snaps.value = this.embla.scrollSnapList().map((_: any, n: any) => n);
  this._selected.value = i;
  this._canPrev.value = this.embla.canScrollPrev();
  this._canNext.value = this.embla.canScrollNext();
  if (this.emblaThumbs) this.emblaThumbs.scrollTo(i);
};

  selectThumb = (i: any) => {
  if (this.emblaThumbs && !this.emblaThumbs.clickAllowed()) return;
  this.scrollToIndex(i);
};

  scrollNext(jump?: any) {
    if (this.embla) this.embla.scrollNext(jump);
  }

  scrollPrev(jump?: any) {
    if (this.embla) this.embla.scrollPrev(jump);
  }

  scrollToIndex(index: any, jump?: any) {
    if (this.embla) this.embla.scrollTo(index, jump);
  }

  reInitCarousel(opts: any) {
    if (this.embla) this.embla.reInit(opts ?? this.emblaOptionsFromProps(), this.emblaPluginsFromProps());
  }

  canScrollNext() {
    return this.embla ? this.embla.canScrollNext() : false;
  }

  canScrollPrev() {
    return this.embla ? this.embla.canScrollPrev() : false;
  }

  getSelectedIndex() {
    return this.embla ? this.embla.selectedScrollSnap() : 0;
  }

  scrollSnapList() {
    return this.embla ? this.embla.scrollSnapList() : [];
  }

  scrollProgress() {
    return this.embla ? this.embla.scrollProgress() : 0;
  }

  slidesInView() {
    return this.embla ? this.embla.slidesInView() : [];
  }

  slidesNotInView() {
    return this.embla ? this.embla.slidesNotInView() : [];
  }

  previousScrollSnap() {
    return this.embla ? this.embla.previousScrollSnap() : 0;
  }

  getPlugins() {
    return this.embla ? this.embla.plugins() : null;
  }

  getInstance() {
    return this.embla;
  }

  get selectedIndex(): number { return this._selectedIndexControllable.read(); }
  set selectedIndex(v: number) { this._selectedIndexControllable.notifyPropertyWrite(v); }

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
    const __skip = new Set<string>(['slides', 'loop', 'align', 'axis', 'slides-to-scroll', 'slidestoscroll', 'drag-free', 'dragfree', 'draggable', 'contain-scroll', 'containscroll', 'start-index', 'startindex', 'skip-snaps', 'skipsnaps', 'duration', 'direction', 'autoplay', 'autoplay-delay', 'autoplaydelay', 'dots', 'arrows', 'thumbnails', 'plugins', 'options', 'selected-index', 'selectedindex']);
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
