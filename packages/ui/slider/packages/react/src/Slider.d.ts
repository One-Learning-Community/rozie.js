import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface SliderProps {
  /**
   * The current value (two-way `r-model`). A scalar number in single mode; a sorted `[lo, hi]` array in `range` mode, with each thumb neighbour-clamped so the pair stays sorted on every commit. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Slider **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <Slider r-model:value="volume" :min="0" :max="100" :step="1" ariaLabel="Volume" />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (next: (unknown) | null) => void;
  /**
   * Switch to dual-thumb range mode: `value` becomes a sorted `[lo, hi]` array driven by two overlapping native inputs. The exact analog of listbox's `multiple` (scalar↔array). A bare attribute (`<Slider range>`) coerces to `true`.
   */
  range?: boolean;
  /**
   * The lower bound of the scale, forwarded to the native input as the `min` attribute (the browser derives `aria-valuemin` from it — not set by hand, per MDN slider-role guidance).
   */
  min?: number;
  /**
   * The upper bound of the scale, forwarded to the native input as the `max` attribute (the browser derives `aria-valuemax` from it — not set by hand, per MDN slider-role guidance).
   */
  max?: number;
  /**
   * The granularity of the scale, forwarded as the native `step` attribute; every write-back is quantized to it.
   */
  step?: number;
  /**
   * Layout orientation — `'horizontal'` (default) or `'vertical'`. Vertical rotates the wrapper `-90deg` so up = increase and sets `aria-orientation="vertical"` explicitly (a native range input always reports itself as horizontal even when visually rotated).
   */
  orientation?: string;
  /**
   * Disable the control — it becomes non-interactive and dimmed. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Tick marks over the track — either a bare `value[]` (positions only) or a `{ value, label }[]` (positioned and labelled). Rendered as a decorative overlay above the track; override per-mark rendering via the `mark` scoped slot (`{ value, label, position }`).
   */
  marks?: unknown[];
  /**
   * Accessible name for each native input when there is no visible `<label for>`, reflected onto the input's `aria-label`.
   */
  ariaLabel?: (string) | null;
  /**
   * The jump applied on `PageUp` / `PageDown`. `null` falls back to `step × 10`. Applied by a thin `@keydown` augment so it honours this value (native browsers otherwise use their own large step); arrows / `Home` / `End` stay native.
   */
  pageStep?: (number) | null;
  /**
   * A `(value) => string` formatter for the value shown in the `bubble` slot and surfaced as `aria-valuetext`. Receives the numeric value and returns a string; `null` uses the raw value.
   */
  formatValue?: ((...args: unknown[]) => unknown) | null;
  /**
   * Render the value-bubble overlay (one bubble per thumb in range mode). Headless and opt-in — there is no default-styled bubble; supply the `bubble` slot to control its appearance.
   */
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
