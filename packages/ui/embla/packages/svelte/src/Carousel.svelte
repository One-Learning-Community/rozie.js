<script lang="ts">
import { applyListeners, rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount, untrack } from 'svelte';

interface Props {
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
  options?: any;
  /**
   * The current scroll-snap index (two-way `r-model`). Dragging or scrolling writes the new index back (echo-guarded so a programmatic `scrollTo` does not ping-pong); a consumer write scrolls the carousel. Distinct from the `select` emit — a model prop must not share a name with an emit.
   * @example
   * <Carousel :slides="items" r-model:selectedIndex="idx" />
   */
  selectedIndex?: number;
  slide?: Snippet<[{ slide: any; index: any }]>;
  children?: Snippet;
  thumb?: Snippet<[{ slide: any; index: any }]>;
  snippets?: Record<string, any>;
  onselect?: (...args: unknown[]) => void;
  onsettle?: (...args: unknown[]) => void;
  onreinit?: (...args: unknown[]) => void;
  onpointerdown?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultSlides = (() => [])();
let __defaultPlugins = (() => [])();
let __defaultOptions = (() => ({}))();

let {
  slides = __defaultSlides,
  loop = false,
  align = 'center',
  axis = 'x',
  slidesToScroll = 1,
  dragFree = false,
  draggable = true,
  containScroll = 'trimSnaps',
  startIndex = 0,
  skipSnaps = false,
  duration = 25,
  direction = 'ltr',
  autoplay = false,
  autoplayDelay = 4000,
  dots = false,
  arrows = false,
  thumbnails = false,
  plugins = __defaultPlugins,
  options = __defaultOptions,
  selectedIndex = $bindable(0),
  slide: __slideProp,
  children: __childrenProp,
  thumb: __thumbProp,
  snippets,
  onselect,
  onsettle,
  onreinit,
  onpointerdown,
  ...__rozieAttrs
}: Props = $props();

const slide$$slot = $derived(__slideProp ?? snippets?.slide);
const children = $derived(__childrenProp ?? snippets?.children);
const thumb = $derived(__thumbProp ?? snippets?.thumb);

let snaps: any[] = $state([]);
let selected = $state(0);
let canPrev = $state(false);
let canNext = $state(false);

let viewportEl = $state<HTMLElement | undefined>(undefined);
let thumbsViewportEl = $state<HTMLElement | undefined>(undefined);

import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.
// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.
let embla: any = null;
// The SECOND Embla instance powering the optional synced thumbnail strip (null
// when `thumbnails` is off). Top-level let for the same hoist reason as `embla`.
// The SECOND Embla instance powering the optional synced thumbnail strip (null
// when `thumbnails` is off). Top-level let for the same hoist reason as `embla`.
let emblaThumbs: any = null;

// Stable key for config-array slides — prefer an object id, fall back to value/index.
// Stable key for config-array slides — prefer an object id, fall back to value/index.
const keyFor = (slide: any, i: any) => {
  if (slide !== null && typeof slide === 'object') return slide.id ?? slide.key ?? i;
  return slide ?? i;
};

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
const emblaOptionsFromProps = () => {
  let opts: any = null;
  opts = {
    loop: loop,
    align: align,
    axis: axis,
    slidesToScroll: slidesToScroll,
    dragFree: dragFree,
    watchDrag: draggable,
    containScroll: containScroll,
    startIndex: startIndex,
    skipSnaps: skipSnaps,
    duration: duration,
    direction: direction,
    ...options
  };
  return opts;
};

// Build the plugin array: gate Autoplay behind the `autoplay` prop, then append
// any consumer-supplied plugins verbatim.
// Build the plugin array: gate Autoplay behind the `autoplay` prop, then append
// any consumer-supplied plugins verbatim.
const emblaPluginsFromProps = () => {
  const builtins = autoplay ? [Autoplay({
    delay: autoplayDelay
  })] : [];
  return [...builtins, ...plugins];
};

// Thumbnail-strip Embla options (the canonical Embla "thumbs" config): keep every
// snap reachable + free dragging so the strip scrolls independently of the main
// carousel, sharing the main axis. Built into a pre-nulled let for the same
// literal-union laundering reason as emblaOptionsFromProps (axis is a `string`).
// Thumbnail-strip Embla options (the canonical Embla "thumbs" config): keep every
// snap reachable + free dragging so the strip scrolls independently of the main
// carousel, sharing the main axis. Built into a pre-nulled let for the same
// literal-union laundering reason as emblaOptionsFromProps (axis is a `string`).
const thumbsOptionsFromProps = () => {
  let opts: any = null;
  opts = {
    containScroll: 'keepSnaps',
    dragFree: true,
    axis: axis
  };
  return opts;
};

// Mirror the engine's live nav state into reactive $data so the built-in dots /
// arrows re-render on every snap change. `snaps` is an INDEX array (one entry per
// scroll snap → one dot), so the dot r-for needs no unused loop value. Also keeps
// the thumbnail strip's scroll position in sync with the main selection.
// Mirror the engine's live nav state into reactive $data so the built-in dots /
// arrows re-render on every snap change. `snaps` is an INDEX array (one entry per
// scroll snap → one dot), so the dot r-for needs no unused loop value. Also keeps
// the thumbnail strip's scroll position in sync with the main selection.
const syncNav = () => {
  if (!embla) return;
  const i = embla.selectedScrollSnap();
  snaps = embla.scrollSnapList().map((_: any, n: any) => n);
  selected = i;
  canPrev = embla.canScrollPrev();
  canNext = embla.canScrollNext();
  if (emblaThumbs) emblaThumbs.scrollTo(i);
};

// Thumb click → scroll the MAIN carousel. Guarded by the thumb engine's
// clickAllowed() so a drag of the strip doesn't register as a click (the Embla
// thumbs idiom). Calls the $expose'd scrollToIndex verb directly (below) —
// arg-light internal calls to an exposed verb now typecheck cleanly on all
// six targets: the emitter lowers a TRAILING $expose verb param optional
// (`jump?: any` / `index`+`jump?`) whenever it sees a fewer-arg internal call
// site (emitter-hardening backlog item #5). The prior raw-engine
// navPrev/navNext/navTo bypass existed ONLY to dodge the pre-fix required-arg
// TS2554 and is gone now that the compiler owns the arity.
// Thumb click → scroll the MAIN carousel. Guarded by the thumb engine's
// clickAllowed() so a drag of the strip doesn't register as a click (the Embla
// thumbs idiom). Calls the $expose'd scrollToIndex verb directly (below) —
// arg-light internal calls to an exposed verb now typecheck cleanly on all
// six targets: the emitter lowers a TRAILING $expose verb param optional
// (`jump?: any` / `index`+`jump?`) whenever it sees a fewer-arg internal call
// site (emitter-hardening backlog item #5). The prior raw-engine
// navPrev/navNext/navTo bypass existed ONLY to dodge the pre-fix required-arg
// TS2554 and is gone now that the compiler owns the arity.
const selectThumb = (i: any) => {
  if (emblaThumbs && !emblaThumbs.clickAllowed()) return;
  scrollToIndex(i);
};
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
export function scrollNext(jump?: any) {
  if (embla) embla.scrollNext(jump);
}
export function scrollPrev(jump?: any) {
  if (embla) embla.scrollPrev(jump);
}
export function scrollToIndex(index: any, jump?: any) {
  if (embla) embla.scrollTo(index, jump);
}
export function reInitCarousel(opts: any) {
  if (embla) embla.reInit(opts ?? emblaOptionsFromProps(), emblaPluginsFromProps());
}
export function canScrollNext() {
  return embla ? embla.canScrollNext() : false;
}
export function canScrollPrev() {
  return embla ? embla.canScrollPrev() : false;
}
export function getSelectedIndex() {
  return embla ? embla.selectedScrollSnap() : 0;
}
export function scrollSnapList() {
  return embla ? embla.scrollSnapList() : [];
}
export function scrollProgress() {
  return embla ? embla.scrollProgress() : 0;
}
export function slidesInView() {
  return embla ? embla.slidesInView() : [];
}
export function slidesNotInView() {
  return embla ? embla.slidesNotInView() : [];
}
export function previousScrollSnap() {
  return embla ? embla.previousScrollSnap() : 0;
}
export function getPlugins() {
  return embla ? embla.plugins() : null;
}
export function getInstance() {
  return embla;
}

onMount(() => {
  embla = EmblaCarousel(viewportEl!, emblaOptionsFromProps(), emblaPluginsFromProps());

  // Build the thumbnail strip's own Embla instance when enabled. $refs.thumbsViewportEl
  // exists exactly when the `thumbnails` r-if has rendered (read here in $onMount, the
  // only $refs-safe site). Stays null otherwise (zero overhead).
  if (thumbnails && thumbsViewportEl) {
    emblaThumbs = EmblaCarousel(thumbsViewportEl!, thumbsOptionsFromProps());
  }

  // engine → consumer: on every snap change write the two-way model AND fire the
  // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`). syncNav
  // refreshes the built-in dots/arrows + thumb sync.
  embla.on('select', () => {
    const i = embla.selectedScrollSnap();
    selectedIndex = i;
    onselect?.(i);
    syncNav();
  });
  embla.on('settle', () => onsettle?.());
  embla.on('reInit', () => {
    onreinit?.();
    syncNav();
  });
  embla.on('pointerDown', () => onpointerdown?.());
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
  return () => {
    embla?.destroy();
    emblaThumbs?.destroy();
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => selectedIndex)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((i: any) => {
  if (embla && typeof i === 'number' && i !== embla.selectedScrollSnap()) embla.scrollTo(i);
})(__watchVal); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { (() => [loop, align, axis, slidesToScroll, dragFree, draggable, containScroll, skipSnaps, duration, direction].join('|'))(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } (() => embla?.reInit(emblaOptionsFromProps()))(); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { (() => `${autoplay}|${autoplayDelay}`)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } (() => embla?.reInit(emblaOptionsFromProps(), emblaPluginsFromProps()))(); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { (() => slides.length)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } (() => {
  embla?.reInit(emblaOptionsFromProps());
  emblaThumbs?.reInit(thumbsOptionsFromProps());
  syncNav();
})(); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { const __watchVal = (() => thumbnails)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } ((on: any) => {
  if (on && !emblaThumbs && thumbsViewportEl) {
    emblaThumbs = EmblaCarousel(thumbsViewportEl!, thumbsOptionsFromProps());
    syncNav();
  } else if (!on && emblaThumbs) {
    emblaThumbs.destroy();
    emblaThumbs = null;
  }
})(__watchVal); }); });
</script>

<div {...__rozieAttrs} class={["rozie-embla", { 'rozie-embla--vertical': axis === 'y' }, (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-4143c216><div class="rozie-embla__stage" data-rozie-s-4143c216>{#if arrows}<button type="button" class="rozie-embla__arrow rozie-embla__arrow--prev" disabled={!canPrev} aria-label="Previous slide" onclick={($event) => { scrollPrev(); }} data-rozie-s-4143c216>‹</button>{/if}<div class="rozie-embla__viewport" bind:this={viewportEl} data-rozie-s-4143c216><div class="rozie-embla__container" data-rozie-s-4143c216>{#each slides as slide, i (keyFor(slide, i))}<div class="rozie-embla__slide" data-rozie-s-4143c216>{#if slide$$slot}{@render slide$$slot({ slide, index: i })}{:else}{rozieDisplay(slide)}{/if}</div>{/each}{@render children?.()}</div></div>{#if arrows}<button type="button" class="rozie-embla__arrow rozie-embla__arrow--next" disabled={!canNext} aria-label="Next slide" onclick={($event) => { scrollNext(); }} data-rozie-s-4143c216>›</button>{/if}</div>{#if dots}<div class="rozie-embla__dots" data-rozie-s-4143c216>{#each snaps as di (di)}<button type="button" class={["rozie-embla__dot", { 'is-selected': di === selected }]} aria-label={rozieAttr('Go to slide ' + (di + 1))} onclick={($event) => { scrollToIndex(di); }} data-rozie-s-4143c216></button>{/each}</div>{/if}{#if thumbnails}<div class="rozie-embla__thumbs" data-rozie-s-4143c216><div class="rozie-embla__thumbs-viewport" bind:this={thumbsViewportEl} data-rozie-s-4143c216><div class="rozie-embla__thumbs-container" data-rozie-s-4143c216>{#each slides as item, i (keyFor(item, i))}<div class={["rozie-embla__thumb", { 'is-selected': i === selected }]} onclick={($event) => { selectThumb(i); }} data-rozie-s-4143c216>{#if thumb}{@render thumb({ slide: item, index: i })}{:else}{rozieDisplay(item)}{/if}</div>{/each}</div></div></div>{/if}</div>

<style>
:global {
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
}
</style>
