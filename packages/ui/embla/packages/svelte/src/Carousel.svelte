<script lang="ts">
import { applyListeners, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';
import { onMount, untrack } from 'svelte';

interface Props {
  slides?: any[];
  loop?: boolean;
  align?: string;
  axis?: string;
  slidesToScroll?: number;
  dragFree?: boolean;
  draggable?: boolean;
  containScroll?: string;
  startIndex?: number;
  skipSnaps?: boolean;
  duration?: number;
  direction?: string;
  autoplay?: boolean;
  autoplayDelay?: number;
  plugins?: any[];
  options?: any;
  selectedIndex?: number;
  slide?: Snippet<[{ slide: any; index: any }]>;
  children?: Snippet;
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
  plugins = __defaultPlugins,
  options = __defaultOptions,
  selectedIndex = $bindable(0),
  slide: __slideProp,
  children: __childrenProp,
  snippets,
  onselect,
  onsettle,
  onreinit,
  onpointerdown,
  ...__rozieAttrs
}: Props = $props();

const slide = $derived(__slideProp ?? snippets?.slide);
const children = $derived(__childrenProp ?? snippets?.children);

let viewportEl = $state<HTMLElement | undefined>(undefined);

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
// ─── imperative handle (Phase 21 $expose) — collision-suffix discipline ──────
// 9 verbs, each guarding the pre-mount/destroyed `embla = null`.
//  - reInitCarousel ≠ the `reInit` emit (ROZ121 expose-verb==emit collision).
//  - getSelectedIndex ≠ the `selectedIndex` model prop (ROZ524-class — avoids any
//    setter collision on Lit/Angular; it's a method, the prop is the two-way value).
//  - scrollToIndex ≠ the inherited DOM/LitElement `HTMLElement.scrollTo(x, y)`. A
//    bare `scrollTo` expose verb becomes a public method on the Lit custom-element
//    class and its `(index, jump)` signature is INCOMPATIBLE with the inherited
//    `Element.scrollTo` overloads (TS2416 → the whole class decorator fails to
//    resolve). This is a NEW collision class: expose-verb shadows an inherited DOM
//    method on the Lit target. Suffix it (the reInit→reInitCarousel discipline).
//  - scrollNext/scrollPrev/canScrollNext/canScrollPrev/scrollSnapList have no
//    matching prop, emit, or inherited DOM method — clear.
export function scrollNext(jump: any) {
  if (embla) embla.scrollNext(jump);
}
export function scrollPrev(jump: any) {
  if (embla) embla.scrollPrev(jump);
}
export function scrollToIndex(index: any, jump: any) {
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
export function getInstance() {
  return embla;
}

onMount(() => {
  embla = EmblaCarousel(viewportEl!, emblaOptionsFromProps(), emblaPluginsFromProps());

  // engine → consumer: on every snap change write the two-way model AND fire the
  // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`).
  embla.on('select', () => {
    const i = embla.selectedScrollSnap();
    selectedIndex = i;
    onselect?.(i);
  });
  embla.on('settle', () => onsettle?.());
  embla.on('reInit', () => onreinit?.());
  embla.on('pointerDown', () => onpointerdown?.());
  return () => embla?.destroy();
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
$effect(() => { (() => slides.length)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } (() => embla?.reInit(emblaOptionsFromProps()))(); }); });
</script>

<div {...__rozieAttrs} class={["rozie-embla", { 'rozie-embla--vertical': axis === 'y' }, (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-4143c216><div class="rozie-embla__viewport" bind:this={viewportEl} data-rozie-s-4143c216><div class="rozie-embla__container" data-rozie-s-4143c216>{#each slides as item, i (keyFor(item, i))}<div class="rozie-embla__slide" data-rozie-s-4143c216>{#if slide}{@render slide({ slide: item, index: i })}{:else}{rozieDisplay(item)}{/if}</div>{/each}{@render children?.()}</div></div></div>

<style>
:global {
  .rozie-embla[data-rozie-s-4143c216] { position: relative; }
  .rozie-embla__viewport[data-rozie-s-4143c216] { overflow: hidden; }
  .rozie-embla__container[data-rozie-s-4143c216] { display: flex; }
  .rozie-embla__slide[data-rozie-s-4143c216] { flex: 0 0 100%; min-width: 0; }
  .rozie-embla--vertical[data-rozie-s-4143c216] .rozie-embla__container[data-rozie-s-4143c216] { flex-direction: column; height: 100%; }
  .rozie-embla--vertical[data-rozie-s-4143c216] .rozie-embla__slide[data-rozie-s-4143c216] { flex: 0 0 100%; min-height: 0; }
}
</style>
