import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface CarouselProps {
  slides?: unknown[];
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
  plugins?: unknown[];
  options?: Record<string, unknown>;
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
