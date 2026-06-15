import { LitElement, css, html } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
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

@customElement('rozie-carousel')
export default class Carousel extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-embla[data-rozie-s-4143c216] { position: relative; }
.rozie-embla__viewport[data-rozie-s-4143c216] { overflow: hidden; }
.rozie-embla__container[data-rozie-s-4143c216] { display: flex; }
.rozie-embla__slide[data-rozie-s-4143c216] { flex: 0 0 100%; min-width: 0; }
.rozie-embla--vertical[data-rozie-s-4143c216] .rozie-embla__container[data-rozie-s-4143c216] { flex-direction: column; height: 100%; }
.rozie-embla--vertical[data-rozie-s-4143c216] .rozie-embla__slide[data-rozie-s-4143c216] { flex: 0 0 100%; min-height: 0; }
`;

  @property({ type: Array }) slides: any[] = [];
  @property({ type: Boolean, reflect: true }) loop: boolean = false;
  @property({ type: String, reflect: true }) align: string = 'center';
  @property({ type: String, reflect: true }) axis: string = 'x';
  @property({ type: Number, reflect: true }) slidesToScroll: number = 1;
  @property({ type: Boolean, reflect: true }) dragFree: boolean = false;
  @property({ type: Boolean, reflect: true }) draggable: boolean = true;
  @property({ type: String, reflect: true }) containScroll: string = 'trimSnaps';
  @property({ type: Number, reflect: true }) startIndex: number = 0;
  @property({ type: Boolean, reflect: true }) skipSnaps: boolean = false;
  @property({ type: Number, reflect: true }) duration: number = 25;
  @property({ type: String, reflect: true }) direction: string = 'ltr';
  @property({ type: Boolean, reflect: true }) autoplay: boolean = false;
  @property({ type: Number, reflect: true }) autoplayDelay: number = 4000;
  @property({ type: Array }) plugins: any[] = [];
  @property({ type: Object }) options: any = {};
  @property({ type: Number, attribute: 'selected-index' }) _selectedIndex_attr: number = 0;
  private _selectedIndexControllable = createLitControllableProperty<number>({ host: this, eventName: 'selected-index-change', defaultValue: 0, initialControlledValue: undefined });
  @query('[data-rozie-ref="viewportEl"]') private _refViewportEl!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieFirstUpdateDone = false;

  @state() private _hasSlotSlide = false;
  @queryAssignedElements({ slot: 'slide', flatten: true }) private _slotSlideElements!: Element[];
  @property({ attribute: false }) slide?: (scope: { slide: unknown; index: unknown }) => unknown;
  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

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
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotSlide = Array.from(this.children).some((el) => el.getAttribute('slot') === 'slide');
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push((() => this.embla?.destroy()));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.selectedIndex)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((i: any) => {
      if (this.embla && typeof i === 'number' && i !== this.embla.selectedScrollSnap()) this.embla.scrollTo(i);
    })(__watchVal); }); }));

    this.embla = EmblaCarousel(this._refViewportEl, this.emblaOptionsFromProps(), this.emblaPluginsFromProps());

    // engine → consumer: on every snap change write the two-way model AND fire the
    // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`).
    // engine → consumer: on every snap change write the two-way model AND fire the
    // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`).
    this.embla.on('select', () => {
      const i = this.embla.selectedScrollSnap();
      this._selectedIndexControllable.write(i);
      this.dispatchEvent(new CustomEvent("select", {
        detail: i,
        bubbles: true,
        composed: true
      }));
    });
    this.embla.on('settle', () => this.dispatchEvent(new CustomEvent("settle", {
      detail: undefined,
      bubbles: true,
      composed: true
    })));
    this.embla.on('reInit', () => this.dispatchEvent(new CustomEvent("reInit", {
      detail: undefined,
      bubbles: true,
      composed: true
    })));
    this.embla.on('pointerDown', () => this.dispatchEvent(new CustomEvent("pointer-down", {
      detail: undefined,
      bubbles: true,
      composed: true
    })));
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('loop') || changedProperties.has('align') || changedProperties.has('axis') || changedProperties.has('slidesToScroll') || changedProperties.has('dragFree') || changedProperties.has('draggable') || changedProperties.has('containScroll') || changedProperties.has('skipSnaps') || changedProperties.has('duration') || changedProperties.has('direction'))) { const __watchVal = (() => [this.loop, this.align, this.axis, this.slidesToScroll, this.dragFree, this.draggable, this.containScroll, this.skipSnaps, this.duration, this.direction].join('|'))(); (() => this.embla?.reInit(this.emblaOptionsFromProps()))(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('autoplay') || changedProperties.has('autoplayDelay'))) { const __watchVal = (() => `${this.autoplay}|${this.autoplayDelay}`)(); (() => this.embla?.reInit(this.emblaOptionsFromProps(), this.emblaPluginsFromProps()))(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('slides'))) { const __watchVal = (() => this.slides.length)(); (() => this.embla?.reInit(this.emblaOptionsFromProps()))(); }
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
  <div class="rozie-embla__viewport" data-rozie-ref="viewportEl" data-rozie-s-4143c216>
    <div class="rozie-embla__container" data-rozie-s-4143c216>
      
      ${repeat<any>(this.slides, (item, i) => this.keyFor(item, i), (item, i) => html`<div class="rozie-embla__slide" key=${rozieAttr(this.keyFor(item, i))} data-rozie-s-4143c216>
        ${this.slide !== undefined ? this.slide({slide: item, index: i}) : html`<slot name="slide" data-rozie-params=${(() => { try { return JSON.stringify({slide: item, index: i}); } catch { return '{}'; } })()}>${rozieDisplay(item)}</slot>`}
      </div>`)}
      
      <slot></slot>
    </div>
  </div>
</div>
`;
  }

  embla: any = null;

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

  scrollNext(jump: any) {
    if (this.embla) this.embla.scrollNext(jump);
  }

  scrollPrev(jump: any) {
    if (this.embla) this.embla.scrollPrev(jump);
  }

  scrollToIndex(index: any, jump: any) {
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
    const __skip = new Set<string>(['slides', 'loop', 'align', 'axis', 'slides-to-scroll', 'slidestoscroll', 'drag-free', 'dragfree', 'draggable', 'contain-scroll', 'containscroll', 'start-index', 'startindex', 'skip-snaps', 'skipsnaps', 'duration', 'direction', 'autoplay', 'autoplay-delay', 'autoplaydelay', 'plugins', 'options', 'selected-index', 'selectedindex']);
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
