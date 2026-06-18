import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './Carousel.css';
import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

// Top-level null-let (untyped → auto type-neutralized to `any`; React hoists it to
// useRef cleanly). Do NOT annotate to a concrete EmblaCarouselType.

interface SlideCtx { slide: any; index: any; }

interface ThumbCtx { slide: any; index: any; }

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
  dots?: boolean;
  arrows?: boolean;
  thumbnails?: boolean;
  plugins?: any[];
  options?: Record<string, any>;
  selectedIndex?: number;
  defaultSelectedIndex?: number;
  onSelectedIndexChange?: (selectedIndex: number) => void;
  onSelect?: (...args: any[]) => void;
  onSettle?: (...args: any[]) => void;
  onReInit?: (...args: any[]) => void;
  onPointerDown?: (...args: any[]) => void;
  renderSlide?: (ctx: SlideCtx) => ReactNode;
  children?: ReactNode;
  renderThumb?: (ctx: ThumbCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
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

const Carousel = forwardRef<CarouselHandle, CarouselProps>(function Carousel(_props: CarouselProps, ref): JSX.Element {
  const __defaultSlides = useState(() => (() => [])())[0];
  const __defaultPlugins = useState(() => (() => [])())[0];
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<CarouselProps, 'slides' | 'loop' | 'align' | 'axis' | 'slidesToScroll' | 'dragFree' | 'draggable' | 'containScroll' | 'startIndex' | 'skipSnaps' | 'duration' | 'direction' | 'autoplay' | 'autoplayDelay' | 'dots' | 'arrows' | 'thumbnails' | 'plugins' | 'options'> & { slides: any[]; loop: boolean; align: string; axis: string; slidesToScroll: number; dragFree: boolean; draggable: boolean; containScroll: string; startIndex: number; skipSnaps: boolean; duration: number; direction: string; autoplay: boolean; autoplayDelay: number; dots: boolean; arrows: boolean; thumbnails: boolean; plugins: any[]; options: Record<string, any> } = {
    ..._props,
    slides: _props.slides ?? __defaultSlides,
    loop: _props.loop ?? false,
    align: _props.align ?? 'center',
    axis: _props.axis ?? 'x',
    slidesToScroll: _props.slidesToScroll ?? 1,
    dragFree: _props.dragFree ?? false,
    draggable: _props.draggable ?? true,
    containScroll: _props.containScroll ?? 'trimSnaps',
    startIndex: _props.startIndex ?? 0,
    skipSnaps: _props.skipSnaps ?? false,
    duration: _props.duration ?? 25,
    direction: _props.direction ?? 'ltr',
    autoplay: _props.autoplay ?? false,
    autoplayDelay: _props.autoplayDelay ?? 4000,
    dots: _props.dots ?? false,
    arrows: _props.arrows ?? false,
    thumbnails: _props.thumbnails ?? false,
    plugins: _props.plugins ?? __defaultPlugins,
    options: _props.options ?? __defaultOptions,
  };
  const attrs: Record<string, unknown> = (() => {
    const { slides, loop, align, axis, slidesToScroll, dragFree, draggable, containScroll, startIndex, skipSnaps, duration, direction, autoplay, autoplayDelay, dots, arrows, thumbnails, plugins, options, selectedIndex, defaultValue, onSelectedIndexChange, defaultSelectedIndex, ...rest } = _props as CarouselProps & Record<string, unknown>;
    void slides; void loop; void align; void axis; void slidesToScroll; void dragFree; void draggable; void containScroll; void startIndex; void skipSnaps; void duration; void direction; void autoplay; void autoplayDelay; void dots; void arrows; void thumbnails; void plugins; void options; void selectedIndex; void defaultValue; void onSelectedIndexChange; void defaultSelectedIndex;
    return rest;
  })();
  const embla = useRef<any>(null);
  const emblaThumbs = useRef<any>(null);
  const [selectedIndex, setSelectedIndex] = useControllableState({
    value: props.selectedIndex,
    defaultValue: props.defaultSelectedIndex ?? 0,
    onValueChange: props.onSelectedIndexChange,
  });
  const _thumbnailsRef = useRef(props.thumbnails);
  _thumbnailsRef.current = props.thumbnails;
  const [snaps, setSnaps] = useState<any[]>([]);
  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const viewportEl = useRef<HTMLDivElement | null>(null);
  const thumbsViewportEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);

  function keyFor(slide: any, i: any) {
    if (slide !== null && typeof slide === 'object') return slide.id ?? slide.key ?? i;
    return slide ?? i;
  }
  const emblaOptionsFromProps = useCallback(() => {
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
  }, [props.align, props.axis, props.containScroll, props.direction, props.dragFree, props.draggable, props.duration, props.loop, props.options, props.skipSnaps, props.slidesToScroll, props.startIndex]);
  const emblaPluginsFromProps = useCallback(() => {
    const builtins = props.autoplay ? [Autoplay({
      delay: props.autoplayDelay
    })] : [];
    return [...builtins, ...props.plugins];
  }, [props.autoplay, props.autoplayDelay, props.plugins]);
  const thumbsOptionsFromProps = useCallback(() => {
    let opts: any = null;
    opts = {
      containScroll: 'keepSnaps',
      dragFree: true,
      axis: props.axis
    };
    return opts;
  }, [props.axis]);
  const syncNav = useCallback(() => {
    if (!embla.current) return;
    const i = embla.current.selectedScrollSnap();
    setSnaps(embla.current.scrollSnapList().map((_: any, n: any) => n));
    setSelected(i);
    setCanPrev(embla.current.canScrollPrev());
    setCanNext(embla.current.canScrollNext());
    if (emblaThumbs.current) emblaThumbs.current.scrollTo(i);
  }, []);
  const navPrev = useCallback(() => {
    if (embla.current) embla.current.scrollPrev();
  }, []);
  const navNext = useCallback(() => {
    if (embla.current) embla.current.scrollNext();
  }, []);
  const navTo = useCallback((i: any) => {
    if (embla.current) embla.current.scrollTo(i);
  }, []);
  const selectThumb = useCallback((i: any) => {
    if (emblaThumbs.current && !emblaThumbs.current.clickAllowed()) return;
    navTo(i);
  }, [navTo]);
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
    if (embla.current) embla.current.scrollNext(jump);
  }
  function scrollPrev(jump: any) {
    if (embla.current) embla.current.scrollPrev(jump);
  }
  function scrollToIndex(index: any, jump: any) {
    if (embla.current) embla.current.scrollTo(index, jump);
  }
  function reInitCarousel(opts: any) {
    if (embla.current) embla.current.reInit(opts ?? emblaOptionsFromProps(), emblaPluginsFromProps());
  }
  function canScrollNext() {
    return embla.current ? embla.current.canScrollNext() : false;
  }
  function canScrollPrev() {
    return embla.current ? embla.current.canScrollPrev() : false;
  }
  function getSelectedIndex() {
    return embla.current ? embla.current.selectedScrollSnap() : 0;
  }
  function scrollSnapList() {
    return embla.current ? embla.current.scrollSnapList() : [];
  }
  function scrollProgress() {
    return embla.current ? embla.current.scrollProgress() : 0;
  }
  function slidesInView() {
    return embla.current ? embla.current.slidesInView() : [];
  }
  function slidesNotInView() {
    return embla.current ? embla.current.slidesNotInView() : [];
  }
  function previousScrollSnap() {
    return embla.current ? embla.current.previousScrollSnap() : 0;
  }
  function getPlugins() {
    return embla.current ? embla.current.plugins() : null;
  }
  function getInstance() {
    return embla.current;
  }

  useEffect(() => {
    embla.current = EmblaCarousel(viewportEl.current!, emblaOptionsFromProps(), emblaPluginsFromProps());

    // Build the thumbnail strip's own Embla instance when enabled. $refs.thumbsViewportEl
    // exists exactly when the `thumbnails` r-if has rendered (read here in $onMount, the
    // only $refs-safe site). Stays null otherwise (zero overhead).
    if (_thumbnailsRef.current && thumbsViewportEl.current) {
      emblaThumbs.current = EmblaCarousel(thumbsViewportEl.current!, thumbsOptionsFromProps());
    }

    // engine → consumer: on every snap change write the two-way model AND fire the
    // distinctly-named `select` emit (model `selectedIndex` ≠ emit `select`). syncNav
    // refreshes the built-in dots/arrows + thumb sync.
    embla.current.on('select', () => {
      const i = embla.current.selectedScrollSnap();
      setSelectedIndex(i);
      props.onSelect && props.onSelect(i);
      syncNav();
    });
    embla.current.on('settle', () => props.onSettle && props.onSettle());
    embla.current.on('reInit', () => {
      props.onReInit && props.onReInit();
      syncNav();
    });
    embla.current.on('pointerDown', () => props.onPointerDown && props.onPointerDown());
    // Embla caches SLIDE sizes at init. If a slide's CSS (or a root width applied via
    // attribute fallthrough) settles a frame after $onMount, the snap COUNT measured
    // at init is stale — and a slide-size change (vs a viewport resize or slide
    // add/remove) fires neither `resize` nor `reInit`, so Embla never re-measures on
    // its own. Re-measure once after the first layout flush via reInit (its `reInit`
    // handler resyncs the dot count); `resize` keeps the viewport-resize case covered.
    embla.current.on('resize', () => syncNav());

    // seed the nav state immediately (covers the already-laid-out case)…
    syncNav();
    // …then re-measure after layout fully settles (a consumer's slide CSS / a root
    // width via attribute fallthrough can land a couple of frames after $onMount;
    // Embla caches slide sizes at init and a slide-size change alone fires no
    // re-measure). Two rAFs out, then a macrotask, each reInit → its handler resyncs
    // the dot count. Idempotent: a reInit on already-correct sizes is a no-op diff.
    if (typeof requestAnimationFrame === 'function') {
      const remeasure = () => {
        if (embla.current) embla.current.reInit(emblaOptionsFromProps(), emblaPluginsFromProps());
      };
      requestAnimationFrame(() => requestAnimationFrame(remeasure));
      setTimeout(remeasure, 0);
    }
    return () => {
      embla.current?.destroy();
      emblaThumbs.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const i = selectedIndex;
    if (embla.current && typeof i === 'number' && i !== embla.current.selectedScrollSnap()) embla.current.scrollTo(i);
  }, [selectedIndex]);
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    embla.current?.reInit(emblaOptionsFromProps());
  }, [props.align, props.axis, props.containScroll, props.direction, props.dragFree, props.draggable, props.duration, props.loop, props.skipSnaps, props.slidesToScroll]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    embla.current?.reInit(emblaOptionsFromProps(), emblaPluginsFromProps());
  }, [props.autoplay, props.autoplayDelay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    embla.current?.reInit(emblaOptionsFromProps());
    emblaThumbs.current?.reInit(thumbsOptionsFromProps());
    syncNav();
  }, [props.slides]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const on = props.thumbnails;
    if (on && !emblaThumbs.current && thumbsViewportEl.current) {
      emblaThumbs.current = EmblaCarousel(thumbsViewportEl.current!, thumbsOptionsFromProps());
      syncNav();
    } else if (!on && emblaThumbs.current) {
      emblaThumbs.current.destroy();
      emblaThumbs.current = null;
    }
  }, [props.thumbnails]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ scrollNext, scrollPrev, scrollToIndex, reInitCarousel, canScrollNext, canScrollPrev, getSelectedIndex, scrollSnapList, scrollProgress, slidesInView, slidesNotInView, previousScrollSnap, getPlugins, getInstance });
  _rozieExposeRef.current = { scrollNext, scrollPrev, scrollToIndex, reInitCarousel, canScrollNext, canScrollPrev, getSelectedIndex, scrollSnapList, scrollProgress, slidesInView, slidesNotInView, previousScrollSnap, getPlugins, getInstance };
  useImperativeHandle(ref, () => ({ scrollNext: (...args: Parameters<typeof scrollNext>): ReturnType<typeof scrollNext> => _rozieExposeRef.current.scrollNext(...args), scrollPrev: (...args: Parameters<typeof scrollPrev>): ReturnType<typeof scrollPrev> => _rozieExposeRef.current.scrollPrev(...args), scrollToIndex: (...args: Parameters<typeof scrollToIndex>): ReturnType<typeof scrollToIndex> => _rozieExposeRef.current.scrollToIndex(...args), reInitCarousel: (...args: Parameters<typeof reInitCarousel>): ReturnType<typeof reInitCarousel> => _rozieExposeRef.current.reInitCarousel(...args), canScrollNext: (...args: Parameters<typeof canScrollNext>): ReturnType<typeof canScrollNext> => _rozieExposeRef.current.canScrollNext(...args), canScrollPrev: (...args: Parameters<typeof canScrollPrev>): ReturnType<typeof canScrollPrev> => _rozieExposeRef.current.canScrollPrev(...args), getSelectedIndex: (...args: Parameters<typeof getSelectedIndex>): ReturnType<typeof getSelectedIndex> => _rozieExposeRef.current.getSelectedIndex(...args), scrollSnapList: (...args: Parameters<typeof scrollSnapList>): ReturnType<typeof scrollSnapList> => _rozieExposeRef.current.scrollSnapList(...args), scrollProgress: (...args: Parameters<typeof scrollProgress>): ReturnType<typeof scrollProgress> => _rozieExposeRef.current.scrollProgress(...args), slidesInView: (...args: Parameters<typeof slidesInView>): ReturnType<typeof slidesInView> => _rozieExposeRef.current.slidesInView(...args), slidesNotInView: (...args: Parameters<typeof slidesNotInView>): ReturnType<typeof slidesNotInView> => _rozieExposeRef.current.slidesNotInView(...args), previousScrollSnap: (...args: Parameters<typeof previousScrollSnap>): ReturnType<typeof previousScrollSnap> => _rozieExposeRef.current.previousScrollSnap(...args), getPlugins: (...args: Parameters<typeof getPlugins>): ReturnType<typeof getPlugins> => _rozieExposeRef.current.getPlugins(...args), getInstance: (...args: Parameters<typeof getInstance>): ReturnType<typeof getInstance> => _rozieExposeRef.current.getInstance(...args) }), []);

  return (
    <>
    <div {...attrs} className={clsx(clsx("rozie-embla", { "rozie-embla--vertical": props.axis === 'y' }), (attrs.className as string | undefined))} data-rozie-s-4143c216="">
      
      <div className={"rozie-embla__stage"} data-rozie-s-4143c216="">
        {(props.arrows) && <button type="button" className={"rozie-embla__arrow rozie-embla__arrow--prev"} disabled={!canPrev} aria-label="Previous slide" onClick={($event) => { navPrev(); }} data-rozie-s-4143c216="">‹</button>}<div className={"rozie-embla__viewport"} ref={viewportEl} data-rozie-s-4143c216="">
          <div className={"rozie-embla__container"} data-rozie-s-4143c216="">
            
            {props.slides.map((item, i) => <div key={keyFor(item, i)} className={"rozie-embla__slide"} data-rozie-s-4143c216="">
              {(props.renderSlide ?? props.slots?.['slide']) ? ((props.renderSlide ?? props.slots?.['slide']) as Function)({ slide: item, index: i }) : rozieDisplay(item)}
            </div>)}
            
            {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
          </div>
        </div>
        {(props.arrows) && <button type="button" className={"rozie-embla__arrow rozie-embla__arrow--next"} disabled={!canNext} aria-label="Next slide" onClick={($event) => { navNext(); }} data-rozie-s-4143c216="">›</button>}</div>

      
      {(props.dots) && <div className={"rozie-embla__dots"} data-rozie-s-4143c216="">
        {snaps.map((di) => <button key={di} type="button" className={clsx("rozie-embla__dot", { "is-selected": di === selected })} aria-label={rozieAttr('Go to slide ' + (di + 1))} onClick={($event) => { navTo(di); }} data-rozie-s-4143c216="" />)}
      </div>}{(props.thumbnails) && <div className={"rozie-embla__thumbs"} data-rozie-s-4143c216="">
        <div className={"rozie-embla__thumbs-viewport"} ref={thumbsViewportEl} data-rozie-s-4143c216="">
          <div className={"rozie-embla__thumbs-container"} data-rozie-s-4143c216="">
            {props.slides.map((item, i) => <div key={keyFor(item, i)} className={clsx("rozie-embla__thumb", { "is-selected": i === selected })} onClick={($event) => { selectThumb(i); }} data-rozie-s-4143c216="">
              {(props.renderThumb ?? props.slots?.['thumb']) ? ((props.renderThumb ?? props.slots?.['thumb']) as Function)({ slide: item, index: i }) : rozieDisplay(item)}
            </div>)}
          </div>
        </div>
      </div>}</div>
    </>
  );
});
export default Carousel;
