import type { JSX } from 'solid-js';
import { For, Show, children, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieDisplay } from '@rozie/runtime-solid';
import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.

__rozieInjectStyle('Carousel-4143c216', `.rozie-embla[data-rozie-s-4143c216] { position: relative; }
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
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #1a1a1a;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  transition: opacity 0.15s ease, background 0.15s ease;
}
.rozie-embla__arrow[data-rozie-s-4143c216]:hover { background: #fff; }
.rozie-embla__arrow[data-rozie-s-4143c216]:disabled { opacity: 0.35; cursor: default; }
.rozie-embla__arrow--prev[data-rozie-s-4143c216] { left: 0.5rem; }
.rozie-embla__arrow--next[data-rozie-s-4143c216] { right: 0.5rem; }
.rozie-embla__dots[data-rozie-s-4143c216] {
  display: flex;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.625rem 0;
}
.rozie-embla__dot[data-rozie-s-4143c216] {
  width: 0.5rem;
  height: 0.5rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.rozie-embla__dot[data-rozie-s-4143c216]:hover { background: rgba(0, 0, 0, 0.45); }
.rozie-embla__dot.is-selected[data-rozie-s-4143c216] {
  background: #1a1a1a;
  transform: scale(1.25);
}
.rozie-embla__thumbs[data-rozie-s-4143c216] { margin-top: 0.5rem; }
.rozie-embla__thumbs-viewport[data-rozie-s-4143c216] { overflow: hidden; }
.rozie-embla__thumbs-container[data-rozie-s-4143c216] { display: flex; gap: 0.5rem; }
.rozie-embla__thumb[data-rozie-s-4143c216] {
  flex: 0 0 auto;
  cursor: pointer;
  opacity: 0.5;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  transition: opacity 0.15s ease, border-color 0.15s ease;
}
.rozie-embla__thumb[data-rozie-s-4143c216]:hover { opacity: 0.8; }
.rozie-embla__thumb.is-selected[data-rozie-s-4143c216] {
  opacity: 1;
  border-color: #1a1a1a;
}`);

interface SlideSlotCtx { slide: any; index: any; }

interface ThumbSlotCtx { slide: any; index: any; }

interface CarouselProps {
  /**
   * Slide data for config-array mode (mode a): Rozie renders one `.rozie-embla__slide` per item, optionally via the scoped `slide` slot for custom markup. Optional — leave it unset and use the default slot (mode b) to drop slide DOM directly.
   * @example
   * <Carousel :slides="['A', 'B', 'C']" r-model:selectedIndex="idx" />
   */
  slides?: any[];
  /**
   * Wrap from the last snap back to the first (the Embla `loop` option). Runtime-updatable — toggling it re-inits the engine.
   */
  loop?: boolean;
  /**
   * Snap alignment of slides within the viewport — one of `'start'`, `'center'`, or `'end'`. Runtime-updatable.
   */
  align?: string;
  /**
   * Scroll axis — `'x'` for a horizontal carousel or `'y'` for a vertical one. Runtime-updatable.
   */
  axis?: string;
  /**
   * Number of slides advanced per snap (the Embla `slidesToScroll` option). Runtime-updatable.
   */
  slidesToScroll?: number;
  /**
   * Enable momentum/free-scroll dragging with no hard snapping (the Embla `dragFree` option). Runtime-updatable.
   */
  dragFree?: boolean;
  /**
   * Enable pointer drag (mapped to the Embla `watchDrag` option — a Vue-clarity rename). Set `false` to disable dragging and leave only programmatic/arrow navigation. Runtime-updatable.
   */
  draggable?: boolean;
  /**
   * Edge-snap containment (the Embla `containScroll` option) — `''` (off), `'trimSnaps'`, or `'keepSnaps'`. Runtime-updatable.
   */
  containScroll?: string;
  /**
   * Initial snap index the carousel starts at (the Embla `startIndex` option). Runtime-updatable.
   */
  startIndex?: number;
  /**
   * Allow a fast flick to skip intermediate snaps (the Embla `skipSnaps` option). Runtime-updatable.
   */
  skipSnaps?: boolean;
  /**
   * Scroll transition duration in Embla's relative unit (the `duration` option) — lower is snappier. Runtime-updatable.
   */
  duration?: number;
  /**
   * Text/scroll direction — `'ltr'` or `'rtl'` (the Embla `direction` option). Runtime-updatable.
   */
  direction?: string;
  /**
   * Mount the `embla-carousel-autoplay` plugin to auto-advance the carousel. Toggling it at runtime rebuilds the plugin set.
   */
  autoplay?: boolean;
  /**
   * Delay in milliseconds between auto-advances when `autoplay` is on. Runtime-updatable.
   */
  autoplayDelay?: number;
  /**
   * Show built-in dot pagination — one dot per scroll snap, the active snap highlighted, and clicking a dot scrolls to it. Opt-in, off by default.
   */
  dots?: boolean;
  /**
   * Show built-in prev/next arrow buttons overlaid on the viewport. The arrows disable at the ends unless `loop` is set. Opt-in, off by default.
   */
  arrows?: boolean;
  /**
   * Show a synced thumbnail strip below the carousel — its own Embla instance with one thumb per slide (config-array mode). Fill the `thumb` scoped slot for custom thumb content (falls back to the slide value). Clicking a thumb scrolls the main carousel; the main selection highlights and scrolls the active thumb. Opt-in, off by default.
   */
  thumbnails?: boolean;
  /**
   * Escape hatch — extra Embla plugins (Fade, Class Names, Wheel Gestures, …) appended verbatim after the built-in Autoplay plugin.
   */
  plugins?: any[];
  /**
   * Escape hatch — a raw `EmblaOptionsType` object spread last over the curated option props, so a consumer can override anything Embla supports.
   */
  options?: Record<string, any>;
  /**
   * The current scroll-snap index (two-way `r-model`). Dragging or scrolling writes the new index back (echo-guarded so a programmatic `scrollTo` does not ping-pong); a consumer write scrolls the carousel. Distinct from the `select` emit — a model prop must not share a name with an emit.
   * @example
   * <Carousel :slides="items" r-model:selectedIndex="idx" />
   */
  selectedIndex?: number;
  defaultSelectedIndex?: number;
  onSelectedIndexChange?: (selectedIndex: number) => void;
  onSelect?: (...args: unknown[]) => void;
  onSettle?: (...args: unknown[]) => void;
  onReInit?: (...args: unknown[]) => void;
  onPointerDown?: (...args: unknown[]) => void;
  slideSlot?: (ctx: SlideSlotCtx) => JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  thumbSlot?: (ctx: ThumbSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: CarouselHandle) => void;
}

export interface CarouselHandle {
  scrollNext: (...args: any[]) => any;
  scrollPrev: (...args: any[]) => any;
  scrollToIndex: (...args: any[]) => any;
  reInitCarousel: (...args: any[]) => any;
  canScrollNext: (...args: any[]) => any;
  canScrollPrev: (...args: any[]) => any;
  getSelectedIndex: (...args: any[]) => any;
  scrollSnapList: (...args: any[]) => any;
  scrollProgress: (...args: any[]) => any;
  slidesInView: (...args: any[]) => any;
  slidesNotInView: (...args: any[]) => any;
  previousScrollSnap: (...args: any[]) => any;
  getPlugins: (...args: any[]) => any;
  getInstance: (...args: any[]) => any;
}

export default function Carousel(_props: CarouselProps): JSX.Element {
  const _merged = mergeProps({ slides: (() => [])(), loop: false, align: 'center', axis: 'x', slidesToScroll: 1, dragFree: false, draggable: true, containScroll: 'trimSnaps', startIndex: 0, skipSnaps: false, duration: 25, direction: 'ltr', autoplay: false, autoplayDelay: 4000, dots: false, arrows: false, thumbnails: false, plugins: (() => [])(), options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['slides', 'loop', 'align', 'axis', 'slidesToScroll', 'dragFree', 'draggable', 'containScroll', 'startIndex', 'skipSnaps', 'duration', 'direction', 'autoplay', 'autoplayDelay', 'dots', 'arrows', 'thumbnails', 'plugins', 'options', 'selectedIndex', 'children', 'ref']);
  const resolved = children(() => local.children);
  onMount(() => { local.ref?.({ scrollNext, scrollPrev, scrollToIndex, reInitCarousel, canScrollNext, canScrollPrev, getSelectedIndex, scrollSnapList, scrollProgress, slidesInView, slidesNotInView, previousScrollSnap, getPlugins, getInstance }); });

  const [selectedIndex, setSelectedIndex] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'selectedIndex', 0);
  const [snaps, setSnaps] = createSignal([]);
  const [selected, setSelected] = createSignal(0);
  const [canPrev, setCanPrev] = createSignal(false);
  const [canNext, setCanNext] = createSignal(false);
  onMount(() => {
    const _cleanup = (() => {
    embla = EmblaCarousel(viewportElRef, emblaOptionsFromProps(), emblaPluginsFromProps());

    // Build the thumbnail strip's own Embla instance when enabled. $refs.thumbsViewportEl
    // exists exactly when the `thumbnails` r-if has rendered (read here in $onMount, the
    // only $refs-safe site). Stays null otherwise (zero overhead).
    if (local.thumbnails && thumbsViewportElRef) {
      emblaThumbs = EmblaCarousel(thumbsViewportElRef, thumbsOptionsFromProps());
    }

    // engine → consumer: on every snap change write the two-way model AND fire the
    // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`). syncNav
    // refreshes the built-in dots/arrows + thumb sync.
    embla.on('select', () => {
      const i = embla.selectedScrollSnap();
      setSelectedIndex(i);
      _props.onSelect?.(i);
      syncNav();
    });
    embla.on('settle', () => _props.onSettle?.());
    embla.on('reInit', () => {
      _props.onReInit?.();
      syncNav();
    });
    embla.on('pointerDown', () => _props.onPointerDown?.());
    // Embla caches SLIDE sizes at init. If a slide's CSS (or a root width applied via
    // attribute fallthrough) settles a frame after $onMount, the snap COUNT measured
    // at init is stale — and a slide-size change (vs a viewport resize or slide
    // add/remove) fires neither `resize` nor `reInit`, so Embla never re-measures on
    // its own. Re-measure once after the first layout flush via reInit (its `reInit`
    // handler resyncs the dot count); `resize` keeps the viewport-resize case covered.
    embla.on('resize', () => syncNav());

    // seed the nav state immediately (covers the already-laid-out case)…
    syncNav();
    // …then re-measure after layout fully settles (a consumer's slide CSS / a root
    // width via attribute fallthrough can land a couple of frames after $onMount;
    // Embla caches slide sizes at init and a slide-size change alone fires no
    // re-measure). Two rAFs out, then a macrotask, each reInit → its handler resyncs
    // the dot count. Idempotent: a reInit on already-correct sizes is a no-op diff.
    if (typeof requestAnimationFrame === 'function') {
      const remeasure = () => {
        if (embla) embla.reInit(emblaOptionsFromProps(), emblaPluginsFromProps());
      };
      requestAnimationFrame(() => requestAnimationFrame(remeasure));
      setTimeout(remeasure, 0);
    }
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    embla?.destroy();
    emblaThumbs?.destroy();
  });
  });
  createEffect(on(() => (() => selectedIndex())(), (v) => untrack(() => ((i: any) => {
    if (embla && typeof i === 'number' && i !== embla.selectedScrollSnap()) embla.scrollTo(i);
  })(v)), { defer: true }));
  createEffect(on(() => (() => [local.loop, local.align, local.axis, local.slidesToScroll, local.dragFree, local.draggable, local.containScroll, local.skipSnaps, local.duration, local.direction].join('|'))(), (v) => untrack(() => (() => embla?.reInit(emblaOptionsFromProps()))()), { defer: true }));
  createEffect(on(() => (() => `${local.autoplay}|${local.autoplayDelay}`)(), (v) => untrack(() => (() => embla?.reInit(emblaOptionsFromProps(), emblaPluginsFromProps()))()), { defer: true }));
  createEffect(on(() => (() => local.slides.length)(), (v) => untrack(() => (() => {
    embla?.reInit(emblaOptionsFromProps());
    emblaThumbs?.reInit(thumbsOptionsFromProps());
    syncNav();
  })()), { defer: true }));
  createEffect(on(() => (() => local.thumbnails)(), (v) => untrack(() => ((on: any) => {
    if (on && !emblaThumbs && thumbsViewportElRef) {
      emblaThumbs = EmblaCarousel(thumbsViewportElRef, thumbsOptionsFromProps());
      syncNav();
    } else if (!on && emblaThumbs) {
      emblaThumbs.destroy();
      emblaThumbs = null;
    }
  })(v)), { defer: true }));
  let viewportElRef: HTMLElement | null = null;
  let thumbsViewportElRef: HTMLElement | null = null;

  // Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
  // useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.
  let embla: any = null;
  // The SECOND Embla instance powering the optional synced thumbnail strip (null
  // when `thumbnails` is off). Top-level let for the same hoist reason as `embla`.
  let emblaThumbs: any = null;

  // Stable key for config-array slides — prefer an object id, fall back to value/index.
  function keyFor(slide: any, i: any) {
    if (slide !== null && typeof slide === 'object') return slide.id ?? slide.key ?? i;
    return slide ?? i;
  }

  // Map the curated props → an EmblaOptionsType. `draggable` → `watchDrag`. The
  // `...$props.options` escape hatch spreads last so a consumer can override anything.
  //
  // NOTE the null-let return discipline: Embla's EmblaOptionsType narrows the string
  // options to literal unions (align→'start'|'center'|'end', axis→'x'|'y', …). The
  // untyped `String` props are `string`, which does NOT structurally narrow to those
  // unions under strict tsc on the emitted leaves. Building the object into a
  // pre-nulled `let` (auto type-neutralized to `any`) launders the literal so the
  // engine accepts it — the .rozie-native fix (no codegen type-aid, no lang="ts"),
  // the same laundering discipline MapLibre uses for its untyped option object.
  function emblaOptionsFromProps() {
    let opts: any = null;
    opts = {
      loop: local.loop,
      align: local.align,
      axis: local.axis,
      slidesToScroll: local.slidesToScroll,
      dragFree: local.dragFree,
      watchDrag: local.draggable,
      containScroll: local.containScroll,
      startIndex: local.startIndex,
      skipSnaps: local.skipSnaps,
      duration: local.duration,
      direction: local.direction,
      ...local.options
    };
    return opts;
  }

  // Build the plugin array: gate Autoplay behind the `autoplay` prop, then append
  // any consumer-supplied plugins verbatim.
  function emblaPluginsFromProps() {
    const builtins = local.autoplay ? [Autoplay({
      delay: local.autoplayDelay
    })] : [];
    return [...builtins, ...local.plugins];
  }

  // Thumbnail-strip Embla options (the canonical Embla "thumbs" config): keep every
  // snap reachable + free dragging so the strip scrolls independently of the main
  // carousel, sharing the main axis. Built into a pre-nulled let for the same
  // literal-union laundering reason as emblaOptionsFromProps (axis is a `string`).
  function thumbsOptionsFromProps() {
    let opts: any = null;
    opts = {
      containScroll: 'keepSnaps',
      dragFree: true,
      axis: local.axis
    };
    return opts;
  }

  // Mirror the engine's live nav state into reactive $data so the built-in dots /
  // arrows re-render on every snap change. `snaps` is an INDEX array (one entry per
  // scroll snap → one dot), so the dot r-for needs no unused loop value. Also keeps
  // the thumbnail strip's scroll position in sync with the main selection.
  function syncNav() {
    if (!embla) return;
    const i = embla.selectedScrollSnap();
    setSnaps(embla.scrollSnapList().map((_: any, n: any) => n));
    setSelected(i);
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
    if (emblaThumbs) emblaThumbs.scrollTo(i);
  }

  // Internal nav handlers for the built-in arrows/dots/thumbs. These call the
  // `any`-typed engine directly (NOT the $expose verbs scrollPrev/scrollNext/
  // scrollToIndex, whose strict emitted signatures have a REQUIRED jump/index arg —
  // invoking them arg-light from the template would trip TS2554 on the leaves).
  function navPrev() {
    if (embla) embla.scrollPrev();
  }
  function navNext() {
    if (embla) embla.scrollNext();
  }
  function navTo(i: any) {
    if (embla) embla.scrollTo(i);
  }

  // Thumb click → scroll the MAIN carousel. Guarded by the thumb engine's
  // clickAllowed() so a drag of the strip doesn't register as a click (the Embla
  // thumbs idiom).
  function selectThumb(i: any) {
    if (emblaThumbs && !emblaThumbs.clickAllowed()) return;
    navTo(i);
  }
  // ─── imperative handle (Phase 21 $expose) — collision-suffix discipline ──────
  // 14 verbs, each guarding the pre-mount/destroyed `embla = null`.
  //  - reInitCarousel ≠ the `reInit` emit (ROZ121 expose-verb==emit collision).
  //  - getSelectedIndex ≠ the `selectedIndex` model prop (ROZ524-class — avoids any
  //    setter collision on Lit/Angular; it's a method, the prop is the two-way value).
  //  - scrollToIndex ≠ the inherited DOM/LitElement `HTMLElement.scrollTo(x, y)`. A
  //    bare `scrollTo` expose verb becomes a public method on the Lit custom-element
  //    class and its `(index, jump)` signature is INCOMPATIBLE with the inherited
  //    `Element.scrollTo` overloads (TS2416 → the whole class decorator fails to
  //    resolve). This is a NEW collision class: expose-verb shadows an inherited DOM
  //    method on the Lit target. Suffix it (the reInit→reInitCarousel discipline).
  //  - getPlugins ≠ the `plugins` prop (bare `plugins` collides with the prop + its
  //    React `setPlugins` auto-setter) — the get* getter convention. Returns the
  //    live plugin API map (e.g. `getPlugins().autoplay.play()/.stop()`).
  //  - scrollProgress/slidesInView/slidesNotInView/previousScrollSnap drive custom
  //    progress bars, lazy-load/in-view dots, and directional transitions — no
  //    matching prop, emit, or inherited DOM method — clear.
  //  - scrollNext/scrollPrev/canScrollNext/canScrollPrev/scrollSnapList clear.
  function scrollNext(jump: any) {
    if (embla) embla.scrollNext(jump);
  }
  function scrollPrev(jump: any) {
    if (embla) embla.scrollPrev(jump);
  }
  function scrollToIndex(index: any, jump: any) {
    if (embla) embla.scrollTo(index, jump);
  }
  function reInitCarousel(opts: any) {
    if (embla) embla.reInit(opts ?? emblaOptionsFromProps(), emblaPluginsFromProps());
  }
  function canScrollNext() {
    return embla ? embla.canScrollNext() : false;
  }
  function canScrollPrev() {
    return embla ? embla.canScrollPrev() : false;
  }
  function getSelectedIndex() {
    return embla ? embla.selectedScrollSnap() : 0;
  }
  function scrollSnapList() {
    return embla ? embla.scrollSnapList() : [];
  }
  function scrollProgress() {
    return embla ? embla.scrollProgress() : 0;
  }
  function slidesInView() {
    return embla ? embla.slidesInView() : [];
  }
  function slidesNotInView() {
    return embla ? embla.slidesNotInView() : [];
  }
  function previousScrollSnap() {
    return embla ? embla.previousScrollSnap() : 0;
  }
  function getPlugins() {
    return embla ? embla.plugins() : null;
  }
  function getInstance() {
    return embla;
  }

  return (
    <>
    <div classList={{ 'rozie-embla--vertical': local.axis === 'y' }} {...attrs} class={"rozie-embla" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-4143c216="">
      
      <div class={"rozie-embla__stage"} data-rozie-s-4143c216="">
        {<Show when={local.arrows}><button type="button" aria-label="Previous slide" class={"rozie-embla__arrow rozie-embla__arrow--prev"} disabled={!canPrev()} onClick={($event) => { navPrev(); }} data-rozie-s-4143c216="">‹</button></Show>}<div class={"rozie-embla__viewport"} ref={(el) => { viewportElRef = el as HTMLElement; }} data-rozie-s-4143c216="">
          <div class={"rozie-embla__container"} data-rozie-s-4143c216="">
            
            <For each={local.slides}>{(item, i) => <div class={"rozie-embla__slide"} data-rozie-s-4143c216="">
              {(_props.slideSlot ?? _props.slots?.['slide'])?.({ slide: item, index: i() }) ?? rozieDisplay(item)}
            </div>}</For>
            
            {resolved()}
          </div>
        </div>
        {<Show when={local.arrows}><button type="button" aria-label="Next slide" class={"rozie-embla__arrow rozie-embla__arrow--next"} disabled={!canNext()} onClick={($event) => { navNext(); }} data-rozie-s-4143c216="">›</button></Show>}</div>

      
      {<Show when={local.dots}><div class={"rozie-embla__dots"} data-rozie-s-4143c216="">
        <For each={snaps()}>{(di) => <button type="button" aria-label={rozieAttr('Go to slide ' + (di + 1))} class={"rozie-embla__dot"} classList={{ 'is-selected': di === selected() }} onClick={($event) => { navTo(di); }} data-rozie-s-4143c216="" />}</For>
      </div></Show>}{<Show when={local.thumbnails}><div class={"rozie-embla__thumbs"} data-rozie-s-4143c216="">
        <div class={"rozie-embla__thumbs-viewport"} ref={(el) => { thumbsViewportElRef = el as HTMLElement; }} data-rozie-s-4143c216="">
          <div class={"rozie-embla__thumbs-container"} data-rozie-s-4143c216="">
            <For each={local.slides}>{(item, i) => <div class={"rozie-embla__thumb"} classList={{ 'is-selected': i() === selected() }} onClick={($event) => { selectThumb(i()); }} data-rozie-s-4143c216="">
              {(_props.thumbSlot ?? _props.slots?.['thumb'])?.({ slide: item, index: i() }) ?? rozieDisplay(item)}
            </div>}</For>
          </div>
        </div>
      </div></Show>}</div>
    </>
  );
}
