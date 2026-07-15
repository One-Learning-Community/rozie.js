import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ListboxProps {
  /**
   * The option set. Each entry is either a primitive (`string`/`number`) or an object; objects resolve their label, value, and disabled state via the `option*` resolver props, falling back to `.label` / `.value` / `.disabled`.
   */
  options?: unknown[];
  /**
   * The selected value (two-way `r-model`) — a scalar in single-select, an array of values in multi-select. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Listbox **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <Listbox r-model:value="fruit" :options="fruits" />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (next: (unknown) | null) => void;
  /**
   * Enable multi-select: `value` becomes an array, selecting an option toggles its membership, and the popup stays open after each commit.
   */
  multiple?: boolean;
  /**
   * Render the results list in normal flow (static) rather than as an absolutely-positioned popup. Use when embedding the listbox inside an `overflow:hidden` container (e.g. a command palette) so the list is not clipped. Defaults `false` (standalone dropdown behavior).
   */
  inline?: boolean;
  /**
   * Disable the control entirely. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Placeholder text shown in the empty control.
   */
  placeholder?: string;
  /**
   * Close the popup after a single-select commit. Defaults `true`; multi-select keeps the popup open regardless of this setting.
   */
  closeOnSelect?: boolean;
  /**
   * Resolver override for an object option's display label — `(option) => string`. Falls back to the option's `.label` property.
   */
  optionLabel?: ((...args: any[]) => any) | null;
  /**
   * Resolver override for an object option's committed value — `(option) => value`. Falls back to the option's `.value` property.
   */
  optionValue?: ((...args: any[]) => any) | null;
  /**
   * Resolver override marking an option non-selectable — `(option) => boolean`. Falls back to the option's `.disabled` property.
   */
  optionDisabled?: ((...args: any[]) => any) | null;
  /**
   * Stable id base for the ARIA wiring (the listbox id, per-option ids, and `aria-activedescendant`). Give each instance on a page a distinct id so these references stay unique.
   */
  id?: string;
  /**
   * Accessible name for the control when there is no visible `<label for>` pointing at its `id` (`aria-label`).
   */
  ariaLabel?: (string) | null;
  /**
   * Opt-in vertical **option windowing** for long lists. When `true`, only the visible slice of options renders inside a bounded scrolling list (leading/trailing spacers preserve the total scroll height), windowing over the filtered option set. Default `false` is byte-identical to a non-windowed listbox. Pair with `inline` + `maxHeight` so the windowed scroll container is bounded.
   */
  virtual?: boolean;
  /**
   * Estimated option row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight?: number;
  /**
   * A CSS length string bounding the list scroll container when `virtual` is on (e.g. `'320px'`). Mirrored to the `--rozie-listbox-max-height` custom property; the prop wins, the token is the fallback. Ignored when `virtual` is off.
   */
  maxHeight?: string;
  onOpenChange?: (...args: unknown[]) => void;
  onChange?: (...args: unknown[]) => void;
  renderSelected?: (params: { selected: () => void; value: unknown }) => ReactNode;
  renderOption?: (params: { option: () => void; index: () => void; active: unknown; selected: unknown; disabled: unknown }) => ReactNode;
  renderEmpty?: (params: { query: unknown }) => ReactNode;
  renderOption?: (params: { option: unknown; index: unknown; active: unknown; selected: unknown; disabled: unknown }) => ReactNode;
  renderEmpty?: (params: { query: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ListboxHandle {
  open: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  focusControl: (...args: any[]) => any;
}

declare const Listbox: React.ForwardRefExoticComponent<ListboxProps & React.RefAttributes<ListboxHandle>>;
export default Listbox;
