import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface NumberFieldProps {
  /**
   * The numeric value of the field (two-way `r-model`). `null` means the field is empty. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a number field **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). The value is clamped to `[min, max]` and snapped to `step` on every commit.
   * @example
   * <NumberField r-model:modelValue="qty" :min="0" :max="10" />
   */
  modelValue?: (number) | null;
  defaultModelValue?: (number) | null;
  onModelValueChange?: (next: (number) | null) => void;
  /**
   * Inclusive lower bound. Every commit clamps the value to `>= min`, and the **Home** key jumps to `min`. `null` (the default) means no lower bound. Also emitted as `aria-valuemin`.
   */
  min?: (number) | null;
  /**
   * Inclusive upper bound. Every commit clamps the value to `<= max`, and the **End** key jumps to `max`. `null` (the default) means no upper bound. Also emitted as `aria-valuemax`.
   */
  max?: (number) | null;
  /**
   * The increment/decrement granularity. **ArrowUp** / **ArrowDown** and the +/- buttons change the value by `step`, and every commit snaps the value to the nearest multiple of `step` measured from `min` (or `0` when `min` is `null`).
   */
  step?: number;
  /**
   * The coarse step applied by **PageUp** / **PageDown**, for fast traversal of a wide range.
   */
  largeStep?: number;
  /**
   * Options forwarded to `Intl.NumberFormat` for locale-aware **display** formatting (e.g. `{ style: "currency", currency: "USD" }` or `{ minimumFractionDigits: 2 }`). The displayed text is formatted while the field is unfocused; on commit the formatting is stripped back off and the raw number is parsed.
   * @example
   * :formatOptions="{ style: 'currency', currency: 'USD' }"
   */
  formatOptions?: Record<string, unknown>;
  /**
   * Opt in to **scrub-on-drag**: press and drag horizontally on the field to change the value by `step` per few pixels (a power-user affordance). Off by default.
   */
  allowScrub?: boolean;
  /**
   * Disable the whole control — the input, both steppers, the keyboard, and scrubbing. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Make the field read-only — the value is shown and focusable but cannot be changed by typing, the steppers, the keyboard, or scrubbing.
   */
  readonly?: boolean;
  /**
   * Accessible name applied to the `role="spinbutton"` input (`aria-label`). Provide this (or an external `<label>`) so the control is announced.
   */
  ariaLabel?: (string) | null;
  onChange?: (...args: unknown[]) => void;
}

export interface NumberFieldHandle {
  focus: (...args: any[]) => any;
  increment: (...args: any[]) => any;
  decrement: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

declare const NumberField: React.ForwardRefExoticComponent<NumberFieldProps & React.RefAttributes<NumberFieldHandle>>;
export default NumberField;
