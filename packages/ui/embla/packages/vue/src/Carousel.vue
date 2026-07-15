<template>

<div :class="['rozie-embla', { 'rozie-embla--vertical': props.axis === 'y' }]" v-bind="$attrs">
  
  <div class="rozie-embla__stage">
    <button v-if="props.arrows" type="button" class="rozie-embla__arrow rozie-embla__arrow--prev" :disabled="!canPrev" aria-label="Previous slide" @click="scrollPrev()">‹</button><div class="rozie-embla__viewport" ref="viewportElRef">
      <div class="rozie-embla__container">
        
        <div v-for="(slide, i) in props.slides" :key="keyFor(slide, i)" class="rozie-embla__slide">
          <slot name="slide" :slide="slide" :index="i">{{ slide }}</slot>
        </div>
        
        <slot></slot>
      </div>
    </div>
    <button v-if="props.arrows" type="button" class="rozie-embla__arrow rozie-embla__arrow--next" :disabled="!canNext" aria-label="Next slide" @click="scrollNext()">›</button></div>

  
  <div v-if="props.dots" class="rozie-embla__dots">
    <button v-for="di in snaps" :key="di" type="button" :class="['rozie-embla__dot', { 'is-selected': di === selected }]" :aria-label="'Go to slide ' + (di + 1)" @click="scrollToIndex(di)"></button>
  </div><div v-if="props.thumbnails" class="rozie-embla__thumbs">
    <div class="rozie-embla__thumbs-viewport" ref="thumbsViewportElRef">
      <div class="rozie-embla__thumbs-container">
        <div v-for="(item, i) in props.slides" :key="keyFor(item, i)" :class="['rozie-embla__thumb', { 'is-selected': i === selected }]" @click="selectThumb(i)">
          <slot name="thumb" :slide="item" :index="i">{{ item }}</slot>
        </div>
      </div>
    </div>
  </div></div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
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
  }>(),
  { slides: () => [], loop: false, align: 'center', axis: 'x', slidesToScroll: 1, dragFree: false, draggable: true, containScroll: 'trimSnaps', startIndex: 0, skipSnaps: false, duration: 25, direction: 'ltr', autoplay: false, autoplayDelay: 4000, dots: false, arrows: false, thumbnails: false, plugins: () => [], options: () => ({}) }
);

/**
 * The current scroll-snap index (two-way `r-model`). Dragging or scrolling writes the new index back (echo-guarded so a programmatic `scrollTo` does not ping-pong); a consumer write scrolls the carousel. Distinct from the `select` emit — a model prop must not share a name with an emit.
 * @example
 * <Carousel :slides="items" r-model:selectedIndex="idx" />
 */
const selectedIndex = defineModel<number>('selectedIndex', { default: 0 });

const emit = defineEmits<{
  select: [...args: any[]];
  settle: [...args: any[]];
  reInit: [...args: any[]];
  'pointer-down': [...args: any[]];
}>();

defineSlots<{
  slide(props: { slide: any; index: any }): any;
  default(props: {  }): any;
  thumb(props: { slide: any; index: any }): any;
}>();

const snaps = ref<any[]>([]);
const selected = ref(0);
const canPrev = ref(false);
const canNext = ref(false);

const viewportElRef = ref<HTMLElement>();
const thumbsViewportElRef = ref<HTMLElement>();

import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';
// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.
let embla: any = null;
// The SECOND Embla instance powering the optional synced thumbnail strip (null
// when `thumbnails` is off). Top-level let for the same hoist reason as `embla`.
let emblaThumbs: any = null;
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
const emblaOptionsFromProps = () => {
  let opts: any = null;
  opts = {
    // Pin the slide set explicitly rather than letting Embla infer it from the
    // container's direct children. In config-array mode the container also holds a
    // trailing empty default <slot> (the declarative-mode entry point). On Lit that
    // <slot> is a real, 0-width node in shadow DOM, so Embla would count it as a
    // phantom 5th slide and collapse scrollSnapList() to a single snap — one dot,
    // next-arrow disabled — even though the four real slides render correctly (the
    // hostless targets emit no node for an unused slot, so they were unaffected).
    // Both modes label slides `.rozie-embla__slide` (see the mode-b docs), so this
    // selector is correct for config-array AND declarative usage; `...$props.options`
    // still overrides it if a consumer needs to.
    slides: '.rozie-embla__slide',
    loop: props.loop,
    align: props.align,
    axis: props.axis,
    slidesToScroll: props.slidesToScroll,
    dragFree: props.dragFree,
    watchDrag: props.draggable,
    containScroll: props.containScroll,
    startIndex: props.startIndex,
    skipSnaps: props.skipSnaps,
    duration: props.duration,
    direction: props.direction,
    ...props.options
  };
  return opts;
};
// Build the plugin array: gate Autoplay behind the `autoplay` prop, then append
// any consumer-supplied plugins verbatim.
const emblaPluginsFromProps = () => {
  const builtins = props.autoplay ? [Autoplay({
    delay: props.autoplayDelay
  })] : [];
  return [...builtins, ...props.plugins];
};
// Thumbnail-strip Embla options (the canonical Embla "thumbs" config): keep every
// snap reachable + free dragging so the strip scrolls independently of the main
// carousel, sharing the main axis. Built into a pre-nulled let for the same
// literal-union laundering reason as emblaOptionsFromProps (axis is a `string`).
const thumbsOptionsFromProps = () => {
  let opts: any = null;
  opts = {
    containScroll: 'keepSnaps',
    dragFree: true,
    axis: props.axis
  };
  return opts;
};
// Mirror the engine's live nav state into reactive $data so the built-in dots /
// arrows re-render on every snap change. `snaps` is an INDEX array (one entry per
// scroll snap → one dot), so the dot r-for needs no unused loop value. Also keeps
// the thumbnail strip's scroll position in sync with the main selection.
const syncNav = () => {
  if (!embla) return;
  const i = embla.selectedScrollSnap();
  snaps.value = embla.scrollSnapList().map((_: any, n: any) => n);
  selected.value = i;
  canPrev.value = embla.canScrollPrev();
  canNext.value = embla.canScrollNext();
  if (emblaThumbs) emblaThumbs.scrollTo(i);
};
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
const selectThumb = (i: any) => {
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

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  embla = EmblaCarousel(viewportElRef.value!, emblaOptionsFromProps(), emblaPluginsFromProps());

  // Build the thumbnail strip's own Embla instance when enabled. $refs.thumbsViewportEl
  // exists exactly when the `thumbnails` r-if has rendered (read here in $onMount, the
  // only $refs-safe site). Stays null otherwise (zero overhead).
  if (props.thumbnails && thumbsViewportElRef.value) {
    emblaThumbs = EmblaCarousel(thumbsViewportElRef.value!, thumbsOptionsFromProps());
  }

  // engine → consumer: on every snap change write the two-way model AND fire the
  // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`). syncNav
  // refreshes the built-in dots/arrows + thumb sync.
  embla.on('select', () => {
    const i = embla.selectedScrollSnap();
    selectedIndex.value = i;
    emit('select', i);
    syncNav();
  });
  embla.on('settle', () => emit('settle'));
  embla.on('reInit', () => {
    emit('reInit');
    syncNav();
  });
  embla.on('pointerDown', () => emit('pointer-down'));
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
  _cleanup_0 = () => {
    embla?.destroy();
    emblaThumbs?.destroy();
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => selectedIndex.value, (i: any) => {
  if (embla && typeof i === 'number' && i !== embla.selectedScrollSnap()) embla.scrollTo(i);
});
watch(() => [props.loop, props.align, props.axis, props.slidesToScroll, props.dragFree, props.draggable, props.containScroll, props.skipSnaps, props.duration, props.direction].join('|'), () => embla?.reInit(emblaOptionsFromProps()));
watch(() => `${props.autoplay}|${props.autoplayDelay}`, () => embla?.reInit(emblaOptionsFromProps(), emblaPluginsFromProps()));
watch(() => props.slides.length, () => {
  embla?.reInit(emblaOptionsFromProps());
  emblaThumbs?.reInit(thumbsOptionsFromProps());
  syncNav();
});
watch(() => props.thumbnails, (on: any) => {
  if (on && !emblaThumbs && thumbsViewportElRef.value) {
    emblaThumbs = EmblaCarousel(thumbsViewportElRef.value!, thumbsOptionsFromProps());
    syncNav();
  } else if (!on && emblaThumbs) {
    emblaThumbs.destroy();
    emblaThumbs = null;
  }
});

defineExpose({ scrollNext, scrollPrev, scrollToIndex, reInitCarousel, canScrollNext, canScrollPrev, getSelectedIndex, scrollSnapList, scrollProgress, slidesInView, slidesNotInView, previousScrollSnap, getPlugins, getInstance });
</script>

<style scoped>
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
</style>
