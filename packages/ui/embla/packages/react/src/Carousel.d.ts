import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface CarouselProps {
  /**
   * Slide data for config-array mode (mode a): Rozie renders one `.rozie-embla__slide` per item, optionally via the scoped `slide` slot for custom markup. Optional — leave it unset and use the default slot (mode b) to drop slide DOM directly.
   * @example
   * <Carousel :slides="['A', 'B', 'C']" r-model:selectedIndex="idx" />
   */
  slides?: unknown[];
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
  plugins?: unknown[];
  /**
   * Escape hatch — a raw `EmblaOptionsType` object spread last over the curated option props, so a consumer can override anything Embla supports.
   */
  options?: Record<string, unknown>;
  /**
   * The current scroll-snap index (two-way `r-model`). Dragging or scrolling writes the new index back (echo-guarded so a programmatic `scrollTo` does not ping-pong); a consumer write scrolls the carousel. Distinct from the `select` emit — a model prop must not share a name with an emit.
   * @example
   * <Carousel :slides="items" r-model:selectedIndex="idx" />
   */
  selectedIndex?: number;
  defaultSelectedIndex?: number;
  onSelectedIndexChange?: (next: number) => void;
  onSelect?: (...args: unknown[]) => void;
  onSettle?: (...args: unknown[]) => void;
  onReInit?: (...args: unknown[]) => void;
  onPointerDown?: (...args: unknown[]) => void;
  renderSlide?: (params: { slide: () => void; index: () => void }) => ReactNode;
  children?: ReactNode;
  renderThumb?: (params: { slide: () => void; index: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
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

declare const Carousel: React.ForwardRefExoticComponent<CarouselProps & React.RefAttributes<CarouselHandle>>;
export default Carousel;
