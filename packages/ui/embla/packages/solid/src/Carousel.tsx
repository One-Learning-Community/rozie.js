import type { JSX } from 'solid-js';
import { For, children, createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieDisplay } from '@rozie/runtime-solid';
import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.

__rozieInjectStyle('Carousel-4143c216', `.rozie-embla[data-rozie-s-4143c216] { position: relative; }
.rozie-embla__viewport[data-rozie-s-4143c216] { overflow: hidden; }
.rozie-embla__container[data-rozie-s-4143c216] { display: flex; }
.rozie-embla__slide[data-rozie-s-4143c216] { flex: 0 0 100%; min-width: 0; }
.rozie-embla--vertical[data-rozie-s-4143c216] .rozie-embla__container[data-rozie-s-4143c216] { flex-direction: column; height: 100%; }
.rozie-embla--vertical[data-rozie-s-4143c216] .rozie-embla__slide[data-rozie-s-4143c216] { flex: 0 0 100%; min-height: 0; }`);

interface SlideSlotCtx { slide: any; index: any; }

interface CarouselProps {
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
  options?: Record<string, any>;
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
  getInstance: (...args: any[]) => any;
}

export default function Carousel(_props: CarouselProps): JSX.Element {
  const _merged = mergeProps({ slides: (() => [])(), loop: false, align: 'center', axis: 'x', slidesToScroll: 1, dragFree: false, draggable: true, containScroll: 'trimSnaps', startIndex: 0, skipSnaps: false, duration: 25, direction: 'ltr', autoplay: false, autoplayDelay: 4000, plugins: (() => [])(), options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['slides', 'loop', 'align', 'axis', 'slidesToScroll', 'dragFree', 'draggable', 'containScroll', 'startIndex', 'skipSnaps', 'duration', 'direction', 'autoplay', 'autoplayDelay', 'plugins', 'options', 'selectedIndex', 'children', 'ref']);
  const resolved = children(() => local.children);
  onMount(() => { local.ref?.({ scrollNext, scrollPrev, scrollToIndex, reInitCarousel, canScrollNext, canScrollPrev, getSelectedIndex, scrollSnapList, getInstance }); });

  const [selectedIndex, setSelectedIndex] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'selectedIndex', 0);
  onMount(() => {
    const _cleanup = (() => {
    embla = EmblaCarousel(viewportElRef, emblaOptionsFromProps(), emblaPluginsFromProps());

    // engine → consumer: on every snap change write the two-way model AND fire the
    // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`).
    embla.on('select', () => {
      const i = embla.selectedScrollSnap();
      setSelectedIndex(i);
      _props.onSelect?.(i);
    });
    embla.on('settle', () => _props.onSettle?.());
    embla.on('reInit', () => _props.onReInit?.());
    embla.on('pointerDown', () => _props.onPointerDown?.());
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => embla?.destroy());
  });
  createEffect(on(() => (() => selectedIndex())(), (v) => untrack(() => ((i: any) => {
    if (embla && typeof i === 'number' && i !== embla.selectedScrollSnap()) embla.scrollTo(i);
  })(v)), { defer: true }));
  createEffect(on(() => (() => [local.loop, local.align, local.axis, local.slidesToScroll, local.dragFree, local.draggable, local.containScroll, local.skipSnaps, local.duration, local.direction].join('|'))(), (v) => untrack(() => (() => embla?.reInit(emblaOptionsFromProps()))()), { defer: true }));
  createEffect(on(() => (() => `${local.autoplay}|${local.autoplayDelay}`)(), (v) => untrack(() => (() => embla?.reInit(emblaOptionsFromProps(), emblaPluginsFromProps()))()), { defer: true }));
  createEffect(on(() => (() => local.slides.length)(), (v) => untrack(() => (() => embla?.reInit(emblaOptionsFromProps()))()), { defer: true }));
  let viewportElRef: HTMLElement | null = null;

  // Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
  // useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.
  let embla: any = null;

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
  function getInstance() {
    return embla;
  }

  return (
    <>
    <div classList={{ 'rozie-embla--vertical': local.axis === 'y' }} {...attrs} class={"rozie-embla" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-4143c216="">
      <div class={"rozie-embla__viewport"} ref={(el) => { viewportElRef = el as HTMLElement; }} data-rozie-s-4143c216="">
        <div class={"rozie-embla__container"} data-rozie-s-4143c216="">
          
          <For each={local.slides}>{(item, i) => <div class={"rozie-embla__slide"} data-rozie-s-4143c216="">
            {(_props.slideSlot ?? _props.slots?.['slide'])?.({ slide: item, index: i() }) ?? rozieDisplay(item)}
          </div>}</For>
          
          {resolved()}
        </div>
      </div>
    </div>
    </>
  );
}
