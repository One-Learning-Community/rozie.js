import type { JSX } from 'solid-js';
import { For, Show, children, createEffect, createSignal, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
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
   * Initial snap index the carousel starts at (the Embla `startIndex` option). Init-only — to move after mount use the `scrollToIndex()` handle verb or the `selectedIndex` model.
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
  const _merged = mergeProps({ slides: (() => [])() as any[], loop: false, align: 'center', axis: 'x', slidesToScroll: 1, dragFree: false, draggable: true, containScroll: 'trimSnaps', startIndex: 0, skipSnaps: false, duration: 25, direction: 'ltr', autoplay: false, autoplayDelay: 4000, dots: false, arrows: false, thumbnails: false, plugins: (() => [])() as any[], options: (() => ({}))() as Record<string, any> }, _props);
  const [local, attrs] = splitProps(_merged, ['slides', 'loop', 'align', 'axis', 'slidesToScroll', 'dragFree', 'draggable', 'containScroll', 'startIndex', 'skipSnaps', 'duration', 'direction', 'autoplay', 'autoplayDelay', 'dots', 'arrows', 'thumbnails', 'plugins', 'options', 'selectedIndex', 'children', 'ref', 'onSelect', 'onSettle', 'onReInit', 'onPointerDown']);
  const resolved = children(() => local.children);
  onMount(() => { local.ref?.({ scrollNext, scrollPrev, scrollToIndex, reInitCarousel, canScrollNext, canScrollPrev, getSelectedIndex, scrollSnapList, scrollProgress, slidesInView, slidesNotInView, previousScrollSnap, getPlugins, getInstance }); });

  const [selectedIndex, setSelectedIndex] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'selectedIndex', 0);
  const [snaps, setSnaps] = createSignal<any[]>([]);
  const [selected, setSelected] = createSignal(0);
  const [canPrev, setCanPrev] = createSignal(false);
  const [canNext, setCanNext] = createSignal(false);
  onMount(() => {
    const _cleanup = (() => {
    embla = EmblaCarousel(viewportElRef!, initialOptions(), emblaPluginsFromProps());

    // Build the thumbnail strip's own Embla instance when enabled. $refs.thumbsViewportEl
    // exists exactly when the `thumbnails` r-if has rendered (read here in $onMount, the
    // only $refs-safe site). Stays null otherwise (zero overhead).
    if (local.thumbnails && thumbsViewportElRef) {
      emblaThumbs = EmblaCarousel(thumbsViewportElRef!, thumbsOptionsFromProps());
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
        if (embla) embla.reInit(reinitOptions(), emblaPluginsFromProps());
      };
      remeasureRafOuter = requestAnimationFrame(() => {
        remeasureRafInner = requestAnimationFrame(remeasure);
      });
      remeasureTimer = setTimeout(remeasure, 0);
    }

    // D7: cancel every scheduled handle AND null both engines on unmount. Nulling
    // both (not just calling destroy()) makes all 14 exposed verbs + getInstance()
    // fall through their existing `if (embla)` / ternary guards after unmount, so
    // the handle-manifest's "Null / 0 / Empty before mount" contract becomes
    // symmetric — null before mount AND after unmount — instead of calling into a
    // destroyed engine.
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (remeasureRafOuter) cancelAnimationFrame(remeasureRafOuter);
    if (remeasureRafInner) cancelAnimationFrame(remeasureRafInner);
    if (remeasureTimer) clearTimeout(remeasureTimer);
    remeasureRafOuter = null;
    remeasureRafInner = null;
    remeasureTimer = null;
    if (embla) {
      embla.destroy();
      embla = null;
    }
    if (emblaThumbs) {
      emblaThumbs.destroy();
      emblaThumbs = null;
    }
  });
  });
  createEffect(on(() => (() => selectedIndex())(), (v) => untrack(() => ((i: any) => {
    if (embla && typeof i === 'number' && i !== embla.selectedScrollSnap()) embla.scrollTo(i);
  })(v)), { defer: true }));
  createEffect(on(() => (() => [local.loop, local.align, local.axis, local.slidesToScroll, local.dragFree, local.draggable, local.containScroll, local.skipSnaps, local.duration, local.direction].join('|'))(), (v) => untrack(() => (() => embla?.reInit(reinitOptions()))()), { defer: true }));
  createEffect(on(() => (() => `${local.autoplay}|${local.autoplayDelay}`)(), (v) => untrack(() => (() => embla?.reInit(reinitOptions(), emblaPluginsFromProps()))()), { defer: true }));
  createEffect(on(() => (() => local.slides.length)(), (v) => untrack(() => (() => {
    embla?.reInit(reinitOptions());
    emblaThumbs?.reInit(thumbsOptionsFromProps());
    syncNav();
  })()), { defer: true }));
  createEffect(on(() => (() => [].length)(), (v) => untrack(() => (() => {
    embla?.reInit(reinitOptions());
    syncNav();
  })()), { defer: true }));
  createEffect(on(() => (() => local.thumbnails)(), (v) => untrack(() => ((on: any) => {
    if (!on) {
      if (emblaThumbs) {
        emblaThumbs.destroy();
        emblaThumbs = null;
      }
      return;
    }
    if (emblaThumbs) return;
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
      if (!embla) return; // unmounted — the $onMount cleanup nulled it
      if (!local.thumbnails) return; // toggled back off before this pass ran
      if (emblaThumbs) return; // idempotent across the double-schedule
      if (!thumbsViewportElRef) return;
      emblaThumbs = EmblaCarousel(thumbsViewportElRef, thumbsOptionsFromProps());
      syncNav();
    };
    build();
    if (typeof queueMicrotask !== 'undefined') queueMicrotask(build);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(build);
  })(v)), { defer: true }));
  let viewportElRef: HTMLElement | null = null;
  let thumbsViewportElRef: HTMLElement | null = null;

  // Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
  // useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.
  let embla: any = null;
  // The SECOND Embla instance powering the optional synced thumbnail strip (null
  // when `thumbnails` is off). Top-level let for the same hoist reason as `embla`.
  let emblaThumbs: any = null;
  // D7: the two mount-time remeasure rAF handles + the macrotask handle, captured
  // so the mount cleanup can cancel them on unmount. Null-lets (not `= 0`) so they
  // type-neutralize to `any` — setTimeout's return type differs between the DOM
  // and Node lib shapes across the six leaves' tsconfigs.
  let remeasureRafOuter: any = null;
  let remeasureRafInner: any = null;
  let remeasureTimer: any = null;

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
  function initialOptions() {
    let opts: any = null;
    opts = {
      // quick 260807-cor (D4) — explicit element list, not a selector string. The
      // phantom-slot problem this used to work around structurally (a pinned
      // `.rozie-embla__slide` selector to dodge counting the trailing empty
      // default `<slot>` as a 5th slide) is now solved by construction: we hand
      // Embla the ACTUAL matched elements instead of letting it discover them
      // itself, so there is no container to phantom-count from in the first
      // place. The first spread resolves config-array slides via the viewport
      // ref's own querySelectorAll (works identically to the old selector on
      // all six targets — declarative-mode content isn't inside the viewport
      // ref path). The second spread — `$slotted.default` — is what makes
      // declarative mode (mode b) resolve on Lit: it is the Lit-only sigil
      // that reaches across the shadow boundary to the assigned light-DOM
      // slide elements a shadow-blind `querySelectorAll` could never see
      // (RESEARCH.md D4); it's an empty spread on the other five targets,
      // where slide content is already a real descendant the viewport-ref
      // query already found. `embla-carousel@8.6.0`'s `storeElements()` treats
      // a `slides` array as a literal element list (`Options.d.ts`), so no
      // engine patch is needed for either half. `...$props.options` still
      // overrides `slides` last if a consumer needs to.
      slides: [...viewportElRef!.querySelectorAll('.rozie-embla__slide'), ...[]],
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

  // startIndex is INIT-ONLY. Embla's reActivate preserves the live position by
  // merging mergeOptions({ startIndex: selectedScrollSnap() }, withOptions) — and
  // withOptions WINS (embla-carousel@8 esm :1450, :1558). So any startIndex left
  // in a reInit payload teleports the carousel back to the prop's value on every
  // option flip, slide add/remove, and no-arg reInitCarousel(). Delete it AFTER
  // the ...$props.options spread so the raw escape hatch cannot reintroduce it
  // either. To move programmatically, use the scrollToIndex() handle verb.
  function reinitOptions() {
    let opts: any = null;
    opts = initialOptions();
    delete opts.startIndex;
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
  // literal-union laundering reason as initialOptions (axis is a `string`).
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

  // Thumb click → scroll the MAIN carousel. Calls the $expose'd scrollToIndex verb
  // directly (below) — arg-light internal calls to an exposed verb now typecheck
  // cleanly on all six targets: the emitter lowers a TRAILING $expose verb param
  // optional (`jump?: any` / `index`+`jump?`) whenever it sees a fewer-arg internal
  // call site (emitter-hardening backlog item #5). The prior raw-engine
  // navPrev/navNext/navTo bypass existed ONLY to dodge the pre-fix required-arg
  // TS2554 and is gone now that the compiler owns the arity.
  //
  // NB: no `clickAllowed()` drag-vs-click guard. Embla 8 dropped `clickAllowed`
  // from the public API entirely (it isn't a method on EmblaCarouselType), so the
  // old guard threw `TypeError: emblaThumbs.clickAllowed is not a function` on
  // every thumb tap. The modern Embla thumbs idiom calls `scrollTo` directly; a
  // drag that ends on a thumb simply scrolls, which is acceptable for a nav strip.
  function selectThumb(i: any) {
    scrollToIndex(i);
  }
  // ─── imperative handle (Phase 21 $expose) — collision-suffix discipline ──────
  // 14 verbs, each guarding the pre-mount/destroyed `embla = null`.
  //  - reInitCarousel ≠ the `reInit` emit (ROZ121 expose-verb==emit collision).
  //    260802-tmo D1: a DELIBERATE behavior change to this published verb —
  //    no-arg reInitCarousel() now PRESERVES the current snap (via
  //    reinitOptions()) instead of resetting to `startIndex` on every call. Pass
  //    raw options to override. See docs/components/embla.md's handle table.
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
  function scrollNext(jump?: any) {
    if (embla) embla.scrollNext(jump);
  }
  function scrollPrev(jump?: any) {
    if (embla) embla.scrollPrev(jump);
  }
  function scrollToIndex(index: any, jump?: any) {
    if (embla) embla.scrollTo(index, jump);
  }
  function reInitCarousel(opts: any) {
    if (embla) embla.reInit(opts ?? reinitOptions(), emblaPluginsFromProps());
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
    <div {...attrs} class={"rozie-embla" + " " + rozieClass({ 'rozie-embla--vertical': local.axis === 'y' }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-4143c216="">
      
      <div class={"rozie-embla__stage"} data-rozie-s-4143c216="">
        {<Show when={local.arrows}><button type="button" aria-label="Previous slide" class={"rozie-embla__arrow rozie-embla__arrow--prev"} disabled={!canPrev()} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { scrollPrev(); }} data-rozie-s-4143c216="">‹</button></Show>}<div class={"rozie-embla__viewport"} ref={(el) => { viewportElRef = el as HTMLElement; }} data-rozie-s-4143c216="">
          <div class={"rozie-embla__container"} data-rozie-s-4143c216="">
            
            <For each={local.slides}>{(slide, i) => <div class={"rozie-embla__slide"} data-rozie-s-4143c216="">
              {(_props.slideSlot ?? _props.slots?.['slide'])?.({ slide, index: i() }) ?? rozieDisplay(slide)}
            </div>}</For>
            
            {resolved()}
          </div>
        </div>
        {<Show when={local.arrows}><button type="button" aria-label="Next slide" class={"rozie-embla__arrow rozie-embla__arrow--next"} disabled={!canNext()} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { scrollNext(); }} data-rozie-s-4143c216="">›</button></Show>}</div>

      
      {<Show when={local.dots}><div class={"rozie-embla__dots"} data-rozie-s-4143c216="">
        <Key each={snaps() as readonly any[]} by={(di) => di}>{(di) => <button type="button" aria-label={rozieAttr('Go to slide ' + (di() + 1))} class={"rozie-embla__dot" + " " + rozieClass({ 'is-selected': di() === selected() })} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { scrollToIndex(di()); }} data-rozie-s-4143c216="" />}</Key>
      </div></Show>}{<Show when={local.thumbnails}><div class={"rozie-embla__thumbs"} data-rozie-s-4143c216="">
        <div class={"rozie-embla__thumbs-viewport"} ref={(el) => { thumbsViewportElRef = el as HTMLElement; }} data-rozie-s-4143c216="">
          <div class={"rozie-embla__thumbs-container"} data-rozie-s-4143c216="">
            <For each={local.slides}>{(item, i) => <div class={"rozie-embla__thumb" + " " + rozieClass({ 'is-selected': i() === selected() })} onClick={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { selectThumb(i()); }} data-rozie-s-4143c216="">
              {(_props.thumbSlot ?? _props.slots?.['thumb'])?.({ slide: item, index: i() }) ?? rozieDisplay(item)}
            </div>}</For>
          </div>
        </div>
      </div></Show>}</div>
    </>
  );
}
