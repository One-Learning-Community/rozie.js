<template>

<div :class="['rozie-embla', { 'rozie-embla--vertical': props.axis === 'y' }]" v-bind="$attrs">
  
  <div class="rozie-embla__stage">
    <button v-if="props.arrows" type="button" class="rozie-embla__arrow rozie-embla__arrow--prev" :disabled="!canPrev" aria-label="Previous slide" @click="navPrev()">‹</button><div class="rozie-embla__viewport" ref="viewportElRef">
      <div class="rozie-embla__container">
        
        <div v-for="(item, i) in props.slides" :key="keyFor(item, i)" class="rozie-embla__slide">
          <slot name="slide" :slide="item" :index="i">{{ item }}</slot>
        </div>
        
        <slot></slot>
      </div>
    </div>
    <button v-if="props.arrows" type="button" class="rozie-embla__arrow rozie-embla__arrow--next" :disabled="!canNext" aria-label="Next slide" @click="navNext()">›</button></div>

  
  <div v-if="props.dots" class="rozie-embla__dots">
    <button v-for="di in snaps" :key="di" type="button" :class="['rozie-embla__dot', { 'is-selected': di === selected }]" :aria-label="'Go to slide ' + (di + 1)" @click="navTo(di)"></button>
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
  defineProps<{ slides?: any[]; loop?: boolean; align?: string; axis?: string; slidesToScroll?: number; dragFree?: boolean; draggable?: boolean; containScroll?: string; startIndex?: number; skipSnaps?: boolean; duration?: number; direction?: string; autoplay?: boolean; autoplayDelay?: number; dots?: boolean; arrows?: boolean; thumbnails?: boolean; plugins?: any[]; options?: Record<string, any> }>(),
  { slides: () => [], loop: false, align: 'center', axis: 'x', slidesToScroll: 1, dragFree: false, draggable: true, containScroll: 'trimSnaps', startIndex: 0, skipSnaps: false, duration: 25, direction: 'ltr', autoplay: false, autoplayDelay: 4000, dots: false, arrows: false, thumbnails: false, plugins: () => [], options: () => ({}) }
);

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

// Internal nav handlers for the built-in arrows/dots/thumbs. These call the
// `any`-typed engine directly (NOT the $expose verbs scrollPrev/scrollNext/
// scrollToIndex, whose strict emitted signatures have a REQUIRED jump/index arg —
// invoking them arg-light from the template would trip TS2554 on the leaves).
// Internal nav handlers for the built-in arrows/dots/thumbs. These call the
// `any`-typed engine directly (NOT the $expose verbs scrollPrev/scrollNext/
// scrollToIndex, whose strict emitted signatures have a REQUIRED jump/index arg —
// invoking them arg-light from the template would trip TS2554 on the leaves).
const navPrev = () => {
  if (embla) embla.scrollPrev();
};
const navNext = () => {
  if (embla) embla.scrollNext();
};
const navTo = (i: any) => {
  if (embla) embla.scrollTo(i);
};

// Thumb click → scroll the MAIN carousel. Guarded by the thumb engine's
// clickAllowed() so a drag of the strip doesn't register as a click (the Embla
// thumbs idiom).
// Thumb click → scroll the MAIN carousel. Guarded by the thumb engine's
// clickAllowed() so a drag of the strip doesn't register as a click (the Embla
// thumbs idiom).
const selectThumb = (i: any) => {
  if (emblaThumbs && !emblaThumbs.clickAllowed()) return;
  navTo(i);
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
.rozie-embla__arrow:hover { background: #fff; }
.rozie-embla__arrow:disabled { opacity: 0.35; cursor: default; }
.rozie-embla__arrow--prev { left: 0.5rem; }
.rozie-embla__arrow--next { right: 0.5rem; }
.rozie-embla__dots {
  display: flex;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.625rem 0;
}
.rozie-embla__dot {
  width: 0.5rem;
  height: 0.5rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.rozie-embla__dot:hover { background: rgba(0, 0, 0, 0.45); }
.rozie-embla__dot.is-selected {
  background: #1a1a1a;
  transform: scale(1.25);
}
.rozie-embla__thumbs { margin-top: 0.5rem; }
.rozie-embla__thumbs-viewport { overflow: hidden; }
.rozie-embla__thumbs-container { display: flex; gap: 0.5rem; }
.rozie-embla__thumb {
  flex: 0 0 auto;
  cursor: pointer;
  opacity: 0.5;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  transition: opacity 0.15s ease, border-color 0.15s ease;
}
.rozie-embla__thumb:hover { opacity: 0.8; }
.rozie-embla__thumb.is-selected {
  opacity: 1;
  border-color: #1a1a1a;
}
</style>
