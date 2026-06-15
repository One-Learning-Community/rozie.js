<template>

<div :class="['rozie-embla', { 'rozie-embla--vertical': props.axis === 'y' }]" v-bind="$attrs">
  <div class="rozie-embla__viewport" ref="viewportElRef">
    <div class="rozie-embla__container">
      
      <div v-for="(item, i) in props.slides" :key="keyFor(item, i)" class="rozie-embla__slide">
        <slot name="slide" :slide="item" :index="i">{{ item }}</slot>
      </div>
      
      <slot></slot>
    </div>
  </div>
</div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ slides?: any[]; loop?: boolean; align?: string; axis?: string; slidesToScroll?: number; dragFree?: boolean; draggable?: boolean; containScroll?: string; startIndex?: number; skipSnaps?: boolean; duration?: number; direction?: string; autoplay?: boolean; autoplayDelay?: number; plugins?: any[]; options?: Record<string, any> }>(),
  { slides: () => [], loop: false, align: 'center', axis: 'x', slidesToScroll: 1, dragFree: false, draggable: true, containScroll: 'trimSnaps', startIndex: 0, skipSnaps: false, duration: 25, direction: 'ltr', autoplay: false, autoplayDelay: 4000, plugins: () => [], options: () => ({}) }
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
}>();

const viewportElRef = ref<HTMLElement>();

import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.
// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.
let embla: any = null;

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

  // engine → consumer: on every snap change write the two-way model AND fire the
  // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`).
  embla.on('select', () => {
    const i = embla.selectedScrollSnap();
    selectedIndex.value = i;
    emit('select', i);
  });
  embla.on('settle', () => emit('settle'));
  embla.on('reInit', () => emit('reInit'));
  embla.on('pointerDown', () => emit('pointer-down'));
  _cleanup_0 = () => embla?.destroy();
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => selectedIndex.value, (i: any) => {
  if (embla && typeof i === 'number' && i !== embla.selectedScrollSnap()) embla.scrollTo(i);
});
watch(() => [props.loop, props.align, props.axis, props.slidesToScroll, props.dragFree, props.draggable, props.containScroll, props.skipSnaps, props.duration, props.direction].join('|'), () => embla?.reInit(emblaOptionsFromProps()));
watch(() => `${props.autoplay}|${props.autoplayDelay}`, () => embla?.reInit(emblaOptionsFromProps(), emblaPluginsFromProps()));
watch(() => props.slides.length, () => embla?.reInit(emblaOptionsFromProps()));

defineExpose({ scrollNext, scrollPrev, scrollToIndex, reInitCarousel, canScrollNext, canScrollPrev, getSelectedIndex, scrollSnapList, scrollProgress, slidesInView, slidesNotInView, previousScrollSnap, getPlugins, getInstance });
</script>

<style scoped>
.rozie-embla { position: relative; }
.rozie-embla__viewport { overflow: hidden; }
.rozie-embla__container { display: flex; }
.rozie-embla__slide { flex: 0 0 100%; min-width: 0; }
.rozie-embla--vertical .rozie-embla__container { flex-direction: column; height: 100%; }
.rozie-embla--vertical .rozie-embla__slide { flex: 0 0 100%; min-height: 0; }
</style>
