import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface SliderProps {
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (next: (unknown) | null) => void;
  range?: boolean;
  min?: number;
  max?: number;
  step?: number;
  orientation?: string;
  disabled?: boolean;
  marks?: unknown[];
  ariaLabel?: (string) | null;
  pageStep?: (number) | null;
  formatValue?: ((...args: unknown[]) => unknown) | null;
  showValue?: boolean;
  onChange?: (...args: unknown[]) => void;
  renderMark?: (params: { value: unknown; label: unknown; position: unknown }) => ReactNode;
  renderBubble?: (params: { value: unknown }) => ReactNode;
  renderBubble?: (params: { value: unknown }) => ReactNode;
  renderBubble?: (params: { value: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface SliderHandle {
  focus: (...args: any[]) => any;
  increment: (...args: any[]) => any;
  decrement: (...args: any[]) => any;
}

declare const Slider: React.ForwardRefExoticComponent<SliderProps & React.RefAttributes<SliderHandle>>;
export default Slider;
